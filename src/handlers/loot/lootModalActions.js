const { MessageFlags } = require("discord.js");
const { getLoot, markSold, markStamp } = require("../lootManager");
const { buildLootRecapEmbed, buildLootButtons, isLootHolder } = require("./lootUiBuilders");

async function handleSoldPrice(interaction, parts) {
  const [, , recapMessageId, indexStr] = parts;
  const index = Number(indexStr);
  const harga = interaction.fields.getTextInputValue("harga").trim();

  const existingRecord = getLoot(recapMessageId);
  if (!existingRecord) {
    return interaction.reply({
      content: "Data loot untuk party ini sudah tidak tersedia.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!isLootHolder(interaction, existingRecord)) {
    return interaction.reply({
      content: `Hanya **<@${existingRecord.lootHolder}>** (pembawa loot) yang bisa menandai item terjual.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const record = markSold(recapMessageId, index, interaction.user.id, harga);
  if (!record) {
    return interaction.reply({
      content: "Data loot untuk party ini sudah tidak tersedia.",
      flags: MessageFlags.Ephemeral,
    });
  }

  try {
    const recapMessage = await interaction.channel.messages.fetch(recapMessageId);
    await recapMessage.edit({
      embeds: [buildLootRecapEmbed(record)],
      components: buildLootButtons(recapMessageId, record),
    });
  } catch (err) {
    // Recap message may have been deleted — not fatal, the sale is still recorded.
  }

  return interaction.reply({
    content: `✅ Ditandai terjual: **${record.items[index].name}** — ${harga}`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleStampModal(interaction, parts) {
  const [, , recapMessageId, indexStr] = parts;
  const index = Number(indexStr);
  const stampRaw = interaction.fields.getTextInputValue("stamp").trim();
  const stampValue = Number(stampRaw);

  if (!Number.isFinite(stampValue)) {
    return interaction.reply({
      content: `"${stampRaw}" bukan angka yang valid. Coba lagi dengan angka saja, misal 5.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const existingRecord = getLoot(recapMessageId);
  if (!existingRecord) {
    return interaction.reply({
      content: "Data loot untuk party ini sudah tidak tersedia.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!isLootHolder(interaction, existingRecord)) {
    return interaction.reply({
      content: `Hanya **<@${existingRecord.lootHolder}>** (pembawa loot) yang bisa mengisi STAMP.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const record = markStamp(recapMessageId, index, stampValue);
  if (!record) {
    return interaction.reply({
      content: "Data loot untuk party ini sudah tidak tersedia.",
      flags: MessageFlags.Ephemeral,
    });
  }

  try {
    const recapMessage = await interaction.channel.messages.fetch(recapMessageId);
    await recapMessage.edit({ embeds: [buildLootRecapEmbed(record)] });
  } catch (err) {
    // Recap message may have been deleted — not fatal, the stamp is still recorded.
  }

  return interaction.reply({
    content: `🎟️ STAMP untuk <@${record.roster[index].userId}> diset ke **${stampValue}**.`,
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { handleSoldPrice, handleStampModal };
