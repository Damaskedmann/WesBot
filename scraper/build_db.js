// scraper/build_db.js
import axios from 'axios';
import cheerio from 'cheerio';
import { db } from '../db.js';
const KHONSHU = process.env.KHONSHU_BASE || 'https://khonshu-ankh.vercel.app';
async function collectSlugs(){
  try {
    const res = await axios.get(`${KHONSHU}/champions`, { timeout: 15000 });
    const $ = cheerio.load(res.data);
    const slugs = new Set();
    $('a[href*="/champions/"]').each((i,el) => {
      const href = $(el).attr('href');
      const m = href.match(/\\/champions\\/([^\\/\\?#]+)/);
      if (m) slugs.add(m[1]);
    });
    return Array.from(slugs);
  } catch (e) { console.error('collect slugs failed', e.message); return []; }
}
async function fetchAndStore(slug){
  try {
    const url = `${KHONSHU}/champions/${slug}`;
    const res = await axios.get(url, { timeout: 15000 });
    const name = decodeURIComponent(slug).replace(/-/g,' ').replace(/\\b(\\w)/g,m=>m.toUpperCase());
    const now = new Date().toISOString();
    db.prepare('INSERT OR REPLACE INTO champions (name, raw_json, last_updated) VALUES (?, ?, ?)').run(name, JSON.stringify({source:'ankh', html: res.data}), now);
    console.log('stored', name);
  } catch (err) { console.error('fetch failed', slug, err.message); }
}
(async () => {
  const slugs = await collectSlugs();
  for (const s of slugs.slice(0,500)) {
    await fetchAndStore(s);
    await new Promise(r => setTimeout(r, 600));
  }
  console.log('done build');
})();
