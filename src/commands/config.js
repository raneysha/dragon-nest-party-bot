const {
  SlashCommandBuilder,
  MessageFlags,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");
const {
  setLootChannel,
  clearLootChannel,
  getLootChannel,
  setDefaultPartyComp,
  clearDefaultPartyComp,
  getDefaultPartyComp,
} = require("../handlers/guildConfigManager");
const { FACTORY_DEFAULT_ROLE_CAPS } = require("../handlers/partyManager");

// Shared role option definitions so /config set-default-party matches
// /party create's options exactly (same names/descriptions/limits).
function addRoleCapOptions(sub) {
  return sub
    .addIntegerOption((opt) =>
      opt.setName("paladins").setDescription("Default Paladin slots").setMinValue(0).setMaxValue(10)
    )
    .addIntegerOption((opt) =>
      opt.setName("healers").setDescription("Default Healer slots").setMinValue(0).setMaxValue(10)
    )
    .addIntegerOption((opt) =>
      opt.setName("swordmasters").setDescription("Default Swordmaster slots").setMinValue(0).setMaxValue(10)
    )
    .addIntegerOption((opt) =>
      opt.setName("mercenaries").setDescription("Default Mercenary slots").setMinValue(0).setMaxValue(10)
    )
    .addIntegerOption((opt) =>
      opt.setName("sorceresses").setDescription("Default Sorceress slots").setMinValue(0).setMaxValue(10)
    )
    .addIntegerOption((opt) =>
      opt.setName("acrobats").setDescription("Default Acrobat slots").setMinValue(0).setMaxValue(10)
    )
    .addIntegerOption((opt) =>
      opt.setName("flexible").setDescription("Default Flexible (DPS) slots").setMinValue(0).setMaxValue(20)
    );
}

// Maps this command's option names to partyManager's internal role keys —
// same mapping /party create uses.
const OPTION_TO_ROLE_KEY = {
  paladins: "tank",
  healers: "healer",
  swordmasters: "swordmaster",
  mercenaries: "mercenary",
  sorceresses: "sorceress",
  acrobats: "acrobat",
  flexible: "flexible",
};

function formatComp(roleCaps) {
  return Object.entries(roleCaps)
    .map(([key, cap]) => `${key}: ${cap}`)
    .join(", ");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Configure server-wide bot settings")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("set-loot-channel")
        .setDescription("Set which channel 'Finish' loot threads get created in")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("A text or forum channel")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildForum)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("clear-loot-channel")
        .setDescription("Unset the loot channel — threads go back to the party's own channel")
    )
    .addSubcommand((sub) =>
      addRoleCapOptions(
        sub
          .setName("set-default-party")
          .setDescription("Set this server's default /party create composition (blank role = built-in default)")
      )
    )
    .addSubcommand((sub) =>
      sub
        .setName("clear-default-party")
        .setDescription("Reset this server back to the bot's built-in default party composition")
    )
    .addSubcommand((sub) =>
      sub.setName("view").setDescription("Show the current server settings")
    ),

  async execute(interaction) {
    // Defense in depth — setDefaultMemberPermissions hides the command from
    // non-admins by default, but a server owner could change that, so we
    // check again here.
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: "Only server admins can use this command.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "set-loot-channel") {
      const channel = interaction.options.getChannel("channel");
      setLootChannel(interaction.guildId, channel.id);
      return interaction.reply({
        content: `✅ Loot threads from \`/party finish\` will now be created in ${channel}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "clear-loot-channel") {
      clearLootChannel(interaction.guildId);
      return interaction.reply({
        content: "✅ Loot channel cleared — threads will go back to being created in the party's own channel.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "set-default-party") {
      // Any role left blank falls back to the bot's built-in default for
      // that specific role — so admins only need to specify what they
      // want to change, not the whole composition every time.
      const roleCaps = {};
      for (const [optionName, roleKey] of Object.entries(OPTION_TO_ROLE_KEY)) {
        const value = interaction.options.getInteger(optionName);
        roleCaps[roleKey] = value ?? FACTORY_DEFAULT_ROLE_CAPS[roleKey];
      }

      if (Object.values(roleCaps).every((c) => c === 0)) {
        return interaction.reply({
          content: "The default composition needs at least one role slot — can't set everything to 0.",
          flags: MessageFlags.Ephemeral,
        });
      }

      setDefaultPartyComp(interaction.guildId, roleCaps);
      return interaction.reply({
        content: `✅ Default party composition updated for this server:\n${formatComp(roleCaps)}`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "clear-default-party") {
      clearDefaultPartyComp(interaction.guildId);
      return interaction.reply({
        content: `✅ Reset to the bot's built-in default:\n${formatComp(FACTORY_DEFAULT_ROLE_CAPS)}`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "view") {
      const lootChannelId = getLootChannel(interaction.guildId);
      const lootChannelText = lootChannelId ? `<#${lootChannelId}>` : "_not set (uses the party's own channel)_";

      const customComp = getDefaultPartyComp(interaction.guildId);
      const compText = customComp
        ? `${formatComp(customComp)} _(custom)_`
        : `${formatComp(FACTORY_DEFAULT_ROLE_CAPS)} _(built-in default)_`;

      return interaction.reply({
        content: `**Server settings:**\nLoot channel: ${lootChannelText}\nDefault party: ${compText}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};