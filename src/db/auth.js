const bcrypt = require('bcrypt');
const db = require('./database');

// Registro de usuarios
function registerUser(firstName, lastName, birthDate, email, password, role, callback) {
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            return callback(err);
        }

        const query = `INSERT INTO users (first_name, last_name, birth_date, email, password, role)
                       VALUES (?, ?, ?, ?, ?, ?)`;

        db.query(query, [firstName, lastName, birthDate, email, hash, role], (err, results) => {
            if (err) {
                return callback(err);
            }
            callback(null, results);
        });
    });
}

// Inicio de sesión
function loginUser(email, password, callback) {
    const query = `SELECT * FROM users WHERE email = ?`;

    db.query(query, [email], (err, results) => {
        if (err) {
            return callback(err);
        }
        if (results.length === 0) {
            return callback(new Error('Usuario no encontrado'));
        }

        const user = results[0];

        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                return callback(err);
            }
            if (!isMatch) {
                return callback(new Error('Contraseña incorrecta'));
            }
            callback(null, user);
        });
    });
}

module.exports = { registerUser, loginUser };
