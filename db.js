// db.js
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
const DB_PATH = process.env.DATABASE_PATH || './data/wesbot.db';
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const db = new Database(DB_PATH);
export function initDb() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS champions (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE,
    raw_json TEXT,
    last_updated TEXT
  );
  CREATE TABLE IF NOT EXISTS counters (
    id INTEGER PRIMARY KEY,
    champ_name TEXT,
    counter_hint TEXT
  );
  CREATE TABLE IF NOT EXISTS duel_targets (
    id INTEGER PRIMARY KEY,
    champ TEXT,
    owner TEXT,
    added_by TEXT,
    added_at TEXT
  );
  CREATE TABLE IF NOT EXISTS roster (
    id INTEGER PRIMARY KEY,
    user TEXT,
    bg TEXT,
    champ TEXT,
    star TEXT,
    rank TEXT,
    sig TEXT,
    added_by TEXT,
    added_at TEXT
  );
  CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT);
  `);
  // create some indexes for speed
  db.exec(`CREATE INDEX IF NOT EXISTS idx_roster_user ON roster(user); CREATE INDEX IF NOT EXISTS idx_roster_bg ON roster(bg);`);
}
export { db };
