const { buildPartyEmbed, buildPartyButtons } = require("../uiBuilders");

// Refreshes the live party embed/buttons on the original party message.
// Needed when the update comes from an ephemeral message (the subclass
// picker, assign flow, kick flow, etc.) rather than a direct interaction
// on the party message itself.
async function refreshPartyMessage(client, party, guildId) {
  const channel = await client.channels.fetch(party.channelId);
  const message = await channel.messages.fetch(party.messageId);
  await message.edit({
    embeds: [buildPartyEmbed(party, guildId)],
    components: buildPartyButtons(party, guildId),
  });
}

module.exports = { refreshPartyMessage };
