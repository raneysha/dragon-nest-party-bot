const {
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const { getParty, joinRole, removeMember, ROLE_LABELS } = require("../partyManager");
const { hasSubclasses, getSubclasses } = require("../roleClasses");
const { isLeaderOrAdmin } = require("../shared/permissions");
const { chunkArray } = require("../shared/classPicker");
const { refreshPartyMessage } = require("./partyMessages");

// Step 1 of Assign: leader/admin picked a role, now pick who fills it.
// customId format: party:assignrole:<messageId>
async function handleAssignRole(interaction, parts) {
  const [, , messageId] = parts;
  const party = getParty(messageId);

  if (!party) {
    return interaction.update({ content: "This party no longer exists.", components: [] });
  }
  if (!isLeaderOrAdmin(interaction, party)) {
    return interaction.update({
      content: "Only the party leader or a server admin can assign members to a role.",
      components: [],
    });
  }

  const roleKey = interaction.values[0];
  const role = party.roles[roleKey];
  if (!role || role.members.length >= role.cap) {
    return interaction.update({
      content: "That role just filled up — try a different one.",
      components: [],
    });
  }

  const userMenu = new UserSelectMenuBuilder()
    .setCustomId(`party:assignuser:${messageId}:${roleKey}`)
    .setPlaceholder(`Who should fill ${ROLE_LABELS[roleKey]}?`);

  return interaction.update({
    content: `Pick who to assign to **${ROLE_LABELS[roleKey]}**:`,
    components: [new ActionRowBuilder().addComponents(userMenu)],
  });
}

// Step 2 of Assign: a user was picked. If the role has subclasses, prompt
// for one before finalizing; otherwise assign immediately.
// customId format: party:assignuser:<messageId>:<roleKey>
async function handleAssignUser(interaction, parts) {
  const [, , messageId, roleKey] = parts;
  const party = getParty(messageId);

  if (!party) {
    return interaction.update({ content: "This party no longer exists.", components: [] });
  }
  if (!isLeaderOrAdmin(interaction, party)) {
    return interaction.update({
      content: "Only the party leader or a server admin can assign members to a role.",
      components: [],
    });
  }

  const role = party.roles[roleKey];
  if (!role || role.members.length >= role.cap) {
    return interaction.update({
      content: "That role just filled up — try a different one.",
      components: [],
    });
  }

  const targetUserId = interaction.values[0];
  const targetUsername = interaction.users?.get(targetUserId)?.username ?? targetUserId;

  if (hasSubclasses(roleKey)) {
    const subclasses = getSubclasses(roleKey);
    const chunks = chunkArray(subclasses, 25);

    const rows = chunks.map((chunk, i) => {
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`party:assignclass:${messageId}:${roleKey}:${targetUserId}:${i}`)
        .setPlaceholder(
          chunks.length > 1
            ? `Class for ${targetUsername} (${i + 1}/${chunks.length})`
            : `Which class for ${targetUsername}?`
        )
        .addOptions(chunk.map((subclass) => ({ label: subclass, value: subclass })));
      return new ActionRowBuilder().addComponents(menu);
    });

    return interaction.update({
      content: `Which class should <@${targetUserId}> be assigned as ${ROLE_LABELS[roleKey]}?`,
      components: rows,
    });
  }

  const result = joinRole(messageId, targetUserId, roleKey);
  if (result === "full") {
    return interaction.update({
      content: "That role just filled up — try a different one.",
      components: [],
    });
  }

  await refreshPartyMessage(interaction.client, party);
  return interaction.update({
    content: `Assigned <@${targetUserId}> to ${ROLE_LABELS[roleKey]}.`,
    components: [],
  });
}

// Step 3 of Assign (only for roles with subclasses): finalize with the
// chosen subclass.
// customId format: party:assignclass:<messageId>:<roleKey>:<targetUserId>:<chunkIndex>
async function handleAssignClass(interaction, parts) {
  const [, , messageId, roleKey, targetUserId] = parts;
  const party = getParty(messageId);

  if (!party) {
    return interaction.update({ content: "This party no longer exists.", components: [] });
  }
  if (!isLeaderOrAdmin(interaction, party)) {
    return interaction.update({
      content: "Only the party leader or a server admin can assign members to a role.",
      components: [],
    });
  }

  const subclass = interaction.values[0];
  const result = joinRole(messageId, targetUserId, roleKey, subclass);
  if (result === "full") {
    return interaction.update({
      content: "That role just filled up — try a different one.",
      components: [],
    });
  }

  await refreshPartyMessage(interaction.client, party);
  return interaction.update({
    content: `Assigned <@${targetUserId}> as **${subclass}** ${ROLE_LABELS[roleKey]}.`,
    components: [],
  });
}

// Finalizes a Kick: the leader/admin picked who to remove.
// customId format: party:kickselect:<messageId>
async function handleKickSelect(interaction, parts) {
  const [, , messageId] = parts;
  const party = getParty(messageId);

  if (!party) {
    return interaction.update({ content: "This party no longer exists.", components: [] });
  }
  if (!isLeaderOrAdmin(interaction, party)) {
    return interaction.update({
      content: "Only the party leader or a server admin can kick members.",
      components: [],
    });
  }

  const kickedId = interaction.values[0];
  const removed = removeMember(messageId, kickedId);
  if (!removed) {
    return interaction.update({
      content: "That member already left the party.",
      components: [],
    });
  }

  await refreshPartyMessage(interaction.client, party);
  return interaction.update({
    content: `Kicked <@${kickedId}> from the party.`,
    components: [],
  });
}

// Step 2 of Finish: loot holder was picked, now open the modal for the
// loot list + date cleared (see partyFinishFlow.js for the submit handler).
// customId format: party:finishholder:<messageId>
async function handleFinishHolder(interaction, parts) {
  const [, , messageId] = parts;
  const lootHolderId = interaction.values[0];

  const party = getParty(messageId);
  if (!party) {
    return interaction.update({ content: "This party no longer exists.", components: [] });
  }
  if (!isLeaderOrAdmin(interaction, party)) {
    return interaction.update({
      content: "Only the party leader or a server admin can finish this party.",
      components: [],
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`party:finishmodal:${messageId}:${lootHolderId}`)
    .setTitle("Finish party");

  const lootListInput = new TextInputBuilder()
    .setCustomId("loot_list")
    .setLabel("Lootnya apa aja?")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Satu item per baris")
    .setMaxLength(500)
    .setRequired(true);

  const dateInput = new TextInputBuilder()
    .setCustomId("date_cleared")
    .setLabel("Tanggal clear")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("e.g. 10/07/2026")
    .setMaxLength(30)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(lootListInput),
    new ActionRowBuilder().addComponents(dateInput)
  );

  return interaction.showModal(modal);
}

// Finalizes a direct Join (for roles with subclasses): the class was picked.
// customId format: party:pickclass:<messageId>:<roleKey>:<chunkIndex>
async function handlePickClass(interaction, parts) {
  const [, , messageId, roleKey] = parts;
  const subclass = interaction.values[0];

  const party = getParty(messageId);
  if (!party) {
    return interaction.update({
      content: "This party no longer exists.",
      components: [],
    });
  }

  const result = joinRole(messageId, interaction.user.id, roleKey, subclass);
  if (result === "full") {
    return interaction.update({
      content: "That role just filled up — try another one!",
      components: [],
    });
  }

  await refreshPartyMessage(interaction.client, party);
  return interaction.update({
    content: `Joined as **${subclass}** ${ROLE_LABELS[roleKey]}!`,
    components: [],
  });
}

module.exports = {
  handleAssignRole,
  handleAssignUser,
  handleAssignClass,
  handleKickSelect,
  handleFinishHolder,
  handlePickClass,
};
