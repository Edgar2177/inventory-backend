const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { testConnection } = require('./src/config/database');

const app = express();
const PORT = process.env.PORT || 5000;

// CONFIGURACIÓN DE CORS
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    
    // Lista de orígenes permitidos
    const allowedOrigins = [
      'https://inventory.callhospitality.ca',
      'https://www.inventory.callhospitality.ca',
      'http://localhost:3000',
      'http://localhost:3010'
    ];
    
    // Verifica si el origen está permitido
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // Solo mostrar error en producción
      if (process.env.NODE_ENV === 'production') {
        console.warn(`Origen bloqueado por CORS: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      } else {
        callback(null, true);
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Authorization'],
  maxAge: 86400 // 24 horas
};

// Aplicar CORS
app.use(cors(corsOptions));

// Middleware para manejar preflight requests
app.options('*', cors(corsOptions));

// Middlewares adicionales
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware para logging de peticiones
app.use((req, res, next) => {
  const now = new Date();
  console.log(`[${now.toISOString()}] ${req.method} ${req.url}`);
  console.log(`Origin: ${req.headers.origin || 'No origin'}`);
  console.log(`User-Agent: ${req.headers['user-agent']}`);
  next();
});

// Ruta de verificación de salud
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Ruta principal
app.get('/', (req, res) => {
  res.json({ 
    message: 'API de Inventario de Restaurante',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    documentation: '/api-docs',
    health: '/health'
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

// Ruta para verificar CORS
app.get('/api/cors-test', (req, res) => {
  res.json({
    success: true,
    message: 'CORS está funcionando correctamente',
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

// Manejador de errores de CORS
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'Origen no permitido por CORS',
      yourOrigin: req.headers.origin,
      allowedOrigins: [
        'https://inventory.callhospitality.ca',
        'https://www.inventory.callhospitality.ca',
        'http://localhost:3000',
        'http://localhost:3010'
      ],
      timestamp: new Date().toISOString()
    });
  }
  next(err);
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method
  });
});

// Manejo de Errores Global
app.use((err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });
  
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Error interno del servidor' 
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err.details 
    })
  });
});

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`
  Servidor de Inventario Restaurante
  Puerto: ${PORT}
  Entorno: ${process.env.NODE_ENV || 'development'}
  URL Local: http://localhost:${PORT}
  Iniciado: ${new Date().toISOString()}
  
  CORS Configurado para:
      - https://inventory.callhospitality.ca
      - https://www.inventory.callhospitality.ca
      - http://localhost:3000
      - http://localhost:3010
  
  Rutas disponibles:
      /           - Página principal
      /health     - Verificación de salud
      /api/*      - Endpoints de API
      /api/cors-test - Prueba de CORS
  `);
  
  // Probar conexión a la base de datos
  try {
    await testConnection();
    console.log('Conexión a la base de datos establecida');
  } catch (error) {
    console.error('Error conectando a la base de datos:', error.message);
  }
});