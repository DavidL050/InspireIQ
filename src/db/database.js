import mysql from 'mysql2/promise';  // Cambia a la versión promise

// Crear una conexión utilizando Promesas
const connection = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '12345678',
    database: 'inspire_iq'
});



export default connection;
