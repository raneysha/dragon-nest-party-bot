const {
  MessageFlags,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");
const {
  getParty,
  joinRole,
  removeMember,
  deleteParty,
  isMember,
  getAllMemberIds,
  ROLE_LABELS,
} = require("./partyManager");
const { buildPartyEmbed, buildPartyButtons, getSlotCode } = require("./uiBuilders");
const { hasSubclasses, getSubclasses } = require("./roleClasses");
const { createLoot, getLoot, deleteLoot, markSold, markPaid, markStamp, setLootHolder } = require("./lootManager");
const { getLootChannel } = require("./guildConfigManager");

// Finish and Disband can be used by the party leader OR anyone with server
// Administrator permission (mods stepping in for an absent/AFK leader).
// Other leader-gated actions (Kick, loot selling, etc.) stay leader-only.
function isLeaderOrAdmin(interaction, party) {
  if (interaction.user.id === party.leaderId) return true;
  return interaction.member?.permissions?.has(PermissionFlagsBits.Administrator) ?? false;
}

// Refreshes the live party embed/buttons on the original party message.
// Needed when the update comes from an ephemeral message (the subclass
// picker) rather than a direct interaction on the party message itself.
async function refreshPartyMessage(client, party) {
  const channel = await client.channels.fetch(party.channelId);
  const message = await channel.messages.fetch(party.messageId);
  await message.edit({
    embeds: [buildPartyEmbed(party)],
    components: buildPartyButtons(party),
  });
}

// Builds an ephemeral "choose your class" prompt using a dropdown
// (StringSelectMenu) instead of a row of buttons.
function buildSubclassPrompt(messageId, roleKey) {
  const subclasses = getSubclasses(roleKey);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`party:pickclass:${messageId}:${roleKey}`)
    .setPlaceholder(`Choose your ${ROLE_LABELS[roleKey]} class`)
    .addOptions(subclasses.map((subclass) => ({ label: subclass, value: subclass })));

  return {
    content: `Choose your ${ROLE_LABELS[roleKey]} class:`,
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral,
  };
}

// Builds the loot thread's name in the requested format:
// [Party name] [Date Cleared] [Loot holder]
// Discord thread names are capped at 100 characters, so this truncates
// if needed rather than letting the API call fail.
function buildFinishThreadName(activity, dateCleared, lootHolder) {
  const name = `[${activity}] [${dateCleared}] [${lootHolder}]`;
  return name.length > 100 ? name.slice(0, 100) : name;
}

// Builds the roster (same PL/PR/SM code style as the party listing) once,
// at finish-time, from the party that's about to be deleted. Each entry
// tracks its own `paid` flag so the Gaji button can check members off
// individually. The leader gets a 👑 entry if they didn't fill a role.
function buildLootRoster(party) {
  const roster = [];
  for (const [roleKey, role] of Object.entries(party.roles)) {
    role.members.forEach((member, i) => {
      roster.push({
        code: getSlotCode(roleKey, i, role.cap),
        userId: member.userId,
        subclass: member.subclass,
        paid: false,
        stamp: null,
      });
    });
  }
  if (!isMember(party, party.leaderId)) {
    roster.push({ code: "👑", userId: party.leaderId, subclass: null, paid: false, stamp: null });
  }
  return roster;
}

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
  const soldPrices = record.items.filter((item) => item.sold && item.price).map((item) => parseGoldAmount(item.price));
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

async function handleButton(interaction) {
  const parts = interaction.customId.split(":");
  const action = parts[1];

  if (action === "soldbtn") {
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

  if (action === "gajibtn") {
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

  if (action === "stampbtn") {
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

  if (action === "deletelootbtn") {
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

  if (action === "deletelootconfirm") {
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

  if (action === "changeholderbtn") {
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

  if (action === "finishconfirm") {
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

  const roleKey = parts[2];
  const party = getParty(interaction.message.id);

  if (!party) {
    return interaction.reply({
      content: "This party no longer exists.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (action === "ping") {
    if (!isMember(party, interaction.user.id)) {
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

  if (action === "assign") {
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

  if (action === "kick") {
    if (interaction.user.id !== party.leaderId) {
      return interaction.reply({
        content: "Only the party leader can kick members.",
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

  if (action === "finish") {
    if (!isLeaderOrAdmin(interaction, party)) {
      return interaction.reply({
        content: "Only the party leader or a server admin can finish this party.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // Loot holder is picked from the actual party roster (leader included,
    // even if they didn't fill a role) instead of typed as free text — this
    // is what makes the "Hanya <holder>" checks on SOLD/GAJI reliable.
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

  if (action === "join") {
    if (hasSubclasses(roleKey)) {
      return interaction.reply(buildSubclassPrompt(party.messageId, roleKey));
    }
    const result = joinRole(party.messageId, interaction.user.id, roleKey);
    if (result === "full") {
      return interaction.reply({
        content: "That role just filled up — try another one!",
        flags: MessageFlags.Ephemeral,
      });
    }
  } else if (action === "leave") {
    const removed = removeMember(party.messageId, interaction.user.id);
    if (!removed) {
      return interaction.reply({
        content: "You're not currently signed up for this party.",
        flags: MessageFlags.Ephemeral,
      });
    }
  } else if (action === "disband") {
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

  return interaction.update({
    embeds: [buildPartyEmbed(party)],
    components: buildPartyButtons(party),
  });
}

// Handles the dropdown selection from the subclass picker.
// customId format: party:pickclass:<messageId>:<role>
async function handleSelectMenu(interaction) {
  const parts = interaction.customId.split(":");
  const action = parts[1];

  if (action === "assignrole") {
    const [, , messageId] = parts;
    const party = getParty(messageId);

    if (!party) {
      return interaction.update({ content: "This party no longer exists.", components: [] });
    }
    if (!isLeaderOrAdmin(interaction, party)) {
      return interaction.update({
        content: "Only the party leader or a server admin can assign members to a role.",
        components: [],
      });
    }

    const roleKey = interaction.values[0];
    const role = party.roles[roleKey];
    if (!role || role.members.length >= role.cap) {
      return interaction.update({
        content: "That role just filled up — try a different one.",
        components: [],
      });
    }

    const userMenu = new UserSelectMenuBuilder()
      .setCustomId(`party:assignuser:${messageId}:${roleKey}`)
      .setPlaceholder(`Who should fill ${ROLE_LABELS[roleKey]}?`);

    return interaction.update({
      content: `Pick who to assign to **${ROLE_LABELS[roleKey]}**:`,
      components: [new ActionRowBuilder().addComponents(userMenu)],
    });
  }

  if (action === "assignuser") {
    const [, , messageId, roleKey] = parts;
    const party = getParty(messageId);

    if (!party) {
      return interaction.update({ content: "This party no longer exists.", components: [] });
    }
    if (!isLeaderOrAdmin(interaction, party)) {
      return interaction.update({
        content: "Only the party leader or a server admin can assign members to a role.",
        components: [],
      });
    }

    const role = party.roles[roleKey];
    if (!role || role.members.length >= role.cap) {
      return interaction.update({
        content: "That role just filled up — try a different one.",
        components: [],
      });
    }

    const targetUserId = interaction.values[0];
    // interaction.users is a Collection of resolved User objects that comes
    // bundled with a UserSelectMenu interaction — no extra API call needed.
    const targetUsername = interaction.users?.get(targetUserId)?.username ?? targetUserId;

    if (hasSubclasses(roleKey)) {
      const subclasses = getSubclasses(roleKey);
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`party:assignclass:${messageId}:${roleKey}:${targetUserId}`)
        .setPlaceholder(`Which class for ${targetUsername}?`) // placeholders are plain text — mentions don't render here
        .addOptions(subclasses.map((subclass) => ({ label: subclass, value: subclass })));

      return interaction.update({
        content: `Which class should <@${targetUserId}> be assigned as ${ROLE_LABELS[roleKey]}?`,
        components: [new ActionRowBuilder().addComponents(menu)],
      });
    }

    const result = joinRole(messageId, targetUserId, roleKey);
    if (result === "full") {
      return interaction.update({
        content: "That role just filled up — try a different one.",
        components: [],
      });
    }

    await refreshPartyMessage(interaction.client, party);
    return interaction.update({
      content: `Assigned <@${targetUserId}> to ${ROLE_LABELS[roleKey]}.`,
      components: [],
    });
  }

  if (action === "assignclass") {
    const [, , messageId, roleKey, targetUserId] = parts;
    const party = getParty(messageId);

    if (!party) {
      return interaction.update({ content: "This party no longer exists.", components: [] });
    }
    if (!isLeaderOrAdmin(interaction, party)) {
      return interaction.update({
        content: "Only the party leader or a server admin can assign members to a role.",
        components: [],
      });
    }

    const subclass = interaction.values[0];
    const result = joinRole(messageId, targetUserId, roleKey, subclass);
    if (result === "full") {
      return interaction.update({
        content: "That role just filled up — try a different one.",
        components: [],
      });
    }

    await refreshPartyMessage(interaction.client, party);
    return interaction.update({
      content: `Assigned <@${targetUserId}> as **${subclass}** ${ROLE_LABELS[roleKey]}.`,
      components: [],
    });
  }

  if (action === "kickselect") {
    const [, , messageId] = parts;
    const party = getParty(messageId);

    if (!party) {
      return interaction.update({ content: "This party no longer exists.", components: [] });
    }
    if (interaction.user.id !== party.leaderId) {
      return interaction.update({
        content: "Only the party leader can kick members.",
        components: [],
      });
    }

    const kickedId = interaction.values[0];
    const removed = removeMember(messageId, kickedId);
    if (!removed) {
      return interaction.update({
        content: "That member already left the party.",
        components: [],
      });
    }

    await refreshPartyMessage(interaction.client, party);
    return interaction.update({
      content: `Kicked <@${kickedId}> from the party.`,
      components: [],
    });
  }

  if (action === "soldselect") {
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

  if (action === "gajiselect") {
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

  if (action === "stampselect") {
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

  if (action === "changeholderselect") {
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

  if (action === "finishholder") {
    const [, , messageId] = parts;
    const lootHolderId = interaction.values[0];

    const party = getParty(messageId);
    if (!party) {
      return interaction.update({ content: "This party no longer exists.", components: [] });
    }
    if (!isLeaderOrAdmin(interaction, party)) {
      return interaction.update({
        content: "Only the party leader or a server admin can finish this party.",
        components: [],
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`party:finishmodal:${messageId}:${lootHolderId}`)
      .setTitle("Finish party");

    const lootListInput = new TextInputBuilder()
      .setCustomId("loot_list")
      .setLabel("Lootnya apa aja?")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Satu item per baris")
      .setMaxLength(500)
      .setRequired(true);

    const dateInput = new TextInputBuilder()
      .setCustomId("date_cleared")
      .setLabel("Tanggal clear")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("e.g. 10/07/2026")
      .setMaxLength(30)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(lootListInput),
      new ActionRowBuilder().addComponents(dateInput)
    );

    return interaction.showModal(modal);
  }

  if (action !== "pickclass") return;

  const [, , messageId, roleKey] = parts;
  const subclass = interaction.values[0];

  const party = getParty(messageId);
  if (!party) {
    return interaction.update({
      content: "This party no longer exists.",
      components: [],
    });
  }

  const result = joinRole(messageId, interaction.user.id, roleKey, subclass);
  if (result === "full") {
    return interaction.update({
      content: "That role just filled up — try another one!",
      components: [],
    });
  }

  await refreshPartyMessage(interaction.client, party);
  return interaction.update({
    content: `Joined as **${subclass}** ${ROLE_LABELS[roleKey]}!`,
    components: [],
  });
}

// Handles submission of the "ping the party" modal.
// customId format: party:pingmodal:<messageId>
async function handleModalSubmit(interaction) {
  const parts = interaction.customId.split(":");
  const action = parts[1];

  if (action === "finishmodal") {
    return handleFinishModalSubmit(interaction);
  }

  if (action === "soldprice") {
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

  if (action === "stampmodal") {
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

  if (action !== "pingmodal") return;

  const [, , messageId] = parts;
  const party = getParty(messageId);
  if (!party) {
    return interaction.reply({
      content: "This party no longer exists.",
      flags: MessageFlags.Ephemeral,
    });
  }

  // Double-check membership at submit time too — someone could leave the
  // party in the time between opening the modal and submitting it.
  if (!isMember(party, interaction.user.id)) {
    return interaction.reply({
      content: "You need to join the party before you can ping it.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const message = interaction.fields.getTextInputValue("message");
  const memberIds = getAllMemberIds(party);
  const mentions = memberIds.map((id) => `<@${id}>`).join(" ");

  return interaction.reply({
    content: `📣 **${interaction.user.username}** on **${party.activity}**:\n${message}\n\n${mentions}`,
  });
}

// Handles submission of the "finish party" modal. Deletes the party,
// removes its message, and creates a loot-recap thread with every member
// (plus the leader) added to it.
// customId format: party:finishmodal:<messageId>
async function handleFinishModalSubmit(interaction) {
  const [, , messageId, lootHolderId] = interaction.customId.split(":");
  const party = getParty(messageId);

  if (!party) {
    return interaction.reply({
      content: "This party no longer exists.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!isLeaderOrAdmin(interaction, party)) {
    return interaction.reply({
      content: "Only the party leader or a server admin can finish this party.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const lootList = interaction.fields.getTextInputValue("loot_list");
  const dateCleared = interaction.fields.getTextInputValue("date_cleared");

  // Thread names can't contain a live mention, so fetch a plain username
  // for the loot holder just for that — the loot record itself keeps the
  // real user ID (lootHolderId) for permission checks and the @mention
  // shown in the recap embed.
  let lootHolderName = lootHolderId;
  try {
    const user = await interaction.client.users.fetch(lootHolderId);
    lootHolderName = user.username;
  } catch (err) {
    // Fall back to the raw ID for the thread name if the fetch fails.
  }

  // Everyone who joined a role, plus the leader (who may not have joined
  // a role themselves), gets added to the loot thread.
  const memberIds = new Set(getAllMemberIds(party));
  memberIds.add(party.leaderId);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const threadName = buildFinishThreadName(party.activity, dateCleared, lootHolderName);
  const mentions = Array.from(memberIds).map((id) => `<@${id}>`).join(" ");

  // One loot item per line, blank lines dropped — this becomes the list
  // of options in the Sold dropdown, in the same order shown in the embed.
  const lootItems = lootList
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name) => ({ name, sold: false, soldTo: null }));

  const lootRecord = {
    activity: party.activity,
    dateCleared,
    lootHolder: lootHolderId,
    leaderId: party.leaderId,
    roster: buildLootRoster(party),
    items: lootItems,
  };
  const recapEmbed = buildLootRecapEmbed(lootRecord);

  // If this server has registered a loot channel via /config
  // set-loot-channel, threads get created there instead of the party's
  // own channel. Falls back to the party's channel if unset or if that
  // channel can't be fetched.
  let threadChannel = interaction.channel;
  const configuredLootChannelId = getLootChannel(interaction.guildId);
  if (configuredLootChannelId) {
    try {
      threadChannel = await interaction.client.channels.fetch(configuredLootChannelId);
    } catch (err) {
      // Fall back to the current channel if the configured one is invalid
      // (wrong ID, bot removed from it, etc.) rather than failing outright.
    }
  }

  // Forum channels create threads differently from regular text channels:
  // the starting message must be included in the creation call itself
  // (there's no separate "create, then send" step), and they don't take
  // the same `type` option a text channel does.
  const isForum = threadChannel.type === ChannelType.GuildForum;

  let thread;
  try {
    if (isForum) {
      thread = await threadChannel.threads.create({
        name: threadName,
        message: { content: mentions, embeds: [recapEmbed] },
        reason: `Loot thread for finished party: ${party.activity}`,
      });
    } else {
      thread = await threadChannel.threads.create({
        name: threadName,
        type: ChannelType.PublicThread,
        autoArchiveDuration: 1440,
        reason: `Loot thread for finished party: ${party.activity}`,
      });
    }
  } catch (err) {
    return interaction.editReply({
      content:
        "Party was finished, but I couldn't create the loot thread — check that I have the " +
        "\"Create Public Threads\" permission (or \"Create Posts\" for forum channels) there.",
    });
  }

  for (const id of memberIds) {
    try {
      await thread.members.add(id);
    } catch (err) {
      // Skip members the bot can't add (e.g. they left the server) —
      // not worth failing the whole thread over.
    }
  }

  // Text-channel threads still need the recap message sent explicitly —
  // forum posts already got it bundled into the creation call above.
  let recapMessage;
  if (isForum) {
    recapMessage = await thread.fetchStarterMessage();
  } else {
    recapMessage = await thread.send({
      content: mentions, // kept as plain content so it actually pings — mentions inside embeds don't notify
      embeds: [recapEmbed],
    });
  }

  // Now that we know the recap message's ID, register the loot record
  // under it and attach the Sold button (its customId needs that ID).
  createLoot(recapMessage.id, lootRecord);
  await recapMessage.edit({ components: buildLootButtons(recapMessage.id, lootRecord) });

  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`party:finishconfirm:yes:${messageId}`)
      .setLabel("Yes, disband")
      .setEmoji("💥")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`party:finishconfirm:no:${messageId}`)
      .setLabel("No, keep it open")
      .setEmoji("🔁")
      .setStyle(ButtonStyle.Secondary)
  );

  return interaction.editReply({
    content: `✅ Loot thread created: ${thread}\n\nDo you also want to disband this party listing?`,
    components: [confirmRow],
  });
}

module.exports = { handleButton, handleSelectMenu, handleModalSubmit, buildFinishThreadName };