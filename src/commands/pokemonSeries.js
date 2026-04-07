const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const BASE = 'https://api.tcgdex.net/v2/en';

module.exports = {
  help: {
    description: 'List all Pokémon TCG series, or look up a specific one.',
    examples: [
      '`/pokemon_series` — list every series',
      '`/pokemon_series sword shield` — sets in a specific series',
    ],
  },

  // Aliases registered in Discord alongside the main command name
  aliases: [],

  data: new SlashCommandBuilder()
    .setName('poke_series')
    .setDescription('List all Pokémon TCG series, or look up one by name')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Series name or ID to look up (omit to list all)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const query = interaction.options.getString('name');
    await interaction.deferReply();

    if (!query) {
      const res = await fetch(`${BASE}/series`);
      if (!res.ok) return interaction.editReply('TCGDex API error. Try again later.');
      const all = await res.json();

      const embed = new EmbedBuilder()
        .setTitle('Pokémon TCG Series')
        .setColor(0xFF0000)
        .setDescription(all.map(s => `**${s.name}** (\`${s.id}\`)`).join('\n'));

      return interaction.editReply({ embeds: [embed] });
    }

    // Detailed lookup
    const allRes = await fetch(`${BASE}/series`);
    if (!allRes.ok) return interaction.editReply('TCGDex API error. Try again later.');
    const all = await allRes.json();
    const lc = query.toLowerCase();
    const match = all.find(s => s.name.toLowerCase().includes(lc) || s.id.toLowerCase() === lc);

    if (!match) {
      return interaction.editReply(`No series found matching **${query}**.`);
    }

    const res = await fetch(`${BASE}/series/${match.id}`);
    if (!res.ok) return interaction.editReply('TCGDex API error. Try again later.');
    const serie = await res.json();

    const embed = new EmbedBuilder()
      .setTitle(`${serie.name} (${serie.id})`)
      .setColor(0xFF0000);

    if (serie.logo) embed.setThumbnail(`${serie.logo}.png`);
    if (serie.sets?.length) {
      const setList = serie.sets.map(s => `${s.name} (\`${s.id}\`)`).join('\n');
      embed.addFields({ name: `Sets (${serie.sets.length})`, value: setList.slice(0, 1024) });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
