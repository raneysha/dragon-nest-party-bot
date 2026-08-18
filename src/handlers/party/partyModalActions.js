const { MessageFlags } = require("discord.js");
const { getParty, isMember, getAllMemberIds } = require("../partyManager");
const { isLeaderOrAdmin } = require("../shared/permissions");

// customId format: party:pingmodal:<messageId>
async function handlePingModalSubmit(interaction, parts) {
  const [, , messageId] = parts;
  const party = getParty(messageId);
  if (!party) {
    return interaction.reply({
      content: "This party no longer exists.",
      flags: MessageFlags.Ephemeral,
    });
  }

  // Double-check membership at submit time too — someone could leave the
  // party in the time between opening the modal and submitting it.
  if (!isMember(party, interaction.user.id) && !isLeaderOrAdmin(interaction, party)) {
    return interaction.reply({
      content: "You need to join the party before you can ping it.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const message = interaction.fields.getTextInputValue("message");
  const memberIds = getAllMemberIds(party);
  const mentions = memberIds.map((id) => `<@${id}>`).join(" ");

  return interaction.reply({
    content: `📣 **${interaction.user.username}** on **${party.activity}**:\n${message}\n\n${mentions}`,
  });
}

module.exports = { handlePingModalSubmit };
