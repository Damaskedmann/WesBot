// util/ankh.js
import axios from 'axios';
import cheerio from 'cheerio';
const KHONSHU = process.env.KHONSHU_BASE || 'https://khonshu-ankh.vercel.app';

// Fetch champion page and try to extract counters/immunities/abilities summary
export async function fetchChampionLive(name){
  try {
    // attempt find slug form
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const url = `${KHONSHU}/champions/${encodeURIComponent(slug)}`;
    const res = await axios.get(url, { timeout: 15000 });
    const $ = cheerio.load(res.data);
    const summary = $('meta[name="description"]').attr('content') || $('p').first().text();
    const immunities = $('.immunities').text() || '';
    const abilities = $('.abilities').text() || '';
    // Attempt counters block
    const counters = [];
    $('section:contains("Counters") li, .counters li').each((i,el) => {
      counters.push($(el).text().trim());
    });
    // fallback: look for keywords in page text that look like "Counters: X"
    if (!counters.length) {
      const txt = $('body').text();
      const m = txt.match(/Counters?:\\s*([A-Za-z0-9,\\s]+)/i);
      if (m) counters.push(...m[1].split(',').map(s=>s.trim()));
    }
    return { summary: summary && summary.trim().slice(0,1000), immunities: immunities.trim(), abilities: abilities.trim(), counters };
  } catch (err) {
    // fail gracefully
    return null;
  }
}
