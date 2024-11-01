import { Router } from "express";
import { loginUser, logoutUser, registerUser, getUserById, getUserCourseProgress, getUserLinks } from "../db/auth.js";
import db from "../db/database.js";
import multer from "multer";
import path from 'path';


const router = Router();

// Configuración de multer para manejar la carga de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'src/public/uploads/'); // Directorio donde se almacenarán las imágenes de perfil
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${file.fieldname}-${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Middleware para pasar userId y userRole a todas las vistas
router.use((req, res, next) => {
  res.locals.userId = req.session?.userId || null;
  res.locals.userRole = req.session?.userRole || null;
  next();
});

// Middleware de autenticación
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
      return next();
  }
  
  if (req.path !== '/') {
    return res.redirect('/?login=true');
  }
  
  res.redirect('/');
}

// ---- RUTAS DE AUTENTICACIÓN ----

// Página principal
router.get("/", async (req, res) => {
  try {
      const query = `
          SELECT courses.*, users.first_name, users.last_name
          FROM courses
          JOIN users ON courses.creator_id = users.user_id
          LIMIT 3;
      `;
      const [courses] = await db.query(query);
      res.render("index", { courses });
  } catch (err) {
      console.error("Error al cargar la página principal:", err);
      req.flash('errorMessage', 'Hubo un error al cargar la página principal.');
      res.redirect('/');
  }
});

// Ruta para verificar si el usuario está autenticado
router.get('/check-auth', (req, res) => {
  if (req.session && req.session.userId) {
      res.status(200).json({ authenticated: true });
  } else {
      res.status(401).json({ authenticated: false });
  }
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
      res.status(200).json({ message: 'Registro exitoso', redirect: '/' });
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Proceso de inicio de sesión
router.post("/signin", async (req, res) => {
  const { email, password } = req.body;
  try {
    await loginUser(email, password, req);
    res.status(200).json({ message: 'Inicio de sesión exitoso', redirect: '/' });
  } catch (err) {
    res.status(401).json({ error: err.message });
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

// Ruta para actualizar la foto de perfil
router.post('/profile/upload-photo', isAuthenticated, upload.single('profilePhoto'), async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'Por favor, selecciona una imagen.' });
    }

    const userId = req.session.userId;
    const profileImage = `/uploads/${req.file.filename}`;

    // Update database with new profile image
    const [result] = await db.query('UPDATE users SET profile_image = ? WHERE user_id = ?', [profileImage, userId]);

    // Check if update was successful
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'No se pudo actualizar la foto de perfil.' });
    }

    res.status(200).json({ 
      message: 'Foto de perfil actualizada exitosamente',
      profileImage: profileImage
    });
  } catch (error) {
    console.error('Error uploading profile photo:', error);
    res.status(500).json({ message: 'Hubo un error al subir la foto de perfil.' });
  }
});
// Guardar cambios de perfil y agregar enlaces
router.post("/profile/save", isAuthenticated, async (req, res) => {
  const { firstName, lastName, email, biography, linkName, linkUrl, action, linkId } = req.body;
  const userId = req.session.userId;

  try {
    if (action === "saveProfile") {
      await db.query(
        'UPDATE users SET first_name = ?, last_name = ?, email = ?, biography = ? WHERE user_id = ?',
        [firstName, lastName, email, biography, userId]
      );
      return res.status(200).json({ message: 'Cambios de perfil guardados correctamente.' });
    } 

    if (action === "addLink" && linkName && linkUrl) {
      const [existingLink] = await db.query(
        'SELECT * FROM user_links WHERE user_id = ? AND link_name = ? AND link_url = ?',
        [userId, linkName, linkUrl]
      );

      if (existingLink.length > 0) {
        return res.status(400).json({ message: 'Este enlace ya ha sido agregado.' });
      } else {
        await db.query(
          'INSERT INTO user_links (user_id, link_name, link_url) VALUES (?, ?, ?)',
          [userId, linkName, linkUrl]
        );
        return res.status(200).json({ message: 'Enlace agregado correctamente.' });
      }
    } 

    if (action === "editLink" && linkId && linkName && linkUrl) {
      await db.query(
        'UPDATE user_links SET link_name = ?, link_url = ? WHERE link_id = ? AND user_id = ?',
        [linkName, linkUrl, linkId, userId]
      );
      return res.status(200).json({ message: 'Enlace actualizado correctamente.' });
    }

    res.status(400).json({ message: 'Acción no válida.' });
  } catch (err) {
    console.error("Error al procesar el enlace:", err);
    res.status(500).json({ message: 'Hubo un error al procesar tu solicitud.' });
  }
});

// Eliminar enlaces de perfil
router.post("/profile/delete-link", isAuthenticated, async (req, res) => {
  const { deleteLinkId } = req.body;
  const userId = req.session.userId;

  try {
    const result = await db.query('DELETE FROM user_links WHERE link_id = ? AND user_id = ?', [deleteLinkId, userId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Enlace no encontrado o no tienes permiso para eliminarlo.' });
    }
    return res.status(200).json({ message: 'Enlace eliminado correctamente.' });
  } catch (err) {
    console.error("Error al eliminar el enlace:", err);
    res.status(500).json({ message: 'Error al eliminar el enlace.' });
  }
});
// ---- RUTAS DE CURSOS ----

// Página de todos los cursos (requiere autenticación)
router.get("/course", isAuthenticated, async (req, res) => {
  try {
      // Obtener todos los cursos de la base de datos
      const [courses] = await db.query('SELECT * FROM courses');
      
      // Pasar el ID del usuario actual para diferenciar si el usuario es el creador del curso
      const userId = req.session.userId;

      // Renderizar la vista 'course.ejs' con los cursos obtenidos y el usuario actual
      res.render("course.ejs", { courses, userId });
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
    res.render("create_course.ejs", { course: null, categories }); // Pasar `course: null` para evitar errores en la vista
  } catch (err) {
    console.error("Error al cargar la página de creación de curso:", err);
    res.status(500).json({ error: 'Error en el servidor al cargar la página de creación de curso.' });
  }
});

// Ruta para mostrar el formulario de edición de curso (requiere autenticación)
router.get('/course/edit/:courseId', isAuthenticated, async (req, res) => {
  const courseId = req.params.courseId;

  try {
    // Obtener el curso por ID
    const [courseResult] = await db.query('SELECT * FROM courses WHERE course_id = ?', [courseId]);
    const course = courseResult[0];

    // Validar si el curso existe
    if (!course) {
      req.flash('errorMessage', 'El curso no existe.');
      return res.redirect('/my_courses');
    }

    // Obtener todas las categorías para el formulario de selección
    const [categories] = await db.query('SELECT category_id, name FROM categories');

    // Renderizar la vista de edición con los datos del curso y categorías
    res.render('create_course.ejs', { course, categories });
  } catch (err) {
    console.error("Error al cargar el curso para edición:", err);
    req.flash('errorMessage', 'Hubo un error al cargar el curso.');
    res.redirect('/my_courses');
  }
});

// Ruta para procesar la edición de un curso (requiere autenticación)
router.post('/course/edit/:courseId', isAuthenticated, async (req, res) => {
  const courseId = req.params.courseId;
  const { name, description, language, cover_image, category, requirements, section_title, video_url } = req.body;

  try {
    // Iniciar transacción
    await db.query('START TRANSACTION');

    // Actualizar los datos principales del curso
    await db.query(
      'UPDATE courses SET name = ?, description = ?, language = ?, cover_image = ? WHERE course_id = ?',
      [name, description, language, cover_image, courseId]
    );

    // Actualizar categoría
    if (category) {
      await db.query('DELETE FROM course_categories WHERE course_id = ?', [courseId]);
      await db.query('INSERT INTO course_categories (course_id, category_id) VALUES (?, ?)', [courseId, category]);
    }

    // Actualizar requisitos
    await db.query('DELETE FROM requirements WHERE course_id = ?', [courseId]);
    if (requirements && Array.isArray(requirements)) {
      for (let requirement of requirements) {
        if (requirement.trim()) {
          await db.query('INSERT INTO requirements (course_id, requirement_text) VALUES (?, ?)', [courseId, requirement]);
        }
      }
    }

    // Actualizar secciones
    await db.query('DELETE FROM sections WHERE course_id = ?', [courseId]);
    if (section_title && video_url && Array.isArray(section_title) && Array.isArray(video_url)) {
      for (let i = 0; i < section_title.length; i++) {
        if (section_title[i].trim() && video_url[i].trim()) {
          await db.query('INSERT INTO sections (course_id, title, video_url) VALUES (?, ?, ?)', [courseId, section_title[i], video_url[i]]);
        }
      }
    }

    // Confirmar transacción
    await db.query('COMMIT');
    req.flash('successMessage', 'Curso actualizado exitosamente.');
    res.redirect('/my_courses');
  } catch (err) {
    await db.query('ROLLBACK');
    console.error("Error al actualizar el curso:", err);
    req.flash('errorMessage', 'Hubo un error al actualizar el curso.');
    res.redirect('/course/edit/' + courseId);
  }
});

// Crear un curso (requiere autenticación)
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
    res.redirect('/my_courses');
  } catch (err) {
    await db.query('ROLLBACK');
    console.error("Error al crear el curso:", err);
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
  const userId = req.session.userId;

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
    const sectionsResult = await db.query(
      'SELECT section_id, course_id, title, video_url FROM sections WHERE course_id = ?', 
      [courseId]
    );
    const sections = sectionsResult[0];

    // Transformar las URLs de YouTube para que sean reproducibles en iframe
    const processedSections = sections.map(section => ({
      ...section,
      video_url: transformYouTubeUrl(section.video_url)
    }));

    // Consulta para obtener las valoraciones del curso
    const ratingsResult = await db.query(
      'SELECT r.rating, r.comment, r.created_at, u.first_name, u.last_name FROM ratings r JOIN users u ON r.user_id = u.user_id WHERE r.course_id = ?',
      [courseId]
    );
    const ratings = ratingsResult[0];

    // Consulta para obtener el promedio de las calificaciones
    const [averageRatingResult] = await db.query(
      'SELECT AVG(rating) AS averageRating, COUNT(*) AS totalRatings FROM ratings WHERE course_id = ?', 
      [courseId]
    );
    const { averageRating = 0, totalRatings = 0 } = averageRatingResult[0] || {};

    // Verificar si el usuario ya ha valorado el curso
    const [userRating] = await db.query(
      'SELECT * FROM ratings WHERE course_id = ? AND user_id = ?',
      [courseId, userId]
    );
    const hasRated = userRating.length > 0;

    // Renderizar la página del reproductor de curso
    res.render("course_player", {
      course: courseDetails[0],             // Detalles del curso
      sections: processedSections,          // Secciones procesadas
      ratings,                              // Valoraciones
      averageRating: parseFloat(averageRating).toFixed(1), // Promedio de valoraciones, formateado a un decimal
      totalRatings,                         // Total de valoraciones
      userId,                               // ID del usuario autenticado
      hasRated,                             // Indica si el usuario ya ha valorado
      successMessage: req.flash('successMessage'),
      errorMessage: req.flash('errorMessage')
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

    // Comprobar si el usuario ya ha valorado este curso
    const [existingRating] = await db.query(
      'SELECT * FROM ratings WHERE course_id = ? AND user_id = ?',
      [course_id, user_id]
    );

    const hasRated = existingRating.length > 0;

    if (hasRated) {
      // Si ya existe una valoración, mostrar un mensaje de error
      req.flash('errorMessage', 'Ya has valorado este curso.');
      return res.redirect(`/course_player/${course_id}`);
    }

    // Insertar la nueva valoración en la base de datos
    await db.query(
      'INSERT INTO ratings (course_id, user_id, rating, comment, created_at) VALUES (?, ?, ?, ?, NOW())',
      [course_id, user_id, rating, comment]
    );

    req.flash('successMessage', 'Valoración añadida correctamente.');

    // Obtener la información actualizada del curso
    const [course] = await db.query('SELECT * FROM courses WHERE course_id = ?', [course_id]);
    const [sections] = await db.query('SELECT * FROM sections WHERE course_id = ?', [course_id]);
    const [ratings] = await db.query(
      'SELECT r.rating, r.comment, r.created_at, u.first_name, u.last_name FROM ratings r JOIN users u ON r.user_id = u.user_id WHERE r.course_id = ? ORDER BY r.created_at DESC',
      [course_id]
    );

    // Calcular el promedio de las valoraciones y el total de valoraciones
    const [averageResult] = await db.query(
      'SELECT AVG(rating) AS averageRating, COUNT(*) AS totalRatings FROM ratings WHERE course_id = ?',
      [course_id]
    );
    const averageRating = averageResult[0].averageRating ? parseFloat(averageResult[0].averageRating).toFixed(1) : '0.0';
    const totalRatings = averageResult[0].totalRatings || 0;

    // Renderizar la vista actualizada
    res.render('course_player', {
      course: course[0],
      sections,
      ratings,
      averageRating,
      totalRatings,
      userId: req.session.userId,
      hasRated, // Pasamos hasRated a la vista
      successMessage: req.flash('successMessage'),
      errorMessage: null
    });
  } catch (err) {
    console.error('Error al añadir la valoración:', err);
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
