'use strict';

const express = require('express');
const { db, logAudit } = require('../db');

const router = express.Router();

// List + search all users.
router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  const dept = (req.query.dept || '').trim();

  let sql = `SELECT u.*, COUNT(a.id) AS share_count
             FROM users u LEFT JOIN access a ON a.user_id = u.id`;
  const where = [];
  const params = [];
  if (q) {
    where.push('(u.full_name LIKE ? OR u.username LIKE ? OR u.employee_id LIKE ? OR u.email LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (dept) {
    where.push('u.department = ?');
    params.push(dept);
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' GROUP BY u.id ORDER BY u.full_name ASC';

  const users = db.prepare(sql).all(...params);
  const departments = db
    .prepare("SELECT DISTINCT department FROM users WHERE department IS NOT NULL AND department <> '' ORDER BY department")
    .all()
    .map((r) => r.department);

  res.render('users', { title: 'Users', users, q, dept, departments });
});

// New user form.
router.get('/new', (req, res) => {
  res.render('user_form', { title: 'Add User', user: {}, action: '/users', isNew: true });
});

// Create user.
router.post('/', (req, res) => {
  const { employee_id, username, full_name, email, department, title, status, note } = req.body;
  if (!username || !full_name) {
    req.session.flash = { type: 'error', message: 'Username and full name are required.' };
    return res.redirect('/users/new');
  }
  try {
    const info = db
      .prepare(
        `INSERT INTO users (employee_id, username, full_name, email, department, title, status, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        employee_id || null,
        username.trim(),
        full_name.trim(),
        email || null,
        department || null,
        title || null,
        status || 'active',
        note || null
      );
    logAudit(res.locals.admin.username, 'user.create', `user ${username} (#${info.lastInsertRowid})`);
    req.session.flash = { type: 'success', message: `User "${full_name}" added.` };
    res.redirect(`/users/${info.lastInsertRowid}`);
  } catch (e) {
    req.session.flash = { type: 'error', message: 'Could not add user: ' + e.message };
    res.redirect('/users/new');
  }
});

// User detail: profile + shares they can access.
router.get('/:id', (req, res, next) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return next();

  const grants = db
    .prepare(
      `SELECT a.id AS access_id, a.permission, a.granted_at, a.granted_by,
              sh.id AS share_id, sh.name AS share_name, sh.path,
              s.name AS server_name, s.id AS server_id
       FROM access a
       JOIN shares sh ON sh.id = a.share_id
       JOIN servers s ON s.id = sh.server_id
       WHERE a.user_id = ?
       ORDER BY s.name, sh.name`
    )
    .all(user.id);

  // Shares this user does NOT yet have, for the quick-grant dropdown.
  const availableShares = db
    .prepare(
      `SELECT sh.id, sh.name, s.name AS server_name
       FROM shares sh JOIN servers s ON s.id = sh.server_id
       WHERE sh.id NOT IN (SELECT share_id FROM access WHERE user_id = ?)
       ORDER BY s.name, sh.name`
    )
    .all(user.id);

  res.render('user_detail', { title: user.full_name, user, grants, availableShares });
});

// Edit user form.
router.get('/:id/edit', (req, res, next) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return next();
  res.render('user_form', { title: 'Edit User', user, action: `/users/${user.id}`, isNew: false });
});

// Update user.
router.post('/:id', (req, res, next) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return next();
  const { employee_id, username, full_name, email, department, title, status, note } = req.body;
  try {
    db.prepare(
      `UPDATE users SET employee_id=?, username=?, full_name=?, email=?, department=?, title=?, status=?, note=?
       WHERE id=?`
    ).run(
      employee_id || null,
      username.trim(),
      full_name.trim(),
      email || null,
      department || null,
      title || null,
      status || 'active',
      note || null,
      user.id
    );
    logAudit(res.locals.admin.username, 'user.update', `user ${username} (#${user.id})`);
    req.session.flash = { type: 'success', message: 'User updated.' };
    res.redirect(`/users/${user.id}`);
  } catch (e) {
    req.session.flash = { type: 'error', message: 'Could not update user: ' + e.message };
    res.redirect(`/users/${user.id}/edit`);
  }
});

// Delete user.
router.post('/:id/delete', (req, res, next) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return next();
  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  logAudit(res.locals.admin.username, 'user.delete', `user ${user.username} (#${user.id})`);
  req.session.flash = { type: 'success', message: `User "${user.full_name}" deleted.` };
  res.redirect('/users');
});

module.exports = router;
