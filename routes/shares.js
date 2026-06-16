'use strict';

const express = require('express');
const { db, logAudit } = require('../db');

const router = express.Router();

// List all servers with their shares.
router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();

  const servers = db
    .prepare(
      `SELECT s.*, COUNT(sh.id) AS share_count
       FROM servers s LEFT JOIN shares sh ON sh.server_id = s.id
       GROUP BY s.id ORDER BY s.name`
    )
    .all();

  let shareSql = `SELECT sh.*, s.name AS server_name, COUNT(a.id) AS user_count
                  FROM shares sh
                  JOIN servers s ON s.id = sh.server_id
                  LEFT JOIN access a ON a.share_id = sh.id`;
  const params = [];
  if (q) {
    shareSql += ' WHERE sh.name LIKE ? OR sh.path LIKE ? OR s.name LIKE ?';
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  shareSql += ' GROUP BY sh.id ORDER BY s.name, sh.name';
  const shares = db.prepare(shareSql).all(...params);

  res.render('shares', { title: 'File Shares', servers, shares, q });
});

/* ---------- Servers ---------- */

router.get('/servers/new', (req, res) => {
  res.render('server_form', { title: 'Add File Share Server', server: {}, action: '/shares/servers', isNew: true });
});

router.post('/servers', (req, res) => {
  const { name, host, location, description } = req.body;
  if (!name) {
    req.session.flash = { type: 'error', message: 'Server name is required.' };
    return res.redirect('/shares/servers/new');
  }
  try {
    const info = db
      .prepare('INSERT INTO servers (name, host, location, description) VALUES (?, ?, ?, ?)')
      .run(name.trim(), host || null, location || null, description || null);
    logAudit(res.locals.admin.username, 'server.create', `server ${name} (#${info.lastInsertRowid})`);
    req.session.flash = { type: 'success', message: `Server "${name}" added.` };
    res.redirect(`/shares/servers/${info.lastInsertRowid}`);
  } catch (e) {
    req.session.flash = { type: 'error', message: 'Could not add server: ' + e.message };
    res.redirect('/shares/servers/new');
  }
});

// Server detail: its shares + who has access to each.
router.get('/servers/:id', (req, res, next) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return next();
  const shares = db
    .prepare(
      `SELECT sh.*, COUNT(a.id) AS user_count
       FROM shares sh LEFT JOIN access a ON a.share_id = sh.id
       WHERE sh.server_id = ? GROUP BY sh.id ORDER BY sh.name`
    )
    .all(server.id);
  res.render('server_detail', { title: server.name, server, shares });
});

router.get('/servers/:id/edit', (req, res, next) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return next();
  res.render('server_form', { title: 'Edit Server', server, action: `/shares/servers/${server.id}`, isNew: false });
});

router.post('/servers/:id', (req, res, next) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return next();
  const { name, host, location, description } = req.body;
  try {
    db.prepare('UPDATE servers SET name=?, host=?, location=?, description=? WHERE id=?')
      .run(name.trim(), host || null, location || null, description || null, server.id);
    logAudit(res.locals.admin.username, 'server.update', `server ${name} (#${server.id})`);
    req.session.flash = { type: 'success', message: 'Server updated.' };
    res.redirect(`/shares/servers/${server.id}`);
  } catch (e) {
    req.session.flash = { type: 'error', message: 'Could not update server: ' + e.message };
    res.redirect(`/shares/servers/${server.id}/edit`);
  }
});

router.post('/servers/:id/delete', (req, res, next) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return next();
  db.prepare('DELETE FROM servers WHERE id = ?').run(server.id);
  logAudit(res.locals.admin.username, 'server.delete', `server ${server.name} (#${server.id})`);
  req.session.flash = { type: 'success', message: `Server "${server.name}" and its shares deleted.` };
  res.redirect('/shares');
});

/* ---------- Sub file shares ---------- */

router.get('/new', (req, res) => {
  const servers = db.prepare('SELECT id, name FROM servers ORDER BY name').all();
  const serverId = req.query.server ? Number(req.query.server) : null;
  res.render('share_form', { title: 'Add File Share', share: { server_id: serverId }, servers, action: '/shares', isNew: true });
});

router.post('/', (req, res) => {
  const { server_id, name, path: sharePath, description } = req.body;
  if (!server_id || !name) {
    req.session.flash = { type: 'error', message: 'Server and share name are required.' };
    return res.redirect('/shares/new');
  }
  try {
    const info = db
      .prepare('INSERT INTO shares (server_id, name, path, description) VALUES (?, ?, ?, ?)')
      .run(Number(server_id), name.trim(), sharePath || null, description || null);
    logAudit(res.locals.admin.username, 'share.create', `share ${name} (#${info.lastInsertRowid})`);
    req.session.flash = { type: 'success', message: `File share "${name}" added.` };
    res.redirect(`/shares/${info.lastInsertRowid}`);
  } catch (e) {
    req.session.flash = { type: 'error', message: 'Could not add share: ' + e.message };
    res.redirect('/shares/new');
  }
});

// Share detail: profile + users with access.
router.get('/:id', (req, res, next) => {
  const share = db
    .prepare(
      `SELECT sh.*, s.name AS server_name, s.id AS server_id
       FROM shares sh JOIN servers s ON s.id = sh.server_id WHERE sh.id = ?`
    )
    .get(req.params.id);
  if (!share) return next();

  const grants = db
    .prepare(
      `SELECT a.id AS access_id, a.permission, a.granted_at, a.granted_by,
              u.id AS user_id, u.full_name, u.username, u.department
       FROM access a JOIN users u ON u.id = a.user_id
       WHERE a.share_id = ? ORDER BY u.full_name`
    )
    .all(share.id);

  const availableUsers = db
    .prepare(
      `SELECT id, full_name, username, department FROM users
       WHERE id NOT IN (SELECT user_id FROM access WHERE share_id = ?)
       ORDER BY full_name`
    )
    .all(share.id);

  res.render('share_detail', { title: share.name, share, grants, availableUsers });
});

router.get('/:id/edit', (req, res, next) => {
  const share = db.prepare('SELECT * FROM shares WHERE id = ?').get(req.params.id);
  if (!share) return next();
  const servers = db.prepare('SELECT id, name FROM servers ORDER BY name').all();
  res.render('share_form', { title: 'Edit File Share', share, servers, action: `/shares/${share.id}`, isNew: false });
});

router.post('/:id', (req, res, next) => {
  const share = db.prepare('SELECT * FROM shares WHERE id = ?').get(req.params.id);
  if (!share) return next();
  const { server_id, name, path: sharePath, description } = req.body;
  try {
    db.prepare('UPDATE shares SET server_id=?, name=?, path=?, description=? WHERE id=?')
      .run(Number(server_id), name.trim(), sharePath || null, description || null, share.id);
    logAudit(res.locals.admin.username, 'share.update', `share ${name} (#${share.id})`);
    req.session.flash = { type: 'success', message: 'File share updated.' };
    res.redirect(`/shares/${share.id}`);
  } catch (e) {
    req.session.flash = { type: 'error', message: 'Could not update share: ' + e.message };
    res.redirect(`/shares/${share.id}/edit`);
  }
});

router.post('/:id/delete', (req, res, next) => {
  const share = db.prepare('SELECT * FROM shares WHERE id = ?').get(req.params.id);
  if (!share) return next();
  db.prepare('DELETE FROM shares WHERE id = ?').run(share.id);
  logAudit(res.locals.admin.username, 'share.delete', `share ${share.name} (#${share.id})`);
  req.session.flash = { type: 'success', message: `File share "${share.name}" deleted.` };
  res.redirect('/shares');
});

module.exports = router;
