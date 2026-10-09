const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "..", "..", "data", "guildConfig.json");

// Shape per guild: { lootChannelId, defaultPartyComp, locale }
let configs = new Map();

function loadFromDisk() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    configs = new Map(Object.entries(parsed));
  } catch (err) {
    // File doesn't exist yet or is invalid — start with an empty config set.
    configs = new Map();
  }
}

function saveToDisk() {
  const obj = Object.fromEntries(configs);
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(obj, null, 2));
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
  if (config) {
    delete config.lootChannelId;
    configs.set(guildId, config);
    saveToDisk();
  }
}

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
  if (config) {
    delete config.defaultPartyComp;
    configs.set(guildId, config);
    saveToDisk();
  }
}

// Returns the guild's custom default party composition, or null if this
// server hasn't set one (meaning callers should fall back to the
// built-in FACTORY_DEFAULT_ROLE_CAPS from partyManager.js).
function getDefaultPartyComp(guildId) {
  return configs.get(guildId)?.defaultPartyComp ?? null;
}

const SUPPORTED_LOCALES = ["en", "id"];
const DEFAULT_LOCALE = "en";

function setLocale(guildId, locale) {
  const config = configs.get(guildId) || {};
  config.locale = locale;
  configs.set(guildId, config);
  saveToDisk();
}

// Returns the guild's configured bot language ("en" or "id"), defaulting
// to English if the server hasn't set one via /config language.
function getLocale(guildId) {
  return configs.get(guildId)?.locale ?? DEFAULT_LOCALE;
}

module.exports = {
  setLootChannel,
  clearLootChannel,
  getLootChannel,
  setDefaultPartyComp,
  clearDefaultPartyComp,
  getDefaultPartyComp,
  setLocale,
  getLocale,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
};
