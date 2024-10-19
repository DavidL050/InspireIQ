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

    // Imprimir el resultado para depurar
    console.log("Resultado de la consulta a categorías:", result);

    // Solo tomar el primer elemento del array resultante
    const categories = result[0];  // Esto debería ser la lista de categorías

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