import { Router } from "express";
import { loginUser, logoutUser, registerUser, getUserById, getUserCourseProgress, getUserLinks } from "../db/auth.js";
import db from "../db/database.js"

const router = Router();

// Middleware para pasar userId y userRole a todas las vistas
router.use((req, res, next) => {
  res.locals.userId = req.session?.userId || null;
  res.locals.userRole = req.session?.userRole || null;
  console.log("Sesión en middleware:", {
    userId: req.session?.userId,
    userRole: req.session?.userRole,
    sessionID: req.sessionID
  });
  next();
});

// Middleware de autenticación
function isAuthenticated(req, res, next) {
  if (req.session?.userId) {
    return next();
  } else {
    return res.redirect('/signin');
  }
}

// Página principal
router.get("/", (req, res) => {
  res.render("index.ejs");
});

// Página de registro
router.get("/signup", (req, res) => {
  if (req.session?.userId) {
    return res.redirect('/');
  }
  const errorMessage = req.query.error || null;
  res.render("signup.ejs", { errorMessage });
});

// Proceso de registro
router.post("/signup", async (req, res) => {
  const { name, lastname, email, password, role } = req.body;
  try {
    const result = await registerUser(name, lastname, email, password, role);
    req.session.userId = result.userId;
    req.session.userRole = role;
    req.session.save(err => {
      if (err) {
        console.error("Error al guardar la sesión después del registro:", err);
        return res.status(500).json({ error: 'Error en el servidor al guardar la sesión' });
      }
      console.log("Sesión después del registro:", req.session);
      res.redirect('/?success=true');
    });
  } catch (err) {
    console.error("Error en el proceso de registro:", err);
    res.redirect(`/signup?error=${encodeURIComponent(err.message)}`);
  }
});

// Página de inicio de sesión
router.get("/signin", (req, res) => {
  if (req.session?.userId) {
    return res.redirect('/');
  }
  const successMessage = req.query.success ? "Te has registrado exitosamente" : null;
  const errorMessage = req.query.error || null;
  res.render("signin.ejs", { successMessage, errorMessage });
});

// Proceso de inicio de sesión
router.post("/signin", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await loginUser(email, password, req);
    console.log("Sesión después del inicio de sesión:", req.session);
    res.redirect('/');
  } catch (err) {
    console.error("Error en el inicio de sesión:", err);
    res.redirect(`/signin?error=${encodeURIComponent(err.message)}`);
  }
});

// Cerrar sesión
router.get("/logout", async (req, res) => {
  try {
    await logoutUser(req);
    res.redirect('/signin');
  } catch (err) {
    console.error("Error al cerrar sesión:", err);
    res.status(500).json({ error: 'Error en el servidor al cerrar sesión' });
  }
});
// Página de perfil (requiere autenticación)
router.get("/profile", isAuthenticated, async (req, res) => {
  try {
    const user = await getUserById(req.session.userId);
    const coursesProgress = await getUserCourseProgress(req.session.userId);
    const userLinks = await getUserLinks(req.session.userId);

    // Verifica si los link_id están presentes
    console.log("Enlaces del usuario con IDs:", userLinks);

    res.render("profile.ejs", { user, coursesProgress, userLinks });
  } catch (err) {
    console.error("Error al obtener el perfil del usuario:", err);
    res.status(500).json({ error: 'Error en el servidor al obtener el perfil del usuario' });
  }
});

router.post("/profile/save", isAuthenticated, async (req, res) => {
  const { firstName, lastName, email, biography, linkName, linkUrl, action } = req.body;
  const userId = req.session.userId;

  try {
    if (action === "saveProfile") {
      // Actualizar los datos del perfil
      await db.query(
        'UPDATE users SET first_name = ?, last_name = ?, email = ?, biography = ? WHERE user_id = ?',
        [firstName, lastName, email, biography, userId]
      );
      req.flash('successMessage', 'Cambios de perfil guardados correctamente.');
    }

    if (action === "addLink" && linkName && linkUrl) {
      // Verificar si el enlace ya existe para evitar duplicados
      const [existingLink] = await db.query(
        'SELECT * FROM user_links WHERE user_id = ? AND link_name = ? AND link_url = ?',
        [userId, linkName, linkUrl]
      );

      if (existingLink.length > 0) {
        req.flash('errorMessage', 'Este enlace ya ha sido agregado.');
      } else {
        // Agregar nuevo enlace social si no existe
        await db.query(
          'INSERT INTO user_links (user_id, link_name, link_url) VALUES (?, ?, ?)',
          [userId, linkName, linkUrl]
        );
        req.flash('successMessage', 'Enlace agregado correctamente.');
      }
    }

    res.redirect("/profile");
  } catch (err) {
    console.error("Error al procesar la solicitud:", err);
    req.flash('errorMessage', 'Hubo un error al procesar tu solicitud.');
    res.redirect("/profile");
  }
});
//Ruta para eliminar enlaces

router.post("/profile/delete-link", async (req, res) => {
  const { deleteLinkId } = req.body;

  if (!deleteLinkId) {
    req.flash('error', 'ID de enlace no proporcionado.');
    return res.redirect('/profile');
  }

  try {
    const userId = req.session.userId;
    const result = await db.query('DELETE FROM user_links WHERE link_id = ? AND user_id = ?', [deleteLinkId, userId]);

    if (result.affectedRows === 0) {
      req.flash('error', 'Enlace no encontrado o no tienes permiso para eliminarlo.');
      return res.redirect('/profile');
    }

    req.flash('success', 'Enlace eliminado correctamente.');
    res.redirect('/profile');
  } catch (err) {
    console.error("Error al eliminar el enlace:", err);
    req.flash('error', 'Error al eliminar el enlace.');
    res.redirect('/profile');
  }
});

// Página del curso (requiere autenticación)
router.get("/course", isAuthenticated, async (req, res) => {
  try {
    res.render("course.ejs");
  } catch (err) {
    console.error("Error al cargar la página del curso:", err);
    res.status(500).json({ error: 'Error en el servidor al cargar la página del curso' });
  }
});

// Página de crear curso (requiere autenticación)
router.get("/create_course", isAuthenticated, async (req, res) => {
  try {
    // Obtener las categorías de la base de datos
    const result = await db.query('SELECT category_id, name FROM categories');

    // Imprimir el resultado para depuración
    console.log("Resultado de la consulta a categorías:", result);

    // Verificar que el resultado sea correcto
    const categories = result[0];  // Tomar el primer elemento que contiene la lista de categorías

    // Validar si tenemos categorías
    if (!categories || categories.length === 0) {
      console.error("No se obtuvieron categorías.");
      return res.status(500).json({ error: 'No se obtuvieron categorías.' });
    }

    // Renderizar la página de crear curso pasando las categorías
    res.render("create_course.ejs", { categories });
  } catch (err) {
    console.error("Error al cargar la página de creación de curso:", err);
    res.status(500).json({ error: 'Error en el servidor al cargar la página de creación de curso.' });
  }
});

// Ruta POST para crear un curso (requiere autenticación)
router.post('/create_course', isAuthenticated, async (req, res) => {
  const { name, description, language, cover_image, category, requirements, section_title, video_url } = req.body;
  const creator_id = req.session.userId;
  
  try {
    // Validación de campos obligatorios
    if (!name || !description || !language || !category) {
      req.flash('errorMessage', 'Por favor completa todos los campos obligatorios.');
      return res.redirect('/create_course');
    }
    
    // Iniciar una transacción
    await db.query('START TRANSACTION');
    
    // Insertar el curso en la tabla 'courses'
    const [result] = await db.query(
      'INSERT INTO courses (name, description, creation_date, creator_id, language, cover_image) VALUES (?, ?, NOW(), ?, ?, ?)',
      [name, description, creator_id, language, cover_image]
    );

    // Verificar si el curso se creó correctamente y obtener el ID
    const courseId = result.insertId || result[0].insertId;  // Verifica varias estructuras de respuesta posibles
    if (!courseId) {
      throw new Error('Error al obtener el ID del curso insertado');
    }
    console.log('Curso creado con ID:', courseId);
    
    // Asociar el curso a la categoría en la tabla intermedia 'course_categories'
    if (category) {
      await db.query('INSERT INTO course_categories (course_id, category_id) VALUES (?, ?)', [courseId, category]);
      console.log('Curso asociado a la categoría');
    }
    
    // Inserción de requerimientos en la tabla 'requirements'
    if (requirements && Array.isArray(requirements)) {
      for (let requirement of requirements) {
        if (requirement.trim()) {
          await db.query('INSERT INTO requirements (course_id, requirement_text) VALUES (?, ?)', [courseId, requirement]);
        }
      }
    }
    
    // Inserción de secciones en la tabla 'sections'
    if (section_title && video_url && Array.isArray(section_title) && Array.isArray(video_url)) {
      for (let i = 0; i < section_title.length; i++) {
        if (section_title[i].trim() && video_url[i].trim()) {
          await db.query('INSERT INTO sections (course_id, title, video_url) VALUES (?, ?, ?)', [courseId, section_title[i], video_url[i]]);
        }
      }
    }
    
    // Si todo va bien, hacemos commit
    await db.query('COMMIT');
    req.flash('successMessage', 'Curso creado exitosamente.');
    res.redirect('/create_course');
  } catch (err) {
    // Si ocurre un error, hacemos rollback
    await db.query('ROLLBACK');
    console.error('Error al crear el curso:', err.message);  // Imprimir el mensaje exacto del error
    req.flash('errorMessage', `Hubo un error al crear el curso: ${err.message}`);
    res.redirect('/create_course');
  }
});


// Página de detalles de curso (requiere autenticación)
router.get("/course_details/:courseId", isAuthenticated, async (req, res) => {
  const { courseId } = req.params;

  try {
    // Aquí podrías obtener más información del curso si lo necesitas
    // const courseDetails = await db.query('SELECT * FROM courses WHERE id = ?', [courseId]);

    res.render("course_details.ejs", { courseId });
  } catch (err) {
    console.error("Error al cargar los detalles del curso:", err);
    res.status(500).json({ error: 'Error en el servidor al cargar los detalles del curso' });
  }
});

export default router;