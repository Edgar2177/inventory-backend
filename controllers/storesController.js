const pool = require('../config/database'); // Removido { pool }, ahora es solo pool

// Función auxiliar para normalizar nombres (PRIMERO)
const normalizeName = (name) => {
  return name.trim().toLowerCase();
};

// Función para verificar duplicados (DESPUÉS)
const checkDuplicateName = async (name, excludeId = null) => {
  const normalizedName = normalizeName(name);
  let query = 'SELECT id_stores FROM stores WHERE LOWER(TRIM(store_name)) = ?';
  let params = [normalizedName];
  
  if (excludeId) {
    query += ' AND id_stores != ?';
    params.push(excludeId);
  }
  
  const [rows] = await pool.execute(query, params);
  return rows.length > 0;
};

// Obtener todas las tiendas
const getAllStores = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id_stores as id, store_name as name, address FROM stores ORDER BY store_name',
      [] // Agregado [] como segundo parámetro
    );
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error getting stores:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting stores',
      error: error.message
    });
  }
};

// Obtener una tienda por ID
const getStoreById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      'SELECT id_stores as id, store_name as name, address FROM stores WHERE id_stores = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error retrieving the store:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving the store',
      error: error.message
    });
  }
};

// Crear una nueva tienda
const createStore = async (req, res) => {
  try {
    const { name, address } = req.body;
    
    // Validaciones
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'The name is required'
      });
    }

    if (!address || address.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Address is required'
      });
    }

    const normalizedName = name.trim();
    const normalizedAddress = address.trim();
    
    // Verificar duplicados
    const isDuplicate = await checkDuplicateName(normalizedName);
    
    if (isDuplicate) {
      return res.status(409).json({
        success: false,
        message: 'There is already a store with that name.'
      });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO stores (store_name, address) VALUES (?, ?)',
      [normalizedName, normalizedAddress]
    );
    
    res.status(201).json({
      success: true,
      message: 'Store successfully created',
      data: {
        id: result.insertId,
        name: normalizedName,
        address: normalizedAddress
      }
    });
  } catch (error) {
    console.error('Error creating store:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating store',
      error: error.message
    });
  }
};

// Actualizar una tienda
const updateStore = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address } = req.body;
    
    // Validaciones
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'The name is required'
      });
    }

    if (!address || address.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Address is required'
      });
    }

    const normalizedName = name.trim();
    const normalizedAddress = address.trim();
    
    // Verificar duplicados (excluyendo el actual)
    const isDuplicate = await checkDuplicateName(normalizedName, id);
    
    if (isDuplicate) {
      return res.status(409).json({
        success: false,
        message: 'There is already a store with that name.'
      });
    }
    
    const [result] = await pool.execute(
      'UPDATE stores SET store_name = ?, address = ? WHERE id_stores = ?',
      [normalizedName, normalizedAddress, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Store successfully updated',
      data: {
        id: parseInt(id),
        name: normalizedName,
        address: normalizedAddress
      }
    });
  } catch (error) {
    console.error('Error updating the store:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating the store',
      error: error.message
    });
  }
};

// Eliminar una tienda
const deleteStore = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [result] = await pool.execute('DELETE FROM stores WHERE id_stores = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Store successfully removed'
    });
  } catch (error) {
    console.error('Error deleting store:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting store',
      error: error.message
    });
  }
};

module.exports = {
  getAllStores,
  getStoreById,
  createStore,
  updateStore,
  deleteStore
};