'use strict';

const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { db, logAudit } = require('../db');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function readCsv(buffer) {
  return parse(buffer.toString('utf8'), {
    columns: (header) => header.map((h) => h.trim().toLowerCase()),
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  });
}

router.get('/', (req, res) => {
  res.render('import', { title: 'Import Data', result: null });
});

// Import users from CSV.
// Expected columns: username, full_name, employee_id, email, department, title, status
router.post('/users', upload.single('file'), (req, res) => {
  if (!req.file) {
    req.session.flash = { type: 'error', message: 'Please choose a CSV file.' };
    return res.redirect('/import');
  }

  let rows;
  try {
    rows = readCsv(req.file.buffer);
  } catch (e) {
    req.session.flash = { type: 'error', message: 'Could not parse CSV: ' + e.message };
    return res.redirect('/import');
  }

  const stmt = db.prepare(
    `INSERT INTO users (employee_id, username, full_name, email, department, title, status)
     VALUES (@employee_id, @username, @full_name, @email, @department, @title, @status)
     ON CONFLICT(username) DO UPDATE SET
       employee_id=excluded.employee_id, full_name=excluded.full_name, email=excluded.email,
       department=excluded.department, title=excluded.title, status=excluded.status`
  );

  const summary = { total: rows.length, ok: 0, skipped: 0, errors: [] };
  const tx = db.transaction(() => {
    rows.forEach((row, i) => {
      const username = (row.username || '').trim();
      const fullName = (row.full_name || row.fullname || row.name || '').trim();
      if (!username || !fullName) {
        summary.skipped++;
        summary.errors.push(`Row ${i + 2}: missing username or full_name`);
        return;
      }
      try {
        stmt.run({
          employee_id: row.employee_id || row.emp_id || null,
          username,
          full_name: fullName,
          email: row.email || null,
          department: row.department || row.dept || null,
          title: row.title || null,
          status: row.status || 'active',
        });
        summary.ok++;
      } catch (e) {
        summary.skipped++;
        summary.errors.push(`Row ${i + 2}: ${e.message}`);
      }
    });
  });
  tx();

  logAudit(res.locals.admin.username, 'import.users', `imported ${summary.ok}/${summary.total} users`);
  res.render('import', { title: 'Import Data', result: { kind: 'Users', ...summary } });
});

// Import file share servers + sub shares from CSV.
// Expected columns: server, host, location, server_description, share, path, share_description
router.post('/shares', upload.single('file'), (req, res) => {
  if (!req.file) {
    req.session.flash = { type: 'error', message: 'Please choose a CSV file.' };
    return res.redirect('/import');
  }

  let rows;
  try {
    rows = readCsv(req.file.buffer);
  } catch (e) {
    req.session.flash = { type: 'error', message: 'Could not parse CSV: ' + e.message };
    return res.redirect('/import');
  }

  const getServer = db.prepare('SELECT id FROM servers WHERE name = ?');
  const insServer = db.prepare('INSERT INTO servers (name, host, location, description) VALUES (?, ?, ?, ?)');
  const insShare = db.prepare(
    `INSERT INTO shares (server_id, name, path, description) VALUES (?, ?, ?, ?)
     ON CONFLICT(server_id, name) DO UPDATE SET path=excluded.path, description=excluded.description`
  );

  const summary = { total: rows.length, ok: 0, skipped: 0, errors: [], servers: 0 };
  let lastServerName = ''; // forward-fill: continuation rows may leave "server" blank
  const tx = db.transaction(() => {
    rows.forEach((row, i) => {
      let serverName = (row.server || row.server_name || '').trim();
      if (!serverName) serverName = lastServerName;
      if (!serverName) {
        summary.skipped++;
        summary.errors.push(`Row ${i + 2}: missing server name`);
        return;
      }
      lastServerName = serverName;
      try {
        let server = getServer.get(serverName);
        if (!server) {
          const info = insServer.run(
            serverName,
            row.host || null,
            row.location || null,
            row.server_description || row.server_desc || null
          );
          server = { id: info.lastInsertRowid };
          summary.servers++;
        }
        const shareName = (row.share || row.share_name || '').trim();
        if (shareName) {
          insShare.run(
            server.id,
            shareName,
            row.path || null,
            row.share_description || row.share_desc || row.description || null
          );
        }
        summary.ok++;
      } catch (e) {
        summary.skipped++;
        summary.errors.push(`Row ${i + 2}: ${e.message}`);
      }
    });
  });
  tx();

  logAudit(res.locals.admin.username, 'import.shares', `imported ${summary.ok}/${summary.total} share rows`);
  res.render('import', { title: 'Import Data', result: { kind: 'File Shares', ...summary } });
});

// Sample CSV templates.
router.get('/template/users.csv', (req, res) => {
  res.type('text/csv').attachment('users-template.csv');
  res.send(
    'employee_id,username,full_name,email,department,title,status\n' +
      'EMP100,jdoe,John Doe,jdoe@example.com,Finance,Analyst,active\n'
  );
});

router.get('/template/shares.csv', (req, res) => {
  res.type('text/csv').attachment('shares-template.csv');
  res.send(
    'server,host,location,server_description,share,path,share_description\n' +
      'FS-HQ-01,10.0.0.10,Head Office,Primary server,Finance,\\\\FS-HQ-01\\Finance,Finance docs\n'
  );
});

module.exports = router;
