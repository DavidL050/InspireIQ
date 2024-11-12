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

    
    let coursesProgress = [];

    
    if (user.role === 'student') {
      const [progress] = await db.query(`
        SELECT c.name AS course_name, cp.progress, e.status
        FROM enrollments e
        JOIN courses c ON e.course_id = c.course_id
        LEFT JOIN course_progress cp ON cp.user_id = e.user_id AND cp.course_id = e.course_id
        WHERE e.user_id = ?
      `, [req.session.userId]);
      
      coursesProgress = progress;  
    }

    // Obtener enlaces sociales del usuario
    const userLinks = await getUserLinks(req.session.userId);
    
    // Renderizar la vista 'profile.ejs' pasando todos los datos
    res.render("profile.ejs", { 
      user, 
      coursesProgress,  // Pasar el array coursesProgress
      userLinks 
    });
  } catch (err) {
    console.error("Error al obtener el perfil del usuario:", err);
    res.status(500).json({ error: 'Error en el servidor al obtener el perfil del usuario' });
  }
});


// Ruta para actualizar la foto de perfil
router.post('/profile/upload-photo', isAuthenticated, upload.single('profilePhoto'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Por favor, selecciona una imagen.' });
    }

    const userId = req.session.userId;
    const profileImage = `/uploads/${req.file.filename}`;

    const [result] = await db.query('UPDATE users SET profile_image = ? WHERE user_id = ?', [profileImage, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'No se pudo actualizar la foto de perfil.' });
    }

    res.status(200).json({ 
      message: 'Foto de perfil actualizada exitosamente',
      profileImage: profileImage
    });
  } catch (error) {
    console.error('Error al subir la foto de perfil:', error);
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
      const [courses] = await db.query(`
        SELECT c.*, cat.name AS category_name
        FROM courses c
        LEFT JOIN course_categories cc ON c.course_id = cc.course_id
        LEFT JOIN categories cat ON cc.category_id = cat.category_id
      `);
      
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
    res.render("create_course.ejs", { course: null, categories, skills: [], sections: [] }); // Pasar `sections: []` para evitar errores en la vista
  } catch (err) {
    console.error("Error al cargar la página de creación de curso:", err);
    res.status(500).json({ error: 'Error en el servidor al cargar la página de creación de curso.' });
  }
});

// Crear un curso (requiere autenticación)
router.post('/create_course', isAuthenticated, async (req, res) => {
  const { name, description, language, cover_image, category, requirements, section_title, video_url } = req.body;
  const creator_id = req.session.userId;
  
  try {
    await db.query('START TRANSACTION');
    
    // Insertar el curso
    const [result] = await db.query(
      'INSERT INTO courses (name, description, creation_date, creator_id, language, cover_image) VALUES (?, ?, NOW(), ?, ?, ?)',
      [name, description, creator_id, language, cover_image]
    );

    const courseId = result.insertId;
    if (!courseId) throw new Error('Error al obtener el ID del curso insertado');
    
    // Insertar la categoría del curso
    if (category) {
      await db.query('INSERT INTO course_categories (course_id, category_id) VALUES (?, ?)', [courseId, category]);
    }
    
    // Insertar habilidades requeridas (requirements)
    if (requirements && Array.isArray(requirements)) {
      for (let requirement of requirements) {
        if (requirement.trim()) {
          await db.query('INSERT INTO requirements (course_id, requirement_text) VALUES (?, ?)', [courseId, requirement]);
        }
      }
    }
    
    // Insertar secciones del curso
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

    // Obtener las habilidades (requirements) del curso
    const [requirements] = await db.query('SELECT requirement_text FROM requirements WHERE course_id = ?', [courseId]);
    const skills = requirements.map(requirement => requirement.requirement_text);

    // Obtener las secciones del curso
    const [sections] = await db.query('SELECT title, video_url FROM sections WHERE course_id = ?', [courseId]);

    // Renderizar la vista de edición con los datos del curso, categorías, habilidades y secciones
    res.render('create_course.ejs', { course, categories, skills, sections });
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

// Ruta para eliminar un curso (requiere autenticación)
router.post('/course/delete/:courseId', isAuthenticated, async (req, res) => {
  const courseId = req.params.courseId;
  const userId = req.session.userId;

  try {
    // Verificar si el curso pertenece al usuario autenticado
    const [courseResult] = await db.query('SELECT * FROM courses WHERE course_id = ? AND creator_id = ?', [courseId, userId]);
    const course = courseResult[0];

    // Si no se encuentra el curso o no pertenece al usuario, mostrar un mensaje de error
    if (!course) {
      req.flash('errorMessage', 'No tienes permiso para eliminar este curso o el curso no existe.');
      return res.redirect('/my_courses');
    }

    // Iniciar transacción para la eliminación
    await db.query('START TRANSACTION');

    // Eliminar secciones relacionadas
    await db.query('DELETE FROM sections WHERE course_id = ?', [courseId]);

    // Eliminar requisitos relacionados
    await db.query('DELETE FROM requirements WHERE course_id = ?', [courseId]);

    // Eliminar relación con categorías
    await db.query('DELETE FROM course_categories WHERE course_id = ?', [courseId]);

    // Finalmente, eliminar el curso
    await db.query('DELETE FROM courses WHERE course_id = ?', [courseId]);

    // Confirmar transacción
    await db.query('COMMIT');
    req.flash('successMessage', 'Curso eliminado exitosamente.');
    res.redirect('/my_courses');
  } catch (err) {
    // Revertir transacción en caso de error
    await db.query('ROLLBACK');
    console.error("Error al eliminar el curso:", err);
    req.flash('errorMessage', 'Hubo un error al eliminar el curso.');
    res.redirect('/my_courses');
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
// ---- RUTA DE DETALLES DEL CURSO ----
router.get("/course_details/:courseId", isAuthenticated, async (req, res) => {
  const { courseId } = req.params;
  const userId = req.session.userId;

  try {
    // Obtener los detalles del curso
    const [courseDetails] = await db.query('SELECT * FROM courses WHERE course_id = ?', [courseId]);
    if (courseDetails.length === 0) {
      req.flash('errorMessage', 'El curso no existe.');
      return res.redirect('/my_courses');
    }

    const course = courseDetails[0];

    // Verificar si el usuario está inscrito en el curso
    const [enrollmentData] = await db.query(
      'SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    // Definir si el curso ha sido comenzado
    const hasStarted = enrollmentData.length > 0;

    // Renderizar la vista y pasar los detalles del curso y el estado `hasStarted`
    res.render("course_details.ejs", { course, hasStarted, userRole: req.session.userRole });
  } catch (err) {
    console.error("Error al cargar los detalles del curso:", err);
    res.status(500).json({ error: 'Error en el servidor al cargar los detalles del curso' });
  }
});

// ---- RUTA DEL REPRODUCTOR DE CURSO ----

// Función auxiliar para transformar URLs de YouTube en URLs embebidas con soporte para tiempo de inicio
function transformYouTubeUrl(url) {
  try {
    if (!url) return '';

    const urlObj = new URL(url);
    let videoId = '';
    let startTime = '';

    // Detectar el ID del video y el tiempo de inicio en varios formatos de URL
    if (urlObj.hostname.includes('youtube.com')) {
      if (urlObj.pathname.includes('/embed/')) {
        videoId = urlObj.pathname.split('/embed/')[1];
        startTime = urlObj.searchParams.get('start');
      } else if (urlObj.pathname.includes('/watch')) {
        videoId = urlObj.searchParams.get('v');
        startTime = urlObj.searchParams.get('t');
      }
    } else if (urlObj.hostname === 'youtu.be') {
      videoId = urlObj.pathname.substring(1);
      startTime = urlObj.searchParams.get('t');
    } else {
      console.error('Formato de URL no soportado:', url);
      return '';
    }

    // Convertir el tiempo de inicio en segundos si está presente
    let startParam = '';
    if (startTime) {
      const timeInSeconds = convertYouTubeTimeToSeconds(startTime);
      startParam = `?start=${timeInSeconds}`;
    }

    // Retornar la URL de embed con o sin el parámetro de inicio
    return videoId ? `https://www.youtube.com/embed/${videoId}${startParam}` : '';
  } catch (e) {
    console.error('Error transformando URL de YouTube:', e);
    return '';
  }
}

// Función para convertir el tiempo de YouTube a segundos
function convertYouTubeTimeToSeconds(time) {
  const match = time.match(/(\d+)(h|m|s)/g);
  if (!match) return parseInt(time, 10);

  let seconds = 0;
  match.forEach(part => {
    const unit = part.slice(-1);
    const amount = parseInt(part.slice(0, -1), 10);

    if (unit === 'h') seconds += amount * 3600;
    if (unit === 'm') seconds += amount * 60;
    if (unit === 's') seconds += amount;
  });

  return seconds;
}



router.get("/course_player/:courseId", isAuthenticated, async (req, res) => {
  const { courseId } = req.params;
  const userId = req.session.userId;

  try {
    // Obtener detalles del curso y verificar inscripción
    const [courseDetails] = await db.query(`
      SELECT 
        c.*, cat.name AS category, e.progress, e.status AS enrollment_status
      FROM courses c
      LEFT JOIN course_categories cc ON c.course_id = cc.course_id
      LEFT JOIN categories cat ON cc.category_id = cat.category_id
      LEFT JOIN enrollments e ON c.course_id = e.course_id AND e.user_id = ?
      WHERE c.course_id = ?`, [userId, courseId]);

    if (!courseDetails.length) {
      req.flash('errorMessage', 'El curso no existe o no estás inscrito.');
      return res.redirect('/course_details/' + courseId);
    }

    const course = courseDetails[0];

    // Obtener secciones del curso
    const [sectionsResult] = await db.query(
      'SELECT section_id, title, video_url FROM sections WHERE course_id = ?',
      [courseId]
    );
    
    // Transformar URLs de YouTube para embebido
    const processedSections = sectionsResult.map(section => ({
      ...section,
      video_url: transformYouTubeUrl(section.video_url)
    }));

    // Obtener valoraciones y progreso del usuario
    const [ratings] = await db.query(`
      SELECT r.rating, r.comment, r.created_at, u.first_name, u.last_name
      FROM ratings r JOIN users u ON r.user_id = u.user_id
      WHERE r.course_id = ? ORDER BY r.created_at DESC`, [courseId]);

    const [[averageRatingResult]] = await db.query(`
      SELECT AVG(rating) AS averageRating, COUNT(*) AS totalRatings
      FROM ratings WHERE course_id = ?`, [courseId]);

    const averageRating = averageRatingResult?.averageRating || 0;
    const totalRatings = averageRatingResult?.totalRatings || 0;

    // Comprobar si el usuario ya ha valorado el curso
    const [userRating] = await db.query(
      'SELECT * FROM ratings WHERE course_id = ? AND user_id = ?',
      [courseId, userId]
    );
    const hasRated = userRating.length > 0;

    // Obtener el progreso actual del usuario en el curso
    const [progressData] = await db.query(`
      SELECT progress, last_viewed_section FROM course_progress
      WHERE user_id = ? AND course_id = ?`, [userId, courseId]);

    const currentProgress = progressData[0]?.progress || 0;
    const lastViewedSection = progressData[0]?.last_viewed_section || processedSections[0]?.section_id;
    const currentSectionVideoUrl = processedSections.find(section => section.section_id === lastViewedSection)?.video_url || processedSections[0]?.video_url;

    res.render("course_player", {
      course,
      sections: processedSections,
      currentSection: lastViewedSection,
      currentSectionVideoUrl,
      ratings,
      averageRating: parseFloat(averageRating).toFixed(1),
      totalRatings,
      userId,
      hasRated,
      currentProgress
    });

  } catch (err) {
    console.error('Error al cargar la página del curso:', err);
    req.flash('errorMessage', 'Hubo un problema al cargar la página del curso.');
    res.redirect('/my_courses');
  }
});


// ---- RUTA PARA INSCRIPCIÓN ----
router.post("/course/:courseId/enroll", isAuthenticated, async (req, res) => {
  const { courseId } = req.params;
  const userId = req.session.userId;

  try {
    // Iniciar transacción
    await db.query('START TRANSACTION');

    // Verificar si el usuario ya está inscrito en el curso
    const [existingEnrollment] = await db.query(
      'SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    if (existingEnrollment.length > 0) {
      // Si ya está inscrito, devolver un mensaje y no insertar de nuevo
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Ya estás inscrito en este curso',
        redirectUrl: `/course_player/${courseId}`
      });
    }

    // Insertar la inscripción en la tabla enrollments
    const [enrollmentResult] = await db.query(
      'INSERT INTO enrollments (user_id, course_id, enrollment_date, progress, status) VALUES (?, ?, NOW(), 0, ?)',
      [userId, courseId, 'enrolled']
    );

    if (enrollmentResult.affectedRows === 0) {
      // Si no se pudo insertar la inscripción, devolver un error
      await db.query('ROLLBACK');
      return res.status(500).json({
        success: false,
        message: 'No se pudo completar la inscripción en el curso'
      });
    }

    // Inicializar el progreso en la tabla course_progress
    const [progressResult] = await db.query(
      'INSERT INTO course_progress (user_id, course_id, progress) VALUES (?, ?, 0)',
      [userId, courseId]
    );

    if (progressResult.affectedRows === 0) {
      // Si no se pudo inicializar el progreso, devolver un error
      await db.query('ROLLBACK');
      return res.status(500).json({
        success: false,
        message: 'No se pudo inicializar el progreso del curso'
      });
    }

    // Confirmar la transacción
    await db.query('COMMIT');

    // Enviar respuesta de éxito con redirección al reproductor del curso
    res.status(201).json({
      success: true,
      message: 'Inscripción exitosa',
      redirectUrl: `/course_player/${courseId}`
    });

  } catch (err) {
    // Revertir la transacción en caso de error
    await db.query('ROLLBACK');
    console.error("Error en la inscripción:", err);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor al procesar la inscripción'
    });
  }
});

// ---- RUTA PARA ACTUALIZAR PROGRESO ----
router.post("/course/:courseId/update-progress", isAuthenticated, async (req, res) => {
  const { courseId } = req.params;
  const userId = req.session.userId;
  const { lastViewedSection, completedSections, totalSections } = req.body;

  try {
    await db.query('START TRANSACTION');

    // Calculate progress as a percentage
    const progress = Math.floor((completedSections / totalSections) * 100);

    // Check if the progress record already exists in the `course_progress` table
    const [[existingProgress]] = await db.query(
      'SELECT progress_id FROM course_progress WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    if (existingProgress) {
      // If the record exists, update the progress and the last viewed section
      await db.query(
        'UPDATE course_progress SET progress = ?, last_viewed_section = ? WHERE user_id = ? AND course_id = ?',
        [progress, lastViewedSection, userId, courseId]
      );
    } else {
      // If the record doesn't exist, insert a new entry in `course_progress`
      await db.query(
        'INSERT INTO course_progress (user_id, course_id, progress, last_viewed_section) VALUES (?, ?, ?, ?)',
        [userId, courseId, progress, lastViewedSection]
      );
    }

    // Update the progress in the `enrollments` table
    await db.query(
      'UPDATE enrollments SET progress = ? WHERE user_id = ? AND course_id = ?',
      [progress, userId, courseId]
    );

    await db.query('COMMIT');

    res.json({
      success: true,
      progress
    });

  } catch (err) {
    await db.query('ROLLBACK');
    console.error("Error updating progress:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
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


export default router;