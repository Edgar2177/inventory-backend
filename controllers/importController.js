const pool = require('../config/database');
const XLSX = require('xlsx');

// Mapeo de nombres a IDs
const getProductTypeId = async (typeName) => {
  if (!typeName) return null;
  const [rows] = await pool.execute(
    'SELECT id_product_types FROM product_types WHERE LOWER(TRIM(product_name)) = LOWER(TRIM(?))',
    [typeName]
  );
  return rows.length > 0 ? rows[0].id_product_types : null;
};

const getCategoryId = async (categoryName, productTypeId) => {
  if (!categoryName) return null;
  let query = 'SELECT id_categories FROM categories WHERE LOWER(TRIM(category_name)) = LOWER(TRIM(?))';
  let params = [categoryName];
  
  if (productTypeId) {
    query += ' AND id_product_types = ?';
    params.push(productTypeId);
  }
  
  const [rows] = await pool.execute(query, params);
  return rows.length > 0 ? rows[0].id_categories : null;
};

const getVendorId = async (vendorName) => {
  if (!vendorName) return null;
  const [rows] = await pool.execute(
    'SELECT id_vendors FROM vendors WHERE LOWER(TRIM(vendor_name)) = LOWER(TRIM(?))',
    [vendorName]
  );
  return rows.length > 0 ? rows[0].id_vendors : null;
};

// Importar productos desde Excel
const importProducts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Leer el archivo Excel
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    let imported = 0;
    let skipped = 0;
    let errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        const productName = row['Product Name'];
        if (!productName) {
          skipped++;
          continue;
        }

        // Obtener IDs de las relaciones
        const productTypeId = await getProductTypeId(row['Product Type']);
        const categoryId = await getCategoryId(row['Category'], productTypeId);
        const vendorId = await getVendorId(row['Vendor']);

        // Validaciones requeridas
        if (!productTypeId) {
          errors.push(`Row ${i + 2}: Product Type "${row['Product Type']}" not found`);
          skipped++;
          continue;
        }

        if (!categoryId) {
          errors.push(`Row ${i + 2}: Category "${row['Category']}" not found`);
          skipped++;
          continue;
        }

        if (!row['Container type']) {
          errors.push(`Row ${i + 2}: Container type is required`);
          skipped++;
          continue;
        }

        if (!row['Size'] || parseFloat(row['Size']) <= 0) {
          errors.push(`Row ${i + 2}: Valid container size is required`);
          skipped++;
          continue;
        }

        if (!row['Units']) {
          errors.push(`Row ${i + 2}: Units are required`);
          skipped++;
          continue;
        }

        // Preparar datos para inserción
        const productData = {
          product_name: productName.trim(),
          product_code: row['Product code'] || null,
          id_product_type: productTypeId,
          id_category: categoryId,
          container_type: row['Container type'],
          container_size: parseFloat(row['Size']),
          container_unit: row['Units'],
          wholesale_price: row['Wholesale container price'] ? parseFloat(row['Wholesale container price']) : null,
          single_portion_size: row['Single portion size'] ? parseFloat(row['Single portion size']) : null,
          single_portion_unit: row['Units'], // Usar misma unidad
          full_weight: row['Full weight'] ? parseFloat(row['Full weight']) : null,
          full_weight_unit: row['Units'], // Usar misma unidad
          empty_weight: row['Empty weight'] ? parseFloat(row['Empty weight']) : null,
          empty_weight_unit: row['Units'], // Usar misma unidad
          case_size: row['Case size'] ? parseInt(row['Case size']) : null,
          id_vendor: vendorId
        };

        // Verificar si el producto ya existe
        const [existing] = await pool.execute(
          'SELECT id_products FROM products WHERE LOWER(TRIM(product_name)) = LOWER(TRIM(?))',
          [productName]
        );

        if (existing.length > 0) {
          // Actualizar producto existente
          await pool.execute(
            `UPDATE products SET 
              product_code = ?,
              id_product_type = ?,
              id_category = ?,
              container_type = ?,
              container_size = ?,
              container_unit = ?,
              wholesale_price = ?,
              single_portion_size = ?,
              single_portion_unit = ?,
              full_weight = ?,
              full_weight_unit = ?,
              empty_weight = ?,
              empty_weight_unit = ?,
              case_size = ?,
              id_vendor = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id_products = ?`,
            [
              productData.product_code,
              productData.id_product_type,
              productData.id_category,
              productData.container_type,
              productData.container_size,
              productData.container_unit,
              productData.wholesale_price,
              productData.single_portion_size,
              productData.single_portion_unit,
              productData.full_weight,
              productData.full_weight_unit,
              productData.empty_weight,
              productData.empty_weight_unit,
              productData.case_size,
              productData.id_vendor,
              existing[0].id_products
            ]
          );
        } else {
          // Insertar nuevo producto
          await pool.execute(
            `INSERT INTO products (
              product_name, product_code, id_product_type, id_category,
              container_type, container_size, container_unit, wholesale_price,
              single_portion_size, single_portion_unit, full_weight, full_weight_unit,
              empty_weight, empty_weight_unit, case_size, id_vendor
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              productData.product_name,
              productData.product_code,
              productData.id_product_type,
              productData.id_category,
              productData.container_type,
              productData.container_size,
              productData.container_unit,
              productData.wholesale_price,
              productData.single_portion_size,
              productData.single_portion_unit,
              productData.full_weight,
              productData.full_weight_unit,
              productData.empty_weight,
              productData.empty_weight_unit,
              productData.case_size,
              productData.id_vendor
            ]
          );
        }

        imported++;
      } catch (error) {
        console.error(`Error processing row ${i + 2}:`, error);
        errors.push(`Row ${i + 2}: ${error.message}`);
        skipped++;
      }
    }

    res.json({
      success: true,
      message: 'Import completed',
      stats: {
        total: data.length,
        imported,
        skipped,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({
      success: false,
      message: 'Error importing products',
      error: error.message
    });
  }
};

module.exports = {
  importProducts
};