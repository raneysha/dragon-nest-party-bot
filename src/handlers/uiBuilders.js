const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { ROLE_LABELS, isFull, getAllMemberIds } = require("./partyManager");
const { t } = require("../i18n");

const ROLE_BUTTON_CODES = {
  tank: "PL",
  healer: "HL",
  swordmaster: "SM",
  mercenary: "MC",
  sorceress: "SC",
  acrobat: "AC",
  flexible: "FLX",
};

const ROLE_EMOJIS = {
  tank: "🛡️",
  healer: "💉",
  swordmaster: "⚔️",
  mercenary: "🔨",
  sorceress: "🔥",
  acrobat: "🏹",
  flexible: "🎯",
};

function getRoleButtonCode(roleKey) {
  return ROLE_BUTTON_CODES[roleKey] || roleKey.slice(0, 3).toUpperCase();
}

function roleEmoji(roleKey) {
  return ROLE_EMOJIS[roleKey] || "🔹";
}

// Builds a roster-line code like "PL1", "FLX2" — the short prefix per
// role, with a number suffix only when that role has more than one slot
// (a single-slot role like Healer just shows "HL", not "HL1").
function getSlotCode(roleKey, index, cap) {
  const prefix = getRoleButtonCode(roleKey);
  return cap > 1 ? `${prefix}${index + 1}` : prefix;
}

function buildPartyEmbed(party, guildId) {
  const embed = new EmbedBuilder()
    .setTitle(`🗡️ ${party.activity}`)
    .setColor(isFull(party) ? 0x2ecc71 : 0x5865f2)
    .setFooter({
      text: t(guildId, isFull(party) ? "party.embed.full" : "party.embed.tapToJoin"),
    })
    .setTimestamp(party.createdAt);

  const details = [];
  if (party.time) details.push(t(guildId, "party.embed.when", { time: party.time }));
  details.push(t(guildId, "party.embed.leader", { leaderId: party.leaderId }));
  if (party.note) details.push(t(guildId, "party.embed.note", { note: party.note }));

  const totalCap = Object.values(party.roles).reduce((sum, r) => sum + r.cap, 0);
  const totalJoined = getAllMemberIds(party).length;
  details.push(
    `\n${t(guildId, "party.embed.status", {
      status: t(guildId, isFull(party) ? "party.embed.statusFull" : "party.embed.statusOpen"),
    })}`
  );
  details.push(t(guildId, "party.embed.members", { joined: totalJoined, total: totalCap }));
  if (party.nestType) details.push(t(guildId, "party.embed.raidNest", { nestType: party.nestType }));

  embed.setDescription(details.join("\n"));

  const rosterEntries = [];
  for (const [roleKey, role] of Object.entries(party.roles)) {
    for (let i = 0; i < role.cap; i++) {
      const code = getSlotCode(roleKey, i, role.cap);
      const member = role.members[i];
      const value = member
        ? `${member.subclass ? `${member.subclass} ` : ""}<@${member.userId}>`
        : t(guildId, "party.embed.openSlot");
      rosterEntries.push({ code, value });
    }
  }
  const maxCodeLength = Math.max(...rosterEntries.map((e) => e.code.length));
  const rosterLines = rosterEntries.map((e) => `\`${e.code.padEnd(maxCodeLength)}\` : ${e.value}`);
  embed.addFields({
    name: "\u200b",
    value: rosterLines.join("\n"),
    inline: false,
  });

  return embed;
}

function buildPartyButtons(party, guildId) {
  const rows = [];
  let row = new ActionRowBuilder();

  const roleKeys = Object.keys(party.roles);
  roleKeys.forEach((roleKey, i) => {
    const role = party.roles[roleKey];
    const full = role.members.length >= role.cap;
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`party:join:${roleKey}`)
        .setLabel(getRoleButtonCode(roleKey))
        .setEmoji(roleEmoji(roleKey))
        .setStyle(full ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(full)
    );
    // Wrap after 3 role buttons per row (Discord's actual max is 5, but 3
    // keeps rows balanced/neat instead of one packed row + a lonely leftover).
    if ((i + 1) % 3 === 0) {
      rows.push(row);
      row = new ActionRowBuilder();
    }
  });

  // Always push whatever's left in the role-buttons row (even a partial
  // one) before starting a fresh row for the action buttons — otherwise
  // role buttons and these can overflow past the 5-per-row limit together.
  if (row.components.length > 0) {
    rows.push(row);
  }

  // Split across two rows of 3 (instead of one packed row) since adding
  // Assign brought the action button count to 6 — one row can only hold 5.
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("party:ping")
        .setLabel(t(guildId, "party.buttons.ping"))
        .setEmoji("📣")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("party:leave")
        .setLabel(t(guildId, "party.buttons.leave"))
        .setEmoji("🚪")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("party:assign")
        .setLabel(t(guildId, "party.buttons.assign"))
        .setEmoji("👑")
        .setStyle(ButtonStyle.Secondary)
    )
  );
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("party:kick")
        .setLabel(t(guildId, "party.buttons.kick"))
        .setEmoji("👢")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("party:finish")
        .setLabel(t(guildId, "party.buttons.finish"))
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("party:disband")
        .setLabel(t(guildId, "party.buttons.disband"))
        .setEmoji("💥")
        .setStyle(ButtonStyle.Danger)
    )
  );

  return rows;
}

module.exports = { buildPartyEmbed, buildPartyButtons, getSlotCode };
