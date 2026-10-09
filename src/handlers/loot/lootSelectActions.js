const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
const { getLoot, markPaid, setLootHolder } = require("../lootManager");
const { buildLootRecapEmbed, buildLootButtons, isLootHolder } = require("./lootUiBuilders");
const { t } = require("../../i18n");

async function handleSoldSelect(interaction, parts) {
  const [, , recapMessageId] = parts;
  const index = interaction.values[0];

  const record = getLoot(recapMessageId);
  if (!record) {
    return interaction.update({
      content: t(interaction.guildId, "loot.sold.recordGone"),
      components: [],
    });
  }

  if (!isLootHolder(interaction, record)) {
    return interaction.update({
      content: t(interaction.guildId, "loot.sold.notHolder", { lootHolder: record.lootHolder }),
      components: [],
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`party:soldprice:${recapMessageId}:${index}`)
    .setTitle(t(interaction.guildId, "loot.sold.modalTitle"));

  const hargaInput = new TextInputBuilder()
    .setCustomId("harga")
    .setLabel(t(interaction.guildId, "loot.sold.priceLabel", { item: record.items[index].name }).slice(0, 45))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(t(interaction.guildId, "loot.sold.pricePlaceholder"))
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
      content: t(interaction.guildId, "loot.gaji.recordGone"),
      components: [],
    });
  }

  if (!isLootHolder(interaction, existingRecord)) {
    return interaction.update({
      content: t(interaction.guildId, "loot.gaji.notHolder", { lootHolder: existingRecord.lootHolder }),
      components: [],
    });
  }

  const record = markPaid(recapMessageId, index);
  if (!record) {
    return interaction.update({
      content: t(interaction.guildId, "loot.gaji.recordGone"),
      components: [],
    });
  }

  try {
    const recapMessage = await interaction.channel.messages.fetch(recapMessageId);
    await recapMessage.edit({ embeds: [buildLootRecapEmbed(record, interaction.guildId)] });
  } catch (err) {
    // Recap message may have been deleted — not fatal, the payment is still recorded.
  }

  return interaction.update({
    content: t(interaction.guildId, "loot.gaji.confirm", { userId: record.roster[index].userId }),
    components: [],
  });
}

async function handleStampSelect(interaction, parts) {
  const [, , recapMessageId] = parts;
  const index = interaction.values[0];

  const record = getLoot(recapMessageId);
  if (!record) {
    return interaction.update({
      content: t(interaction.guildId, "loot.stamp.recordGone"),
      components: [],
    });
  }

  if (!isLootHolder(interaction, record)) {
    return interaction.update({
      content: t(interaction.guildId, "loot.stamp.notHolder", { lootHolder: record.lootHolder }),
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
    .setTitle(t(interaction.guildId, "loot.stamp.modalTitle"));

  const stampInput = new TextInputBuilder()
    .setCustomId("stamp")
    .setLabel(t(interaction.guildId, "loot.stamp.amountLabel", { username }).slice(0, 45))
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(t(interaction.guildId, "loot.stamp.amountPlaceholder"))
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
      content: t(interaction.guildId, "loot.changeHolder.recordGone"),
      components: [],
    });
  }

  if (interaction.user.id !== existingRecord.leaderId) {
    return interaction.update({
      content: t(interaction.guildId, "loot.changeHolder.leaderOnly"),
      components: [],
    });
  }

  const record = setLootHolder(recapMessageId, newHolderId);
  if (!record) {
    return interaction.update({
      content: t(interaction.guildId, "loot.changeHolder.recordGone"),
      components: [],
    });
  }

  try {
    const recapMessage = await interaction.channel.messages.fetch(recapMessageId);
    await recapMessage.edit({
      embeds: [buildLootRecapEmbed(record, interaction.guildId)],
      components: buildLootButtons(recapMessageId, record, interaction.guildId),
    });
  } catch (err) {
    // Recap message may have been deleted — not fatal, the change is still recorded.
  }

  return interaction.update({
    content: t(interaction.guildId, "loot.changeHolder.confirm", { userId: newHolderId }),
    components: [],
  });
}

module.exports = { handleSoldSelect, handleGajiSelect, handleStampSelect, handleChangeHolderSelect };
