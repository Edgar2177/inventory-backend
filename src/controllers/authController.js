const pool = require('../config/database');
const bcrypt = require('bcryptjs');

// Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Buscar usuario por email
    const [users] = await pool.execute(
      'SELECT id_users as id, name, email, password, role FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = users[0];

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Obtener tiendas asignadas al usuario
    const [stores] = await pool.execute(
      `SELECT 
        s.id_stores as id,
        s.store_name as name
      FROM user_stores us
      INNER JOIN stores s ON us.id_store = s.id_stores
      WHERE us.id_user = ?
      ORDER BY s.store_name`,
      [user.id]
    );

    // No enviar la contraseña al frontend
    delete user.password;

    // Agregar las tiendas al objeto user
    user.stores = stores;

    res.json({
      success: true,
      message: 'Login successful',
      user: user
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during login',
      error: error.message
    });
  }
};

// Logout
const logout = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during logout',
      error: error.message
    });
  }
};

module.exports = {
  login,
  logout
};