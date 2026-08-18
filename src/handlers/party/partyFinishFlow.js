const { MessageFlags, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { getParty, isMember, getAllMemberIds } = require("../partyManager");
const { getSlotCode } = require("../uiBuilders");
const { isLeaderOrAdmin } = require("../shared/permissions");
const { createLoot } = require("../lootManager");
const { getLootChannel } = require("../guildConfigManager");
const { buildLootRecapEmbed, buildLootButtons } = require("../loot/lootUiBuilders");

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

// Handles submission of the "finish party" modal. Creates a loot-recap
// thread with every member (plus the leader) added to it. The party
// itself isn't deleted here — that happens via the confirm step
// (party:finishconfirm) shown after this completes.
// customId format: party:finishmodal:<messageId>:<lootHolderId>
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
        '"Create Public Threads" permission (or "Create Posts" for forum channels) there.',
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

module.exports = { buildFinishThreadName, buildLootRoster, handleFinishModalSubmit };
