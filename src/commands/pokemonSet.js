const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const BASE = 'https://api.tcgdex.net/v2/en';

module.exports = {
  help: {
    description: 'Look up a Pokémon TCG set by name or ID.',
    examples: [
      '`/pokemon_set base1` — look up by set ID',
      '`/pokemon_set flashfire` — look up by name',
      '`/pokemon_set Scarlet & Violet` — full name match',
    ],
  },

  // Aliases registered in Discord alongside the main command name
  aliases: [],

  data: new SlashCommandBuilder()
    .setName('poke_set')
    .setDescription('Look up a Pokémon TCG card set')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Set name or ID (e.g. "base1", "Scarlet & Violet")')
        .setRequired(true)
    ),

  async execute(interaction) {
    const query = interaction.options.getString('name');
    await interaction.deferReply();

    // Try direct ID lookup first, then fall back to listing all sets and filtering
    let set = null;

    const directRes = await fetch(`${BASE}/sets/${encodeURIComponent(query)}`);
    if (directRes.ok) {
      set = await directRes.json();
    } else {
      const allRes = await fetch(`${BASE}/sets`);
      if (!allRes.ok) return interaction.editReply('TCGDex API error. Try again later.');
      const all = await allRes.json();
      const lc = query.toLowerCase();
      const match = all.find(s => s.name.toLowerCase().includes(lc) || s.id.toLowerCase() === lc);
      if (match) {
        const res = await fetch(`${BASE}/sets/${match.id}`);
        if (res.ok) set = await res.json();
      }
    }

    if (!set) {
      return interaction.editReply(`No set found matching **${query}**.`);
    }

    const embed = new EmbedBuilder()
      .setTitle(`${set.name} (${set.id})`)
      .setColor(0x3B4CCA);

    if (set.logo) embed.setThumbnail(`${set.logo}.png`);
    if (set.serie?.name) embed.addFields({ name: 'Series', value: set.serie.name, inline: true });
    if (set.releaseDate) embed.addFields({ name: 'Released', value: set.releaseDate, inline: true });
    if (set.cardCount?.total != null) {
      embed.addFields({ name: 'Cards', value: String(set.cardCount.total), inline: true });
    }
    if (set.legal) {
      const formats = Object.entries(set.legal)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(', ');
      if (formats) embed.addFields({ name: 'Legal in', value: formats, inline: true });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
