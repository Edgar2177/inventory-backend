const express = require('express');
const router = express.Router();
const {
  getAllProductsByStore,
  getProductsByStoreId,
  assignProductToStore,
  updateProductInStore,
  removeProductFromStore
} = require('../controllers/productsByStoreController');

router.get('/', getAllProductsByStore);
router.get('/store/:storeId', getProductsByStoreId);
router.post('/', assignProductToStore);
router.put('/:id', updateProductInStore);
router.delete('/:id', removeProductFromStore);

module.exports = router;