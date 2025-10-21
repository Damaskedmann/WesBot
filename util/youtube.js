// util/youtube.js
import axios from 'axios';
const API = process.env.YOUTUBE_API_KEY;
const TRUSTED = ['mco c noob','mcoc noob','vega','karatemike','seatin','mco cnoob'];

function preferTrusted(items){
  const trusted = [], others = [];
  for (const it of items){
    const ch = (it.snippet.channelTitle||'').toLowerCase();
    const isTrusted = TRUSTED.some(t => ch.includes(t));
    if (isTrusted) trusted.push(it); else others.push(it);
  }
  return trusted.concat(others);
}

export async function youtubeSearch(q){
  if (!API) return [];
  try {
    const qenc = encodeURIComponent(q + ' mcoc');
    const url = `https://www.googleapis.com/youtube/v3/search?key=${API}&part=snippet&type=video&maxResults=6&q=${qenc}`;
    const res = await axios.get(url, { timeout: 10000 });
    const items = res.data.items || [];
    const ordered = preferTrusted(items);
    return ordered.map(it => ({
      title: it.snippet.title,
      channel: it.snippet.channelTitle,
      url: 'https://youtube.com/watch?v=' + it.id.videoId,
      thumbnail: it.snippet.thumbnails?.default?.url || ''
    }));
  } catch (err) {
    console.error('yt search err', err?.message);
    return [];
  }
}
