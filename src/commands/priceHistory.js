const {
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  ComponentType,
} = require('discord.js');
const API_URL = process.env.API_URL;

// Strip the " - 204/165" number suffix from a product name for display
function cleanName(name) {
  return name.replace(/-\s*\d+\/\d+\s*$/, '').trim();
}

// Format a price value as a dollar string
function fmt(price) {
  return price != null ? `$${Number(price).toFixed(2)}` : '—';
}

// Calculate % change between two prices, returning a formatted string with arrow
function pctChange(current, previous) {
  if (current == null || previous == null || previous === 0) return '';
  const pct = ((current - previous) / previous) * 100;
  const arrow = pct >= 0 ? '↑' : '↓';
  return ` (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% ${arrow})`;
}

// Build and send the price history embed for a tracked card
async function showPriceHistory(interaction, productId) {
  const [card, snapshots] = await Promise.all([
    fetch(`${API_URL}/cards/${productId}`).then(r => r.json()),
    fetch(`${API_URL}/cards/${productId}/prices`).then(r => r.json()),
  ]);

  const embed = new EmbedBuilder()
    .setTitle(cleanName(card.name))
    .setColor(0xFFCB05);

  if (card.image_url) embed.setThumbnail(card.image_url);

  embed.addFields({
    name: 'Set',
    value: `${card.set_name} — #${card.collector_number}/${card.set_total}`,
    inline: false,
  });

  if (snapshots.length === 0) {
    embed.addFields({
      name: 'No Data Yet',
      value: 'Prices have not been collected yet. Check back after the first daily sync (21:00 UTC).',
      inline: false,
    });
    return interaction.editReply({ embeds: [embed], components: [] });
  }

  // Group snapshots by variant
  const byVariant = {};
  for (const row of snapshots) {
    if (!byVariant[row.sub_type_name]) byVariant[row.sub_type_name] = [];
    byVariant[row.sub_type_name].push(row);
  }

  // One embed field per variant
  for (const [variant, rows] of Object.entries(byVariant)) {
    const current = rows[0];
    const ago7    = rows.find(r => {
      const diff = (new Date(current.snapshot_date) - new Date(r.snapshot_date)) / 86400000;
      return diff >= 6 && diff <= 8;
    });
    const ago30   = rows.find(r => {
      const diff = (new Date(current.snapshot_date) - new Date(r.snapshot_date)) / 86400000;
      return diff >= 28 && diff <= 32;
    });

    const lines = [
      `**Current** (${current.snapshot_date}): ${fmt(current.market_price)}`,
      ago7  ? `**7d ago**: ${fmt(ago7.market_price)}${pctChange(current.market_price, ago7.market_price)}`   : null,
      ago30 ? `**30d ago**: ${fmt(ago30.market_price)}${pctChange(current.market_price, ago30.market_price)}` : null,
    ].filter(Boolean);

    // Show up to 10 most recent data points as a mini history table
    const history = rows.slice(0, 10)
      .map(r => `\`${r.snapshot_date}\` ${fmt(r.market_price)}`)
      .join('\n');

    lines.push('', history);

    embed.addFields({ name: variant, value: lines.join('\n'), inline: false });
  }

  if (card.tcgplayer_url) {
    embed.addFields({ name: 'TCGPlayer', value: `[View listing](${card.tcgplayer_url})`, inline: false });
  }

  await interaction.editReply({ embeds: [embed], components: [] });
}

module.exports = {
  help: {
    description: 'Show TCGPlayer price history for a high-rarity SV or Mega Evolution card.',
    examples: [
      '`/price_history charizard` — find tracked Charizard cards',
      '`/price_history pikachu ex` — find tracked Pikachu ex cards',
    ],
  },

  aliases: ['ph'],

  data: new SlashCommandBuilder()
    .setName('price_history')
    .setDescription('Show price history for a high-rarity Pokémon card')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Card name to search for')
        .setRequired(true)
    ),

  async execute(interaction) {
    const input = interaction.options.getString('name').trim();
    await interaction.deferReply();

    const rows = await fetch(`${API_URL}/cards?search=${encodeURIComponent(input)}`).then(r => r.json());

    if (rows.length === 0) {
      return interaction.editReply(
        `No tracked cards found for **${input}**. Only high-rarity SV and Mega Evolution cards are tracked.`
      );
    }

    // Single match — show directly
    if (rows.length === 1) return showPriceHistory(interaction, rows[0].product_id);

    // Multiple matches — show dropdown
    const options = rows.map(card =>
      new StringSelectMenuOptionBuilder()
        .setLabel(cleanName(card.name).slice(0, 100))
        .setDescription(`${card.set_name} — #${card.collector_number}/${card.set_total}`.slice(0, 100))
        .setValue(String(card.product_id))
    );

    const menu = new StringSelectMenuBuilder()
      .setCustomId('price_history_select')
      .setPlaceholder('Choose a card...')
      .addOptions(options);

    const row    = new ActionRowBuilder().addComponents(menu);
    const reply  = await interaction.editReply({
      content: `Found **${rows.length}** tracked cards for **${input}**. Pick one:`,
      components: [row],
    });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: i => i.user.id === interaction.user.id,
      time: 60_000,
      max: 1,
    });

    collector.on('collect', async i => {
      await i.deferUpdate();
      await showPriceHistory(interaction, parseInt(i.values[0]));
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        interaction.editReply({ content: 'Selection timed out.', components: [] });
      }
    });
  },
};
