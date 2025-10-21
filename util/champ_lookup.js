// util/champ_lookup.js
import { db } from '../db.js';
import Fuse from 'fuse.js';
import axios from 'axios';
const KHONSHU = process.env.KHONSHU_BASE || 'https://khonshu-ankh.vercel.app';

// get all champion names from DB; if none, attempt to fetch list from Khonshu
async function ensureChampionIndex() {
  const rows = db.prepare('SELECT name FROM champions').all().map(r=>r.name);
  if (rows.length) return rows;
  // try fetch index
  try {
    const res = await axios.get(`${KHONSHU}/champions`, { timeout: 15000 });
    const html = res.data;
    // naive extraction of slugs/names
    const m = html.match(/<a[^>]*href="\/champions\/([^"]+)"/g);

    const names = [];
    if (m) {
      for (const a of m) {
        const slug = a.match(/href="\\/champions\\/([^"]+)"/)[1];
        names.push(decodeURIComponent(slug).replace(/-/g,' ').replace(/\\b(\\w)/g,c=>c.toUpperCase()));
      }
    }
    // insert into DB minimal records
    const insert = db.prepare('INSERT OR IGNORE INTO champions (name, raw_json, last_updated) VALUES (?, ?, ?)');
    const now = new Date().toISOString();
    for (const n of names.slice(0,400)) { insert.run(n, JSON.stringify({source: 'ankh'}), now); }
    return names;
  } catch (err) {
    console.error('champ index err', err.message);
    return rows;
  }
}

export async function fuzzyFindChampion(query){
  const all = await ensureChampionIndex();
  if (!all || all.length === 0) return [];
  const fuse = new Fuse(all, { includeScore:true, threshold:0.4 });
  const res = fuse.search(query).map(r=>r.item);
  // if exact match exists prioritize
  const exact = all.find(a => a.toLowerCase() === query.toLowerCase());
  if (exact) return [exact];
  return res.length ? res : [];
}

export async function getChampionByName(name){
  return db.prepare('SELECT raw_json FROM champions WHERE name = ?').get(name);
}
