// Import Discord.js components needed for building the command, embed, and dropdown
const {
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  ComponentType,
} = require('discord.js');

// Import the TCGDex SDK and its Query builder for filtering card searches
const TCGdex = require('@tcgdex/sdk').default;
const { Query } = require('@tcgdex/sdk');

// Create a single SDK instance set to English
const tcgdex = new TCGdex('en');

// Parses the user's raw input into three parts:
//   pokemonName — the actual Pokémon to search for (e.g. "charizard")
//   setName     — optional set to filter by (e.g. "flashfire"), or null
//   isMega      — true if the user typed "mega ..." so we can filter to M/Mega cards later
function parseInput(input) {
  let term = input.trim();

  // Check if the input starts with "mega" or "m " so we can filter results to M/Mega cards
  const isMega = /^(mega|m)\s/i.test(term);
  term = term.replace(/^(mega|m)\s+/i, '');

  // Try to find a card type suffix (ex, gx, v, vmax, vstar, star) in the input.
  // Anything before the suffix is the Pokémon name; anything after is the set name.
  // vmax/vstar are listed before v so "vmax" isn't accidentally matched as "v" + "max".
  const suffixMatch = term.match(/^(.+?)\s+(vmax|vstar|ex|gx|star|v)\b\s*(.+)?$/i);

  let pokemonName, setName;
  if (suffixMatch) {
    // e.g. "charizard ex flashfire" → pokemonName="charizard", setName="flashfire"
    pokemonName = suffixMatch[1].trim();
    setName = suffixMatch[3]?.trim() || null;
  } else {
    // No suffix found — treat the first word as the Pokémon name and the rest as the set name.
    // e.g. "charizard crystal guardians" → pokemonName="charizard", setName="crystal guardians"
    const spaceIdx = term.indexOf(' ');
    if (spaceIdx !== -1) {
      pokemonName = term.slice(0, spaceIdx);
      setName = term.slice(spaceIdx + 1).trim();
    } else {
      // Single word input — no set name
      pokemonName = term;
      setName = null;
    }
  }

  return { pokemonName, setName, isMega };
}

// Fetches a single card by ID and displays it as a Discord embed
async function showCard(interaction, cardId) {
  const detail = await tcgdex.card.get(cardId);
  if (!detail) {
    return interaction.editReply({ content: 'Failed to fetch card details.', components: [] });
  }

  // Build the embed with a yellow colour (Pokémon TCG yellow)
  const embed = new EmbedBuilder()
    .setTitle(`${detail.name} — ${cardId}`)
    .setColor(0xFFCB05);

  // Add the card image and available fields — each one is only added if the data exists
  if (detail.image) embed.setThumbnail(detail.getImageURL('high', 'png'));
  if (detail.set?.name) embed.addFields({ name: 'Set', value: detail.set.name, inline: true });
  if (detail.rarity) embed.addFields({ name: 'Rarity', value: detail.rarity, inline: true });
  if (detail.hp) embed.addFields({ name: 'HP', value: String(detail.hp), inline: true });
  if (detail.types?.length) embed.addFields({ name: 'Type(s)', value: detail.types.join(', '), inline: true });
  if (detail.illustrator) embed.addFields({ name: 'Illustrator', value: detail.illustrator, inline: true });

  await interaction.editReply({ content: null, embeds: [embed], components: [] });
}

// Builds and sends a dropdown menu so the user can pick from multiple matching cards.
// Fetches full card details in parallel to show the set name and rarity in each option.
async function showMenu(interaction, cards, content) {
  // Fetch full details for up to 25 cards at the same time so we have rarity and set name
  const details = await Promise.all(
    cards.slice(0, 25).map(c => tcgdex.card.get(c.id).catch(() => null))
  );

  // Build one dropdown option per card — label is the card name, description shows set · rarity
  const options = details.map((detail, i) => {
    const card = cards[i];
    const parts = [detail?.set?.name, detail?.rarity].filter(Boolean);
    const desc = parts.length ? parts.join(' · ') : card.id;
    return new StringSelectMenuOptionBuilder()
      .setLabel(card.name)
      .setDescription(desc.slice(0, 100)) // Discord caps descriptions at 100 characters
      .setValue(card.id);
  });

  // Wrap the options in a select menu, then wrap that in an action row (Discord requires this)
  const menu = new StringSelectMenuBuilder()
    .setCustomId('card_select')
    .setPlaceholder('Choose a card...')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(menu);

  // Send the dropdown to Discord
  const reply = await interaction.editReply({ content, components: [row] });

  // Listen for the user to pick an option — only accept input from the original user
  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    filter: i => i.user.id === interaction.user.id,
    time: 60_000, // auto-expire after 60 seconds
    max: 1,       // stop listening after one selection
  });

  // When a card is selected, fetch and display it
  collector.on('collect', async i => {
    await i.deferUpdate();
    await showCard(interaction, i.values[0]);
  });

  // If the 60-second window expires with no selection, remove the dropdown
  collector.on('end', collected => {
    if (collected.size === 0) {
      interaction.editReply({ content: 'Selection timed out.', components: [] });
    }
  });
}

module.exports = {
  // Register the slash command with Discord — defines the name, description, and options
  data: new SlashCommandBuilder()
    .setName('card')
    .setDescription('Look up a Pokémon TCG card')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Card name to search for')
        .setRequired(true)
    ),

  async execute(interaction) {
    const input = interaction.options.getString('name');

    // Break the input into pokemonName, optional setName, and whether the user said "mega"
    const { pokemonName, setName, isMega } = parseInput(input);
    await interaction.deferReply();

    // Build the API query — always search by name, optionally narrow by set
    let query = Query.create().contains('name', pokemonName);
    if (setName) query = query.contains('set.name', setName);

    let cards = await tcgdex.card.list(query);

    // If "mega" was in the input, keep only cards whose name starts with "M " or "Mega "
    if (isMega) cards = cards?.filter(c => /^(M |Mega )/i.test(c.name));

    // Handle the case where nothing was found — try progressively looser searches
    if (!cards || cards.length === 0) {

      // The mega filter may have removed everything — retry without it and suggest results
      if (isMega) {
        let fallback = await tcgdex.card.list(query);
        if (fallback?.length > 0) {
          if (fallback.length === 1) return showCard(interaction, fallback[0].id);
          return showMenu(interaction, fallback,
            `No Mega **${pokemonName}** cards found. Did you mean one of these?`);
        }
      }

      // The set name may have been wrong — retry without it and suggest results
      if (setName) {
        let fallback = await tcgdex.card.list(Query.create().contains('name', pokemonName));
        if (isMega) fallback = fallback?.filter(c => /^(M |Mega )/i.test(c.name));
        if (fallback?.length > 0) {
          if (fallback.length === 1) return showCard(interaction, fallback[0].id);
          return showMenu(interaction, fallback,
            `No **${pokemonName}** cards found in that set. Did you mean one of these?`);
        }
      }

      // Nothing found even with looser searches
      return interaction.editReply(`No cards found for **${input}**.`);
    }

    // Exactly one result — skip the dropdown and show it directly
    if (cards.length === 1) return showCard(interaction, cards[0].id);

    // Multiple results — show the dropdown so the user can pick
    return showMenu(interaction, cards,
      `Found **${cards.length}** results for **${input}**. Pick one:`);
  },
};
