// Import Discord.js components needed for building the command, embed, and dropdown
const {
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  ComponentType,
} = require('discord.js');

const BASE = 'https://api.riftcodex.com';

// Fetches a single Riftbound card by its Riftcodex ID and displays it as a Discord embed
async function showCard(interaction, cardId) {
  const res = await fetch(`${BASE}/cards/${encodeURIComponent(cardId)}`);
  if (!res.ok) {
    return interaction.editReply({ content: 'Failed to fetch card details.', components: [] });
  }
  const card = await res.json();

  // All fields are nested — destructure for convenience
  const { classification = {}, media = {}, set = {} } = card;

  // Build the embed — Riftbound blue accent colour
  const embed = new EmbedBuilder()
    .setTitle(card.name)
    .setColor(0x1A6FD4);

  // Card image
  if (media.image_url) embed.setImage(media.image_url);

  // Classification fields
  if (set.label || set.set_id) embed.addFields({ name: 'Set', value: set.label ?? set.set_id, inline: true });
  if (classification.rarity) embed.addFields({ name: 'Rarity', value: classification.rarity, inline: true });
  if (classification.type) embed.addFields({ name: 'Type', value: classification.type, inline: true });
  if (classification.supertype) embed.addFields({ name: 'Supertype', value: classification.supertype, inline: true });
  if (classification.domain?.length) embed.addFields({ name: 'Domain', value: classification.domain.join(', '), inline: true });
  if (card.collector_number) embed.addFields({ name: 'Number', value: String(card.collector_number), inline: true });

  if (media.artist) embed.addFields({ name: 'Artist', value: media.artist, inline: true });

  await interaction.editReply({ content: null, embeds: [embed], components: [] });
}

// Builds and sends a dropdown menu so the user can pick from multiple matching cards
async function showMenu(interaction, cards, content) {
  // Build one option per card — limit to Discord's 25-option cap
  const options = cards.slice(0, 25).map(card => {
    const parts = [
      card.set?.label ?? card.set?.set_id,
      card.classification?.rarity,
      card.collector_number ? `#${card.collector_number}` : null,
    ].filter(Boolean);

    const desc = parts.length ? parts.join(' · ') : card.riftbound_id ?? card.id;
    return new StringSelectMenuOptionBuilder()
      .setLabel(card.name.slice(0, 100))
      .setDescription(desc.slice(0, 100))
      .setValue(String(card.id));
  });

  const menu = new StringSelectMenuBuilder()
    .setCustomId('riftbound_card_select')
    .setPlaceholder('Choose a card...')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(menu);

  // Send the dropdown to Discord
  const reply = await interaction.editReply({ content, components: [row] });

  // Listen for the user's selection — only the original user can pick
  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    filter: i => i.user.id === interaction.user.id,
    time: 60_000,
    max: 1,
  });

  collector.on('collect', async i => {
    await i.deferUpdate();
    await showCard(interaction, i.values[0]);
  });

  collector.on('end', collected => {
    if (collected.size === 0) {
      interaction.editReply({ content: 'Selection timed out.', components: [] });
    }
  });
}

module.exports = {
  help: {
    description: 'Look up a Riftbound TCG card by name.',
    examples: [
      '`/riftbound_card yasuo` — find all Yasuo cards',
      '`/riftbound_card ahri spiritforged` — Ahri cards from the Spiritforged set',
    ],
  },

  // Aliases registered in Discord alongside the main command name
  aliases: ['rb_card', 'rift_card'],

  data: new SlashCommandBuilder()
    .setName('riftbound_card')
    .setDescription('Look up a Riftbound TCG card')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Card name to search for')
        .setRequired(true)
    ),

  async execute(interaction) {
    const input = interaction.options.getString('name').trim();
    await interaction.deferReply();

    // Helper to extract a card array from any plausible response shape
    const extract = d => Array.isArray(d) ? d : d.cards ?? d.data ?? d.results ?? d.items ?? [];

    // Split input: first word = card name, remainder = optional set name
    // e.g. "ahri spiritforged" → cardName="ahri", setName="spiritforged"
    const spaceIdx = input.indexOf(' ');
    const cardName = spaceIdx !== -1 ? input.slice(0, spaceIdx) : input;
    const setName  = spaceIdx !== -1 ? input.slice(spaceIdx + 1).trim() : null;

    // Fetch all fuzzy matches for the card name (up to 25)
    let cards = [];
    const nameRes = await fetch(`${BASE}/cards/name?fuzzy=${encodeURIComponent(cardName)}&size=25`);
    if (nameRes.ok) cards = extract(await nameRes.json());

    // Fall back to full-text search if the name endpoint returned nothing
    if (cards.length === 0) {
      const searchRes = await fetch(`${BASE}/cards/search?query=${encodeURIComponent(cardName)}&size=25`);
      if (searchRes.ok) cards = extract(await searchRes.json());
    }

    // If a set name was provided, filter results to cards whose set label or ID matches
    if (setName && cards.length > 0) {
      const lc = setName.toLowerCase();
      const filtered = cards.filter(c =>
        c.set?.label?.toLowerCase().includes(lc) ||
        c.set?.set_id?.toLowerCase().includes(lc)
      );

      // If the set filter matched something, use those results
      if (filtered.length > 0) {
        cards = filtered;
      } else {
        // Set didn't match anything — show unfiltered results with a hint
        return showMenu(interaction, cards,
          `No **${cardName}** cards found in that set. Did you mean one of these?`);
      }
    }

    if (cards.length === 0) {
      return interaction.editReply(`No Riftbound cards found for **${input}**.`);
    }

    // Single result — skip the dropdown
    if (cards.length === 1) return showCard(interaction, cards[0].id);

    // Multiple results — show the dropdown
    return showMenu(interaction, cards,
      `Found **${cards.length}** results for **${cardName}**. Pick one:`);
  },
};
