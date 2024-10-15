import { Router } from "express";
import { loginUser, logoutUser, registerUser } from "../db/auth.js";

const router = Router();

// Middleware para pasar userId a todas las vistas
router.use((req, res, next) => {
  console.log('User ID en sesión:', req.session.userId);
  console.log('Sesión completa:', req.session);
  res.locals.userId = req.session ? req.session.userId : null;
  next();
});

// Middleware de autenticación
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/signin');
  }
}

// Página principal
router.get("/", (req, res) => res.render("index.ejs"));

// Registro
router.get("/signup", (req, res) => res.render("signup.ejs"));
router.post("/signup", async (req, res) => {
  const { name, lastname, email, password } = req.body;
  try {
    const result = await registerUser(name, lastname, email, password, 'student');
    req.session.userId = result.insertId;
    req.session.save(err => {
      if (err) {
        console.error('Error al guardar la sesión después del registro:', err);
        return res.status(500).send('Error en el servidor');
      }
      res.redirect('/?success=true');
    });
  } catch (err) {
    console.error('Error en el proceso de registro:', err);
    res.status(500).send('Error en el servidor');
  }
});

// Inicio de sesión
router.get("/signin", (req, res) => {
  const successMessage = req.query.success ? "Te has registrado exitosamente. Ahora puedes iniciar sesión." : null;
  const errorMessage = req.query.error || null;
  res.render("signin.ejs", { successMessage, errorMessage });
});

router.post("/signin", async (req, res) => {
  const { email, password } = req.body;
  try {
    await loginUser(email, password, req);
    res.redirect('/');
  } catch (error) {
    console.error('Error en el inicio de sesión:', error.message);
    res.redirect(`/signin?error=${encodeURIComponent(error.message)}`);
  }
});

// Cerrar sesión
router.get("/logout", async (req, res) => {
  try {
    await logoutUser(req);
    res.redirect('/home');
  } catch (err) {
    console.error('Error al cerrar sesión:', err);
    res.status(500).send('Error en el servidor');
  }
});

// Ver un curso (requiere autenticación)
router.get("/course", isAuthenticated, (req, res) => res.render("course.ejs"));

// Detalles de un curso (requiere autenticación)
router.get("/details", isAuthenticated, (req, res) => res.render("details.ejs"));

router.get("/profile", isAuthenticated, (req, res) => res.render("profile.ejs") )

export default router;