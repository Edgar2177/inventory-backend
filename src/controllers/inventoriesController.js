const pool = require('../config/database');

// Obtener todos los inventarios
const getAllInventories = async (req, res) => {
  try {
    const { storeId } = req.query;

    let query = `
      SELECT 
        i.id_inventories,
        i.inventory_type,
        i.inventory_date,
        i.status,
        i.total_ws_value,
        i.total_rt_value,
        i.created_at,
        s.store_name,
        COUNT(ii.id_inventory_item) as total_products
      FROM inventories i
      INNER JOIN stores s ON i.id_store = s.id_stores
      LEFT JOIN inventory_items ii ON i.id_inventories = ii.id_inventory
      WHERE 1=1
    `;

    const params = [];

    if (storeId) {
      query += ' AND i.id_store = ?';
      params.push(storeId);
    }

    query += ' GROUP BY i.id_inventories ORDER BY i.inventory_date DESC';

    const [inventories] = await pool.execute(query, params);

    res.json({
      success: true,
      data: inventories
    });
  } catch (error) {
    console.error('Error al obtener inventarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los inventarios',
      error: error.message
    });
  }
};

// Obtener un inventario por ID con sus items
const getInventoryById = async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener datos del inventario
    const [inventory] = await pool.execute(
      `SELECT 
        i.*,
        s.store_name
      FROM inventories i
      INNER JOIN stores s ON i.id_store = s.id_stores
      WHERE i.id_inventories = ?`,
      [id]
    );

    if (inventory.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inventario no encontrado'
      });
    }

    // Obtener items del inventario
    const [items] = await pool.execute(
      `SELECT 
        ii.*,
        p.product_name,
        p.container_type,
        p.container_size,
        p.container_unit,
        p.case_size,
        l.location_name
      FROM inventory_items ii
      INNER JOIN products p ON ii.id_product = p.id_products
      LEFT JOIN locations l ON ii.id_location = l.id_locations
      WHERE ii.id_inventory = ?
      ORDER BY p.product_name`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...inventory[0],
        items
      }
    });
  } catch (error) {
    console.error('Error al obtener inventario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el inventario',
      error: error.message
    });
  }
};

// Crear nuevo inventario
const createInventory = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { storeId, inventoryDate, items } = req.body;

    // Validaciones
    if (!storeId || !inventoryDate || !items || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'La tienda, fecha y al menos un producto son requeridos'
      });
    }

    // Crear el inventario
    const [result] = await connection.execute(
      `INSERT INTO inventories (
        id_store,
        inventory_type,
        inventory_date,
        status,
        total_ws_value,
        total_rt_value
      ) VALUES (?, 'Standard', ?, 'Unlocked', 0, 0)`,
      [storeId, inventoryDate]
    );

    const inventoryId = result.insertId;

    // Insertar items del inventario
    let totalWsValue = 0;
    let totalRtValue = 0;

    for (const item of items) {
      const wsValue = parseFloat(item.wholesaleValue) || 0;
      const rtValue = parseFloat(item.retailValue) || 0;

      await connection.execute(
        `INSERT INTO inventory_items (
          id_inventory,
          id_product,
          id_location,
          quantity_type,
          quantity,
          case_size,
          weight_oz,
          wholesale_value,
          retail_value
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          inventoryId,
          item.productId,
          item.locationId || null,
          item.quantityType,
          item.quantity,
          item.caseSize || null,
          item.weightOz || null,
          wsValue,
          rtValue
        ]
      );

      totalWsValue += wsValue;
      totalRtValue += rtValue;
    }

    // Actualizar totales
    await connection.execute(
      `UPDATE inventories 
       SET total_ws_value = ?, total_rt_value = ?
       WHERE id_inventories = ?`,
      [totalWsValue, totalRtValue, inventoryId]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Inventario creado exitosamente',
      data: { id: inventoryId }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error al crear inventario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear el inventario',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// Actualizar inventario
const updateInventory = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { inventoryDate, items } = req.body;

    // Verificar que el inventario existe y está desbloqueado
    const [inventory] = await connection.execute(
      'SELECT status FROM inventories WHERE id_inventories = ?',
      [id]
    );

    if (inventory.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Inventario no encontrado'
      });
    }

    if (inventory[0].status === 'Locked') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'No se puede editar un inventario bloqueado'
      });
    }

    // Actualizar fecha si se proporciona
    if (inventoryDate) {
      await connection.execute(
        'UPDATE inventories SET inventory_date = ? WHERE id_inventories = ?',
        [inventoryDate, id]
      );
    }

    // Si hay items, eliminar los existentes y crear nuevos
    if (items && items.length > 0) {
      await connection.execute(
        'DELETE FROM inventory_items WHERE id_inventory = ?',
        [id]
      );

      let totalWsValue = 0;
      let totalRtValue = 0;

      for (const item of items) {
        const wsValue = parseFloat(item.wholesaleValue) || 0;
        const rtValue = parseFloat(item.retailValue) || 0;

        await connection.execute(
          `INSERT INTO inventory_items (
            id_inventory,
            id_product,
            id_location,
            quantity_type,
            quantity,
            case_size,
            weight_oz,
            wholesale_value,
            retail_value
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            item.productId,
            item.locationId || null,
            item.quantityType,
            item.quantity,
            item.caseSize || null,
            item.weightOz || null,
            wsValue,
            rtValue
          ]
        );

        totalWsValue += wsValue;
        totalRtValue += rtValue;
      }

      await connection.execute(
        `UPDATE inventories 
         SET total_ws_value = ?, total_rt_value = ?
         WHERE id_inventories = ?`,
        [totalWsValue, totalRtValue, id]
      );
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Inventario actualizado exitosamente'
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error al actualizar inventario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el inventario',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// Eliminar inventario
const deleteInventory = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el inventario existe
    const [inventory] = await pool.execute(
      'SELECT status FROM inventories WHERE id_inventories = ?',
      [id]
    );

    if (inventory.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inventario no encontrado'
      });
    }

    if (inventory[0].status === 'Locked') {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar un inventario bloqueado'
      });
    }

    // Eliminar (los items se eliminan por CASCADE)
    await pool.execute('DELETE FROM inventories WHERE id_inventories = ?', [id]);

    res.json({
      success: true,
      message: 'Inventario eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar inventario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el inventario',
      error: error.message
    });
  }
};

// Bloquear/Desbloquear inventario
const toggleLockInventory = async (req, res) => {
  try {
    const { id } = req.params;

    const [inventory] = await pool.execute(
      'SELECT status FROM inventories WHERE id_inventories = ?',
      [id]
    );

    if (inventory.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inventario no encontrado'
      });
    }

    const newStatus = inventory[0].status === 'Locked' ? 'Unlocked' : 'Locked';

    await pool.execute(
      'UPDATE inventories SET status = ? WHERE id_inventories = ?',
      [newStatus, id]
    );

    res.json({
      success: true,
      message: `Inventario ${newStatus === 'Locked' ? 'bloqueado' : 'desbloqueado'} exitosamente`,
      data: { status: newStatus }
    });
  } catch (error) {
    console.error('Error al cambiar estado del inventario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el estado del inventario',
      error: error.message
    });
  }
};

// ✅ EXPORTAR AL FINAL
module.exports = {
  getAllInventories,
  getInventoryById,
  createInventory,
  updateInventory,
  deleteInventory,
  toggleLockInventory
};