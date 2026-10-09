const { StringSelectMenuBuilder, ActionRowBuilder, MessageFlags } = require("discord.js");
const { ROLE_LABELS } = require("../partyManager");
const { getSubclasses } = require("../roleClasses");
const { t } = require("../../i18n");

// Splits an array into chunks of at most `size` items — used so a class
// list longer than Discord's 25-option select menu limit still works, by
// spreading across multiple dropdowns instead of hitting an error.
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// Builds an ephemeral "choose your class" prompt using a dropdown
// (StringSelectMenu) instead of a row of buttons. Used when a player joins
// a role directly (party:join) that has subclasses defined.
function buildSubclassPrompt(messageId, roleKey, guildId) {
  const subclasses = getSubclasses(roleKey);
  const chunks = chunkArray(subclasses, 25); // Discord's hard cap per select menu

  const rows = chunks.map((chunk, i) => {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`party:pickclass:${messageId}:${roleKey}:${i}`)
      .setPlaceholder(
        chunks.length > 1
          ? t(guildId, "party.classPicker.placeholderMulti", { page: i + 1, total: chunks.length })
          : t(guildId, "party.classPicker.placeholderSingle", { role: ROLE_LABELS[roleKey] })
      )
      .addOptions(chunk.map((subclass) => ({ label: subclass, value: subclass })));
    return new ActionRowBuilder().addComponents(menu);
  });

  return {
    content: t(guildId, "party.classPicker.prompt", { role: ROLE_LABELS[roleKey] }),
    components: rows,
    flags: MessageFlags.Ephemeral,
  };
}

module.exports = { chunkArray, buildSubclassPrompt };
