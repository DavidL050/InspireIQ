import { Router } from "express";
import bcrypt from 'bcryptjs';
import db from '../db/database.js';
import multer from 'multer';

const router = Router();

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

router.post("/signin", (req, res) => {
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
                res.redirect('/course'); 
            } else {
                res.status(401).send('Credenciales incorrectas');
            }
        } else {
            res.status(404).send('Usuario no encontrado');
        }
    });
});

// Perfil de usuario
router.get("/profile", (req, res) => res.render("profile.ejs"));

// Ver un curso
router.get("/course", (req, res) => res.render("course.ejs"));

// Detalles de un curso
router.get("/details", (req, res) => res.render("details.ejs"));

export default router;
