// One-time cleanup script: removes guild-specific slash command
// registrations. Run this once if you're seeing duplicate commands in
// Discord (usually caused by having commands registered both globally
// AND to a specific test server via GUILD_ID in .env at different points).
//
// Usage:
//   node src/clear-guild-commands.js <guildId>
//
// If you're not sure which guild(s) ended up with leftover commands,
// run this once for every server ID where you've ever set GUILD_ID
// during testing. It's safe to run even if that guild has no
// guild-specific commands — it just clears an already-empty list.

require("dotenv").config();
const { REST, Routes } = require("discord.js");

const guildId = process.argv[2];

if (!guildId) {
  console.error("Usage: node src/clear-guild-commands.js <guildId>");
  console.error("(Right-click your server icon in Discord → Copy Server ID, with Developer Mode on)");
  process.exit(1);
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Clearing guild-specific commands for guild ${guildId}...`);
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId), { body: [] });
    console.log("✅ Cleared. That server will now only show global commands.");
    console.log("Note: if global commands aren't showing yet, they can take up to 1 hour to propagate after a deploy.");
  } catch (err) {
    console.error("Failed to clear guild commands:", err.message);
  }
})();
