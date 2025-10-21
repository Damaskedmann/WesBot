// data/duel.js
import { db } from '../db.js';
export function registerDuelTarget(champ, owner, addedBy) {
  const now = new Date().toISOString();
  db.prepare('INSERT INTO duel_targets (champ, owner, added_by, added_at) VALUES (?, ?, ?, ?)').run(champ, owner, addedBy, now);
}
export function listDuelTargets() {
  return db.prepare('SELECT champ, owner, added_at FROM duel_targets ORDER BY id DESC LIMIT 50').all();
}
