import mysql from 'mysql2/promise';

// Crear una conexión utilizando Promesas
const connection = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '840862_Mv',
    database: 'inspire_iq'
});

export default connection;