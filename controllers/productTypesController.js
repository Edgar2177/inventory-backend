const pool = require('../config/database'); // Removido { pool }, ahora es solo pool

// Función auxiliar para normalizar nombres (quitar espacios extras y convertir a minúsculas)
const normalizeName = (name) => {
  return name.trim().toLowerCase();
};

// Función para verificar si existe un nombre duplicado
const checkDuplicateName = async (name, excludeId = null) => {
  const normalizedName = normalizeName(name);
  let query = 'SELECT id_product_types FROM product_types WHERE LOWER(TRIM(product_name)) = ?';
  let params = [normalizedName];
  
  if (excludeId) {
    query += ' AND id_product_types != ?';
    params.push(excludeId);
  }
  
  const [rows] = await pool.execute(query, params);
  return rows.length > 0;
};

// Obtener todos los tipos de productos
const getAllProductTypes = async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id_product_types as id, product_name as name FROM product_types ORDER BY product_name', []); // Agregado []
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error getting product types:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting product types',
      error: error.message
    });
  }
};

// Obtener un tipo de producto por ID
const getProductTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute('SELECT id_product_types as id, product_name as name FROM product_types WHERE id_product_types = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product type not found'
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error getting product types:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting product types',
      error: error.message
    });
  }
};

// Crear un nuevo tipo de producto
const createProductType = async (req, res) => {
  try {
    const { name } = req.body;
    
    // Validar que el nombre no esté vacío
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'The name is required'
      });
    }

    // Normalizar el nombre (quitar espacios extras)
    const normalizedName = name.trim();
    
    // Verificar si ya existe un nombre duplicado
    const isDuplicate = await checkDuplicateName(normalizedName);
    
    if (isDuplicate) {
      return res.status(409).json({
        success: false,
        message: 'A product type with that name already exists.'
      });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO product_types (product_name) VALUES (?)',
      [normalizedName]
    );
    
    res.status(201).json({
      success: true,
      message: 'Type of product successfully created',
      data: {
        id: result.insertId,
        name: normalizedName
      }
    });
  } catch (error) {
    console.error('Error creating product type:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating product type',
      error: error.message
    });
  }
};

// Actualizar un tipo de producto
const updateProductType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    // Validar que el nombre no esté vacío
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'The name is required'
      });
    }

    // Normalizar el nombre (quitar espacios extras)
    const normalizedName = name.trim();
    
    // Verificar si ya existe un nombre duplicado (excluyendo el actual)
    const isDuplicate = await checkDuplicateName(normalizedName, id);
    
    if (isDuplicate) {
      return res.status(409).json({
        success: false,
        message: 'A product type with that name already exists.'
      });
    }
    
    const [result] = await pool.execute(
      'UPDATE product_types SET product_name = ? WHERE id_product_types = ?',
      [normalizedName, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product type not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Product type successfully updated',
      data: {
        id: parseInt(id),
        name: normalizedName
      }
    });
  } catch (error) {
    console.error('Error updating product type:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating product type',
      error: error.message
    });
  }
};

// Eliminar un tipo de producto
const deleteProductType = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [result] = await pool.execute('DELETE FROM product_types WHERE id_product_types = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product type not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Product type successfully removed'
    });
  } catch (error) {
    console.error('Error deleting product type:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting product type',
      error: error.message
    });
  }
};

module.exports = {
  getAllProductTypes,
  getProductTypeById,
  createProductType,
  updateProductType,
  deleteProductType
};