const mysql = require('mysql2/promise');
require('dotenv').config();

// ==========================================
// 🔍 MOSTRAR CONFIGURACIÓN ACTUAL
// ==========================================
console.log('\n==========================================');
console.log('📊 CONFIGURACIÓN DE BASE DE DATOS');
console.log('==========================================');
console.log('🏠 DB_HOST:', process.env.DB_HOST || '❌ NO CONFIGURADO');
console.log('🔌 DB_PORT:', process.env.DB_PORT || '❌ NO CONFIGURADO (usará 3306)');
console.log('👤 DB_USER:', process.env.DB_USER || '❌ NO CONFIGURADO');
console.log('🔑 DB_PASSWORD:', process.env.DB_PASSWORD ? `✅ Configurado (${process.env.DB_PASSWORD.length} caracteres)` : '❌ NO CONFIGURADO');
console.log('🗄️  DB_NAME:', process.env.DB_NAME || '❌ NO CONFIGURADO');
console.log('🌍 NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('==========================================\n');

// Verificar variables requeridas
const requiredVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ FALTAN VARIABLES DE ENTORNO CRÍTICAS:');
  missingVars.forEach(varName => console.error(`   ⚠️  ${varName}`));
  console.error('\n💡 Solución: Configúralas en Render Dashboard → Environment\n');
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 60000, // 60 segundos para Render
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

const testConnection = async () => {
  let connection;
  const startTime = Date.now();
  
  try {
    console.log('🔄 Intentando conectar a la base de datos...');
    console.log(`📍 Host: ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}`);
    console.log(`👤 Usuario: ${process.env.DB_USER}`);
    console.log(`🗄️  Base de datos: ${process.env.DB_NAME}`);
    console.log('⏳ Esperando respuesta...\n');
    
    connection = await pool.getConnection();
    
    const duration = Date.now() - startTime;
    console.log(`✅ ¡Conexión exitosa a la BD! (${duration}ms)`);
    
    // Probar query para confirmar
    const [rows] = await connection.query('SELECT DATABASE() as db, VERSION() as version, NOW() as time');
    console.log('✅ Base de datos activa:', rows[0].db);
    console.log('✅ Versión MySQL:', rows[0].version);
    console.log('✅ Hora del servidor:', rows[0].time);
    console.log('==========================================\n');
    
    connection.release();
    return true;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('\n❌❌❌ ERROR CONECTANDO A LA BASE DE DATOS ❌❌❌');
    console.error('==========================================');
    console.error('⏱️  Tiempo transcurrido:', duration + 'ms');
    console.error('🔴 Código de error:', error.code);
    console.error('📝 Mensaje:', error.message);
    console.error('🔢 Error number:', error.errno);
    console.error('📊 SQL State:', error.sqlState || 'N/A');
    console.error('==========================================\n');
    
    // 🔍 DIAGNÓSTICO ESPECÍFICO
    console.error('🔍 DIAGNÓSTICO Y SOLUCIONES:\n');
    
    switch (error.code) {
      case 'ETIMEDOUT':
        console.error('⏱️  ERROR: TIMEOUT - No se puede alcanzar el servidor MySQL');
        console.error('\n📋 Causas posibles:');
        console.error('   1. El host de BD es incorrecto');
        console.error('   2. El firewall del servidor bloquea conexiones externas');
        console.error('   3. El puerto 3306 está cerrado');
        console.error('   4. La BD está apagada o no existe en ese host');
        console.error('\n✅ SOLUCIONES:');
        console.error('   • Verifica que DB_HOST sea correcto:', process.env.DB_HOST);
        console.error('   • Configura "Remote MySQL" en cPanel:');
        console.error('     → cPanel → Databases → Remote MySQL');
        console.error('     → Add Access Host: %');
        console.error('   • Si usas otro hosting, permite conexiones desde 0.0.0.0/0');
        console.error('   • Verifica que MySQL esté corriendo en el servidor');
        break;
        
      case 'ECONNREFUSED':
        console.error('🚫 ERROR: CONEXIÓN RECHAZADA - El servidor rechaza activamente');
        console.error('\n📋 Causas posibles:');
        console.error('   1. MySQL no está corriendo en el servidor');
        console.error('   2. El puerto es incorrecto');
        console.error('   3. Firewall bloqueando el puerto');
        console.error('\n✅ SOLUCIONES:');
        console.error('   • Verifica que DB_PORT sea 3306 (actual:', process.env.DB_PORT || 3306, ')');
        console.error('   • Verifica que MySQL esté activo en el servidor');
        console.error('   • Contacta al administrador del servidor');
        break;
        
      case 'ENOTFOUND':
        console.error('🔍 ERROR: HOST NO ENCONTRADO - El dominio/IP no existe');
        console.error('\n📋 Causas posibles:');
        console.error('   1. El hostname está mal escrito');
        console.error('   2. DNS no resuelve el dominio');
        console.error('   3. La IP cambió');
        console.error('\n✅ SOLUCIONES:');
        console.error('   • Verifica DB_HOST:', process.env.DB_HOST);
        console.error('   • Prueba hacer ping:', `ping ${process.env.DB_HOST}`);
        console.error('   • Verifica con tus jefes que sea la IP correcta');
        break;
        
      case 'ER_ACCESS_DENIED_ERROR':
        console.error('🔒 ERROR: ACCESO DENEGADO - Credenciales incorrectas');
        console.error('\n📋 Causas posibles:');
        console.error('   1. Usuario o contraseña incorrectos');
        console.error('   2. El usuario no tiene permisos remotos');
        console.error('   3. La contraseña cambió');
        console.error('\n✅ SOLUCIONES:');
        console.error('   • Verifica DB_USER:', process.env.DB_USER);
        console.error('   • Verifica que la contraseña sea correcta en Render Environment');
        console.error('   • En MySQL, el usuario debe tener permisos para @\'%\':');
        console.error('     GRANT ALL ON *.* TO \'usuario\'@\'%\' IDENTIFIED BY \'password\';');
        break;
        
      case 'ER_BAD_DB_ERROR':
        console.error('🗄️  ERROR: BASE DE DATOS NO EXISTE');
        console.error('\n📋 Causas posibles:');
        console.error('   1. El nombre de la base de datos está mal');
        console.error('   2. La base de datos fue eliminada');
        console.error('\n✅ SOLUCIONES:');
        console.error('   • Verifica DB_NAME:', process.env.DB_NAME);
        console.error('   • Verifica en Workbench que exista esa base de datos');
        console.error('   • Conecta sin especificar BD y ejecuta: SHOW DATABASES;');
        break;
        
      case 'PROTOCOL_CONNECTION_LOST':
        console.error('📡 ERROR: CONEXIÓN PERDIDA');
        console.error('\n✅ SOLUCIONES:');
        console.error('   • La conexión se perdió durante la comunicación');
        console.error('   • Esto es temporal, el pool se reconectará automáticamente');
        break;
        
      default:
        console.error('⚠️  ERROR DESCONOCIDO');
        console.error('\n📋 Información del error:');
        console.error('   Código:', error.code);
        console.error('   Errno:', error.errno);
        console.error('   Mensaje completo:', error.message);
        console.error('\n✅ SOLUCIÓN GENERAL:');
        console.error('   • Copia este error completo y compártelo con tu equipo');
        console.error('   • Verifica todas las variables de entorno');
        console.error('   • Prueba la conexión desde Workbench');
    }
    
    console.error('\n==========================================');
    console.error('🔗 Configuración actual:');
    console.error(`   mysql -h ${process.env.DB_HOST} -P ${process.env.DB_PORT || 3306} -u ${process.env.DB_USER} -p`);
    console.error('==========================================\n');
    
    if (connection) connection.release();
    return false;
  }
};

// Evento de error del pool
pool.on('error', (err) => {
  console.error('\n⚠️  Error en el pool de conexiones:');
  console.error('   Código:', err.code);
  console.error('   Mensaje:', err.message);
  
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.error('   ℹ️  La conexión se perdió, el pool intentará reconectar automáticamente');
  }
});

// Cerrar pool correctamente al terminar
process.on('SIGTERM', async () => {
  console.log('\n🛑 Señal SIGTERM recibida, cerrando pool de conexiones...');
  try {
    await pool.end();
    console.log('✅ Pool cerrado correctamente');
  } catch (error) {
    console.error('❌ Error cerrando pool:', error.message);
  }
  process.exit(0);
});

module.exports = pool;
module.exports.testConnection = testConnection;