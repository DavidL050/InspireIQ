import bcrypt from 'bcryptjs';
import db from './database.js';

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
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.save(err => {
        if (err) {
          return reject(new Error('Error al guardar la sesión'));
        }
        resolve(user);
      });
    });
  });
}

function logoutUser(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy(err => {
      if (err) {
        console.error('Error al cerrar sesión:', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export { registerUser, loginUser, logoutUser };