const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getAllPOSData,
  importPOSData,
  deletePOSRecord,
  clearStoreData
} = require('../controllers/posController');

// Configurar multer para manejar archivos en memoria
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB límite
});

// Obtener todos los datos POS
router.get('/', getAllPOSData);

// Importar datos desde CSV
router.post('/import', upload.single('file'), importPOSData);

// Eliminar un registro
router.delete('/:id', deletePOSRecord);

// Limpiar todos los datos de una tienda
router.delete('/store/:storeId/clear', clearStoreData);

module.exports = router;