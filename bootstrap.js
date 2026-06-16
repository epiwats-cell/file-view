'use strict';

/*
 * Runs automatically on server startup. Ensures there is always at least one
 * admin account so the app is usable immediately after `npm start` (no separate
 * seed step required). Demo data is only created via `npm run seed`.
 */

const bcrypt = require('bcryptjs');
const { db, logAudit } = require('./db');

function ensureAdmin() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM admins').get().c;
  if (count > 0) return false;

  const user = process.env.ADMIN_USER || 'admin';
  const pass = process.env.ADMIN_PASS || 'admin1234';
  const hash = bcrypt.hashSync(pass, 10);
  db.prepare('INSERT INTO admins (username, password_hash, full_name) VALUES (?, ?, ?)')
    .run(user, hash, 'System Administrator');
  logAudit('system', 'bootstrap.admin', `created default admin ${user}`);
  console.log('--------------------------------------------------------------');
  console.log(`  No admin found - created default admin account:`);
  console.log(`    username: ${user}`);
  console.log(`    password: ${pass}`);
  console.log('  Please change this password after your first login.');
  console.log('--------------------------------------------------------------');
  return true;
}

module.exports = { ensureAdmin };
