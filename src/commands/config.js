const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require("discord.js");
const {
  setLootChannel,
  clearLootChannel,
  getLootChannel,
  setDefaultPartyComp,
  clearDefaultPartyComp,
  getDefaultPartyComp,
  setLocale,
  getLocale,
} = require("../handlers/guildConfigManager");
const { FACTORY_DEFAULT_ROLE_CAPS } = require("../handlers/partyManager");
const { t } = require("../i18n");

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
    .filter(([, cap]) => cap > 0)
    .map(([roleKey, cap]) => `${roleKey}: ${cap}`)
    .join(", ");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Server settings for this bot")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("set-loot-channel")
        .setDescription("Set the channel where loot threads from /party finish are created")
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("The channel to create loot threads in").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("clear-loot-channel").setDescription("Reset loot threads to use the party's own channel")
    )
    .addSubcommand((sub) =>
      sub
        .setName("set-default-party")
        .setDescription("Set this server's default party role composition")
        .addIntegerOption((opt) => opt.setName("paladins").setDescription("Paladin slots").setMinValue(0))
        .addIntegerOption((opt) => opt.setName("healers").setDescription("Healer slots").setMinValue(0))
        .addIntegerOption((opt) => opt.setName("swordmasters").setDescription("Swordmaster slots").setMinValue(0))
        .addIntegerOption((opt) => opt.setName("mercenaries").setDescription("Mercenary slots").setMinValue(0))
        .addIntegerOption((opt) => opt.setName("sorceresses").setDescription("Sorceress slots").setMinValue(0))
        .addIntegerOption((opt) => opt.setName("acrobats").setDescription("Acrobat slots").setMinValue(0))
        .addIntegerOption((opt) => opt.setName("flexible").setDescription("Flexible slots").setMinValue(0))
    )
    .addSubcommand((sub) =>
      sub.setName("clear-default-party").setDescription("Reset to the bot's built-in default composition")
    )
    .addSubcommand((sub) =>
      sub.setName("view").setDescription("Show the current server settings")
    )
    .addSubcommand((sub) =>
      sub
        .setName("language")
        .setDescription("Set the language the bot replies in on this server")
        .addStringOption((opt) =>
          opt
            .setName("language")
            .setDescription("English or Indonesian")
            .setRequired(true)
            .addChoices(
              { name: "English", value: "en" },
              { name: "Indonesian (Bahasa Indonesia)", value: "id" }
            )
        )
    ),

  async execute(interaction) {
    // Defense in depth — setDefaultMemberPermissions hides the command from
    // non-admins by default, but a server owner could change that, so we
    // check again here.
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: t(interaction.guildId, "config.adminOnly"),
        flags: MessageFlags.Ephemeral,
      });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "set-loot-channel") {
      const channel = interaction.options.getChannel("channel");
      setLootChannel(interaction.guildId, channel.id);
      return interaction.reply({
        content: t(interaction.guildId, "config.setLootChannel.confirm", { channel }),
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "clear-loot-channel") {
      clearLootChannel(interaction.guildId);
      return interaction.reply({
        content: t(interaction.guildId, "config.clearLootChannel.confirm"),
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
          content: t(interaction.guildId, "config.setDefaultParty.needsRole"),
          flags: MessageFlags.Ephemeral,
        });
      }

      setDefaultPartyComp(interaction.guildId, roleCaps);
      return interaction.reply({
        content: t(interaction.guildId, "config.setDefaultParty.confirm", { comp: formatComp(roleCaps) }),
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "clear-default-party") {
      clearDefaultPartyComp(interaction.guildId);
      return interaction.reply({
        content: t(interaction.guildId, "config.clearDefaultParty.confirm", {
          comp: formatComp(FACTORY_DEFAULT_ROLE_CAPS),
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "view") {
      const lootChannelId = getLootChannel(interaction.guildId);
      const lootChannelText = lootChannelId
        ? `<#${lootChannelId}>`
        : t(interaction.guildId, "config.view.lootChannelUnset");

      const customComp = getDefaultPartyComp(interaction.guildId);
      const compText = customComp
        ? t(interaction.guildId, "config.view.compCustom", { comp: formatComp(customComp) })
        : t(interaction.guildId, "config.view.compBuiltIn", { comp: formatComp(FACTORY_DEFAULT_ROLE_CAPS) });

      const locale = getLocale(interaction.guildId);
      const languageText = t(
        interaction.guildId,
        locale === "id" ? "config.language.indonesian" : "config.language.english"
      );

      return interaction.reply({
        content: t(interaction.guildId, "config.view.summary", {
          lootChannel: lootChannelText,
          comp: compText,
          language: languageText,
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "language") {
      const locale = interaction.options.getString("language");
      setLocale(interaction.guildId, locale);
      const languageText = t(
        interaction.guildId,
        locale === "id" ? "config.language.indonesian" : "config.language.english"
      );
      return interaction.reply({
        content: t(interaction.guildId, "config.language.confirm", { language: languageText }),
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
