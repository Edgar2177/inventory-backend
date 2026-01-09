const express = require('express');
const router = express.Router();
const {
  getAllProductTypes,
  getProductTypeById,
  createProductType,
  updateProductType,
  deleteProductType
} = require('../controllers/productTypesController');

// Rutas
router.get('/', getAllProductTypes);
router.get('/:id', getProductTypeById);
router.post('/', createProductType);
router.put('/:id', updateProductType);
router.delete('/:id', deleteProductType);

module.exports = router;