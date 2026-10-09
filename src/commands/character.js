const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require("discord.js");
const { addCharacter, removeCharacter, getCharacters } = require("../handlers/characterManager");
const { getAllClassNames } = require("../handlers/roleClasses");
const { t } = require("../i18n");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("character")
    .setDescription("Manage your registered characters")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Register a character")
        .addStringOption((opt) => opt.setName("ign").setDescription("Your character's in-game name").setRequired(true))
        .addStringOption((opt) =>
          opt
            .setName("class")
            .setDescription("Your character's class (start typing to search)")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List a user's registered characters")
        .addUserOption((opt) => opt.setName("user").setDescription("Whose characters to list (defaults to you)"))
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove one of your registered characters")
        .addStringOption((opt) =>
          opt.setName("ign").setDescription("The character's in-game name to remove").setRequired(true)
        )
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const matches = getAllClassNames()
      .filter((name) => name.toLowerCase().includes(focusedValue))
      .slice(0, 25); // Discord autocomplete caps at 25 suggestions

    await interaction.respond(matches.map((name) => ({ name, value: name })));
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "add") {
      const ign = interaction.options.getString("ign").trim();
      const className = interaction.options.getString("class");

      // Autocomplete only *suggests* matches as you type — unlike a
      // static choices list, Discord doesn't actually enforce that the
      // submitted value came from a suggestion. Validate it here so a
      // typo or free-typed value doesn't get stored as a "class."
      if (!getAllClassNames().includes(className)) {
        return interaction.reply({
          content: t(interaction.guildId, "character.add.invalidClass", { className }),
          flags: MessageFlags.Ephemeral,
        });
      }

      const result = addCharacter(interaction.user.id, ign, className);
      if (result === "duplicate") {
        return interaction.reply({
          content: t(interaction.guildId, "character.add.duplicate", { ign }),
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        content: t(interaction.guildId, "character.add.confirm", { ign, className }),
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "list") {
      const targetUser = interaction.options.getUser("user") ?? interaction.user;
      const list = getCharacters(targetUser.id);

      if (list.length === 0) {
        const content =
          targetUser.id === interaction.user.id
            ? t(interaction.guildId, "character.list.emptySelf")
            : t(interaction.guildId, "character.list.emptyOther", { username: targetUser.username });
        return interaction.reply({
          content,
          flags: MessageFlags.Ephemeral,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(t(interaction.guildId, "character.list.title", { username: targetUser.username }))
        .setColor(0x5865f2)
        .setThumbnail(targetUser.displayAvatarURL())
        .setDescription(list.map((c) => `**${c.ign}** — ${c.className}`).join("\n"))
        .setFooter({
          text: t(interaction.guildId, "character.list.footer", {
            count: list.length,
            plural: list.length === 1 ? "" : "s",
          }),
        });

      return interaction.reply({
        embeds: [embed],
      });
    }

    if (sub === "remove") {
      const ign = interaction.options.getString("ign").trim();
      const removed = removeCharacter(interaction.user.id, ign);

      if (!removed) {
        return interaction.reply({
          content: t(interaction.guildId, "character.remove.notFound", { ign }),
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        content: t(interaction.guildId, "character.remove.confirm", { ign }),
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
