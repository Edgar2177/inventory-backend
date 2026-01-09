const express = require('express');
const router = express.Router();
const inventoriesController = require('../controllers/inventoriesController');

// Rutas
router.get('/', inventoriesController.getAllInventories);
router.get('/:id', inventoriesController.getInventoryById);
router.post('/', inventoriesController.createInventory);
router.put('/:id', inventoriesController.updateInventory);
router.delete('/:id', inventoriesController.deleteInventory);
router.patch('/:id/toggle-lock', inventoriesController.toggleLockInventory);

module.exports = router;