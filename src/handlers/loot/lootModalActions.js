const { MessageFlags } = require("discord.js");
const { getLoot, markSold, markStamp } = require("../lootManager");
const { buildLootRecapEmbed, buildLootButtons, isLootHolder } = require("./lootUiBuilders");
const { t } = require("../../i18n");

async function handleSoldPrice(interaction, parts) {
  const [, , recapMessageId, indexStr] = parts;
  const index = Number(indexStr);
  const harga = interaction.fields.getTextInputValue("harga").trim();

  const existingRecord = getLoot(recapMessageId);
  if (!existingRecord) {
    return interaction.reply({
      content: t(interaction.guildId, "loot.sold.recordGone"),
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!isLootHolder(interaction, existingRecord)) {
    return interaction.reply({
      content: t(interaction.guildId, "loot.sold.notHolder", { lootHolder: existingRecord.lootHolder }),
      flags: MessageFlags.Ephemeral,
    });
  }

  const record = markSold(recapMessageId, index, interaction.user.id, harga);
  if (!record) {
    return interaction.reply({
      content: t(interaction.guildId, "loot.sold.recordGone"),
      flags: MessageFlags.Ephemeral,
    });
  }

  try {
    const recapMessage = await interaction.channel.messages.fetch(recapMessageId);
    await recapMessage.edit({
      embeds: [buildLootRecapEmbed(record, interaction.guildId)],
      components: buildLootButtons(recapMessageId, record, interaction.guildId),
    });
  } catch (err) {
    // Recap message may have been deleted — not fatal, the sale is still recorded.
  }

  return interaction.reply({
    content: t(interaction.guildId, "loot.sold.confirm", { item: record.items[index].name, price: harga }),
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
      content: t(interaction.guildId, "loot.stamp.notANumber", { raw: stampRaw }),
      flags: MessageFlags.Ephemeral,
    });
  }

  const existingRecord = getLoot(recapMessageId);
  if (!existingRecord) {
    return interaction.reply({
      content: t(interaction.guildId, "loot.stamp.recordGone"),
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!isLootHolder(interaction, existingRecord)) {
    return interaction.reply({
      content: t(interaction.guildId, "loot.stamp.notHolder", { lootHolder: existingRecord.lootHolder }),
      flags: MessageFlags.Ephemeral,
    });
  }

  const record = markStamp(recapMessageId, index, stampValue);
  if (!record) {
    return interaction.reply({
      content: t(interaction.guildId, "loot.stamp.recordGone"),
      flags: MessageFlags.Ephemeral,
    });
  }

  try {
    const recapMessage = await interaction.channel.messages.fetch(recapMessageId);
    await recapMessage.edit({ embeds: [buildLootRecapEmbed(record, interaction.guildId)] });
  } catch (err) {
    // Recap message may have been deleted — not fatal, the stamp is still recorded.
  }

  return interaction.reply({
    content: t(interaction.guildId, "loot.stamp.confirm", { userId: record.roster[index].userId, value: stampValue }),
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { handleSoldPrice, handleStampModal };
