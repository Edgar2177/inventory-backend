const express = require('express');
const router = express.Router();
const {
  getAllInventories,
  getInventoryById,
  createInventory,
  updateInventory,
  deleteInventory,
  toggleLockInventory,
  getAvailableProducts,
  reorderInventoryItems,
  getLastInventoryProducts
} = require('../controllers/inventoriesController');

// Rutas especiales con path fijo (deben estar ANTES de /:id)
router.get('/available-products', getAvailableProducts);
router.get('/last-products/:locationId', getLastInventoryProducts);

// Rutas CRUD básicas
router.get('/', getAllInventories);
router.get('/:id', getInventoryById);
router.post('/', createInventory);
router.put('/:id', updateInventory);
router.delete('/:id', deleteInventory);

// Rutas especiales con /:id
router.patch('/:id/toggle-lock', toggleLockInventory);
router.patch('/:id/reorder', reorderInventoryItems);

module.exports = router;