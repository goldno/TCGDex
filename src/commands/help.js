const {
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  ComponentType,
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// Load all command files from this directory except help.js itself
function loadCommands() {
  return fs.readdirSync(__dirname)
    .filter(file => file.endsWith('.js') && file !== 'help.js')
    .sort()
    .map(file => require(path.join(__dirname, file)));
}

// Build an embed showing full details for a single command, including its aliases
function buildCommandEmbed(cmd) {
  const lines = [];
  if (cmd.help?.description) lines.push(cmd.help.description);

  // Show aliases if any exist
  if (cmd.aliases?.length) {
    lines.push('', `**Aliases:** ${cmd.aliases.map(a => `\`/${a}\``).join(', ')}`);
  }

  if (cmd.help?.examples?.length) {
    lines.push('', '**Examples:**', ...cmd.help.examples);
  }

  return new EmbedBuilder()
    .setTitle(`/${cmd.data.name}`)
    .setDescription(lines.join('\n') || cmd.data.description)
    .setColor(0xFFCB05);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List all available commands'),

  async execute(interaction) {
    const commands = loadCommands();

    // Build one dropdown option per command
    const options = commands.map(cmd =>
      new StringSelectMenuOptionBuilder()
        .setLabel(`/${cmd.data.name}`)
        .setDescription(cmd.data.description.slice(0, 100))
        .setValue(cmd.data.name)
    );

    const menu = new StringSelectMenuBuilder()
      .setCustomId('help_select')
      .setPlaceholder('Choose a command...')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(menu);

    // Send the dropdown — ephemeral so only the requester sees it
    const reply = await interaction.reply({
      content: 'Select a command to see more details:',
      components: [row],
      ephemeral: true,
    });

    // Listen for the user to pick a command
    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: i => i.user.id === interaction.user.id,
      time: 60_000,
    });

    collector.on('collect', async i => {
      const selected = commands.find(cmd => cmd.data.name === i.values[0]);
      await i.update({
        content: 'Select a command to see more details:',
        embeds: [buildCommandEmbed(selected)],
        components: [row],
      });
    });

    // Remove the dropdown after 60 seconds of inactivity
    collector.on('end', () => {
      interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};
