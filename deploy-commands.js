require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  const mainJson = command.data.toJSON();
  commands.push(mainJson);

  // Register each alias as a separate slash command with the same options as the main command
  for (const alias of command.aliases ?? []) {
    commands.push({ ...mainJson, name: alias });
  }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

const route = process.env.GUILD_ID
  ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
  : Routes.applicationCommands(process.env.CLIENT_ID);

(async () => {
  try {
    console.log(`Registering ${commands.length} slash command(s)...`);
    await rest.put(route, { body: commands });
    console.log('Done.');
  } catch (err) {
    console.error(err);
  }
})();
