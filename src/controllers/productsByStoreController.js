const pool = require('../config/database'); 

// Obtener todas las relaciones productos-tiendas
const getAllProductsByStore = async (req, res) => {
  try {
    const query = `
      SELECT 
        ps.id_product_store as id,
        ps.id_product as productId,
        p.product_name as productName,
        p.container_type as containerType,
        ps.id_store as storeId,
        s.store_name as storeName,
        ps.par as par,
        ps.reorder_point as reorderPoint,
        ps.order_by_the as orderByThe,
        ps.created_at as createdAt
      FROM products_by_store ps
      INNER JOIN products p ON ps.id_product = p.id_products
      INNER JOIN stores s ON ps.id_store = s.id_stores
      ORDER BY s.store_name, p.product_name
    `;
    
    const [rows] = await pool.execute(query, []);
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error al obtener productos por tienda:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los productos por tienda',
      error: error.message
    });
  }
};

// Obtener productos de una tienda específica
const getProductsByStoreId = async (req, res) => {
  try {
    const { storeId } = req.params;
    const query = `
      SELECT 
        ps.id_product_store as id,
        ps.id_product as productId,
        p.product_name as productName,
        p.product_code as productCode,
        p.container_size as containerSize,
        p.container_unit as containerUnit,
        p.container_type as containerType,
        p.case_size as caseSize,
        p.wholesale_price as wholesalePrice,
        
        -- ⭐ CAMPOS DE PESO EN GRAMOS (columnas base_unit que ya existen):
        p.full_weight_base_unit as fullWeightBaseUnit,
        p.empty_weight_base_unit as emptyWeightBaseUnit,
        
        c.category_name as categoryName,
        ps.par as par,
        ps.reorder_point as reorderPoint,
        ps.order_by_the as orderByThe
      FROM products_by_store ps
      INNER JOIN products p ON ps.id_product = p.id_products
      LEFT JOIN categories c ON p.id_category = c.id_categories
      WHERE ps.id_store = ?
      ORDER BY p.product_name
    `;
    
    const [rows] = await pool.execute(query, [storeId]);
    
    // Debug: Mostrar el primer producto
    if (rows.length > 0) {
      console.log('✅ Productos cargados:', rows.length);
      console.log('📦 Primer producto:', {
        nombre: rows[0].productName,
        fullWeightBaseUnit: rows[0].fullWeightBaseUnit,
        emptyWeightBaseUnit: rows[0].emptyWeightBaseUnit
      });
    }
    
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error al obtener productos de la tienda:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los productos de la tienda',
      error: error.message
    });
  }
};

// Asignar un producto a una tienda
const assignProductToStore = async (req, res) => {
  try {
    const { productId, storeId, par, reorderPoint, orderByThe } = req.body;
    
    // Validaciones
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'El producto es requerido'
      });
    }

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: 'La tienda es requerida'
      });
    }

    // Verificar que exista el producto
    const [product] = await pool.execute(
      'SELECT id_products FROM products WHERE id_products = ?',
      [productId]
    );
    
    if (product.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'El producto no existe'
      });
    }

    // Verificar que exista la tienda
    const [store] = await pool.execute(
      'SELECT id_stores FROM stores WHERE id_stores = ?',
      [storeId]
    );
    
    if (store.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'La tienda no existe'
      });
    }

    // Verificar si ya existe la relación
    const [existing] = await pool.execute(
      'SELECT id_product_store FROM products_by_store WHERE id_product = ? AND id_store = ?',
      [productId, storeId]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Este producto ya está asignado a esta tienda'
      });
    }

    // Crear la relación
    const [result] = await pool.execute(
      'INSERT INTO products_by_store (id_product, id_store, par, reorder_point, order_by_the) VALUES (?, ?, ?, ?, ?)',
      [productId, storeId, par || null, reorderPoint || null, orderByThe || null]
    );
    
    res.status(201).json({
      success: true,
      message: 'Producto asignado a la tienda exitosamente',
      data: {
        id: result.insertId,
        productId,
        storeId,
        par,
        reorderPoint,
        orderByThe
      }
    });
  } catch (error) {
    console.error('Error al asignar producto a tienda:', error);
    res.status(500).json({
      success: false,
      message: 'Error al asignar el producto a la tienda',
      error: error.message
    });
  }
};

// Actualizar un producto en tienda
const updateProductInStore = async (req, res) => {
  try {
    const { id } = req.params;
    const { par, reorderPoint, orderByThe } = req.body;
    
    const [result] = await pool.execute(
      'UPDATE products_by_store SET par = ?, reorder_point = ?, order_by_the = ? WHERE id_product_store = ?',
      [par || null, reorderPoint || null, orderByThe || null, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Relación no encontrada'
      });
    }
    
    res.json({
      success: true,
      message: 'Producto actualizado en la tienda exitosamente'
    });
  } catch (error) {
    console.error('Error al actualizar producto en tienda:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el producto en la tienda',
      error: error.message
    });
  }
};

// Eliminar un producto de una tienda
const removeProductFromStore = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [result] = await pool.execute(
      'DELETE FROM products_by_store WHERE id_product_store = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Relación no encontrada'
      });
    }
    
    res.json({
      success: true,
      message: 'Producto removido de la tienda exitosamente'
    });
  } catch (error) {
    console.error('Error al remover producto de tienda:', error);
    res.status(500).json({
      success: false,
      message: 'Error al remover el producto de la tienda',
      error: error.message
    });
  }
};

module.exports = {
  getAllProductsByStore,
  getProductsByStoreId,
  assignProductToStore,
  updateProductInStore,
  removeProductFromStore
};