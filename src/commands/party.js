const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { createParty, getAllParties, rekeyParty, FACTORY_DEFAULT_ROLE_CAPS } = require("../handlers/partyManager");
const { buildPartyEmbed, buildPartyButtons } = require("../handlers/uiBuilders");
const { getDefaultPartyComp } = require("../handlers/guildConfigManager");
const { t } = require("../i18n");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("party")
    .setDescription("Organize a party/raid")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a new party listing")
        .addStringOption((opt) => opt.setName("activity").setDescription("What you're running").setRequired(true))
        .addStringOption((opt) => opt.setName("time").setDescription("When it's happening, e.g. '8 PM server time'"))
        .addStringOption((opt) => opt.setName("note").setDescription("Any extra info, e.g. min item level"))
        .addStringOption((opt) =>
          opt.setName("nest_type").setDescription("Nest type, e.g. 'Elite' or 'Hard Mode'")
        )
        .addIntegerOption((opt) => opt.setName("paladins").setDescription("Paladin slots (defaults to server config)").setMinValue(0))
        .addIntegerOption((opt) => opt.setName("healers").setDescription("Healer slots (defaults to server config)").setMinValue(0))
        .addIntegerOption((opt) => opt.setName("swordmasters").setDescription("Swordmaster slots (defaults to server config)").setMinValue(0))
        .addIntegerOption((opt) => opt.setName("mercenaries").setDescription("Mercenary slots (defaults to server config)").setMinValue(0))
        .addIntegerOption((opt) => opt.setName("sorceresses").setDescription("Sorceress slots (defaults to server config)").setMinValue(0))
        .addIntegerOption((opt) => opt.setName("acrobats").setDescription("Acrobat slots (defaults to server config)").setMinValue(0))
        .addIntegerOption((opt) => opt.setName("flexible").setDescription("Flexible slots (defaults to server config)").setMinValue(0))
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("List active parties in this channel"))
    .addSubcommand((sub) =>
      sub
        .setName("recall")
        .setDescription("Repost a party listing at the bottom of the channel")
        .addStringOption((opt) => opt.setName("activity").setDescription("Which party (matches by name)"))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "create") {
      const activity = interaction.options.getString("activity").trim();
      const time = interaction.options.getString("time");
      const note = interaction.options.getString("note");
      const nestType = interaction.options.getString("nest_type");

      // If the admin typed ANY role option, treat this as a fully custom
      // composition for this one party — every role not explicitly typed
      // is treated as 0, not "use the server default." Otherwise (nothing
      // typed at all), fall back to this server's configured default, or
      // the bot's built-in default if the server hasn't set one.
      const typedRoleCaps = {
        tank: interaction.options.getInteger("paladins"),
        healer: interaction.options.getInteger("healers"),
        swordmaster: interaction.options.getInteger("swordmasters"),
        mercenary: interaction.options.getInteger("mercenaries"),
        sorceress: interaction.options.getInteger("sorceresses"),
        acrobat: interaction.options.getInteger("acrobats"),
        flexible: interaction.options.getInteger("flexible"),
      };
      const anyRoleTyped = Object.values(typedRoleCaps).some((v) => v !== null);

      const roleCaps = anyRoleTyped
        ? Object.fromEntries(Object.entries(typedRoleCaps).map(([k, v]) => [k, v ?? 0]))
        : getDefaultPartyComp(interaction.guildId) ?? FACTORY_DEFAULT_ROLE_CAPS;

      if (Object.values(roleCaps).every((c) => c === 0)) {
        return interaction.reply({
          content: t(interaction.guildId, "party.create.needsRole"),
          flags: MessageFlags.Ephemeral,
        });
      }

      // Reply first to get a message we can attach the real embed to
      const reply = await interaction.reply({
        content: t(interaction.guildId, "party.create.creating"),
        fetchReply: true,
      });

      const party = createParty({
        messageId: reply.id,
        channelId: interaction.channelId,
        leaderId: interaction.user.id,
        activity,
        time,
        note,
        nestType,
        roleCaps,
      });

      await interaction.editReply({
        content: null,
        embeds: [buildPartyEmbed(party, interaction.guildId)],
        components: buildPartyButtons(party, interaction.guildId),
      });
      return;
    }

    if (sub === "list") {
      const active = getAllParties().filter((p) => p.channelId === interaction.channelId);
      if (active.length === 0) {
        return interaction.reply({
          content: t(interaction.guildId, "party.list.empty"),
          flags: MessageFlags.Ephemeral,
        });
      }
      const lines = active.map((p) =>
        t(interaction.guildId, "party.list.line", {
          activity: p.activity,
          time: p.time ? ` — ${p.time}` : "",
          leaderId: p.leaderId,
        })
      );
      return interaction.reply({
        content: t(interaction.guildId, "party.list.header", { lines: lines.join("\n") }),
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "recall") {
      const query = interaction.options.getString("activity");
      const activeInChannel = getAllParties().filter((p) => p.channelId === interaction.channelId);

      if (activeInChannel.length === 0) {
        return interaction.reply({
          content: t(interaction.guildId, "party.recall.empty"),
          flags: MessageFlags.Ephemeral,
        });
      }

      let target;
      if (query) {
        const matches = activeInChannel.filter((p) =>
          p.activity.toLowerCase().includes(query.toLowerCase())
        );
        if (matches.length === 0) {
          const names = activeInChannel.map((p) => `• ${p.activity}`).join("\n");
          return interaction.reply({
            content: t(interaction.guildId, "party.recall.noMatch", { query, names }),
            flags: MessageFlags.Ephemeral,
          });
        }
        if (matches.length > 1) {
          const names = matches.map((p) => `• ${p.activity}`).join("\n");
          return interaction.reply({
            content: t(interaction.guildId, "party.recall.multiMatch", { query, names }),
            flags: MessageFlags.Ephemeral,
          });
        }
        target = matches[0];
      } else {
        if (activeInChannel.length > 1) {
          const names = activeInChannel.map((p) => `• ${p.activity}`).join("\n");
          return interaction.reply({
            content: t(interaction.guildId, "party.recall.needsQuery", { names }),
            flags: MessageFlags.Ephemeral,
          });
        }
        target = activeInChannel[0];
      }

      // Best-effort delete of the old (buried) message — if it's already
      // gone or we can't fetch it for some reason, we still recreate below.
      try {
        const oldMessage = await interaction.channel.messages.fetch(target.messageId);
        await oldMessage.delete();
      } catch (err) {
        // ignore — old message may already be deleted
      }

      const reply = await interaction.reply({
        content: t(interaction.guildId, "party.recall.recalling"),
        fetchReply: true,
      });
      const party = rekeyParty(target.messageId, reply.id);

      await interaction.editReply({
        content: null,
        embeds: [buildPartyEmbed(party, interaction.guildId)],
        components: buildPartyButtons(party, interaction.guildId),
      });
      return;
    }
  },
};
