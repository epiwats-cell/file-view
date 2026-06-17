'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, 'fileview.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name     TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT UNIQUE,
    username    TEXT NOT NULL UNIQUE,
    full_name   TEXT NOT NULL,
    first_name  TEXT,
    last_name   TEXT,
    email       TEXT,
    department  TEXT,
    title       TEXT,
    status      TEXT NOT NULL DEFAULT 'active',
    note        TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS servers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    host        TEXT,
    location    TEXT,
    description TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS shares (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id   INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    path        TEXT,
    description TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(server_id, name)
  );

  CREATE TABLE IF NOT EXISTS access (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    share_id    INTEGER NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
    permission  TEXT NOT NULL DEFAULT 'read',
    granted_by  TEXT,
    granted_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, share_id)
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    actor      TEXT,
    action     TEXT NOT NULL,
    detail     TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_shares_server ON shares(server_id);
  CREATE INDEX IF NOT EXISTS idx_access_user   ON access(user_id);
  CREATE INDEX IF NOT EXISTS idx_access_share  ON access(share_id);
`);

// --- Lightweight migrations for databases created before first_name/last_name existed ---
function columnExists(table, col) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
}
if (!columnExists('users', 'first_name')) {
  db.exec('ALTER TABLE users ADD COLUMN first_name TEXT');
}
if (!columnExists('users', 'last_name')) {
  db.exec('ALTER TABLE users ADD COLUMN last_name TEXT');
}
// Backfill first/last from existing full_name (first token = first name, rest = last name).
const toBackfill = db
  .prepare("SELECT id, full_name FROM users WHERE (first_name IS NULL OR first_name = '') AND full_name IS NOT NULL AND full_name <> ''")
  .all();
if (toBackfill.length) {
  const upd = db.prepare('UPDATE users SET first_name = ?, last_name = ? WHERE id = ?');
  const tx = db.transaction(() => {
    for (const r of toBackfill) {
      const parts = String(r.full_name).trim().split(/\s+/);
      const first = parts.shift() || '';
      const last = parts.join(' ');
      upd.run(first, last, r.id);
    }
  });
  tx();
}

function logAudit(actor, action, detail) {
  try {
    db.prepare('INSERT INTO audit_log (actor, action, detail) VALUES (?, ?, ?)')
      .run(actor || 'system', action, detail || '');
  } catch (_) {
    /* never let auditing break a request */
  }
}

module.exports = { db, logAudit, DATA_DIR };
