'use strict';

/*
 * Seed script: creates the default admin account and (optionally) some
 * demonstration data so the system is usable immediately after install.
 *
 * Run with:  npm run seed
 *
 * The default admin credentials can be overridden with env vars:
 *   ADMIN_USER, ADMIN_PASS
 */

const bcrypt = require('bcryptjs');
const { db, logAudit } = require('./db');

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin1234';

function ensureAdmin() {
  const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(ADMIN_USER);
  if (existing) {
    console.log(`Admin "${ADMIN_USER}" already exists - skipping.`);
    return;
  }
  const hash = bcrypt.hashSync(ADMIN_PASS, 10);
  db.prepare('INSERT INTO admins (username, password_hash, full_name) VALUES (?, ?, ?)')
    .run(ADMIN_USER, hash, 'System Administrator');
  logAudit('system', 'seed.admin', `created admin ${ADMIN_USER}`);
  console.log(`Created admin account -> username: ${ADMIN_USER}  password: ${ADMIN_PASS}`);
  console.log('!! Please change this password after first login.');
}

function seedDemo() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count > 0) {
    console.log('Data already present - skipping demo seed.');
    return;
  }

  const insUser = db.prepare(
    `INSERT INTO users (employee_id, username, full_name, first_name, last_name, email, department, title)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insServer = db.prepare(
    'INSERT INTO servers (name, host, location, description) VALUES (?, ?, ?, ?)'
  );
  const insShare = db.prepare(
    'INSERT INTO shares (server_id, name, path, description) VALUES (?, ?, ?, ?)'
  );
  const insAccess = db.prepare(
    'INSERT INTO access (user_id, share_id, permission, granted_by) VALUES (?, ?, ?, ?)'
  );

  const tx = db.transaction(() => {
    const u1 = insUser.run('EMP001', 'somchai', 'Somchai Jaidee', 'Somchai', 'Jaidee', 'somchai@example.com', 'Finance', 'Accountant').lastInsertRowid;
    const u2 = insUser.run('EMP002', 'somsri', 'Somsri Rakdee', 'Somsri', 'Rakdee', 'somsri@example.com', 'HR', 'HR Officer').lastInsertRowid;
    const u3 = insUser.run('EMP003', 'piti', 'Piti Sukjai', 'Piti', 'Sukjai', 'piti@example.com', 'IT', 'System Engineer').lastInsertRowid;

    const s1 = insServer.run('FS-HQ-01', '10.0.0.10', 'Head Office', 'Primary head office file server').lastInsertRowid;
    const s2 = insServer.run('FS-DC-02', '10.0.1.20', 'Data Center', 'Secondary data center file server').lastInsertRowid;

    const sh1 = insShare.run(s1, 'Finance', '\\\\FS-HQ-01\\Finance', 'Finance department documents').lastInsertRowid;
    const sh2 = insShare.run(s1, 'HR', '\\\\FS-HQ-01\\HR', 'Human resources documents').lastInsertRowid;
    const sh3 = insShare.run(s1, 'Public', '\\\\FS-HQ-01\\Public', 'Company-wide shared folder').lastInsertRowid;
    const sh4 = insShare.run(s2, 'IT-Backup', '\\\\FS-DC-02\\IT-Backup', 'IT backup storage').lastInsertRowid;

    insAccess.run(u1, sh1, 'full', 'system');
    insAccess.run(u1, sh3, 'read', 'system');
    insAccess.run(u2, sh2, 'full', 'system');
    insAccess.run(u2, sh3, 'read', 'system');
    insAccess.run(u3, sh4, 'full', 'system');
    insAccess.run(u3, sh3, 'write', 'system');
  });
  tx();
  logAudit('system', 'seed.demo', 'inserted demo users/servers/shares');
  console.log('Inserted demonstration data (users, servers, shares, access).');
}

ensureAdmin();
if (process.env.SEED_DEMO !== 'false') {
  seedDemo();
}
console.log('Seed complete.');
