// db.js - SQLite Database Adapter
// Uses better-sqlite3 or Node.js native built-in node:sqlite seamlessly without external DB setup
const path = require('path');
const os = require('os');
const fs = require('fs');

// Detect serverless environment (Vercel / AWS Lambda)
const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME);

// On Vercel serverless, root directory is read-only. Use os.tmpdir() to allow SQLite write access.
const dbPath = isVercel ? path.join(os.tmpdir(), 'crm.db') : path.join(__dirname, 'crm.db');

// Seed/copy initial database file to /tmp if present
if (isVercel && fs.existsSync(path.join(__dirname, 'crm.db')) && !fs.existsSync(dbPath)) {
  try {
    fs.copyFileSync(path.join(__dirname, 'crm.db'), dbPath);
  } catch (err) {
    console.warn('[DB] Could not copy initial crm.db to /tmp:', err.message);
  }
}

let db;
try {
  const BetterSqlite = require('better-sqlite3');
  db = new BetterSqlite(dbPath);
  try { db.pragma('journal_mode = WAL'); } catch (e) {}
  console.log(`[DB] Using better-sqlite3 engine (${isVercel ? 'serverless /tmp' : 'local'}).`);
} catch (err) {
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(dbPath);
  console.log(`[DB] Using Node.js native built-in node:sqlite engine (${isVercel ? 'serverless /tmp' : 'local'}).`);
}

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'contacted', 'qualified', 'closed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = db;
