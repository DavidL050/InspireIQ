import bcrypt from 'bcryptjs';
import db from './database.js';

// Registro de usuarios
async function registerUser(firstName, lastName, email, password, role) {
    try {
        const hash = await bcrypt.hash(password, 10);
        const query = `INSERT INTO users (first_name, last_name, email, password, role) VALUES (?, ?, ?, ?, ?)`;

        return new Promise((resolve, reject) => {
            db.query(query, [firstName, lastName, email, hash, role], (err, results) => {
                if (err) {
                    return reject(err);
                }
                resolve(results);
            });
        });
    } catch (err) {
        throw new Error('Error al registrar el usuario: ' + err.message);
    }
}

// Inicio de sesión
async function loginUser(email, password, req) {
    const query = `SELECT * FROM users WHERE email = ?`;

    return new Promise((resolve, reject) => {
        db.query(query, [email], async (err, results) => {
            if (err) {
                return reject(err);
            }
            if (results.length === 0) {
                return reject(new Error('Usuario no encontrado'));
            }

            const user = results[0];

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return reject(new Error('Contraseña incorrecta'));
            }

            // Guardar información del usuario en la sesión
            req.session.userId = user.id; // Almacena el ID del usuario en la sesión
            req.session.userRole = user.role; // Almacena el rol del usuario en la sesión
            resolve(user);
        });
    });
}

// Cerrar sesión
function logoutUser(req) {
    req.session.destroy((err) => {
        if (err) {
            console.log('Error al cerrar sesión:', err);
        }
    });
}

export { registerUser, loginUser, logoutUser };
