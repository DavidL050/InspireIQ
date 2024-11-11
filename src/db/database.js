import mysql from 'mysql2/promise';  

// Crear una conexión utilizando Promesas
const connection = mysql.createPool({
    uri: 'mysql://root:itxUoywNJeozixvuVIpadbyTfGpxcoil@autorack.proxy.rlwy.net:32235/railway'
});


export default connection;