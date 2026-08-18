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

// Opens a modal for composing a party-wide ping message. Usable by any
// current party member, or the leader/an admin even if they haven't joined.
async function handlePing(interaction, party) {
  if (!isMember(party, interaction.user.id) && !isLeaderOrAdmin(interaction, party)) {
    return interaction.reply({
      content: "You need to join the party before you can ping it.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`party:pingmodal:${party.messageId}`)
    .setTitle("Ping the party");

  const messageInput = new TextInputBuilder()
    .setCustomId("message")
    .setLabel("What do you want to say?")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("e.g. Forming up now, get in voice!")
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
      content: "Only the party leader or a server admin can assign members to a role.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const openRoleOptions = Object.entries(party.roles)
    .filter(([, role]) => role.members.length < role.cap)
    .map(([roleKey, role]) => ({
      label: `${ROLE_LABELS[roleKey]} (${role.cap - role.members.length} open)`,
      value: roleKey,
    }));

  if (openRoleOptions.length === 0) {
    return interaction.reply({
      content: "Every role is already full — there's nothing open to assign someone to.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`party:assignrole:${party.messageId}`)
    .setPlaceholder("Which role do you want to fill?")
    .addOptions(openRoleOptions);

  return interaction.reply({
    content: "Which open role do you want to assign someone to?",
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral,
  });
}

// Leader/admin picks a current member from a dropdown to remove.
async function handleKick(interaction, party) {
  if (!isLeaderOrAdmin(interaction, party)) {
    return interaction.reply({
      content: "Only the party leader or a server admin can kick members.",
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
      content: "There's no one to kick — the party has no members besides you.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`party:kickselect:${party.messageId}`)
    .setPlaceholder("Choose a member to kick")
    .addOptions(options.slice(0, 25)); // Discord select menus cap at 25 options

  return interaction.reply({
    content: "Who do you want to kick from the party?",
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral,
  });
}

// Leader/admin picks who's carrying the loot, kicking off the finish flow
// (see partyFinishFlow.js for the modal + thread creation that follows).
async function handleFinish(interaction, party) {
  if (!isLeaderOrAdmin(interaction, party)) {
    return interaction.reply({
      content: "Only the party leader or a server admin can finish this party.",
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
    .setPlaceholder("Siapa yang bawa loot?")
    .addOptions(options.slice(0, 25)); // Discord select menus cap at 25 options

  return interaction.reply({
    content: "Siapa yang bawa loot dari party ini?",
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral,
  });
}

// Leader/admin disbands the party outright — no loot thread, just gone.
async function handleDisband(interaction, party) {
  if (!isLeaderOrAdmin(interaction, party)) {
    return interaction.reply({
      content: "Only the party leader or a server admin can disband this party.",
      flags: MessageFlags.Ephemeral,
    });
  }

  deleteParty(party.messageId);
  return interaction.update({
    content: "💥 This party has been disbanded.",
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
      content: "This party listing is already gone.",
      components: [],
    });
  }

  if (!isLeaderOrAdmin(interaction, party)) {
    return interaction.reply({
      content: "Only the party leader or a server admin can decide this.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (choice === "no") {
    return interaction.update({
      content: "👍 Party listing stays open — feel free to keep organizing it.",
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
    content: "💥 Party listing disbanded.",
    components: [],
  });
}

module.exports = { handlePing, handleAssign, handleKick, handleFinish, handleDisband, handleFinishConfirm };
