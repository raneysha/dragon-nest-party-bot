const { MessageFlags, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require("discord.js");
const { getLoot, deleteLoot } = require("../lootManager");
const { isLootHolder, allItemsSold } = require("./lootUiBuilders");
const { t } = require("../../i18n");

async function handleSoldBtn(interaction, parts) {
  const recapMessageId = parts[2];
  const record = getLoot(recapMessageId);
  if (!record) {
    return interaction.reply({
      content: t(interaction.guildId, "loot.sold.recordGone"),
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!isLootHolder(interaction, record)) {
    return interaction.reply({
      content: t(interaction.guildId, "loot.sold.notHolder", { lootHolder: record.lootHolder }),
      flags: MessageFlags.Ephemeral,
    });
  }

  const unsoldOptions = record.items
    .map((item, i) => ({ label: item.name.slice(0, 100), value: String(i), sold: item.sold }))
    .filter((opt) => !opt.sold);

  if (unsoldOptions.length === 0) {
    return interaction.reply({
      content: t(interaction.guildId, "loot.sold.allSold"),
      flags: MessageFlags.Ephemeral,
    });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`party:soldselect:${recapMessageId}`)
    .setPlaceholder(t(interaction.guildId, "loot.sold.placeholder"))
    .addOptions(unsoldOptions.slice(0, 25)); // Discord select menus cap at 25 options

  return interaction.reply({
    content: t(interaction.guildId, "loot.sold.prompt"),
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleGajiBtn(interaction, parts) {
  const recapMessageId = parts[2];
  const record = getLoot(recapMessageId);
  if (!record) {
    return interaction.reply({
      content: t(interaction.guildId, "loot.gaji.recordGone"),
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!isLootHolder(interaction, record)) {
    return interaction.reply({
      content: t(interaction.guildId, "loot.gaji.notHolder", { lootHolder: record.lootHolder }),
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!allItemsSold(record)) {
    return interaction.reply({
      content: t(interaction.guildId, "loot.gaji.notAllSold"),
      flags: MessageFlags.Ephemeral,
    });
  }

  const unpaidEntries = record.roster
    .map((entry, i) => ({ entry, i }))
    .filter(({ entry }) => !entry.paid);

  if (unpaidEntries.length === 0) {
    return interaction.reply({
      content: t(interaction.guildId, "loot.gaji.allPaid"),
      flags: MessageFlags.Ephemeral,
    });
  }

  const options = [];
  for (const { entry, i } of unpaidEntries.slice(0, 25)) {
    let username = entry.userId;
    try {
      const user = await interaction.client.users.fetch(entry.userId);
      username = user.username;
    } catch (err) {
      // If the fetch fails for some reason, fall back to showing the raw ID.
    }
    options.push({ label: username.slice(0, 100), value: String(i) });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`party:gajiselect:${recapMessageId}`)
    .setPlaceholder(t(interaction.guildId, "loot.gaji.placeholder"))
    .addOptions(options); // already capped at 25 above

  return interaction.reply({
    content: t(interaction.guildId, "loot.gaji.prompt"),
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleStampBtn(interaction, parts) {
  const recapMessageId = parts[2];
  const record = getLoot(recapMessageId);
  if (!record) {
    return interaction.reply({
      content: t(interaction.guildId, "loot.stamp.recordGone"),
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!isLootHolder(interaction, record)) {
    return interaction.reply({
      content: t(interaction.guildId, "loot.stamp.notHolder", { lootHolder: record.lootHolder }),
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!record.roster || record.roster.length === 0) {
    return interaction.reply({
      content: t(interaction.guildId, "loot.stamp.noRoster"),
      flags: MessageFlags.Ephemeral,
    });
  }

  const options = [];
  for (let i = 0; i < record.roster.length; i++) {
    const entry = record.roster[i];
    let username = entry.userId;
    try {
      const user = await interaction.client.users.fetch(entry.userId);
      username = user.username;
    } catch (err) {
      // If the fetch fails for some reason, fall back to showing the raw ID.
    }
    const label = entry.stamp != null ? `${username} (🎟️ ${entry.stamp})` : username;
    options.push({ label: label.slice(0, 100), value: String(i) });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`party:stampselect:${recapMessageId}`)
    .setPlaceholder(t(interaction.guildId, "loot.stamp.placeholder"))
    .addOptions(options.slice(0, 25)); // Discord select menus cap at 25 options

  return interaction.reply({
    content: t(interaction.guildId, "loot.stamp.prompt"),
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleDeleteLootBtn(interaction, parts) {
  const recapMessageId = parts[2];
  const record = getLoot(recapMessageId);
  if (!record) {
    return interaction.reply({
      content: t(interaction.guildId, "loot.delete.recordGone"),
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: t(interaction.guildId, "loot.delete.adminOnly"),
      flags: MessageFlags.Ephemeral,
    });
  }

  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`party:deletelootconfirm:yes:${recapMessageId}`)
      .setLabel(t(interaction.guildId, "loot.delete.confirmYes"))
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`party:deletelootconfirm:no:${recapMessageId}`)
      .setLabel(t(interaction.guildId, "loot.delete.confirmNo"))
      .setStyle(ButtonStyle.Secondary)
  );

  return interaction.reply({
    content: t(interaction.guildId, "loot.delete.confirmPrompt"),
    components: [confirmRow],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleDeleteLootConfirm(interaction, parts) {
  const choice = parts[2]; // "yes" or "no"
  const recapMessageId = parts[3];
  const record = getLoot(recapMessageId);

  if (!record) {
    return interaction.update({
      content: t(interaction.guildId, "loot.delete.recordGone"),
      components: [],
    });
  }

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.update({
      content: t(interaction.guildId, "loot.delete.adminOnly"),
      components: [],
    });
  }

  if (choice === "no") {
    return interaction.update({
      content: t(interaction.guildId, "loot.delete.cancelled"),
      components: [],
    });
  }

  // Acknowledge first, then delete — once the thread is gone, there's
  // no channel left to send a response into.
  await interaction.update({
    content: t(interaction.guildId, "loot.delete.deleting"),
    components: [],
  });

  deleteLoot(recapMessageId);

  // The recap message lives inside the thread itself, so this button's
  // channel IS the thread — deleting it removes the whole thread.
  try {
    await interaction.channel.delete();
  } catch (err) {
    // Can't send a normal reply since we already used update() above —
    // follow up instead so the admin still sees the failure.
    await interaction.followUp({
      content: t(interaction.guildId, "loot.delete.failed"),
      flags: MessageFlags.Ephemeral,
    });
  }
  return;
}

async function handleChangeHolderBtn(interaction, parts) {
  const recapMessageId = parts[2];
  const record = getLoot(recapMessageId);
  if (!record) {
    return interaction.reply({
      content: t(interaction.guildId, "loot.changeHolder.recordGone"),
      flags: MessageFlags.Ephemeral,
    });
  }

  if (interaction.user.id !== record.leaderId) {
    return interaction.reply({
      content: t(interaction.guildId, "loot.changeHolder.leaderOnly"),
      flags: MessageFlags.Ephemeral,
    });
  }

  const options = [];
  for (const entry of record.roster) {
    let username = entry.userId;
    try {
      const user = await interaction.client.users.fetch(entry.userId);
      username = user.username;
    } catch (err) {
      // If the fetch fails for some reason, fall back to showing the raw ID.
    }
    const label =
      entry.userId === record.lootHolder
        ? t(interaction.guildId, "loot.changeHolder.currentTag", { username })
        : username;
    options.push({ label: label.slice(0, 100), value: entry.userId });
  }

  if (options.length === 0) {
    return interaction.reply({
      content: t(interaction.guildId, "loot.changeHolder.noRoster"),
      flags: MessageFlags.Ephemeral,
    });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`party:changeholderselect:${recapMessageId}`)
    .setPlaceholder(t(interaction.guildId, "loot.changeHolder.placeholder"))
    .addOptions(options.slice(0, 25)); // Discord select menus cap at 25 options

  return interaction.reply({
    content: t(interaction.guildId, "loot.changeHolder.prompt"),
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = {
  handleSoldBtn,
  handleGajiBtn,
  handleStampBtn,
  handleDeleteLootBtn,
  handleDeleteLootConfirm,
  handleChangeHolderBtn,
};
