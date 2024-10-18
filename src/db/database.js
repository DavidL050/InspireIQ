import mysql from 'mysql2/promise';  // Cambia a la versión promise

// Crear una conexión utilizando Promesas
const connection = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '12345678',
    database: 'inspire_iq'
});

// No necesitas la conexión manual usando connect() porque mysql2/promise maneja las conexiones automáticamente.

export default connection;
