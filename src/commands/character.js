const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require("discord.js");
const { addCharacter, removeCharacter, getCharacters, findByClass } = require("../handlers/characterManager");
const { getAllClassNames } = require("../handlers/roleClasses");
const { t } = require("../i18n");

// Discord error code for "Unknown Member" (the user isn't in this server).
const UNKNOWN_MEMBER = 10007;

// characters.json is global across every server the bot is in, so a search
// result can include players who aren't in *this* server. Drop only those
// Discord confirms are not members; on any other error (rate limit, outage)
// keep the player, so a hiccup never makes results silently disappear.
async function keepGuildMembers(guild, results) {
  if (!guild) return results; // DM context — nothing to filter against
  const checked = await Promise.all(
    results.map(async (r) => {
      try {
        await guild.members.fetch(r.userId);
        return r;
      } catch (err) {
        return err.code === UNKNOWN_MEMBER ? null : r;
      }
    })
  );
  return checked.filter(Boolean);
}

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
        .setName("search")
        .setDescription("Find which players in this server have a character of a class")
        .addStringOption((opt) =>
          opt
            .setName("class")
            .setDescription("The class to search for (start typing to search)")
            .setRequired(true)
            .setAutocomplete(true)
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

    if (sub === "search") {
      const className = interaction.options.getString("class");

      // Same guard as /character add: autocomplete only suggests, it doesn't
      // stop a user from submitting free text.
      if (!getAllClassNames().includes(className)) {
        return interaction.reply({
          content: t(interaction.guildId, "character.add.invalidClass", { className }),
          flags: MessageFlags.Ephemeral,
        });
      }

      // Looking up each player's membership can take longer than Discord's
      // 3-second reply window, so acknowledge first.
      await interaction.deferReply();

      const results = await keepGuildMembers(interaction.guild, findByClass(className));
      if (results.length === 0) {
        return interaction.editReply({
          content: t(interaction.guildId, "character.search.empty", { className }),
        });
      }

      // One line per player; stop before the embed description limit (4096)
      // and say how many were left out instead of failing.
      const MAX_DESCRIPTION = 3900;
      const lines = [];
      let used = 0;
      for (const r of results) {
        const line = `<@${r.userId}> — ${r.igns.map((ign) => `**${ign}**`).join(", ")}`;
        if (used + line.length + 1 > MAX_DESCRIPTION) break;
        lines.push(line);
        used += line.length + 1;
      }
      const hidden = results.length - lines.length;
      if (hidden > 0) lines.push(t(interaction.guildId, "character.search.more", { count: hidden }));

      const characterCount = results.reduce((sum, r) => sum + r.igns.length, 0);
      const embed = new EmbedBuilder()
        .setTitle(t(interaction.guildId, "character.search.title", { className }))
        .setColor(0x5865f2)
        .setDescription(lines.join("\n"))
        .setFooter({
          text: t(interaction.guildId, "character.search.footer", {
            players: results.length,
            characters: characterCount,
          }),
        });

      return interaction.editReply({ embeds: [embed] });
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
