const { getLocale, DEFAULT_LOCALE } = require("../handlers/guildConfigManager");
const STRINGS = require("./strings");

// Looks up `key` in the given guild's configured language, filling in any
// {placeholder} tokens from `vars`. Falls back to English if the guild's
// locale is missing a key (shouldn't happen once both tables are kept in
// sync, but this keeps a translation gap from ever showing a raw key to
// the user), and finally to the key itself as a last-resort fallback.
//
// `guildId` may be null/undefined (e.g. in a DM context) — that just
// resolves to the default locale.
function t(guildId, key, vars = {}) {
  const locale = guildId ? getLocale(guildId) : DEFAULT_LOCALE;
  const table = STRINGS[locale] || STRINGS[DEFAULT_LOCALE];
  let str = table[key] ?? STRINGS[DEFAULT_LOCALE][key] ?? key;

  for (const [varName, value] of Object.entries(vars)) {
    str = str.replaceAll(`{${varName}}`, value);
  }
  return str;
}

module.exports = { t };
