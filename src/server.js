import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import indexRoutes from './routes/routes.js';
import db from './db/database.js';
import flash from 'connect-flash';

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

// Inicializar mensajes flash
app.use(flash());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const __dirname = dirname(fileURLToPath(import.meta.url));
app.set('views', join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware para hacer userId disponible en todas las vistas
app.use((req, res, next) => {
  res.locals.userId = req.session.userId || null; // Asegúrate de que userId se asigne correctamente
  console.log('Session ID:', req.sessionID); // Muestra el ID de la sesión
  console.log('Session data:', req.session); // Muestra todos los datos de la sesión
  next();
});
// Middleware para pasar mensajes flash a las vistas
app.use((req, res, next) => {
  res.locals.successMessage = req.flash('successMessage');
  res.locals.errorMessage = req.flash('errorMessage');
  next();
});

// Usar las rutas
app.use(indexRoutes);

// Servir archivos estáticos
app.use(express.static(join(__dirname, 'public')));

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Iniciar el servidor
const PORT = process.env.PORT || 4000; // Permite usar un puerto definido en el entorno
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
