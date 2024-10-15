import { Router } from "express";
import bcrypt from 'bcryptjs';
import db from '../db/database.js';
import multer from 'multer';

const router = Router();

// Middleware para pasar userId a todas las vistas
router.use((req, res, next) => {
  res.locals.userId = req.session ? req.session.userId : null;
  next();
});

// Principal
router.get("/", (req, res) => res.render("index.ejs"));

// Home
router.get("/home", (req, res) => res.render("index.ejs"));

// Registro
router.get("/signup", (req, res) => res.render("signup.ejs"));

router.post("/signup", async (req, res) => {
  const { name, lastname, email, password, area } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const role = area ? 'teacher' : 'student';
    const sql = 'INSERT INTO users (first_name, last_name, email, password, role) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [name, lastname, email, hashedPassword, role], (error, results) => {
      if (error) {
        console.error('Error al registrar el usuario:', error);
        return res.status(500).send('Error en el registro');
      }
      const userId = results.insertId;
      req.session.userId = userId;
      res.redirect('/home?success=true');
    });
  } catch (err) {
    console.error('Error en el proceso de registro:', err);
    res.status(500).send('Error en el servidor');
  }
});

// Inicio de sesión
router.get("/signin", (req, res) => {
  const successMessage = req.query.success ? "Te has registrado exitosamente. Ahora puedes iniciar sesión." : null;
  res.render("signin.ejs", { successMessage });
});

router.post("/signin", async (req, res) => {
  const { email, password } = req.body;
  const sql = 'SELECT * FROM users WHERE email = ?';
  db.query(sql, [email], async (error, results) => {
    if (error) {
      console.error('Error al iniciar sesión:', error);
      return res.status(500).send('Error en el inicio de sesión');
    }
    if (results.length > 0) {
      const user = results[0];
      const validPassword = await bcrypt.compare(password, user.password);
      if (validPassword) {
        req.session.userId = user.id;
        res.redirect('/course');
      } else {
        res.render("signin.ejs", { errorMessage: "Credenciales incorrectas" });
      }
    } else {
      res.render("signin.ejs", { errorMessage: "Usuario no encontrado" });
    }
  });
});

// Cerrar sesión
router.get("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error al cerrar sesión:', err);
      return res.status(500).send('Error al cerrar sesión');
    }
    res.redirect('/');
  });
});

// Perfil de usuario
router.get("/profile", (req, res) => {
  if (req.session && req.session.userId) {
    res.render("profile.ejs");
  } else {
    res.redirect('/signin');
  }
});

// Ver un curso
router.get("/course", (req, res) => res.render("course.ejs"));

// Detalles de un curso
router.get("/details", (req, res) => res.render("details.ejs"));

export default router;