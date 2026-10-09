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
const { t } = require("../../i18n");

// Step 1 of Assign: leader/admin picked a role, now pick who fills it.
// customId format: party:assignrole:<messageId>
async function handleAssignRole(interaction, parts) {
  const [, , messageId] = parts;
  const party = getParty(messageId);

  if (!party) {
    return interaction.update({ content: t(interaction.guildId, "common.partyGone"), components: [] });
  }
  if (!isLeaderOrAdmin(interaction, party)) {
    return interaction.update({
      content: t(interaction.guildId, "party.assign.denied"),
      components: [],
    });
  }

  const roleKey = interaction.values[0];
  const role = party.roles[roleKey];
  if (!role || role.members.length >= role.cap) {
    return interaction.update({
      content: t(interaction.guildId, "party.assign.roleJustFilled"),
      components: [],
    });
  }

  const userMenu = new UserSelectMenuBuilder()
    .setCustomId(`party:assignuser:${messageId}:${roleKey}`)
    .setPlaceholder(t(interaction.guildId, "party.assign.userPlaceholder", { role: ROLE_LABELS[roleKey] }));

  return interaction.update({
    content: t(interaction.guildId, "party.assign.userPrompt", { role: ROLE_LABELS[roleKey] }),
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
    return interaction.update({ content: t(interaction.guildId, "common.partyGone"), components: [] });
  }
  if (!isLeaderOrAdmin(interaction, party)) {
    return interaction.update({
      content: t(interaction.guildId, "party.assign.denied"),
      components: [],
    });
  }

  const role = party.roles[roleKey];
  if (!role || role.members.length >= role.cap) {
    return interaction.update({
      content: t(interaction.guildId, "party.assign.roleJustFilled"),
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
            ? t(interaction.guildId, "party.assign.classPromptMulti", {
                username: targetUsername,
                page: i + 1,
                total: chunks.length,
              })
            : t(interaction.guildId, "party.assign.classPromptSingle", { username: targetUsername })
        )
        .addOptions(chunk.map((subclass) => ({ label: subclass, value: subclass })));
      return new ActionRowBuilder().addComponents(menu);
    });

    return interaction.update({
      content: t(interaction.guildId, "party.assign.classQuestion", {
        userId: targetUserId,
        role: ROLE_LABELS[roleKey],
      }),
      components: rows,
    });
  }

  const result = joinRole(messageId, targetUserId, roleKey);
  if (result === "full") {
    return interaction.update({
      content: t(interaction.guildId, "party.assign.roleJustFilled"),
      components: [],
    });
  }

  await refreshPartyMessage(interaction.client, party, interaction.guildId);
  return interaction.update({
    content: t(interaction.guildId, "party.assign.confirmNoClass", {
      userId: targetUserId,
      role: ROLE_LABELS[roleKey],
    }),
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
    return interaction.update({ content: t(interaction.guildId, "common.partyGone"), components: [] });
  }
  if (!isLeaderOrAdmin(interaction, party)) {
    return interaction.update({
      content: t(interaction.guildId, "party.assign.denied"),
      components: [],
    });
  }

  const subclass = interaction.values[0];
  const result = joinRole(messageId, targetUserId, roleKey, subclass);
  if (result === "full") {
    return interaction.update({
      content: t(interaction.guildId, "party.assign.roleJustFilled"),
      components: [],
    });
  }

  await refreshPartyMessage(interaction.client, party, interaction.guildId);
  return interaction.update({
    content: t(interaction.guildId, "party.assign.confirmWithClass", {
      userId: targetUserId,
      subclass,
      role: ROLE_LABELS[roleKey],
    }),
    components: [],
  });
}

// Finalizes a Kick: the leader/admin picked who to remove.
// customId format: party:kickselect:<messageId>
async function handleKickSelect(interaction, parts) {
  const [, , messageId] = parts;
  const party = getParty(messageId);

  if (!party) {
    return interaction.update({ content: t(interaction.guildId, "common.partyGone"), components: [] });
  }
  if (!isLeaderOrAdmin(interaction, party)) {
    return interaction.update({
      content: t(interaction.guildId, "party.kick.denied"),
      components: [],
    });
  }

  const kickedId = interaction.values[0];
  const removed = removeMember(messageId, kickedId);
  if (!removed) {
    return interaction.update({
      content: t(interaction.guildId, "party.kick.alreadyLeft"),
      components: [],
    });
  }

  await refreshPartyMessage(interaction.client, party, interaction.guildId);
  return interaction.update({
    content: t(interaction.guildId, "party.kick.confirm", { userId: kickedId }),
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
    return interaction.update({ content: t(interaction.guildId, "common.partyGone"), components: [] });
  }
  if (!isLeaderOrAdmin(interaction, party)) {
    return interaction.update({
      content: t(interaction.guildId, "party.finish.denied"),
      components: [],
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`party:finishmodal:${messageId}:${lootHolderId}`)
    .setTitle(t(interaction.guildId, "party.finish.modalTitle"));

  const lootListInput = new TextInputBuilder()
    .setCustomId("loot_list")
    .setLabel(t(interaction.guildId, "party.finish.lootListLabel"))
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder(t(interaction.guildId, "party.finish.lootListPlaceholder"))
    .setMaxLength(500)
    .setRequired(true);

  const dateInput = new TextInputBuilder()
    .setCustomId("date_cleared")
    .setLabel(t(interaction.guildId, "party.finish.dateLabel"))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(t(interaction.guildId, "party.finish.datePlaceholder"))
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
      content: t(interaction.guildId, "common.partyGone"),
      components: [],
    });
  }

  const result = joinRole(messageId, interaction.user.id, roleKey, subclass);
  if (result === "full") {
    return interaction.update({
      content: t(interaction.guildId, "party.pickclass.roleFull"),
      components: [],
    });
  }

  await refreshPartyMessage(interaction.client, party, interaction.guildId);
  return interaction.update({
    content: t(interaction.guildId, "party.pickclass.confirm", {
      subclass,
      role: ROLE_LABELS[roleKey],
    }),
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
