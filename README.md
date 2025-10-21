# WesBot 🤖
# WesBot Complete (v3)

Features:
- /wes wake-mode (30s follow-up)
- Live champion scraping (Konshu's Ankh)
- YouTube guide search (use your YOUTUBE_API_KEY)
- Duel target & roster storage (SQLite)
- Railway/GitHub ready

## Quick deploy (GitHub -> Railway)
1. Create GitHub repo (wesbot). Paste all files exactly as provided.
2. On Railway, Deploy from GitHub (select repo).
3. Add environment variables in Railway:
   - DISCORD_TOKEN
   - OWNER_ID
   - YOUTUBE_API_KEY
   - DATABASE_PATH (optional)
   - KHONSHU_BASE (optional)
   - WAKE_WORD (default: /wes)
4. Deploy and watch logs.
5. Invite bot to server (scopes: bot, intents: message content).
6. In Discord: type `/wes` then your question (e.g., `who counters Shathra?` or `add roster`).

## Roster format
When prompted to add roster:
`USER / BG / CHAMP / STAR / RANK / SIG`
Example:
`SMOVV / BG1 / Nico Miranou / 7 / R4 / 200`

## Notes
- The bot listens only after you type the WAKE_WORD (default `/wes`) to avoid responding to normal chat.
- YouTube results use your API key; ensure it has YouTube Data API v3 enabled.
