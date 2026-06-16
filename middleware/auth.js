'use strict';

const { db } = require('../db');

function attachUser(req, res, next) {
  if (req.session && req.session.adminId) {
    const admin = db
      .prepare('SELECT id, username, full_name FROM admins WHERE id = ?')
      .get(req.session.adminId);
    res.locals.admin = admin || null;
    if (!admin) {
      // Session points at a deleted admin - clear it.
      req.session.adminId = null;
    }
  } else {
    res.locals.admin = null;
  }
  next();
}

function requireAuth(req, res, next) {
  if (req.session && req.session.adminId && res.locals.admin) {
    return next();
  }
  req.session.flash = { type: 'error', message: 'Please sign in to continue.' };
  req.session.returnTo = req.originalUrl;
  return res.redirect('/login');
}

module.exports = { attachUser, requireAuth };
