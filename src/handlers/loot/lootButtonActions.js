const { MessageFlags, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require("discord.js");
const { getLoot, deleteLoot } = require("../lootManager");
const { isLootHolder, allItemsSold } = require("./lootUiBuilders");

async function handleSoldBtn(interaction, parts) {
  const recapMessageId = parts[2];
  const record = getLoot(recapMessageId);
  if (!record) {
    return interaction.reply({
      content: "Data loot untuk party ini sudah tidak tersedia.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!isLootHolder(interaction, record)) {
    return interaction.reply({
      content: `Hanya **<@${record.lootHolder}>** (pembawa loot) yang bisa menandai item terjual.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const unsoldOptions = record.items
    .map((item, i) => ({ label: item.name.slice(0, 100), value: String(i), sold: item.sold }))
    .filter((opt) => !opt.sold);

  if (unsoldOptions.length === 0) {
    return interaction.reply({
      content: "Semua item sudah ditandai terjual.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`party:soldselect:${recapMessageId}`)
    .setPlaceholder("Pilih item yang sudah terjual")
    .addOptions(unsoldOptions.slice(0, 25)); // Discord select menus cap at 25 options

  return interaction.reply({
    content: "Item mana yang sudah terjual?",
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleGajiBtn(interaction, parts) {
  const recapMessageId = parts[2];
  const record = getLoot(recapMessageId);
  if (!record) {
    return interaction.reply({
      content: "Data party ini sudah tidak tersedia.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!isLootHolder(interaction, record)) {
    return interaction.reply({
      content: `Hanya **<@${record.lootHolder}>** (pembawa loot) yang bisa menandai gaji.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!allItemsSold(record)) {
    return interaction.reply({
      content: "Semua item harus terjual dulu sebelum gaji bisa ditandai.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const unpaidEntries = record.roster
    .map((entry, i) => ({ entry, i }))
    .filter(({ entry }) => !entry.paid);

  if (unpaidEntries.length === 0) {
    return interaction.reply({
      content: "Semua member sudah menerima gaji.",
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
    .setPlaceholder("Pilih member yang sudah digaji")
    .addOptions(options); // already capped at 25 above

  return interaction.reply({
    content: "Member mana yang sudah menerima gaji?",
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleStampBtn(interaction, parts) {
  const recapMessageId = parts[2];
  const record = getLoot(recapMessageId);
  if (!record) {
    return interaction.reply({
      content: "Data loot untuk party ini sudah tidak tersedia.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!isLootHolder(interaction, record)) {
    return interaction.reply({
      content: `Hanya **<@${record.lootHolder}>** (pembawa loot) yang bisa mengisi STAMP.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!record.roster || record.roster.length === 0) {
    return interaction.reply({
      content: "Tidak ada member di roster party ini.",
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
    .setPlaceholder("Pilih member")
    .addOptions(options.slice(0, 25)); // Discord select menus cap at 25 options

  return interaction.reply({
    content: "Isi STAMP untuk member mana?",
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleDeleteLootBtn(interaction, parts) {
  const recapMessageId = parts[2];
  const record = getLoot(recapMessageId);
  if (!record) {
    return interaction.reply({
      content: "Data loot untuk party ini sudah tidak tersedia.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: "Hanya server admin yang bisa menghapus loot thread ini.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`party:deletelootconfirm:yes:${recapMessageId}`)
      .setLabel("Ya, hapus thread")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`party:deletelootconfirm:no:${recapMessageId}`)
      .setLabel("Batal")
      .setStyle(ButtonStyle.Secondary)
  );

  return interaction.reply({
    content: "⚠️ Yakin mau hapus thread loot ini? Aksi ini tidak bisa dibatalkan.",
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
      content: "Data loot untuk party ini sudah tidak tersedia.",
      components: [],
    });
  }

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.update({
      content: "Hanya server admin yang bisa menghapus loot thread ini.",
      components: [],
    });
  }

  if (choice === "no") {
    return interaction.update({
      content: "👍 Dibatalkan — thread tidak dihapus.",
      components: [],
    });
  }

  // Acknowledge first, then delete — once the thread is gone, there's
  // no channel left to send a response into.
  await interaction.update({
    content: "🗑️ Menghapus thread...",
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
      content: "Data loot sudah dihapus, tapi gagal menghapus thread — cek permission bot (Manage Threads).",
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
      content: "Data loot untuk party ini sudah tidak tersedia.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (interaction.user.id !== record.leaderId) {
    return interaction.reply({
      content: "Hanya party leader yang bisa mengubah pembawa loot.",
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
    const label = entry.userId === record.lootHolder ? `⭐ ${username} (saat ini)` : username;
    options.push({ label: label.slice(0, 100), value: entry.userId });
  }

  if (options.length === 0) {
    return interaction.reply({
      content: "Tidak ada member di roster party ini.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`party:changeholderselect:${recapMessageId}`)
    .setPlaceholder("Pilih pembawa loot baru")
    .addOptions(options.slice(0, 25)); // Discord select menus cap at 25 options

  return interaction.reply({
    content: "Siapa pembawa loot yang baru?",
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
