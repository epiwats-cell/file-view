'use strict';

const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

const { DATA_DIR } = require('./db');
const { requireAuth, attachUser } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const userRoutes = require('./routes/users');
const shareRoutes = require('./routes/shares');
const accessRoutes = require('./routes/access');
const importRoutes = require('./routes/import');
const reportRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admins');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'public')));

app.use(
  session({
    store: new SQLiteStore({ db: 'sessions.db', dir: DATA_DIR }),
    secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 }, // 8 hours
  })
);

// Make logged-in admin + flash messages available to every view.
app.use(attachUser);
app.use((req, res, next) => {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.currentPath = req.path;
  next();
});

// Public auth routes (login / logout).
app.use('/', authRoutes);

// Everything below requires an authenticated admin.
app.use('/dashboard', requireAuth, dashboardRoutes);
app.use('/users', requireAuth, userRoutes);
app.use('/shares', requireAuth, shareRoutes);
app.use('/access', requireAuth, accessRoutes);
app.use('/import', requireAuth, importRoutes);
app.use('/reports', requireAuth, reportRoutes);
app.use('/admins', requireAuth, adminRoutes);

app.get('/', (req, res) => {
  if (req.session.adminId) return res.redirect('/dashboard');
  return res.redirect('/login');
});

// 404
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Not Found',
    code: 404,
    message: 'The page you requested was not found.',
  });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', {
    title: 'Server Error',
    code: 500,
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`File-View running at http://localhost:${PORT}`);
});

module.exports = app;
