import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import indexRoutes from './routes/index.js';
import db from './db/database.js';

const app = express();

// Configuración de express-session
app.use(session({
  secret: 'tu_secreto_aqui', // Cambia esto por una cadena secreta larga y aleatoria
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Cambia a true si tu sitio usa HTTPS
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const __dirname = dirname(fileURLToPath(import.meta.url));

app.set('views', join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware para hacer userId disponible en todas las vistas
app.use((req, res, next) => {
  res.locals.userId = req.session.userId || null;
  next();
});

// Usar las rutas
app.use(indexRoutes);

// Servir archivos estáticos
app.use(express.static(join(__dirname, 'public')));

app.listen(4000, () => {
  console.log('Server running on port 4000');
});