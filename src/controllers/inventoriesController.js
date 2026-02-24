const pool = require('../config/database');

// ========================================
// FUNCIONES AUXILIARES
// ========================================

const checkActiveInventory = async (locationId, excludeInventoryId = null) => {
  let query = `
    SELECT id_inventories 
    FROM inventories 
    WHERE id_location = ? AND (status = 'Unlocked' OR status = 'Unlocked')
  `;
  const params = [locationId];
  if (excludeInventoryId) {
    query += ' AND id_inventories != ?';
    params.push(excludeInventoryId);
  }
  const [result] = await pool.execute(query, params);
  return result.length > 0 ? result[0].id_inventories : null;
};

const getLastInventoryOrder = async (locationId) => {
  const [result] = await pool.execute(
    `SELECT ii.id_product, ii.display_order
     FROM inventory_items ii
     INNER JOIN inventories i ON ii.id_inventory = i.id_inventories
     WHERE i.id_location = ?
       AND i.id_inventories = (
         SELECT MAX(id_inventories) FROM inventories WHERE id_location = ?
       )
     ORDER BY ii.display_order`,
    [locationId, locationId]
  );
  return result;
};

const calculateNetWeight = async (connection, productId, itemFullWeight, itemEmptyWeight) => {
  let fullWeight = itemFullWeight ? parseFloat(itemFullWeight) : null;
  let emptyWeight = itemEmptyWeight ? parseFloat(itemEmptyWeight) : null;

  if (!fullWeight || !emptyWeight) {
    const [product] = await connection.execute(
      `SELECT full_weight, empty_weight FROM products WHERE id_products = ?`,
      [productId]
    );
    if (product.length > 0) {
      fullWeight = fullWeight || parseFloat(product[0].full_weight) || null;
      emptyWeight = emptyWeight || parseFloat(product[0].empty_weight) || null;
    }
  }

  if (fullWeight && emptyWeight && fullWeight > emptyWeight) {
    return { fullWeight, emptyWeight, netWeight: fullWeight - emptyWeight };
  }

  return { fullWeight: fullWeight || null, emptyWeight: emptyWeight || null, netWeight: null };
};

// Validar items — solo cantidad obligatoria, wholesale se calcula en el frontend
const validateInventoryItems = (items) => {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.quantity || parseFloat(item.quantity) <= 0) {
      return {
        valid: false,
        message: `La cantidad debe ser mayor a 0 para ${item.productName || 'producto ' + (i + 1)}`
      };
    }
  }
  return { valid: true };
};

// ========================================
// CONTROLADORES
// ========================================

const getAllInventories = async (req, res) => {
  try {
    const { storeId } = req.query;

    let query = `
      SELECT 
        i.id_inventories,
        i.inventory_type,
        i.inventory_date,
        i.status,
        i.id_location,
        l.location_name,
        i.total_ws_value,
        
        i.total_losses_value,
        i.created_at,
        s.store_name,
        COUNT(DISTINCT ii.id_inventory_item) as total_products,
        COUNT(DISTINCT il.id_inventory_loss) as total_losses
      FROM inventories i
      INNER JOIN stores s ON i.id_store = s.id_stores
      LEFT JOIN locations l ON i.id_location = l.id_locations
      LEFT JOIN inventory_items ii ON i.id_inventories = ii.id_inventory
      LEFT JOIN inventory_losses il ON i.id_inventories = il.id_inventory
      WHERE 1=1
    `;

    const params = [];
    if (storeId) {
      query += ' AND i.id_store = ?';
      params.push(storeId);
    }
    query += ' GROUP BY i.id_inventories ORDER BY i.inventory_date DESC';

    const [inventories] = await pool.execute(query, params);
    res.json({ success: true, data: inventories });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener los inventarios', error: error.message });
  }
};

const getInventoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const [inventory] = await pool.execute(
      `SELECT i.*, s.store_name, l.location_name
       FROM inventories i
       INNER JOIN stores s ON i.id_store = s.id_stores
       LEFT JOIN locations l ON i.id_location = l.id_locations
       WHERE i.id_inventories = ?`,
      [id]
    );

    if (inventory.length === 0) {
      return res.status(404).json({ success: false, message: 'Inventario no encontrado' });
    }

    const [items] = await pool.execute(
      `SELECT 
        ii.*,
        p.product_name,
        p.product_code,
        p.container_type,
        p.container_size,
        p.container_unit,
        p.case_size,
        p.full_weight as product_full_weight,
        p.empty_weight as product_empty_weight,
        p.wholesale_price,
        l.location_name
       FROM inventory_items ii
       INNER JOIN products p ON ii.id_product = p.id_products
       LEFT JOIN locations l ON ii.id_location = l.id_locations
       WHERE ii.id_inventory = ?
       ORDER BY ii.display_order ASC, p.product_name`,
      [id]
    );

    const [losses] = await pool.execute(
      `SELECT il.*, p.product_name, p.product_code
       FROM inventory_losses il
       INNER JOIN products p ON il.id_product = p.id_products
       WHERE il.id_inventory = ?
       ORDER BY il.created_at DESC`,
      [id]
    );

    res.json({ success: true, data: { ...inventory[0], items, losses } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener el inventario', error: error.message });
  }
};

const getAvailableProducts = async (req, res) => {
  try {
    const { storeId } = req.query;
    if (!storeId) {
      return res.status(400).json({ success: false, message: 'storeId es requerido' });
    }

    const [products] = await pool.execute(
      `SELECT 
        p.id_products as id,
        p.product_name as name,
        p.product_code,
        p.container_type,
        p.container_size,
        p.container_unit,
        p.container_size_base_unit,
        p.container_size_base_unit_type,
        p.case_size,
        p.wholesale_price,
        p.full_weight,
        p.empty_weight,
        p.full_weight_unit as weight_unit,
        pbs.par,
        pbs.reorder_point,
        pbs.order_by_the
       FROM products p
       INNER JOIN products_by_store pbs ON p.id_products = pbs.id_product
       WHERE pbs.id_store = ?
       ORDER BY p.product_name`,
      [storeId]
    );

    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener productos disponibles', error: error.message });
  }
};

const createInventory = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { storeId, locationId, inventoryDate, items, waste = [] } = req.body;
    console.log('DEBUG createInventory - Received:', { 
      storeId, 
      locationId, 
      inventoryDate, 
      itemsCount: items?.length || 0,
      wasteCount: waste?.length || 0,
      status: req.body.status 
    });

    // Validación básica
    if (!storeId || !inventoryDate) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'La tienda y fecha son requeridos' });
    }

    // Si status es 'Locked', validar que haya productos
    const status = req.body.status || 'Open';
    if (status === 'Locked' && (!items || items.length === 0)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Debe agregar al menos un producto antes de cerrar el inventario' });
    }

    if (!locationId) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'La ubicación es requerida' });
    }

    // Solo validar inventario activo si intentamos crear uno Locked (cerrado)
    if (status === 'Locked') {
      const activeInventoryId = await checkActiveInventory(locationId);
      if (activeInventoryId) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Ya existe un inventario activo para esta ubicación. Por favor, ciérrelo antes de crear uno nuevo.' });
      }
    }

    // Procesar items solo si hay productos
    let finalItems = [];
    if (items && items.length > 0) {
      // Validar solo si es status Locked (cerrado)
      if (status === 'Locked') {
        const validation = validateInventoryItems(items);
        if (!validation.valid) {
          await connection.rollback();
          return res.status(400).json({ success: false, message: validation.message });
        }
      }

      // Orden basado en el último inventario
      const lastOrder = await getLastInventoryOrder(locationId);
      const orderMap = new Map();
      lastOrder.forEach(item => orderMap.set(item.id_product, item.display_order));

      const orderedItems = [];
      const newProducts = [];
      items.forEach(item => {
        if (orderMap.has(item.productId)) {
          orderedItems.push({ ...item, order: orderMap.get(item.productId) });
        } else {
          newProducts.push(item);
        }
      });
      orderedItems.sort((a, b) => a.order - b.order);

      let currentOrder = 1;
      finalItems = [
        ...newProducts.map(item => ({ ...item, order: currentOrder++ })),
        ...orderedItems.map(item => ({ ...item, order: currentOrder++ }))
      ];
    }

    // Crear inventario (status puede ser 'Unlocked' o 'Locked')
    const [result] = await connection.execute(
      `INSERT INTO inventories (id_store, id_location, inventory_type, inventory_date, status, total_ws_value, total_losses_value)
       VALUES (?, ?, 'Standard', ?, ?, 0, 0)`,
      [storeId, locationId, inventoryDate, status]
    );
    const inventoryId = result.insertId;

    // Insertar items (puede estar vacío si status = Unlocked)
    let totalWsValue = 0;
    console.log('DEBUG - Inserting items:', finalItems.length, 'items, status:', status);
    for (const item of finalItems) {
      // Validar que quantity sea un número válido
      const quantity = parseFloat(item.quantity);
      if (isNaN(quantity)) {
        console.error('ERROR - Invalid quantity for product:', item.productName, 'quantity:', item.quantity);
        await connection.rollback();
        return res.status(400).json({ 
          success: false, 
          message: `Invalid quantity for product: ${item.productName}` 
        });
      }
      const wsValue = parseFloat(item.wholesaleValue) || 0;
      const weights = await calculateNetWeight(connection, item.productId, item.fullWeight, item.emptyWeight);

      await connection.execute(
        `INSERT INTO inventory_items (id_inventory, id_product, id_location, display_order, quantity_type, quantity, case_size, weight_oz, full_weight, empty_weight, net_weight, wholesale_value)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [inventoryId, item.productId, item.locationId || null, item.order, item.quantityType,
         quantity, item.caseSize ? parseInt(item.caseSize) : null,
         item.weightOz ? parseFloat(item.weightOz) : null,
         weights.fullWeight, weights.emptyWeight, weights.netWeight, wsValue]
      );
      totalWsValue += wsValue;
    }

    // Insertar waste
    let totalWasteValue = 0;
    for (const w of waste) {
      const wsValue = parseFloat(w.wholesaleValue) || 0;
      const weights = await calculateNetWeight(connection, w.productId, w.fullWeight, w.emptyWeight);

      await connection.execute(
        `INSERT INTO inventory_losses (id_inventory, id_product, quantity, unit, reason, loss_value)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [inventoryId, w.productId, parseFloat(w.quantity), w.quantityType || 'units', '', wsValue]
      );
      totalWasteValue += wsValue;
    }

    // Actualizar totales
    await connection.execute(
      `UPDATE inventories SET total_ws_value = ?, total_losses_value = ? WHERE id_inventories = ?`,
      [totalWsValue, totalWasteValue, inventoryId]
    );

    await connection.commit();
    res.status(201).json({ success: true, message: 'Inventario creado exitosamente', data: { id: inventoryId, totalWsValue, totalWasteValue } });
  } catch (error) {
    await connection.rollback();
    console.error('❌ ERROR in createInventory:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ success: false, message: 'Error al crear el inventario', error: error.message });
  } finally {
    connection.release();
  }
};

const updateInventory = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { locationId, inventoryDate, items, waste = [], status } = req.body;

    const [inventory] = await connection.execute(
      'SELECT status, id_location FROM inventories WHERE id_inventories = ?',
      [id]
    );

    if (inventory.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Inventario no encontrado' });
    }

    if (inventory[0].status === 'Locked') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'No se puede editar un inventario bloqueado' });
    }

    if (locationId && locationId !== inventory[0].id_location) {
      const activeInventoryId = await checkActiveInventory(locationId, id);
      if (activeInventoryId) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Ya existe un inventario activo para esta ubicación' });
      }
    }

    // Validar items solo si el status que se está guardando es Locked
    if (items && items.length > 0 && status === 'Locked') {
      const validation = validateInventoryItems(items);
      if (!validation.valid) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: validation.message });
      }
    }

    // Actualizar fecha, ubicación y/o status si vienen en el body
    if (inventoryDate || locationId || status) {
      const updates = [];
      const params = [];
      if (inventoryDate) { updates.push('inventory_date = ?'); params.push(inventoryDate); }
      if (locationId)    { updates.push('id_location = ?');    params.push(locationId); }
      if (status)        { updates.push('status = ?');         params.push(status); }
      params.push(id);
      await connection.execute(`UPDATE inventories SET ${updates.join(', ')} WHERE id_inventories = ?`, params);
    }

    if (items && items.length > 0) {
      await connection.execute('DELETE FROM inventory_items WHERE id_inventory = ?', [id]);

      let totalWsValue = 0;
      for (const item of items) {
        const wsValue = parseFloat(item.wholesaleValue) || 0;
        const weights = await calculateNetWeight(connection, item.productId, item.fullWeight, item.emptyWeight);

        await connection.execute(
          `INSERT INTO inventory_items (id_inventory, id_product, id_location, display_order, quantity_type, quantity, case_size, weight_oz, full_weight, empty_weight, net_weight, wholesale_value)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, item.productId, item.locationId || null, item.displayOrder || item.order || 0,
           item.quantityType, parseFloat(item.quantity), item.caseSize ? parseInt(item.caseSize) : null,
           item.weightOz ? parseFloat(item.weightOz) : null,
           weights.fullWeight, weights.emptyWeight, weights.netWeight, wsValue]
        );
        totalWsValue += wsValue;
      }

      // Actualizar waste
      await connection.execute('DELETE FROM inventory_losses WHERE id_inventory = ?', [id]);
      let totalWasteValue = 0;
      for (const w of waste) {
        const wsValue = parseFloat(w.wholesaleValue) || 0;

        await connection.execute(
          `INSERT INTO inventory_losses (id_inventory, id_product, quantity, unit, reason, loss_value)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, w.productId, parseFloat(w.quantity), w.quantityType || 'units', '', wsValue]
        );
        totalWasteValue += wsValue;
      }

      await connection.execute(
        `UPDATE inventories SET total_ws_value = ?, total_losses_value = ? WHERE id_inventories = ?`,
        [totalWsValue, totalWasteValue, id]
      );
    }

    await connection.commit();
    res.json({ success: true, message: 'Inventario actualizado exitosamente' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: 'Error al actualizar el inventario', error: error.message });
  } finally {
    connection.release();
  }
};

const deleteInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const [inventory] = await pool.execute('SELECT status FROM inventories WHERE id_inventories = ?', [id]);

    if (inventory.length === 0) {
      return res.status(404).json({ success: false, message: 'Inventario no encontrado' });
    }
    if (inventory[0].status === 'Locked') {
      return res.status(400).json({ success: false, message: 'No se puede eliminar un inventario bloqueado' });
    }

    await pool.execute('DELETE FROM inventories WHERE id_inventories = ?', [id]);
    res.json({ success: true, message: 'Inventario eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar el inventario', error: error.message });
  }
};

const toggleLockInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const [inventory] = await pool.execute('SELECT status FROM inventories WHERE id_inventories = ?', [id]);

    if (inventory.length === 0) {
      return res.status(404).json({ success: false, message: 'Inventario no encontrado' });
    }

    const newStatus = inventory[0].status === 'Locked' ? 'Unlocked' : 'Locked';
    await pool.execute('UPDATE inventories SET status = ? WHERE id_inventories = ?', [newStatus, id]);

    res.json({
      success: true,
      message: `Inventario ${newStatus === 'Locked' ? 'bloqueado' : 'desbloqueado'} exitosamente`,
      data: { status: newStatus }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al actualizar el estado del inventario', error: error.message });
  }
};

const reorderInventoryItems = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { itemOrders } = req.body;

    const [inventory] = await connection.execute('SELECT status FROM inventories WHERE id_inventories = ?', [id]);
    if (inventory.length === 0 || inventory[0].status === 'Locked') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'No se puede reordenar un inventario bloqueado' });
    }

    for (const item of itemOrders) {
      await connection.execute(
        'UPDATE inventory_items SET display_order = ? WHERE id_inventory_item = ? AND id_inventory = ?',
        [item.display_order, item.id_inventory_item, id]
      );
    }

    await connection.commit();
    res.json({ success: true, message: 'Orden actualizado exitosamente' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: 'Error al reordenar items del inventario', error: error.message });
  } finally {
    connection.release();
  }
};


/**
 * Obtener productos del último inventario de una ubicación
 * Para precargar en un nuevo inventario (sin pesos)
 */
const getLastInventoryProducts = async (req, res) => {
  try {
    const { locationId } = req.params;

    if (!locationId) {
      return res.status(400).json({ success: false, message: 'locationId es requerido' });
    }

    // Buscar el último inventario de esta ubicación
    const [lastInventory] = await pool.execute(
      `SELECT id_inventories 
       FROM inventories 
       WHERE id_location = ? 
       ORDER BY id_inventories DESC 
       LIMIT 1`,
      [locationId]
    );

    if (lastInventory.length === 0) {
      return res.json({ success: true, data: [], message: 'No hay inventarios previos para esta ubicación' });
    }

    const lastInventoryId = lastInventory[0].id_inventories;

    // Obtener el id_store del inventario para filtrar products_by_store
    const [invData] = await pool.execute(
      'SELECT id_store FROM inventories WHERE id_inventories = ?',
      [lastInventoryId]
    );
    const storeId = invData[0]?.id_store;

    // Obtener los productos del último inventario con todos sus datos
    const [items] = await pool.execute(
      `SELECT 
        ii.display_order,
        ii.quantity_type,
        ii.full_weight,
        ii.empty_weight,
        ii.net_weight,
        p.id_products as productId,
        p.product_name as productName,
        p.product_code as productCode,
        p.container_type as containerType,
        p.container_size as containerSize,
        p.container_unit as containerUnit,
        p.case_size as caseSize,
        p.full_weight as product_full_weight,
        p.empty_weight as product_empty_weight,
        p.wholesale_price as wholesalePrice
       FROM inventory_items ii
       INNER JOIN products p ON ii.id_product = p.id_products
       WHERE ii.id_inventory = ?
       ORDER BY ii.display_order ASC`,
      [lastInventoryId]
    );

    res.json({ success: true, data: items, lastInventoryId });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener productos del último inventario', error: error.message });
  }
};

module.exports = {
  getAllInventories,
  getInventoryById,
  createInventory,
  updateInventory,
  deleteInventory,
  toggleLockInventory,
  getAvailableProducts,
  reorderInventoryItems,
  getLastInventoryProducts
};