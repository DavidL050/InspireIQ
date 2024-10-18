// auth.js
import bcrypt from 'bcrypt';
import db from './database.js';

// Función para registrar un nuevo usuario
async function registerUser(name, lastname, email, password, role) {
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (first_name, last_name, email, password, role) VALUES (?, ?, ?, ?, ?)',
      [name, lastname, email, hashedPassword, role]
    );
    return { userId: result.insertId };
  } catch (err) {
    throw err;
  }
}

// Función para iniciar sesión
async function loginUser(email, password, req) {
  try {
    // Consultar si el usuario existe en la base de datos
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      throw new Error('Usuario no encontrado');
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Contraseña incorrecta');
    }

    if (!req || !req.session) {
      throw new Error('Sesión no disponible');
    }

    // Guardar el userId y userRole en la sesión
    req.session.userId = user.user_id;
    req.session.userRole = user.role;

    await new Promise((resolve, reject) => {
      req.session.save(err => {
        if (err) return reject(new Error('Error al guardar la sesión'));
        resolve();
      });
    });

    return { userId: user.user_id, role: user.role };
  } catch (err) {
    console.error('Error detallado en el inicio de sesión:', err.message);
    throw new Error('Error al iniciar sesión. Verifica tus credenciales e inténtalo de nuevo.');
  }
}

// Función para cerrar sesión
function logoutUser(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy(err => {
      if (err) return reject(new Error('Error al cerrar sesión'));
      resolve();
    });
  });
}

// Función para obtener un usuario por su ID
async function getUserById(userId) {
  try {
    // Buscar el usuario por su ID en la base de datos
    const [users] = await db.query('SELECT * FROM users WHERE user_id = ?', [userId]);
    if (users.length === 0) {
      throw new Error('Usuario no encontrado');
    }

    // Excluir la contraseña en la respuesta
    const { password, ...userWithoutPassword } = users[0];
    return userWithoutPassword;
  } catch (err) {
    throw err;
  }
}
// Función para obtener el progreso del usuario en los cursos
async function getUserCourseProgress(userId) {
  try {
    // Consulta para obtener el progreso del usuario en los cursos
    const [coursesProgress] = await db.query(
      'SELECT c.name, cp.progress FROM course_progress cp JOIN courses c ON cp.course_id = c.course_id WHERE cp.user_id = ?',
      [userId]
    );

    if (coursesProgress.length === 0) {
      return [];
    }

    return coursesProgress;
  } catch (err) {
    console.error('Error al obtener el progreso de los cursos:', err);
    throw err;
  }
}
// Función para obtener los enlaces sociales del usuario
async function getUserLinks(userId) {
  try {
    // Consulta para obtener los enlaces sociales del usuario
    const [userLinks] = await db.query(
      'SELECT link_name, link_url FROM user_links WHERE user_id = ?',
      [userId]
    );
    
    return userLinks;
  } catch (err) {
    console.error('Error al obtener los enlaces del usuario:', err);
    throw err;
  }
}

export { registerUser, loginUser, logoutUser, getUserById, getUserCourseProgress, getUserLinks };



