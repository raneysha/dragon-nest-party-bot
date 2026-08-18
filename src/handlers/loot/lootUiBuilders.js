const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

// Parses a free-typed price like "500k", "1.2m", "750rb" into a plain
// gold number. Accepts k/rb/ribu for thousands and m/jt/juta for
// millions (matching the placeholder shown on the harga input); a bare
// number with no suffix is taken as-is. Returns null if it can't be
// parsed, so unparseable entries can be excluded from the total instead
// of silently corrupting it.
function parseGoldAmount(raw) {
  if (!raw) return null;
  const str = raw.toString().trim().toLowerCase().replace(/\s+/g, "").replace(/,/g, ".");
  const match = str.match(/^(\d+(?:\.\d+)?)(k|rb|ribu|m|jt|juta)?$/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  if (Number.isNaN(num)) return null;
  const suffix = match[2];
  if (suffix === "k" || suffix === "rb" || suffix === "ribu") return num * 1_000;
  if (suffix === "m" || suffix === "jt" || suffix === "juta") return num * 1_000_000;
  return num;
}

function formatGold(num) {
  return new Intl.NumberFormat("id-ID").format(Math.round(num));
}

// Builds the loot recap embed from a lootManager record. Sold items get
// a ✅ marker; unsold ones stay numbered so the Sold dropdown's options
// line up with what's shown here.
function buildLootRecapEmbed(record) {
  const embed = new EmbedBuilder()
    .setTitle(`📦 Loot recap — ${record.activity}`)
    .setColor(0xf1c40f);

  const lootLines = record.items.length
    ? record.items
        .map((item, i) =>
          item.sold
            ? `✅ ~~${item.name}~~${item.price ? ` — ${item.price}` : ""}`
            : `${i + 1}. ${item.name}`
        )
        .join("\n")
    : "_none_";

  // Total is summed only from sold items with a parseable price. If some
  // sold item's price couldn't be parsed (free-text weirdness), the total
  // is flagged as approximate rather than silently dropping it.
  const soldPrices = record.items
    .filter((item) => item.sold && item.price)
    .map((item) => parseGoldAmount(item.price));
  const parsedPrices = soldPrices.filter((p) => p !== null);
  const totalGold = parsedPrices.reduce((sum, p) => sum + p, 0);
  const hasUnparsedPrice = parsedPrices.length !== soldPrices.length;
  const totalLine =
    parsedPrices.length > 0
      ? `\n**Total gold:** ${formatGold(totalGold)}${hasUnparsedPrice ? " (approx — ada harga yang tidak terbaca)" : ""}`
      : "";

  embed.setDescription(
    `**Tanggal clear:** ${record.dateCleared}\n**Bawa loot:** <@${record.lootHolder}>\n**Loot:**\n${lootLines}${totalLine}`
  );

  if (record.roster && record.roster.length > 0) {
    const maxCodeLength = Math.max(...record.roster.map((e) => e.code.length));
    const rosterLines = record.roster.map((e) => {
      const value = e.subclass ? `${e.subclass} <@${e.userId}>` : `<@${e.userId}>`;
      const stampText = e.stamp != null ? ` — 🎟️ ${e.stamp}` : "";
      return `${e.code.padEnd(maxCodeLength)} : ${value}${e.paid ? " ✅" : ""}${stampText}`;
    });
    const totalStamp = record.roster.reduce((sum, e) => sum + (e.stamp || 0), 0);
    const totalGoldStamp = totalStamp * 3;
    const totalGaji = (totalGold - totalGoldStamp) / record.roster.length;
    rosterLines.push(
      "",
      `**Total Gold Stamp:** ${formatGold(totalGoldStamp)}`,
      `**Total Gaji:** ${formatGold(totalGaji)}`
    );
    embed.addFields({ name: "🎟️ STAMP", value: rosterLines.join("\n"), inline: false });
  }

  return embed;
}

// The "Bawa loot" field is now the loot holder's real Discord user ID
// (picked from a dropdown of party members), so this is an exact match —
// no more fuzzy username/nickname guessing.
function isLootHolder(interaction, record) {
  return interaction.user.id === record.lootHolder;
}

// Whether every loot item has been marked sold. Also true if there are no
// items at all — nothing to sell means the Gaji button should be usable
// right away.
function allItemsSold(record) {
  return record.items.every((item) => item.sold);
}

// Builds the SOLD/GAJI button row for the loot recap message. GAJI stays
// disabled until every item is marked sold.
function buildLootButtons(recapMessageId, record) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`party:soldbtn:${recapMessageId}`)
        .setLabel("SOLD")
        .setEmoji("💰")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`party:gajibtn:${recapMessageId}`)
        .setLabel("GAJI")
        .setEmoji("💵")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!allItemsSold(record)),
      new ButtonBuilder()
        .setCustomId(`party:stampbtn:${recapMessageId}`)
        .setLabel("STAMP")
        .setEmoji("🎟️")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`party:changeholderbtn:${recapMessageId}`)
        .setLabel("Ubah Pembawa Loot")
        .setEmoji("👑")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`party:deletelootbtn:${recapMessageId}`)
        .setLabel("Delete")
        .setEmoji("🗑️")
        .setStyle(ButtonStyle.Danger)
    ),
  ];
}

module.exports = {
  parseGoldAmount,
  formatGold,
  isLootHolder,
  allItemsSold,
  buildLootRecapEmbed,
  buildLootButtons,
};
