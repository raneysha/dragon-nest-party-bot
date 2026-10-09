const {
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");
const { getParty, deleteParty, isMember, getAllMemberIds, ROLE_LABELS } = require("../partyManager");
const { isLeaderOrAdmin } = require("../shared/permissions");
const { t } = require("../../i18n");

// Opens a modal for composing a party-wide ping message. Usable by any
// current party member, or the leader/an admin even if they haven't joined.
async function handlePing(interaction, party) {
  if (!isMember(party, interaction.user.id) && !isLeaderOrAdmin(interaction, party)) {
    return interaction.reply({
      content: t(interaction.guildId, "party.ping.needToJoin"),
      flags: MessageFlags.Ephemeral,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`party:pingmodal:${party.messageId}`)
    .setTitle(t(interaction.guildId, "party.ping.modalTitle"));

  const messageInput = new TextInputBuilder()
    .setCustomId("message")
    .setLabel(t(interaction.guildId, "party.ping.modalLabel"))
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder(t(interaction.guildId, "party.ping.modalPlaceholder"))
    .setMaxLength(300)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(messageInput));
  return interaction.showModal(modal);
}

// Leader/admin picks an open role, then a member to assign to it (see
// partySelectActions.js for the rest of this flow).
async function handleAssign(interaction, party) {
  if (!isLeaderOrAdmin(interaction, party)) {
    return interaction.reply({
      content: t(interaction.guildId, "party.assign.denied"),
      flags: MessageFlags.Ephemeral,
    });
  }

  const openRoleOptions = Object.entries(party.roles)
    .filter(([, role]) => role.members.length < role.cap)
    .map(([roleKey, role]) => ({
      label: t(interaction.guildId, "party.assign.rolePlaceholder", {
        role: ROLE_LABELS[roleKey],
        open: role.cap - role.members.length,
      }),
      value: roleKey,
    }));

  if (openRoleOptions.length === 0) {
    return interaction.reply({
      content: t(interaction.guildId, "party.assign.allFull"),
      flags: MessageFlags.Ephemeral,
    });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`party:assignrole:${party.messageId}`)
    .setPlaceholder(t(interaction.guildId, "party.assign.roleMenuPlaceholder"))
    .addOptions(openRoleOptions);

  return interaction.reply({
    content: t(interaction.guildId, "party.assign.rolePrompt"),
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral,
  });
}

// Leader/admin picks a current member from a dropdown to remove.
async function handleKick(interaction, party) {
  if (!isLeaderOrAdmin(interaction, party)) {
    return interaction.reply({
      content: t(interaction.guildId, "party.kick.denied"),
      flags: MessageFlags.Ephemeral,
    });
  }

  const options = [];
  for (const [roleKey, role] of Object.entries(party.roles)) {
    for (const member of role.members) {
      if (member.userId === party.leaderId) continue; // leader can't kick themselves this way

      let username = member.userId;
      try {
        const user = await interaction.client.users.fetch(member.userId);
        username = user.username;
      } catch (err) {
        // If the fetch fails for some reason, fall back to showing the raw ID.
      }

      const roleLabel = ROLE_LABELS[roleKey];
      const label = member.subclass
        ? `${username} — ${roleLabel} (${member.subclass})`
        : `${username} — ${roleLabel}`;
      options.push({ label: label.slice(0, 100), value: member.userId });
    }
  }

  if (options.length === 0) {
    return interaction.reply({
      content: t(interaction.guildId, "party.kick.nobodyToKick"),
      flags: MessageFlags.Ephemeral,
    });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`party:kickselect:${party.messageId}`)
    .setPlaceholder(t(interaction.guildId, "party.kick.placeholder"))
    .addOptions(options.slice(0, 25)); // Discord select menus cap at 25 options

  return interaction.reply({
    content: t(interaction.guildId, "party.kick.prompt"),
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral,
  });
}

// Leader/admin picks who's carrying the loot, kicking off the finish flow
// (see partyFinishFlow.js for the modal + thread creation that follows).
async function handleFinish(interaction, party) {
  if (!isLeaderOrAdmin(interaction, party)) {
    return interaction.reply({
      content: t(interaction.guildId, "party.finish.denied"),
      flags: MessageFlags.Ephemeral,
    });
  }

  const memberIds = new Set(getAllMemberIds(party));
  memberIds.add(party.leaderId);

  const options = [];
  for (const id of memberIds) {
    let username = id;
    try {
      const user = await interaction.client.users.fetch(id);
      username = user.username;
    } catch (err) {
      // If the fetch fails for some reason, fall back to showing the raw ID.
    }
    const label = id === party.leaderId ? `👑 ${username}` : username;
    options.push({ label: label.slice(0, 100), value: id });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`party:finishholder:${party.messageId}`)
    .setPlaceholder(t(interaction.guildId, "party.finish.holderPlaceholder"))
    .addOptions(options.slice(0, 25)); // Discord select menus cap at 25 options

  return interaction.reply({
    content: t(interaction.guildId, "party.finish.holderPrompt"),
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral,
  });
}

// Leader/admin disbands the party outright — no loot thread, just gone.
async function handleDisband(interaction, party) {
  if (!isLeaderOrAdmin(interaction, party)) {
    return interaction.reply({
      content: t(interaction.guildId, "party.disband.denied"),
      flags: MessageFlags.Ephemeral,
    });
  }

  deleteParty(party.messageId);
  return interaction.update({
    content: t(interaction.guildId, "party.disband.confirm"),
    embeds: [],
    components: [],
  });
}

// Confirmation step shown after a loot thread is created: keep the party
// listing open, or disband it now that it's wrapped up.
// customId format: party:finishconfirm:<yes|no>:<messageId>
async function handleFinishConfirm(interaction, parts) {
  const choice = parts[2]; // "yes" or "no"
  const messageId = parts[3];
  const party = getParty(messageId);

  if (!party) {
    return interaction.update({
      content: t(interaction.guildId, "party.finishconfirm.gone"),
      components: [],
    });
  }

  if (!isLeaderOrAdmin(interaction, party)) {
    return interaction.reply({
      content: t(interaction.guildId, "party.finishconfirm.denied"),
      flags: MessageFlags.Ephemeral,
    });
  }

  if (choice === "no") {
    return interaction.update({
      content: t(interaction.guildId, "party.finishconfirm.keepOpen"),
      components: [],
    });
  }

  deleteParty(messageId);
  try {
    const oldChannel = await interaction.client.channels.fetch(party.channelId);
    const oldMessage = await oldChannel.messages.fetch(party.messageId);
    await oldMessage.delete();
  } catch (err) {
    // Message may already be gone — not fatal.
  }

  return interaction.update({
    content: t(interaction.guildId, "party.finishconfirm.disbanded"),
    components: [],
  });
}

module.exports = { handlePing, handleAssign, handleKick, handleFinish, handleDisband, handleFinishConfirm };
