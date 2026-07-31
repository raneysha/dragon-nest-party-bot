// Persistent per-server bot settings, keyed by Discord guild (server) ID.
// Backed by a JSON file on disk (data/guildConfig.json) so settings survive
// a bot restart — same pattern as characterManager.js and lootManager.js.
// Shape per guild: { lootChannelId, defaultPartyComp }

const fs = require("node:fs");
const path = require("node:path");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const DATA_FILE = path.join(DATA_DIR, "guildConfig.json");

const configs = new Map(); // guildId -> { lootChannelId }

function loadFromDisk() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    for (const [guildId, config] of Object.entries(parsed)) {
      configs.set(guildId, config);
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("Couldn't read guildConfig.json, starting with no saved settings:", err.message);
    }
  }
}

function saveToDisk() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const asObject = Object.fromEntries(configs);
    fs.writeFileSync(DATA_FILE, JSON.stringify(asObject, null, 2));
  } catch (err) {
    console.error("Couldn't save guildConfig.json:", err.message);
  }
}

loadFromDisk();

function setLootChannel(guildId, channelId) {
  const config = configs.get(guildId) || {};
  config.lootChannelId = channelId;
  configs.set(guildId, config);
  saveToDisk();
}

function clearLootChannel(guildId) {
  const config = configs.get(guildId);
  if (!config) return;
  delete config.lootChannelId;
  saveToDisk();
}

// Returns the configured loot channel ID for a guild, or null if unset.
function getLootChannel(guildId) {
  return configs.get(guildId)?.lootChannelId ?? null;
}

function setDefaultPartyComp(guildId, roleCaps) {
  const config = configs.get(guildId) || {};
  config.defaultPartyComp = roleCaps;
  configs.set(guildId, config);
  saveToDisk();
}

function clearDefaultPartyComp(guildId) {
  const config = configs.get(guildId);
  if (!config) return;
  delete config.defaultPartyComp;
  saveToDisk();
}

// Returns the guild's custom default party composition, or null if this
// server hasn't set one (meaning callers should fall back to the
// built-in FACTORY_DEFAULT_ROLE_CAPS from partyManager.js).
function getDefaultPartyComp(guildId) {
  return configs.get(guildId)?.defaultPartyComp ?? null;
}

module.exports = {
  setLootChannel,
  clearLootChannel,
  getLootChannel,
  setDefaultPartyComp,
  clearDefaultPartyComp,
  getDefaultPartyComp,
};