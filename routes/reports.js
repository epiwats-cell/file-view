'use strict';

const express = require('express');
const { stringify } = require('csv-stringify/sync');
const { db } = require('../db');

const router = express.Router();

// The full access matrix: one row per (user, share) grant.
function accessMatrix() {
  return db
    .prepare(
      `SELECT u.employee_id, u.username, u.full_name, u.department,
              s.name AS server, sh.name AS share, sh.path,
              a.permission, a.granted_by, a.granted_at
       FROM access a
       JOIN users u   ON u.id = a.user_id
       JOIN shares sh ON sh.id = a.share_id
       JOIN servers s ON s.id = sh.server_id
       ORDER BY u.full_name, s.name, sh.name`
    )
    .all();
}

router.get('/', (req, res) => {
  const rows = accessMatrix();

  // Users with no access at all.
  const usersNoAccess = db
    .prepare(
      `SELECT u.* FROM users u
       WHERE u.id NOT IN (SELECT user_id FROM access) ORDER BY u.full_name`
    )
    .all();

  // Shares with no users.
  const sharesNoUsers = db
    .prepare(
      `SELECT sh.name AS share, s.name AS server FROM shares sh
       JOIN servers s ON s.id = sh.server_id
       WHERE sh.id NOT IN (SELECT share_id FROM access) ORDER BY s.name, sh.name`
    )
    .all();

  // Access count per department.
  const byDept = db
    .prepare(
      `SELECT COALESCE(NULLIF(u.department,''),'(none)') AS department,
              COUNT(DISTINCT u.id) AS users, COUNT(a.id) AS grants
       FROM users u LEFT JOIN access a ON a.user_id = u.id
       GROUP BY department ORDER BY grants DESC`
    )
    .all();

  res.render('reports', {
    title: 'Reports',
    rows,
    usersNoAccess,
    sharesNoUsers,
    byDept,
  });
});

// Export the access matrix as CSV.
router.get('/export/access.csv', (req, res) => {
  const rows = accessMatrix();
  const csv = stringify(rows, {
    header: true,
    columns: [
      'employee_id', 'username', 'full_name', 'department',
      'server', 'share', 'path', 'permission', 'granted_by', 'granted_at',
    ],
  });
  res.type('text/csv').attachment('access-report.csv').send(csv);
});

// Export users as CSV.
router.get('/export/users.csv', (req, res) => {
  const rows = db
    .prepare('SELECT employee_id, username, full_name, email, department, title, status FROM users ORDER BY full_name')
    .all();
  const csv = stringify(rows, { header: true });
  res.type('text/csv').attachment('users-report.csv').send(csv);
});

// Export shares as CSV.
router.get('/export/shares.csv', (req, res) => {
  const rows = db
    .prepare(
      `SELECT s.name AS server, s.host, s.location, sh.name AS share, sh.path, sh.description
       FROM shares sh JOIN servers s ON s.id = sh.server_id ORDER BY s.name, sh.name`
    )
    .all();
  const csv = stringify(rows, { header: true });
  res.type('text/csv').attachment('shares-report.csv').send(csv);
});

module.exports = router;
