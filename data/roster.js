// data/roster.js
import { db } from '../db.js';
export function addRosterEntry({user, bg, champ, star, rank, sig, addedBy}) {
  const now = new Date().toISOString();
  db.prepare('INSERT INTO roster (user, bg, champ, star, rank, sig, added_by, added_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(user, bg, champ, star, rank, sig, addedBy, now);
}
export function getUserRoster(user) {
  return db.prepare('SELECT champ, star, rank, sig FROM roster WHERE LOWER(user) = LOWER(?) ORDER BY id DESC').all(user);
}
export function getBgRoster(bg) {
  return db.prepare('SELECT user, champ, star, rank, sig FROM roster WHERE LOWER(bg) = LOWER(?) ORDER BY user').all(bg);
}
