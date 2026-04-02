require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs   = require('fs');
const path = require('path');
const cron = require('node-cron');

const syncPrices = require('./priceSync');
const syncCards  = require('./syncCards');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

const commandsPath  = path.join(__dirname, 'commands');
const commandFiles  = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
  for (const alias of command.aliases ?? []) {
    client.commands.set(alias, command);
  }
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Daily price sync at 21:00 UTC — 1 hour after TCGCSV updates its prices
  cron.schedule('0 21 * * *', () => {
    syncPrices().catch(console.error);
  });

  // Weekly card discovery every Monday at 22:00 UTC
  // Picks up any new sets that released since the last run
  cron.schedule('0 22 * * 1', () => {
    syncCards().catch(console.error);
  });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(err);
    const reply = { content: 'Something went wrong.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
