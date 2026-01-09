const pool = require('../config/database'); // Removido { pool }, ahora es solo pool

// Función auxiliar para normalizar nombres
const normalizeName = (name) => {
  return name.trim().toLowerCase();
};

// Función para verificar duplicados
const checkDuplicateName = async (productTypeId, name, excludeId = null) => {
  const normalizedName = normalizeName(name);
  let query = 'SELECT id_categories FROM categories WHERE id_product_types = ? AND LOWER(TRIM(category_name)) = ?';
  let params = [productTypeId, normalizedName];
  
  if (excludeId) {
    query += ' AND id_categories != ?';
    params.push(excludeId);
  }
  
  const [rows] = await pool.execute(query, params);
  return rows.length > 0;
};

// Obtener todas las categorías con información del tipo de producto
const getAllCategories = async (req, res) => {
  try {
    const query = `
      SELECT 
        c.id_categories as id,
        c.category_name as name,
        c.id_product_types as productTypeId,
        pt.product_name as productTypeName
      FROM categories c
      INNER JOIN product_types pt ON c.id_product_types = pt.id_product_types
      ORDER BY pt.product_name, c.category_name
    `;
    
    const [rows] = await pool.execute(query, []); // Agregado [] como segundo parámetro
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting categories',
      error: error.message
    });
  }
};

// Obtener una categoría por ID
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT 
        c.id_categories as id,
        c.category_name as name,
        c.id_product_types as productTypeId,
        pt.product_name as productTypeName
      FROM categories c
      INNER JOIN product_types pt ON c.id_product_types = pt.id_product_types
      WHERE c.id_categories = ?
    `;
    
    const [rows] = await pool.execute(query, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting categories',
      error: error.message
    });
  }
};

// Crear una nueva categoría
const createCategory = async (req, res) => {
  try {
    const { productTypeId, name } = req.body;
    
    // Validaciones
    if (!productTypeId) {
      return res.status(400).json({
        success: false,
        message: 'The type of product is required'
      });
    }
    
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'The name is required'
      });
    }

    const normalizedName = name.trim();
    
    // Verificar si existe el tipo de producto
    const [productType] = await pool.execute(
      'SELECT id_product_types FROM product_types WHERE id_product_types = ?',
      [productTypeId]
    );
    
    if (productType.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'The product type does not exist'
      });
    }
    
    // Verificar duplicados dentro del mismo tipo de producto
    const isDuplicate = await checkDuplicateName(productTypeId, normalizedName);
    
    if (isDuplicate) {
      return res.status(409).json({
        success: false,
        message: 'There is already a category with that name for this type of product'
      });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO categories (id_product_types, category_name) VALUES (?, ?)',
      [productTypeId, normalizedName]
    );
    
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: {
        id: result.insertId,
        productTypeId,
        name: normalizedName
      }
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating category',
      error: error.message
    });
  }
};

// Actualizar una categoría
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { productTypeId, name } = req.body;
    
    // Validaciones
    if (!productTypeId) {
      return res.status(400).json({
        success: false,
        message: 'The type of product is required'
      });
    }
    
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'The name is required'
      });
    }

    const normalizedName = name.trim();
    
    // Verificar si existe el tipo de producto
    const [productType] = await pool.execute(
      'SELECT id_product_types FROM product_types WHERE id_product_types = ?',
      [productTypeId]
    );
    
    if (productType.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'The product type does not exist'
      });
    }
    
    // Verificar duplicados (excluyendo el actual)
    const isDuplicate = await checkDuplicateName(productTypeId, normalizedName, id);
    
    if (isDuplicate) {
      return res.status(409).json({
        success: false,
        message: 'There is already a category with that name for this type of product'
      });
    }
    
    const [result] = await pool.execute(
      'UPDATE categories SET id_product_types = ?, category_name = ? WHERE id_categories = ?',
      [productTypeId, normalizedName, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Category updated successfully',
      data: {
        id: parseInt(id),
        productTypeId,
        name: normalizedName
      }
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating category',
      error: error.message
    });
  }
};

// Eliminar una categoría
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [result] = await pool.execute('DELETE FROM categories WHERE id_categories = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Category successfully removed'
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting category',
      error: error.message
    });
  }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
};