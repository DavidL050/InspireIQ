import { Router } from "express";
import { loginUser, logoutUser, registerUser, getUserById } from "../db/auth.js";

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
    res.render("profile.ejs", { user });
  } catch (err) {
    console.error("Error al obtener el perfil del usuario:", err);
    res.status(500).json({ error: 'Error en el servidor al obtener el perfil del usuario' });
  }
});

// Página de detalles (requiere autenticación)
router.get("/details", isAuthenticated, async (req, res) => {
  try {
    const user = await getUserById(req.session.userId);
    res.render("details.ejs", { user });
  } catch (err) {
    console.error("Error al obtener los detalles del usuario:", err);
    res.status(500).json({ error: 'Error en el servidor al obtener los detalles del usuario' });
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
export default router;