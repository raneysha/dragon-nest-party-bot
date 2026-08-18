const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
const { getLoot, markPaid, setLootHolder } = require("../lootManager");
const { buildLootRecapEmbed, buildLootButtons, isLootHolder } = require("./lootUiBuilders");

async function handleSoldSelect(interaction, parts) {
  const [, , recapMessageId] = parts;
  const index = interaction.values[0];

  const record = getLoot(recapMessageId);
  if (!record) {
    return interaction.update({
      content: "Data loot untuk party ini sudah tidak tersedia.",
      components: [],
    });
  }

  if (!isLootHolder(interaction, record)) {
    return interaction.update({
      content: `Hanya **<@${record.lootHolder}>** (pembawa loot) yang bisa menandai item terjual.`,
      components: [],
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`party:soldprice:${recapMessageId}:${index}`)
    .setTitle("Harga jual");

  const hargaInput = new TextInputBuilder()
    .setCustomId("harga")
    .setLabel(`Harga untuk "${record.items[index].name}"`.slice(0, 45))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("misal 500k, 1.2m, 750rb")
    .setMaxLength(30)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(hargaInput));
  return interaction.showModal(modal);
}

async function handleGajiSelect(interaction, parts) {
  const [, , recapMessageId] = parts;
  const index = Number(interaction.values[0]);

  const existingRecord = getLoot(recapMessageId);
  if (!existingRecord) {
    return interaction.update({
      content: "Data party ini sudah tidak tersedia.",
      components: [],
    });
  }

  if (!isLootHolder(interaction, existingRecord)) {
    return interaction.update({
      content: `Hanya **<@${existingRecord.lootHolder}>** (pembawa loot) yang bisa menandai gaji.`,
      components: [],
    });
  }

  const record = markPaid(recapMessageId, index);
  if (!record) {
    return interaction.update({
      content: "Data party ini sudah tidak tersedia.",
      components: [],
    });
  }

  try {
    const recapMessage = await interaction.channel.messages.fetch(recapMessageId);
    await recapMessage.edit({ embeds: [buildLootRecapEmbed(record)] });
  } catch (err) {
    // Recap message may have been deleted — not fatal, the payment is still recorded.
  }

  return interaction.update({
    content: `✅ Gaji diberikan ke <@${record.roster[index].userId}>`,
    components: [],
  });
}

async function handleStampSelect(interaction, parts) {
  const [, , recapMessageId] = parts;
  const index = interaction.values[0];

  const record = getLoot(recapMessageId);
  if (!record) {
    return interaction.update({
      content: "Data loot untuk party ini sudah tidak tersedia.",
      components: [],
    });
  }

  if (!isLootHolder(interaction, record)) {
    return interaction.update({
      content: `Hanya **<@${record.lootHolder}>** (pembawa loot) yang bisa mengisi STAMP.`,
      components: [],
    });
  }

  const entry = record.roster[index];
  let username = entry.userId;
  try {
    const user = await interaction.client.users.fetch(entry.userId);
    username = user.username;
  } catch (err) {
    // Fall back to the raw ID if the fetch fails.
  }

  const modal = new ModalBuilder()
    .setCustomId(`party:stampmodal:${recapMessageId}:${index}`)
    .setTitle("Isi STAMP");

  const stampInput = new TextInputBuilder()
    .setCustomId("stamp")
    .setLabel(`Jumlah STAMP untuk ${username}`.slice(0, 45))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("misal 5")
    .setValue(entry.stamp != null ? String(entry.stamp) : "")
    .setMaxLength(10)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(stampInput));
  return interaction.showModal(modal);
}

async function handleChangeHolderSelect(interaction, parts) {
  const [, , recapMessageId] = parts;
  const newHolderId = interaction.values[0];

  const existingRecord = getLoot(recapMessageId);
  if (!existingRecord) {
    return interaction.update({
      content: "Data loot untuk party ini sudah tidak tersedia.",
      components: [],
    });
  }

  if (interaction.user.id !== existingRecord.leaderId) {
    return interaction.update({
      content: "Hanya party leader yang bisa mengubah pembawa loot.",
      components: [],
    });
  }

  const record = setLootHolder(recapMessageId, newHolderId);
  if (!record) {
    return interaction.update({
      content: "Data loot untuk party ini sudah tidak tersedia.",
      components: [],
    });
  }

  try {
    const recapMessage = await interaction.channel.messages.fetch(recapMessageId);
    await recapMessage.edit({
      embeds: [buildLootRecapEmbed(record)],
      components: buildLootButtons(recapMessageId, record),
    });
  } catch (err) {
    // Recap message may have been deleted — not fatal, the change is still recorded.
  }

  return interaction.update({
    content: `✅ Pembawa loot diubah ke <@${newHolderId}>.`,
    components: [],
  });
}

module.exports = { handleSoldSelect, handleGajiSelect, handleStampSelect, handleChangeHolderSelect };