const pool = require('../config/database'); // Removido { pool }, ahora es solo pool

// Función auxiliar para normalizar nombres
const normalizeName = (name) => {
  return name.trim().toLowerCase();
};

// Función para verificar duplicados
const checkDuplicateName = async (storeId, name, excludeId = null) => {
  const normalizedName = normalizeName(name);
  let query = 'SELECT id_locations FROM locations WHERE id_store = ? AND LOWER(TRIM(location_name)) = ?';
  let params = [storeId, normalizedName];
  
  if (excludeId) {
    query += ' AND id_locations != ?';
    params.push(excludeId);
  }
  
  const [rows] = await pool.execute(query, params);
  return rows.length > 0;
};

// Obtener todas las ubicaciones con información de la tienda
const getAllLocations = async (req, res) => {
  try {
    const query = `
      SELECT 
        l.id_locations as id,
        l.location_name as name,
        l.location_address as address,
        l.created_at as createdAt,
        l.id_store as storeId,
        s.store_name as storeName
      FROM locations l
      INNER JOIN stores s ON l.id_store = s.id_stores
      ORDER BY s.store_name, l.location_name
    `;
    
    const [rows] = await pool.execute(query, []); // Agregado [] como segundo parámetro
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error getting locations:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving locations',
      error: error.message
    });
  }
};

// Obtener una ubicación por ID
const getLocationById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT 
        l.id_locations as id,
        l.location_name as name,
        l.location_address as address,
        l.created_at as createdAt,
        l.id_store as storeId,
        s.store_name as storeName
      FROM locations l
      INNER JOIN stores s ON l.id_store = s.id_stores
      WHERE l.id_locations = ?
    `;
    
    const [rows] = await pool.execute(query, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error getting location:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting location',
      error: error.message
    });
  }
};

// Crear una nueva ubicación
const createLocation = async (req, res) => {
  try {
    const { storeId, name, address } = req.body;
    
    // Validaciones
    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: 'The store is required'
      });
    }
    
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'The name is required'
      });
    }

    if (!address || address.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'The address is required'
      });
    }

    const normalizedName = name.trim();
    const normalizedAddress = address.trim();
    
    // Verificar si existe la tienda
    const [store] = await pool.execute(
      'SELECT id_stores FROM stores WHERE id_stores = ?',
      [storeId]
    );
    
    if (store.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'The store does not exist'
      });
    }
    
    // Verificar duplicados dentro de la misma tienda
    const isDuplicate = await checkDuplicateName(storeId, normalizedName);
    
    if (isDuplicate) {
      return res.status(409).json({
        success: false,
        message: 'There is already a location with that name for this store.'
      });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO locations (id_store, location_name, location_address) VALUES (?, ?, ?)',
      [storeId, normalizedName, normalizedAddress]
    );
    
    res.status(201).json({
      success: true,
      message: 'Ubicación creada exitosamente',
      data: {
        id: result.insertId,
        storeId,
        name: normalizedName,
        address: normalizedAddress
      }
    });
  } catch (error) {
    console.error('Error creating location:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating location',
      error: error.message
    });
  }
};

// Actualizar una ubicación
const updateLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { storeId, name, address } = req.body;
    
    // Validaciones
    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: 'The store is required'
      });
    }
    
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'The name is required'
      });
    }

    if (!address || address.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'The address is required'
      });
    }

    const normalizedName = name.trim();
    const normalizedAddress = address.trim();
    
    // Verificar si existe la tienda
    const [store] = await pool.execute(
      'SELECT id_stores FROM stores WHERE id_stores = ?',
      [storeId]
    );
    
    if (store.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'The store does not exist'
      });
    }
    
    // Verificar duplicados (excluyendo el actual)
    const isDuplicate = await checkDuplicateName(storeId, normalizedName, id);
    
    if (isDuplicate) {
      return res.status(409).json({
        success: false,
        message: 'There is already a location with that name for this store.'
      });
    }
    
    const [result] = await pool.execute(
      'UPDATE locations SET id_store = ?, location_name = ?, location_address = ? WHERE id_locations = ?',
      [storeId, normalizedName, normalizedAddress, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Location updated successfully',
      data: {
        id: parseInt(id),
        storeId,
        name: normalizedName,
        address: normalizedAddress
      }
    });
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating location',
      error: error.message
    });
  }
};

// Eliminar una ubicación
const deleteLocation = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [result] = await pool.execute('DELETE FROM locations WHERE id_locations = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Location successfully removed'
    });
  } catch (error) {
    console.error('Failed to delete location:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete location',
      error: error.message
    });
  }
};

module.exports = {
  getAllLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation
};