const express = require('express');
const router = express.Router();
const prepsController = require('../controllers/prepsController');

// Rutas
router.get('/', prepsController.getAllPreps);
router.get('/:id', prepsController.getPrepById);
router.post('/', prepsController.createPrep);
router.put('/:id', prepsController.updatePrep);
router.delete('/:id', prepsController.deletePrep);

module.exports = router;