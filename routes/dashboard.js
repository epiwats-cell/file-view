'use strict';

const express = require('express');
const { db } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const stats = {
    users: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
    activeUsers: db.prepare("SELECT COUNT(*) AS c FROM users WHERE status = 'active'").get().c,
    servers: db.prepare('SELECT COUNT(*) AS c FROM servers').get().c,
    shares: db.prepare('SELECT COUNT(*) AS c FROM shares').get().c,
    grants: db.prepare('SELECT COUNT(*) AS c FROM access').get().c,
  };

  // Users with the most share access.
  const topUsers = db
    .prepare(
      `SELECT u.id, u.full_name, u.department, COUNT(a.id) AS shares
       FROM users u LEFT JOIN access a ON a.user_id = u.id
       GROUP BY u.id ORDER BY shares DESC, u.full_name ASC LIMIT 5`
    )
    .all();

  // Shares with the most users.
  const topShares = db
    .prepare(
      `SELECT sh.id, sh.name, s.name AS server, COUNT(a.id) AS users
       FROM shares sh
       JOIN servers s ON s.id = sh.server_id
       LEFT JOIN access a ON a.share_id = sh.id
       GROUP BY sh.id ORDER BY users DESC, sh.name ASC LIMIT 5`
    )
    .all();

  const recent = db
    .prepare('SELECT actor, action, detail, created_at FROM audit_log ORDER BY id DESC LIMIT 8')
    .all();

  res.render('dashboard', { title: 'Dashboard', stats, topUsers, topShares, recent });
});

module.exports = router;
