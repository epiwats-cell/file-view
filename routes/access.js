'use strict';

const express = require('express');
const { db, logAudit } = require('../db');

const router = express.Router();

// Grant access (user -> share). Used from both user and share detail pages.
router.post('/grant', (req, res) => {
  const { user_id, share_id, permission, redirect } = req.body;
  if (!user_id || !share_id) {
    req.session.flash = { type: 'error', message: 'User and share are required.' };
    return res.redirect(redirect || '/users');
  }
  try {
    db.prepare(
      `INSERT INTO access (user_id, share_id, permission, granted_by) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, share_id) DO UPDATE SET permission = excluded.permission`
    ).run(Number(user_id), Number(share_id), permission || 'read', res.locals.admin.username);
    logAudit(res.locals.admin.username, 'access.grant', `user#${user_id} -> share#${share_id} (${permission})`);
    req.session.flash = { type: 'success', message: 'Access granted.' };
  } catch (e) {
    req.session.flash = { type: 'error', message: 'Could not grant access: ' + e.message };
  }
  res.redirect(redirect || '/users');
});

// Update an existing grant's permission.
router.post('/:id/permission', (req, res) => {
  const { permission, redirect } = req.body;
  const grant = db.prepare('SELECT * FROM access WHERE id = ?').get(req.params.id);
  if (grant) {
    db.prepare('UPDATE access SET permission = ? WHERE id = ?').run(permission || 'read', grant.id);
    logAudit(res.locals.admin.username, 'access.update', `access#${grant.id} -> ${permission}`);
    req.session.flash = { type: 'success', message: 'Permission updated.' };
  }
  res.redirect(redirect || '/users');
});

// Revoke access.
router.post('/:id/revoke', (req, res) => {
  const { redirect } = req.body;
  const grant = db.prepare('SELECT * FROM access WHERE id = ?').get(req.params.id);
  if (grant) {
    db.prepare('DELETE FROM access WHERE id = ?').run(grant.id);
    logAudit(res.locals.admin.username, 'access.revoke', `access#${grant.id}`);
    req.session.flash = { type: 'success', message: 'Access revoked.' };
  }
  res.redirect(redirect || '/users');
});

module.exports = router;
