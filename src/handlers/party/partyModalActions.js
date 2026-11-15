const { MessageFlags } = require("discord.js");
const { getParty, isMember, getAllMemberIds, updateParty } = require("../partyManager");
const { isLeaderOrAdmin } = require("../shared/permissions");
const { refreshPartyMessage } = require("./partyMessages");
const { t } = require("../../i18n");

// customId format: party:pingmodal:<messageId>
async function handlePingModalSubmit(interaction, parts) {
  const [, , messageId] = parts;
  const party = getParty(messageId);
  if (!party) {
    return interaction.reply({
      content: t(interaction.guildId, "common.partyGone"),
      flags: MessageFlags.Ephemeral,
    });
  }

  // Double-check membership at submit time too — someone could leave the
  // party in the time between opening the modal and submitting it.
  if (!isMember(party, interaction.user.id) && !isLeaderOrAdmin(interaction, party)) {
    return interaction.reply({
      content: t(interaction.guildId, "party.ping.needToJoin"),
      flags: MessageFlags.Ephemeral,
    });
  }

  const message = interaction.fields.getTextInputValue("message");
  const memberIds = getAllMemberIds(party);
  const mentions = memberIds.map((id) => `<@${id}>`).join(" ");

  return interaction.reply({
    content: t(interaction.guildId, "party.ping.broadcast", {
      username: interaction.user.username,
      activity: party.activity,
      message,
      mentions,
    }),
  });
}

// customId format: party:editmodal:<messageId>
async function handleEditModalSubmit(interaction, parts) {
  const [, , messageId] = parts;
  const party = getParty(messageId);
  if (!party) {
    return interaction.reply({
      content: t(interaction.guildId, "common.partyGone"),
      flags: MessageFlags.Ephemeral,
    });
  }

  // Re-check permission at submit time too — someone could lose
  // leader/admin status (or the party could change leader) between
  // opening the modal and submitting it.
  if (!isLeaderOrAdmin(interaction, party)) {
    return interaction.reply({
      content: t(interaction.guildId, "party.edit.denied"),
      flags: MessageFlags.Ephemeral,
    });
  }

  const activity = interaction.fields.getTextInputValue("activity").trim();
  const time = interaction.fields.getTextInputValue("time").trim();

  updateParty(messageId, { activity, time });

  await refreshPartyMessage(interaction.client, party, interaction.guildId);
  return interaction.reply({
    content: t(interaction.guildId, "party.edit.confirm"),
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { handlePingModalSubmit, handleEditModalSubmit };
