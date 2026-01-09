// Factores de conversión a unidades base

// Conversiones de volumen a ml
const volumeToMl = {
  'ml': 1,
  'L': 1000,
  'Gallon': 3785.41,
  'fl oz': 29.5735
};

// Conversiones de peso a gramos
const weightToGrams = {
  'g': 1,
  'kg': 1000,
  'lb': 453.592,
  'oz': 28.3495
};

// Unidades de cantidad (no se convierten)
const countUnits = ['Each'];

/**
 * Convierte un valor con su unidad a la unidad base (ml o gramos)
 * @param {number} value - Valor a convertir
 * @param {string} unit - Unidad del valor
 * @returns {number|null} - Valor convertido o null si es unidad de cantidad
 */
const convertToBaseUnit = (value, unit) => {
  if (!value || !unit) return null;
  
  // Si es unidad de cantidad, no convertir
  if (countUnits.includes(unit)) {
    return null;
  }
  
  // Intentar convertir como volumen
  if (volumeToMl[unit]) {
    return value * volumeToMl[unit];
  }
  
  // Intentar convertir como peso
  if (weightToGrams[unit]) {
    return value * weightToGrams[unit];
  }
  
  return null;
};

/**
 * Determina si una unidad es de volumen, peso o cantidad
 * @param {string} unit - Unidad a clasificar
 * @returns {string} - 'volume', 'weight', o 'count'
 */
const getUnitType = (unit) => {
  if (volumeToMl[unit]) return 'volume';
  if (weightToGrams[unit]) return 'weight';
  if (countUnits.includes(unit)) return 'count';
  return 'unknown';
};

/**
 * Obtiene la etiqueta de la unidad base según el tipo
 * @param {string} unit - Unidad original
 * @returns {string} - 'ml', 'g', o 'unit'
 */
const getBaseUnitLabel = (unit) => {
  const type = getUnitType(unit);
  if (type === 'volume') return 'ml';
  if (type === 'weight') return 'g';
  if (type === 'count') return 'unit';
  return '';
};

module.exports = {
  convertToBaseUnit,
  getUnitType,
  getBaseUnitLabel,
  volumeToMl,
  weightToGrams,
  countUnits
};