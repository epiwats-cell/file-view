'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { db, logAudit } = require('../db');

const router = express.Router();

// Manage admin accounts (the only people who can sign in).
router.get('/', (req, res) => {
  const admins = db.prepare('SELECT id, username, full_name, created_at FROM admins ORDER BY username').all();
  res.render('admins', { title: 'Admin Accounts', admins });
});

router.post('/', (req, res) => {
  const { username, full_name, password } = req.body;
  if (!username || !password) {
    req.session.flash = { type: 'error', message: 'Username and password are required.' };
    return res.redirect('/admins');
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO admins (username, password_hash, full_name) VALUES (?, ?, ?)')
      .run(username.trim(), hash, full_name || null);
    logAudit(res.locals.admin.username, 'admin.create', `admin ${username}`);
    req.session.flash = { type: 'success', message: `Admin "${username}" created.` };
  } catch (e) {
    req.session.flash = { type: 'error', message: 'Could not create admin: ' + e.message };
  }
  res.redirect('/admins');
});

// Change password (own or another admin's).
router.post('/:id/password', (req, res) => {
  const { password } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.params.id);
  if (!admin) {
    req.session.flash = { type: 'error', message: 'Admin not found.' };
    return res.redirect('/admins');
  }
  if (!password || password.length < 6) {
    req.session.flash = { type: 'error', message: 'Password must be at least 6 characters.' };
    return res.redirect('/admins');
  }
  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), admin.id);
  logAudit(res.locals.admin.username, 'admin.password', `changed password for ${admin.username}`);
  req.session.flash = { type: 'success', message: `Password updated for "${admin.username}".` };
  res.redirect('/admins');
});

router.post('/:id/delete', (req, res) => {
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.params.id);
  if (!admin) {
    req.session.flash = { type: 'error', message: 'Admin not found.' };
    return res.redirect('/admins');
  }
  const count = db.prepare('SELECT COUNT(*) AS c FROM admins').get().c;
  if (count <= 1) {
    req.session.flash = { type: 'error', message: 'Cannot delete the last admin account.' };
    return res.redirect('/admins');
  }
  if (admin.id === req.session.adminId) {
    req.session.flash = { type: 'error', message: 'You cannot delete your own account while signed in.' };
    return res.redirect('/admins');
  }
  db.prepare('DELETE FROM admins WHERE id = ?').run(admin.id);
  logAudit(res.locals.admin.username, 'admin.delete', `admin ${admin.username}`);
  req.session.flash = { type: 'success', message: `Admin "${admin.username}" deleted.` };
  res.redirect('/admins');
});

module.exports = router;
