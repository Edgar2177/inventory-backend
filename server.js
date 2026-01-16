const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { testConnection } = require('./src/config/database');

const app = express();
const PORT = process.env.PORT || 5000;

const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
  ? ['https://inventory.callhospitality.ca', 'https://www.inventory.callhospitalit.ca']
  : ['http://localhost:3000', 'http://localhost:301'],
  credentials: true,
  optionsSuccessStatus:200
};


// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.get('/', (req, res) => {
  res.json({ 
    message: 'API de Inventario de Restaurante',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Importar rutas
const productTypesRoutes = require('./src/routes/productTypes');
app.use('/api/product-types', productTypesRoutes);

const categoriesRoutes = require('./src/routes/productCategories');
app.use('/api/categories', categoriesRoutes);

const storesRoutes = require('./src/routes/stores');
app.use('/api/stores', storesRoutes);

const locationRoutes = require('./src/routes/locations');
app.use('/api/locations', locationRoutes);

const vendorsRoutes = require('./src/routes/vendors');
app.use('/api/vendors', vendorsRoutes);

const productsRoutes = require('./src/routes/products');
app.use('/api/products', productsRoutes);

const productsByStoreRoutes = require('./src/routes/productsByStore');
app.use('/api/products-by-store', productsByStoreRoutes);

// Rutas de autenticación y usuarios
const authRoutes = require('./src/routes/auth');
app.use('/api/auth', authRoutes);

const usersRoutes = require('./src/routes/users');
app.use('/api/users', usersRoutes);

const importRoutes = require('./src/routes/import');
app.use('/api/import', importRoutes);

const recipesRoutes = require('./src/routes/recipes');
app.use('/api/recipes', recipesRoutes);

const posRoutes = require('./src/routes/pos');
app.use('/api/pos', posRoutes);

const inventoriesRoutes = require('./src/routes/inventories');
app.use('/api/inventories', inventoriesRoutes);

const prepsRoutes = require('./src/routes/preps');
app.use('/api/preps', prepsRoutes);

//Manejo de Errores
app.use((err, eq, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success:false,
    message: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack})
  });
});

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`)
  await testConnection();
});
