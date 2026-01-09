const pool = require('../config/database');
const Papa = require('papaparse');

// Obtener todos los datos POS
const getAllPOSData = async (req, res) => {
  try {
    const query = `
      SELECT 
        id_pos_raw as id,
        id_store as storeId,
        location,
        order_id as orderId,
        order_number as orderNumber,
        sent_date as sentDate,
        order_date as orderDate,
        check_id as checkId,
        server,
        table_number as tableNumber,
        dining_area as diningArea,
        service,
        dining_option as diningOption,
        item_selection_id as itemSelectionId,
        item_id as itemId,
        master_id as masterId,
        sku,
        plu,
        menu_item as menuItem,
        menu_subgroups as menuSubgroups,
        menu_group as menuGroup,
        menu,
        sales_category as salesCategory,
        gross_price as grossPrice,
        discount,
        net_price as netPrice,
        qty,
        tax,
        is_void as isVoid,
        is_deferred as isDeferred,
        is_tax_exempt as isTaxExempt,
        tax_inclusion_option as taxInclusionOption,
        dining_option_tax as diningOptionTax,
        tab_name as tabName,
        import_date as importDate,
        file_name as fileName
      FROM pos_raw_data
      ORDER BY order_date DESC, order_id DESC
    `;
    
    const [rows] = await pool.execute(query);
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error al obtener datos POS:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener datos POS',
      error: error.message
    });
  }
};

// Importar datos desde CSV
const importPOSData = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { storeId } = req.body;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required'
      });
    }

    // Parsear el CSV
    const csvString = req.file.buffer.toString('utf-8');
    
    Papa.parse(csvString, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: async (results) => {
        try {
          const data = results.data;
          let imported = 0;
          let skipped = 0;
          const errors = [];

          for (const row of data) {
            try {
              // Parsear fechas
              const sentDate = row['Sent Date'] ? new Date(row['Sent Date']) : null;
              const orderDate = row['Order Date'] ? new Date(row['Order Date']) : null;

              await pool.execute(
                `INSERT INTO pos_raw_data (
                  id_store, location, order_id, order_number, sent_date, order_date,
                  check_id, server, table_number, dining_area, service, dining_option,
                  item_selection_id, item_id, master_id, sku, plu, menu_item,
                  menu_subgroups, menu_group, menu, sales_category, gross_price,
                  discount, net_price, qty, tax, is_void, is_deferred, is_tax_exempt,
                  tax_inclusion_option, dining_option_tax, tab_name, file_name
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  storeId,
                  row['Location'] || null,
                  row['Order Id'] || null,
                  row['Order #'] || null,
                  sentDate,
                  orderDate,
                  row['Check Id'] || null,
                  row['Server'] || null,
                  row['Table'] || null,
                  row['Dining Area'] || null,
                  row['Service'] || null,
                  row['Dining Option'] || null,
                  row['Item Selection Id'] || null,
                  row['Item Id'] || null,
                  row['Master Id'] || null,
                  row['SKU'] || null,
                  row['PLU'] || null,
                  row['Menu Item'] || null,
                  row['Menu Subgroup(s)'] || null,
                  row['Menu Group'] || null,
                  row['Menu'] || null,
                  row['Sales Category'] || null,
                  row['Gross Price'] || null,
                  row['Discount'] || null,
                  row['Net Price'] || null,
                  row['Qty'] || null,
                  row['Tax'] || null,
                  row['Void?'] === true || row['Void?'] === 'true' ? 1 : 0,
                  row['Deferred'] === true || row['Deferred'] === 'true' ? 1 : 0,
                  row['Tax Exempt'] === true || row['Tax Exempt'] === 'true' ? 1 : 0,
                  row['Tax Inclusion Option'] || null,
                  row['Dining Option Tax'] || null,
                  row['Tab Name'] || null,
                  req.file.originalname || null
                ]
              );
              imported++;
            } catch (error) {
              skipped++;
              errors.push({
                row: row,
                error: error.message
              });
            }
          }

          res.json({
            success: true,
            message: 'Importación completada',
            stats: {
              total: data.length,
              imported,
              skipped,
              errors: errors.length > 0 ? errors : null
            }
          });
        } catch (error) {
          console.error('Error processing CSV:', error);
          res.status(500).json({
            success: false,
            message: 'Error processing CSV',
            error: error.message
          });
        }
      },
      error: (error) => {
        res.status(500).json({
          success: false,
          message: 'Error parsing CSV',
          error: error.message
        });
      }
    });
  } catch (error) {
    console.error('Error al importar datos POS:', error);
    res.status(500).json({
      success: false,
      message: 'Error al importar datos POS',
      error: error.message
    });
  }
};

// Eliminar registro individual
const deletePOSRecord = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [result] = await pool.execute(
      'DELETE FROM pos_raw_data WHERE id_pos_raw = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Registro no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Registro eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar registro:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el registro',
      error: error.message
    });
  }
};

// Limpiar todos los datos de una tienda
const clearStoreData = async (req, res) => {
  try {
    const { storeId } = req.params;
    
    const [result] = await pool.execute(
      'DELETE FROM pos_raw_data WHERE id_store = ?',
      [storeId]
    );
    
    res.json({
      success: true,
      message: `${result.affectedRows} registros eliminados`,
      deletedCount: result.affectedRows
    });
  } catch (error) {
    console.error('Error al limpiar datos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al limpiar los datos',
      error: error.message
    });
  }
};

module.exports = {
  getAllPOSData,
  importPOSData,
  deletePOSRecord,
  clearStoreData
};