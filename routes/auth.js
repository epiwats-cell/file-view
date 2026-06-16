'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { db, logAudit } = require('../db');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.adminId) return res.redirect('/dashboard');
  res.render('login', { title: 'Sign in' });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get((username || '').trim());

  if (!admin || !bcrypt.compareSync(password || '', admin.password_hash)) {
    logAudit(username, 'login.failed', `failed login attempt for ${username}`);
    req.session.flash = { type: 'error', message: 'Invalid username or password.' };
    return res.redirect('/login');
  }

  req.session.adminId = admin.id;
  logAudit(admin.username, 'login.success', 'admin signed in');
  const dest = req.session.returnTo || '/dashboard';
  delete req.session.returnTo;
  res.redirect(dest);
});

router.post('/logout', (req, res) => {
  const name = res.locals.admin ? res.locals.admin.username : 'unknown';
  logAudit(name, 'logout', 'admin signed out');
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
