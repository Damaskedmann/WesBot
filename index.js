import { Client, GatewayIntentBits } from "discord.js";
import Fuse from "fuse.js";
import dotenv from "dotenv";
dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const PREFIX = process.env.PREFIX || "!";

const champs = [
  { name: "Spider-Man (Classic)", counters: ["Stealth Suit", "Nick Fury", "Shang-Chi"] },
  { name: "Spider-Man 2099", counters: ["Ghost", "Titania", "Wiccan"] },
  { name: "Doctor Doom", counters: ["Human Torch", "Rintrah", "Titania"] },
  { name: "Hercules", counters: ["Null", "America Chavez", "Absorbing Man"] }
];

const fuse = new Fuse(champs, { keys: ["name"], threshold: 0.3 });

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  const query = msg.content.toLowerCase();

  // If message includes 'counter' keyword
  if (query.includes("counter")) {
    const result = fuse.search(query.replace("counter", "").trim());
    if (!result.length) return msg.reply("No matching champ found.");
    const champ = result[0].item;
    return msg.reply(`**${champ.name}** counters: ${champ.counters.join(", ")}`);
  }

  // Simple help
  if (query.includes("help") || query.startsWith(PREFIX + "help")) {
    return msg.reply("Try typing `spider-man counters` or `doom counters`!");
  }
});

client.once("ready", () => console.log(`✅ WesBot logged in as ${client.user.tag}`));
client.login(process.env.DISCORD_TOKEN);
