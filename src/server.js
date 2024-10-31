import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import flash from 'connect-flash';
import multer from 'multer';
import indexRoutes from './routes/routes.js';
import path from 'path';
const app = express();

// Configuración de express-session
app.use(session({
  secret: 'tusecretoestáasalvo', // Cambia esto por una cadena secreta larga y aleatoria
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // Usa true en producción con HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'src/public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${req.session.userId}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes'), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
}).single('profilePhoto');

// Inicializar mensajes flash
app.use(flash());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de vistas
const __dirname = dirname(fileURLToPath(import.meta.url));
app.set('views', join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware para hacer userId y userRole disponibles en todas las vistas
app.use((req, res, next) => {
  res.locals.userId = req.session.userId || null;
  res.locals.userRole = req.session.userRole || null;
  next();
});

// Middleware para pasar mensajes flash a las vistas
app.use((req, res, next) => {
  res.locals.successMessage = req.flash('successMessage');
  res.locals.errorMessage = req.flash('errorMessage');
  next();
});

// Servir archivos estáticos
app.use(express.static(join(__dirname, 'public')));

// Usar las rutas
app.use(indexRoutes);

// Middleware para configurar el tipo de contenido para CSS
app.use((req, res, next) => {
  if (req.path.endsWith('.css')) {
    res.setHeader('Content-Type', 'text/css');
  }
  next();
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Algo salió mal');
});

// Iniciar el servidor
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


