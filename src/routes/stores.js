const express = require('express');
const router = express.Router();
const { getAllStores, getStoreById, createStore, updateStore, deleteStore } = require('../controllers/storesController');

router.get('/', getAllStores);
router.get('/:id', getStoreById);
router.post('/', createStore);
router.put('/:id', updateStore);
router.delete('/:id', deleteStore);

module.exports = router;