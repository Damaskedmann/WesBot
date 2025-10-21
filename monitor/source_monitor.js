// monitor/source_monitor.js
import axios from 'axios';
import { db } from '../db.js';
const KHONSHU = process.env.KHONSHU_BASE || 'https://khonshu-ankh.vercel.app';
const WEBHOOK = process.env.MONITOR_WEBHOOK_URL;
async function check(){
  try {
    const res = await axios.get(KHONSHU, { timeout: 8000 });
    const m = res.data.match(/Version\\s+V\\s*([\\d.]+)/i);
    const v = m ? m[1] : res.headers['last-modified'] || null;
    const row = db.prepare('SELECT value FROM metadata WHERE key = ?').get('khonshu_version');
    const known = row?.value || null;
    if (!known && v) db.prepare('INSERT OR REPLACE INTO metadata (key,value) VALUES (?,?)').run('khonshu_version', v);
    else if (v && v !== known) {
      db.prepare('UPDATE metadata SET value = ? WHERE key = ?').run(v, 'khonshu_version');
      if (WEBHOOK) await axios.post(WEBHOOK, { content: `Khonshu updated: ${v}` });
    }
  } catch (e) { console.error('monitor error', e.message); }
}
check();
