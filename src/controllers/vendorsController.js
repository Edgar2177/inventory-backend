const pool = require('../config/database');

const normalizeName = (name) => {
    return name.trim().toLowerCase();
};

const checkDuplicateName = async (name, excludeId = null) => {
    const normalizedName = normalizeName(name);
    let query = 'SELECT id_vendors FROM vendors WHERE LOWER(TRIM(vendor_name)) = ?';
    let params = [normalizedName];

    if(excludeId){
        query += ' AND id_vendors != ?';
        params.push(excludeId);
    }
    const [rows] = await pool.execute(query, params);
    return rows.length > 0;
};

const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

const getAllVendors = async (req, res) => {
    try{
        const [rows] = await pool.execute(
            'SELECT id_vendors as id, vendor_name as name, contact_name as contactName, phone, email, created_at as createdAt FROM vendors ORDER BY vendor_name',
            []
        );
        res.json({
            success: true,
            data: rows
        });
    }catch(error){
        console.error('Error retrieving the provider', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving the provider',
            error:  error.message
        });
    }
};

const getVendorById = async (req, res) =>{
    try{
        const {id} = req.params;
        const [rows] = await pool.execute(
            'SELECT id_vendors as id, vendor_name as name, contact_name as contactName, phone, email, created_at as createdAt FROM vendors WHERE id_vendors = ?',
            [id]
        );
        if(rows.length === 0){
            return res.status(404).json({
                success: false,
                message: 'Supplier not found'
            });
        }
        res.json({
            success: true,
            data: rows[0]
        });
    }catch(error){
        console.error("Error retrieving the provider", error)
        res.status(500).json({
            success: false,
            message: 'Error retrieving the provider',
            error: error.message
        })
    }
}

// Crear un nuevo proveedor
const createVendor = async (req, res) => {
  try {
    const { name, contactName, phone, email } = req.body;
    
    // Solo validación de nombre
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'The supplier name is required'
      });
    }

    const normalizedName = name.trim();
    const normalizedContactName = contactName ? contactName.trim() : '';
    const normalizedPhone = phone ? phone.trim() : '';
    const normalizedEmail = email ? email.trim().toLowerCase() : '';

    // Validar formato de email solo si se proporciona
    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'The email format is invalid.'
      });
    }
    
    // Verificar duplicados
    const isDuplicate = await checkDuplicateName(normalizedName);
    
    if (isDuplicate) {
      return res.status(409).json({
        success: false,
        message: 'There is already a supplier with that name.'
      });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO vendors (vendor_name, contact_name, phone, email) VALUES (?, ?, ?, ?)',
      [normalizedName, normalizedContactName, normalizedPhone, normalizedEmail]
    );
    
    res.status(201).json({
      success: true,
      message: 'Supplier successfully created',
      data: {
        id: result.insertId,
        name: normalizedName,
        contactName: normalizedContactName,
        phone: normalizedPhone,
        email: normalizedEmail
      }
    });
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating supplier',
      error: error.message
    });
  }
};

// Actualizar un proveedor
const updateVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contactName, phone, email } = req.body;
    
    // Solo validación de nombre
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'The supplier name is required'
      });
    }

    const normalizedName = name.trim();
    const normalizedContactName = contactName ? contactName.trim() : '';
    const normalizedPhone = phone ? phone.trim() : '';
    const normalizedEmail = email ? email.trim().toLowerCase() : '';

    // Validar formato de email solo si se proporciona
    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'The email format is invalid.'
      });
    }
    
    // Verificar duplicados (excluyendo el actual)
    const isDuplicate = await checkDuplicateName(normalizedName, id);
    
    if (isDuplicate) {
      return res.status(409).json({
        success: false,
        message: 'There is already a supplier with that name.'
      });
    }
    
    const [result] = await pool.execute(
      'UPDATE vendors SET vendor_name = ?, contact_name = ?, phone = ?, email = ? WHERE id_vendors = ?',
      [normalizedName, normalizedContactName, normalizedPhone, normalizedEmail, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Supplier successfully updated',
      data: {
        id: parseInt(id),
        name: normalizedName,
        contactName: normalizedContactName,
        phone: normalizedPhone,
        email: normalizedEmail
      }
    });
  } catch (error) {
    console.error('Error updating provider:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating provider',
      error: error.message
    });
  }
};

// Eliminar un proveedor
const deleteVendor = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [result] = await pool.execute('DELETE FROM vendors WHERE id_vendors = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Supplier successfully removed'
    });
  } catch (error) {
    console.error('Failed to delete supplier:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete supplier',
      error: error.message
    });
  }
};

module.exports = {
  getAllVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor
};