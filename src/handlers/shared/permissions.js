const { PermissionFlagsBits } = require("discord.js");

// Several actions (Finish, Disband, Kick, Assign, Ping) can be used by the
// party leader OR anyone with server Administrator permission — mods
// stepping in for an absent/AFK leader.
function isLeaderOrAdmin(interaction, party) {
  if (interaction.user.id === party.leaderId) return true;
  return interaction.member?.permissions?.has(PermissionFlagsBits.Administrator) ?? false;
}

module.exports = { isLeaderOrAdmin };
