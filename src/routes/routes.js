import { Router } from "express";
import { loginUser, logoutUser, registerUser, getUserById, getUserCourseProgress, getUserLinks } from "../db/auth.js";
import db from "../db/database.js";

const router = Router();

// Middleware para pasar userId y userRole a todas las vistas
router.use((req, res, next) => {
  res.locals.userId = req.session?.userId || null;
  res.locals.userRole = req.session?.userRole || null;
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

// ---- RUTAS DE AUTENTICACIÓN ----

// Página principal
router.get("/", async (req, res) => {
  try {
      // Obtener algunos cursos destacados para la página principal
      const query = `
          SELECT courses.*, users.first_name, users.last_name
          FROM courses
          JOIN users ON courses.creator_id = users.user_id
          LIMIT 3  -- Aquí mostramos solo 3 cursos destacados
      `;
      const [courses] = await db.query(query);
      res.render("index", { courses });
  } catch (err) {
      console.error("Error al cargar la página principal:", err);
      req.flash('errorMessage', 'Hubo un error al cargar la página principal.');
      res.redirect('/');
  }
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
      res.redirect('/?success=true');
    });
  } catch (err) {
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
    await loginUser(email, password, req);
    res.redirect('/');
  } catch (err) {
    res.redirect(`/signin?error=${encodeURIComponent(err.message)}`);
  }
});

// Cerrar sesión
router.get("/logout", async (req, res) => {
  try {
    await logoutUser(req);
    res.redirect('/');
  } catch (err) {
    res.status(500).json({ error: 'Error en el servidor al cerrar sesión' });
  }
});

// ---- RUTAS DE PERFIL ----

// Página de perfil (requiere autenticación)
router.get("/profile", isAuthenticated, async (req, res) => {
  try {
    const user = await getUserById(req.session.userId);
    const coursesProgress = await getUserCourseProgress(req.session.userId);
    const userLinks = await getUserLinks(req.session.userId);
    res.render("profile.ejs", { user, coursesProgress, userLinks });
  } catch (err) {
    res.status(500).json({ error: 'Error en el servidor al obtener el perfil del usuario' });
  }
});

// Guardar cambios de perfil
router.post("/profile/save", isAuthenticated, async (req, res) => {
  const { firstName, lastName, email, biography, linkName, linkUrl, action } = req.body;
  const userId = req.session.userId;

  try {
    if (action === "saveProfile") {
      await db.query(
        'UPDATE users SET first_name = ?, last_name = ?, email = ?, biography = ? WHERE user_id = ?',
        [firstName, lastName, email, biography, userId]
      );
      req.flash('successMessage', 'Cambios de perfil guardados correctamente.');
    }

    if (action === "addLink" && linkName && linkUrl) {
      const [existingLink] = await db.query(
        'SELECT * FROM user_links WHERE user_id = ? AND link_name = ? AND link_url = ?',
        [userId, linkName, linkUrl]
      );

      if (existingLink.length > 0) {
        req.flash('errorMessage', 'Este enlace ya ha sido agregado.');
      } else {
        await db.query(
          'INSERT INTO user_links (user_id, link_name, link_url) VALUES (?, ?, ?)',
          [userId, linkName, linkUrl]
        );
        req.flash('successMessage', 'Enlace agregado correctamente.');
      }
    }

    res.redirect("/profile");
  } catch (err) {
    req.flash('errorMessage', 'Hubo un error al procesar tu solicitud.');
    res.redirect("/profile");
  }
});

// Eliminar enlaces de perfil
router.post("/profile/delete-link", async (req, res) => {
  const { deleteLinkId } = req.body;
  const userId = req.session.userId;

  try {
    const result = await db.query('DELETE FROM user_links WHERE link_id = ? AND user_id = ?', [deleteLinkId, userId]);
    if (result.affectedRows === 0) {
      req.flash('errorMessage', 'Enlace no encontrado o no tienes permiso para eliminarlo.');
    } else {
      req.flash('successMessage', 'Enlace eliminado correctamente.');
    }
    res.redirect('/profile');
  } catch (err) {
    req.flash('errorMessage', 'Error al eliminar el enlace.');
    res.redirect('/profile');
  }
});

// ---- RUTAS DE CURSOS ----
// Página de todos los cursos (requiere autenticación)
router.get("/course", isAuthenticated, async (req, res) => {
  try {
      // Obtener todos los cursos de la base de datos
      const [courses] = await db.query('SELECT * FROM courses');

      // Renderizar la vista 'course.ejs' con los cursos obtenidos
      res.render("course.ejs", { courses });
  } catch (err) {
      console.error("Error al cargar la página del curso:", err);
      req.flash('errorMessage', 'Hubo un error al cargar los cursos.');
      res.redirect('/');
  }
});

// Página de crear curso (requiere autenticación)
router.get("/create_course", isAuthenticated, async (req, res) => {
  try {
    const [categories] = await db.query('SELECT category_id, name FROM categories');
    res.render("create_course.ejs", { categories });
  } catch (err) {
    res.status(500).json({ error: 'Error en el servidor al cargar la página de creación de curso.' });
  }
});

// Crear un curso
router.post('/create_course', isAuthenticated, async (req, res) => {
  const { name, description, language, cover_image, category, requirements, section_title, video_url } = req.body;
  const creator_id = req.session.userId;
  
  try {
    await db.query('START TRANSACTION');
    
    const [result] = await db.query(
      'INSERT INTO courses (name, description, creation_date, creator_id, language, cover_image) VALUES (?, ?, NOW(), ?, ?, ?)',
      [name, description, creator_id, language, cover_image]
    );

    const courseId = result.insertId || result[0]?.insertId;
    if (!courseId) throw new Error('Error al obtener el ID del curso insertado');
    
    if (category) {
      await db.query('INSERT INTO course_categories (course_id, category_id) VALUES (?, ?)', [courseId, category]);
    }
    
    if (requirements && Array.isArray(requirements)) {
      for (let requirement of requirements) {
        if (requirement.trim()) {
          await db.query('INSERT INTO requirements (course_id, requirement_text) VALUES (?, ?)', [courseId, requirement]);
        }
      }
    }
    
    if (section_title && video_url && Array.isArray(section_title) && Array.isArray(video_url)) {
      for (let i = 0; i < section_title.length; i++) {
        if (section_title[i].trim() && video_url[i].trim()) {
          await db.query('INSERT INTO sections (course_id, title, video_url) VALUES (?, ?, ?)', [courseId, section_title[i], video_url[i]]);
        }
      }
    }

    await db.query('COMMIT');
    req.flash('successMessage', 'Curso creado exitosamente.');
    res.redirect('/create_course');
  } catch (err) {
    await db.query('ROLLBACK');
    req.flash('errorMessage', `Hubo un error al crear el curso: ${err.message}`);
    res.redirect('/create_course');
  }
});

// Ruta GET para mostrar los cursos creados por el profesor
router.get('/my_courses', isAuthenticated, async (req, res) => {
  const teacherId = req.session.userId;

  try {
    const [courses] = await db.query('SELECT * FROM courses WHERE creator_id = ?', [teacherId]);
    res.render('my_courses', { courses });
  } catch (err) {
    req.flash('errorMessage', 'Hubo un error al cargar tus cursos.');
    res.redirect('/');
  }
});

// Página de detalles de curso
router.get("/course_details/:courseId", isAuthenticated, async (req, res) => {
  const { courseId } = req.params;

  try {
    // Obtener los detalles del curso
    const [courseDetails] = await db.query('SELECT * FROM courses WHERE course_id = ?', [courseId]);

    // Validar si el curso existe
    if (courseDetails.length === 0) {
      req.flash('errorMessage', 'El curso no existe.');
      return res.redirect('/my_courses');
    }

    // Obtener solo las 3 calificaciones más recientes
    const [ratings] = await db.query('SELECT r.rating, r.comment, r.created_at, u.first_name, u.last_name FROM ratings r JOIN users u ON r.user_id = u.user_id WHERE r.course_id = ? ORDER BY r.created_at DESC LIMIT 3', [courseId]);

    // Obtener el promedio de las calificaciones
    const [averageRatingResult] = await db.query('SELECT AVG(rating) as averageRating FROM ratings WHERE course_id = ?', [courseId]);
    const averageRating = averageRatingResult[0].averageRating || 0;

  
    // Renderizar la vista
    res.render("course_details.ejs", {
      course: courseDetails[0],
      ratings: ratings, // Las 3 calificaciones más recientes
      averageRating: averageRating, // El promedio de calificaciones
      courseId: courseId,
      user: req.session.userId // Necesario para el formulario
    });
  } catch (err) {
    // Manejo de errores
    res.status(500).json({ error: 'Error en el servidor al cargar los detalles del curso' });
  }
});

// ---- PAGINA DE COURSE PLAYER ----
router.get("/course_player/:courseId", isAuthenticated, async (req, res) => {
  const { courseId } = req.params;

  try {
    // Consulta para obtener los detalles del curso
    const [courseDetails] = await db.query(`
      SELECT courses.*, categories.name AS category
      FROM courses
      LEFT JOIN course_categories ON courses.course_id = course_categories.course_id
      LEFT JOIN categories ON course_categories.category_id = categories.category_id
      WHERE courses.course_id = ?`, [courseId]);

    // Verificar si el curso existe
    if (courseDetails.length === 0) {
      req.flash('errorMessage', 'El curso no existe.');
      return res.redirect('/my_courses');
    }

    // Consulta para obtener las secciones del curso
    const [sections] = await db.query('SELECT section_id, course_id, title, video_url FROM sections WHERE course_id = ?', [courseId]);

    // Transformar las URLs de YouTube para que sean reproducibles en iframe
    const processedSections = sections.map(section => ({
      ...section,
      video_url: transformYouTubeUrl(section.video_url) // Usamos la función transformYouTubeUrl aquí
    }));

    // Consulta para obtener las valoraciones del curso
    const [ratings] = await db.query('SELECT r.rating, r.comment, r.created_at, u.first_name, u.last_name FROM ratings r JOIN users u ON r.user_id = u.user_id WHERE r.course_id = ?', [courseId]);

    // Consulta para obtener el promedio de las calificaciones
    const [averageRatingResult] = await db.query('SELECT AVG(rating) AS averageRating, COUNT(*) AS totalRatings FROM ratings WHERE course_id = ?', [courseId]);
    const { averageRating = 0, totalRatings = 0 } = averageRatingResult[0] || {};

    // Renderizar la página del reproductor de curso
    res.render("course_player.ejs", {
      course: courseDetails[0],          // Detalles del curso
      sections: processedSections,        // Secciones procesadas
      ratings,                            // Valoraciones
      averageRating,                      // Promedio de valoraciones
      totalRatings,                       // Total de valoraciones
      user: req.session.user              // Información del usuario autenticado
    });
  } catch (err) {
    console.error('Error al cargar la página del curso:', err);
    req.flash('errorMessage', 'Hubo un problema al cargar la página del curso.');
    res.redirect('/my_courses');
  }
});

// Función auxiliar para transformar URLs de YouTube
function transformYouTubeUrl(url) {
  try {
    if (!url) return '';

    // Extraer el ID del video de YouTube
    let videoId = '';
    const urlObj = new URL(url);
    
    if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
      videoId = urlObj.searchParams.get('v');
    } else if (urlObj.hostname === 'youtu.be') {
      videoId = urlObj.pathname.substring(1);
    }

    // Retornar la URL embebible de YouTube
    return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
  } catch (e) {
    console.error('Error transformando URL de YouTube:', e);
    return '';
  }
}




// ---- RUTAS DE ENROLLMENTS ----

// Ruta POST para matricular a un usuario en un curso (solo para estudiantes)
router.post('/enroll', isAuthenticated, async (req, res) => {
  const { user_id, course_id } = req.body;

  try {
    const userRole = req.session.userRole;

    if (userRole !== 'student') {
      req.flash('errorMessage', 'Solo los estudiantes pueden matricularse en cursos.');
      return res.redirect('back');
    }

    if (!user_id || !course_id) {
      req.flash('errorMessage', 'Usuario o curso no proporcionado.');
      return res.redirect('back');
    }

    await db.query('INSERT INTO enrollments (user_id, course_id, enrollment_date, progress, status) VALUES (?, ?, NOW(), 0, ?)', [user_id, course_id, 'active']);
    
    req.flash('successMessage', 'Te has matriculado correctamente en el curso.');
    res.redirect('/courses');
  } catch (err) {
    req.flash('errorMessage', 'Hubo un error al matricular al usuario.');
    res.redirect('back');
  }
});

// ---- RUTAS DE RATINGS ----

// Ruta POST para agregar una valoración
router.post('/rate_course', isAuthenticated, async (req, res) => {
  const { course_id, user_id, rating, comment } = req.body;

  try {
    // Verificar que todos los campos obligatorios estén presentes
    if (!course_id || !user_id || !rating) {
      req.flash('errorMessage', 'Faltan campos obligatorios.');
      return res.redirect('back');
    }

    // Insertar la calificación en la base de datos
    await db.query(
      'INSERT INTO ratings (course_id, user_id, rating, comment, created_at) VALUES (?, ?, ?, ?, NOW())',
      [course_id, user_id, rating, comment]
    );

    req.flash('successMessage', 'Valoración añadida correctamente.');
    res.redirect(`/course_details/${course_id}`);
  } catch (err) {
    req.flash('errorMessage', 'Hubo un error al añadir la valoración.');
    res.redirect('back');
  }
});


// ---- RUTAS DE RESOURCES ----

// Ruta POST para agregar un recurso a una sección
router.post('/add_resource', isAuthenticated, async (req, res) => {
  const { section_id, resource_name, resource_url } = req.body;

  try {
    if (!section_id || !resource_name || !resource_url) {
      req.flash('errorMessage', 'Faltan campos obligatorios.');
      return res.redirect('back');
    }

    await db.query('INSERT INTO resources (section_id, resource_name, resource_url) VALUES (?, ?, ?)', [section_id, resource_name, resource_url]);

    req.flash('successMessage', 'Recurso añadido correctamente.');
    res.redirect(`/sections/${section_id}`);
  } catch (err) {
    req.flash('errorMessage', 'Hubo un error al añadir el recurso.');
    res.redirect('back');
  }
});

export default router;
