import bcrypt from 'bcryptjs';
import db from './database.js';

// Función para registrar un usuario
async function registerUser(firstName, lastName, email, password, role) {
  try {
    const hash = await bcrypt.hash(password, 10);
    const query = `INSERT INTO users (first_name, last_name, email, password, role) VALUES (?, ?, ?, ?, ?)`;
    return new Promise((resolve, reject) => {
      db.query(query, [firstName, lastName, email, hash, role], (err, results) => {
        if (err) {
          return reject(new Error('Error al registrar el usuario: ' + err.message));
        }
        resolve(results);
      });
    });
  } catch (err) {
    throw new Error('Error al registrar el usuario: ' + err.message);
  }
}

// Función para iniciar sesión
async function loginUser(email, password, req) {
  const query = `SELECT * FROM users WHERE email = ?`;
  return new Promise((resolve, reject) => {
    db.query(query, [email], async (err, results) => {
      if (err) {
        return reject(new Error('Error en la consulta a la base de datos: ' + err.message));
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
      if (!req || !req.session) {
        return reject(new Error('La sesión no está disponible'));
      }

      req.session.userId = user.user_id;
      req.session.userRole = user.role;

      // Guardar sesión y resolver la promesa
      req.session.save(err => {
        if (err) {
          return reject(new Error('Error al guardar la sesión: ' + err.message));
        }
        resolve(user);
      });
    });
  });
}

// Función para cerrar sesión
function logoutUser(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy(err => {
      if (err) {
        console.error('Error al cerrar sesión:', err);
        return reject(new Error('Error al cerrar sesión: ' + err.message));
      }
      resolve();
    });
  });
}

// Función para obtener el usuario por su ID
async function getUserById(userId) {
  const query = `SELECT * FROM users WHERE user_id = ?`;
  return new Promise((resolve, reject) => {
    db.query(query, [userId], (err, results) => {
      if (err) {
        return reject(new Error('Error al obtener el usuario: ' + err.message));
      }
      if (results.length === 0) {
        return reject(new Error('Usuario no encontrado'));
      }
      resolve(results[0]); // Devolver el primer resultado, que es el usuario
    });
  });
}

export { registerUser, loginUser, logoutUser, getUserById };
