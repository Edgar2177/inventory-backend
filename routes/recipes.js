const express = require('express');
const router = express.Router();
const {
  getAllRecipes,
  getRecipeById,
  createRecipe,
  updateRecipe,
  deleteRecipe
} = require('../controllers/recipesController');

// GET /api/recipes - Obtener todas las recetas
router.get('/', getAllRecipes);

// GET /api/recipes/:id - Obtener una receta por ID
router.get('/:id', getRecipeById);

// POST /api/recipes - Crear receta
router.post('/', createRecipe);

// PUT /api/recipes/:id - Actualizar receta
router.put('/:id', updateRecipe);

// DELETE /api/recipes/:id - Eliminar receta
router.delete('/:id', deleteRecipe);

module.exports = router;