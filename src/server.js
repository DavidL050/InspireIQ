import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import flash from 'connect-flash';
import multer from 'multer';
import indexRoutes from './routes/routes.js';
import path from 'path';
const app = express();


app.use(session({
  secret: process.env.SESSION_SECRET || 'my_temporary_secret_key',
  resave: false, 
  saveUninitialized: true, 
  cookie: {
    secure: false, // Asegúrate de que esté en false en Heroku si no tienes SSL configurado
    maxAge: 60 * 60 * 1000 // 1 hora de duración de la sesión
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
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});


