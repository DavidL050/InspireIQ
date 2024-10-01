import { Router } from "express";

const router = Router();

// principal
router.get("/", (req, res) => res.render("index.ejs"));

//  home
router.get("/home", (req, res) => res.render("index.ejs"));

// registro
router.get("/signup", (req, res) => res.render("signup.ejs"));

// inicio de sesión
router.get("/signin", (req, res) => res.render("signin.ejs"));

//  perfil de usuario
router.get("/profile", (req, res) => res.render("profile.ejs"));

// ver un curso
router.get("/course", (req, res) => res.render("course.ejs"));

// detalles de un curso
router.get("/details", (req, res) => res.render("details.ejs"));

export default router;
