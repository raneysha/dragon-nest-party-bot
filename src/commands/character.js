const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require("discord.js");
const { addCharacter, removeCharacter, getCharacters } = require("../handlers/characterManager");
const { getAllClassNames } = require("../handlers/roleClasses");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("character")
    .setDescription("Register and view MMORPG characters")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Register one of your characters")
        .addStringOption((opt) =>
          opt
            .setName("ign")
            .setDescription("Your character's in-game name")
            .setRequired(true)
            .setMaxLength(32)
        )
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
        .setDescription("List registered characters")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("Whose characters to list (defaults to you)")
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove one of your registered characters")
        .addStringOption((opt) =>
          opt.setName("ign").setDescription("The character's in-game name to remove").setRequired(true)
        )
    ),

  // Powers the "class" option's search-as-you-type suggestions. Unlike
  // static addChoices() (capped at 25 total), this searches the full
  // class list — however long it grows — and only returns the top 25
  // matches for whatever's currently typed.
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const matches = getAllClassNames()
      .filter((name) => name.toLowerCase().includes(focused))
      .slice(0, 25);
    await interaction.respond(matches.map((name) => ({ name, value: name })));
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "add") {
      const ign = interaction.options.getString("ign").trim();
      const className = interaction.options.getString("class");

      // Autocomplete only *suggests* matches as you type — unlike the old
      // static choices list, Discord doesn't actually enforce that the
      // submitted value came from a suggestion. Validate it here so a
      // typo or free-typed value doesn't get stored as a "class."
      if (!getAllClassNames().includes(className)) {
        return interaction.reply({
          content: `**${className}** isn't a recognized class — please pick one from the suggestions as you type.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const result = addCharacter(interaction.user.id, ign, className);
      if (result === "duplicate") {
        return interaction.reply({
          content: `You already have a character named **${ign}** registered.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        content: `✅ Registered **${ign}** (${className}).`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "list") {
      const targetUser = interaction.options.getUser("user") ?? interaction.user;
      const list = getCharacters(targetUser.id);

      if (list.length === 0) {
        const whose = targetUser.id === interaction.user.id ? "You haven't" : `${targetUser.username} hasn't`;
        return interaction.reply({
          content: `${whose} registered any characters yet.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(`🗡️ ${targetUser.username}'s characters`)
        .setColor(0x5865f2)
        .setThumbnail(targetUser.displayAvatarURL())
        .setDescription(list.map((c) => `**${c.ign}** — ${c.className}`).join("\n"))
        .setFooter({ text: `${list.length} character${list.length === 1 ? "" : "s"} registered` });

      return interaction.reply({
        embeds: [embed],
      });
    }

    if (sub === "remove") {
      const ign = interaction.options.getString("ign").trim();
      const removed = removeCharacter(interaction.user.id, ign);

      if (!removed) {
        return interaction.reply({
          content: `You don't have a character named **${ign}** registered.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        content: `🗑️ Removed **${ign}**.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};