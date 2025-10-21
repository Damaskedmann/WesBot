// index.js
import 'dotenv/config';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { initDb, db } from './db.js';
import { fuzzyFindChampion, getChampionByName } from './util/champ_lookup.js';
import { youtubeSearch } from './util/youtube.js';
import { registerDuelTarget, listDuelTargets } from './data/duel.js';
import { addRosterEntry, getUserRoster, getBgRoster } from './data/roster.js';
import { fetchChampionLive } from './util/ankh.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const WAKE_WORD = process.env.WAKE_WORD || '/wes';
const OWNER_ID = process.env.OWNER_ID;
const WAKE_TIMEOUT_MS = 30000; // 30s for follow-up

// In-memory: userId -> { timer, channelId, context }
const awaiting = new Map();

initDb();

client.once('ready', () => {
  console.log(`✅ WesBot logged in as ${client.user.tag}`);
});

// Helper to send an embed
function sendEmbed(channel, title, description, fields = []) {
  const emb = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
  for (const f of fields) emb.addFields({ name: f.name, value: f.value, inline: f.inline || false });
  return channel.send({ embeds: [emb] });
}

// When someone uses wake word, set awaiting state for that user
client.on('messageCreate', async (msg) => {
  try {
    if (msg.author.bot) return;

    const content = msg.content.trim();

    // If someone is awaiting a follow-up (they used /wes previously), handle their message as the follow-up
    if (awaiting.has(msg.author.id)) {
      const state = awaiting.get(msg.author.id);
      // Only accept response in same channel
      if (state.channelId !== msg.channel.id) return;
      clearTimeout(state.timer);
      awaiting.delete(msg.author.id);
      return handleFollowUp(msg, state.context);
    }

    // If message equals wake word (starts with exact), set awaiting
    if (content === WAKE_WORD || content.startsWith(WAKE_WORD + ' ')) {
      // If they typed "/wes some text" treat the rest as direct follow-up
      const rest = content.length > WAKE_WORD.length ? content.slice(WAKE_WORD.length).trim() : null;
      if (rest) {
        // handle directly as followup
        return handleFollowUp(msg, { mode: 'direct', text: rest });
      }
      // else set awaiting and ask for follow-up
      const timer = setTimeout(() => {
        awaiting.delete(msg.author.id);
        msg.channel.send('⏱️ Timeout — wake me with ' + WAKE_WORD + ' when you need me.');
      }, WAKE_TIMEOUT_MS);
      awaiting.set(msg.author.id, { timer, channelId: msg.channel.id, context: { mode: 'awaiting' } });
      return msg.channel.send('Yes — what do you need? (you have 30 seconds)');
    }

    // Natural-language quick cases if message mentions the bot or uses the prefix
    const lc = content.toLowerCase();

    // If user mentions "guide" or "act" outside wake mode, do a safe quick search but only if message explicitly asks (less sensitive)
    if (lc.includes('guide') || lc.match(/\\bact\\b|\\bstage\\b|\\bpath\\b|\\beasy path\\b/) ) {
      // Do youtube search; proceed only if the message explicitly references guide-like intent
      const results = await youtubeSearch(content);
      if (results && results.length) {
        const lines = results.slice(0,4).map((r,i) => `**${i+1}. ${r.title}** — ${r.channel}\\n${r.url}`);
        return msg.reply(lines.join('\\n\\n'));
      }
    }

    // Otherwise ignore chatter — bot quiet outside wake flow
  } catch (err) {
    console.error('messageCreate error', err);
  }
});

// Follow-up handler: interprets a single follow-up message from a user in wake flow
async function handleFollowUp(msg, context) {
  const text = context.text || msg.content.trim();
  const lc = text.toLowerCase();

  // Duel target workflow
  if (lc.startsWith('duel') || lc.startsWith('duel target') || lc.startsWith('duel-target') ) {
    // ask for input if they only said 'duel'
    if (text.trim().toLowerCase() === 'duel' || text.trim().toLowerCase().startsWith('duel target') && text.trim().split('/').length === 1) {
      // prompt user for the entry
      msg.channel.send('Please enter duel target in this format:\n`CHAMP / USERNAME` (example: Domino / FelixTheSquid)');
      // set awaiting to capture the next message (but reuse same function)
      const timer = setTimeout(() => { awaiting.delete(msg.author.id); msg.channel.send('Timed out.'); }, WAKE_TIMEOUT_MS);
      awaiting.set(msg.author.id, { timer, channelId: msg.channel.id, context: { mode: 'capture_duel' } });
      return;
    }
    // if they included the details in one line
    const parts = text.split('/').map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const champ = parts[0];
      const user = parts[1];
      registerDuelTarget(champ, user, msg.author.id);
      return msg.channel.send(`✅ Duel target saved — **${champ}** (target by ${user}).`);
    }
  }

  // roster add flow: if text starts with "add roster" or "roster add"
  if (lc.startsWith('add roster') || lc.startsWith('roster add')) {
    msg.channel.send('Please enter roster in this format:\n`USER / BG / CHAMP / STAR / RANK / SIG` (example: SMOVV / BG1 / Nico Miranou / 7 / R4 / 200)');
    const timer = setTimeout(() => { awaiting.delete(msg.author.id); msg.channel.send('Timed out.'); }, WAKE_TIMEOUT_MS);
    awaiting.set(msg.author.id, { timer, channelId: msg.channel.id, context: { mode: 'capture_roster' } });
    return;
  }

  // If we are in capture modes (they were prompted previously)
  if (context.mode === 'capture_duel' || context.mode === 'capture_roster') {
    const parts = text.split('/').map(s => s.trim()).filter(Boolean);
    if (context.mode === 'capture_duel') {
      if (parts.length < 2) return msg.channel.send('Bad format. Use: `CHAMP / USERNAME`');
      const champ = parts[0], user = parts[1];
      registerDuelTarget(champ, user, msg.author.id);
      return msg.channel.send(`✅ Duel target saved — **${champ}** (target by ${user}).`);
    } else {
      // roster capture
      // accept either full format or compact
      if (parts.length < 5) return msg.channel.send('Bad format. Use: `USER / BG / CHAMP / STAR / RANK / SIG`');
      const [user, bg, champ, star, rank, sig] = parts;
      addRosterEntry({ user, bg, champ, star, rank, sig, addedBy: msg.author.id });
      return msg.channel.send(`✅ Roster saved for **${user}** (BG: ${bg}) — ${champ} ${star} ${rank} Sig ${sig}`);
    }
  }

  // Query intents
  if (lc.includes('counte') || lc.includes('who beats') || lc.includes('who counters')) {
    // try fuzzy lookup
    const nameCandidate = text.replace(/who\\s+beats|who\\s+counters|counters?|who\\s+is|for|the|a/ig, '').trim();
    const found = await fuzzyFindChampion(nameCandidate);
    if (!found || found.length === 0) return msg.channel.send("I couldn't find that champion. Try full name or tag.");
    const champName = found[0];
    // try a live fetch from Ankh for detailed counters
    const live = await fetchChampionLive(champName);
    if (live && live.counters && live.counters.length) {
      return sendEmbed(msg.channel, `${champName} — Counters`, live.counters.slice(0,10).join(', '));
    }
    // fallback: quick counters table (if DB has)
    const row = db.prepare('SELECT counter_hint FROM counters WHERE champ_name = ?').all(champName);
    if (row.length) return msg.channel.send(`Counters for **${champName}**: ${row.map(r=>r.counter_hint).join(', ')}`);
    return msg.channel.send("No counters found for that variant.");
  }

  // Synergy / champion info
  if (lc.includes('synergy') || lc.includes('synergies') || lc.includes('profile') || lc.includes('info')) {
    const nameCandidate = text.replace(/synergy|synergies|profile|info/ig, '').trim();
    const found = await fuzzyFindChampion(nameCandidate);
    if (!found || found.length === 0) return msg.channel.send("No champion match found.");
    const champName = found[0];
    const live = await fetchChampionLive(champName);
    if (live) {
      return sendEmbed(msg.channel, `${champName} — Profile`, live.summary || 'No summary', [
        { name: 'Immunities', value: live.immunities || 'None' },
        { name: 'Notable Abilities', value: (live.abilities||'').slice(0,800) }
      ]);
    }
    return msg.channel.send('Champion details not available.');
  }

  // YouTube search direct follow-up
  if (lc.includes('guide') || lc.match(/\\bact\\b|\\bpath\\b|\\b9\\.3\\.6\\b|\\beasy\\b/)) {
    const results = await youtubeSearch(text);
    if (!results || !results.length) return msg.channel.send('No guides found.');
    const lines = results.slice(0,4).map((r,i) => `**${i+1}. ${r.title}** — ${r.channel}\\n${r.url}`);
    return msg.channel.send(lines.join('\\n\\n'));
  }

  // Roster queries (e.g., "roster SMOVV" or "roster BG1")
  if (lc.startsWith('roster ')) {
    const arg = text.split(' ').slice(1).join(' ').trim();
    if (!arg) return msg.channel.send('Usage: roster <username|BG>');
    const byUser = await getUserRoster(arg);
    if (byUser && byUser.length) {
      return sendEmbed(msg.channel, `${arg} — Roster`, '', byUser.map(r => ({ name: r.champ, value: `${r.star} ${r.rank} Sig ${r.sig}`, inline: false })));
    }
    const byBg = await getBgRoster(arg);
    if (byBg && byBg.length) {
      const lines = byBg.map(r => `${r.user}: ${r.champ} ${r.star} ${r.rank} Sig ${r.sig}`);
      return msg.channel.send(lines.join('\\n'));
    }
    return msg.channel.send('No roster found.');
  }

  // If nothing matched:
  return msg.channel.send("I didn't understand. Try `/wes` again and ask e.g. 'who counters Shathra' or 'add roster'.");
}

// Start bot
client.login(process.env.DISCORD_TOKEN);
