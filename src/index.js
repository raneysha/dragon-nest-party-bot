require("dotenv").config();
const { Client, GatewayIntentBits, Collection, MessageFlags } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { handleButton, handleSelectMenu, handleModalSubmit } = require("./handlers/buttonHandler");
const { t } = require("./i18n");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"))) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
    } else if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command || !command.autocomplete) return;
      await command.autocomplete(interaction);
    } else if (interaction.isButton() && interaction.customId.startsWith("party:")) {
      await handleButton(interaction);
    } else if (
      (interaction.isStringSelectMenu() || interaction.isUserSelectMenu()) &&
      interaction.customId.startsWith("party:")
    ) {
      await handleSelectMenu(interaction);
    } else if (interaction.isModalSubmit() && interaction.customId.startsWith("party:")) {
      await handleModalSubmit(interaction);
    }
  } catch (err) {
    console.error(err);
    const payload = {
      content: t(interaction.guildId, "common.somethingWentWrong"),
      flags: MessageFlags.Ephemeral,
    };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
