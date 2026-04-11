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


// Parses the user's raw input into:
//   pokemonName — the actual Pokémon to search for (e.g. "charizard")
//   setName     — optional set to filter by (e.g. "flashfire"), or null
//   isMega      — true if the user typed "mega ..." or "m ..."
//   isRadiant   — true if the user typed "radiant ..."
//   suffix      — detected card type suffix (ex, gx, vmax, etc.) or null
function parseInput(input) {
  let term = input.trim();

  // Check for "mega" or "m " prefix
  const isMega = /^(mega|m)\s/i.test(term);
  term = term.replace(/^(mega|m)\s+/i, '');

  // Check for "radiant" prefix (e.g. "radiant charizard")
  const isRadiant = /^radiant\s/i.test(term);
  term = term.replace(/^radiant\s+/i, '');

  // Suffixes that appear IN the card name — filtered client-side by name
  // Suffixes that are RARITY keywords — filtered via the API rarity field
  // vmax/vstar listed before v to avoid partial matches
  const nameSuffixes = 'vmax|vstar|ex|gx|star|v';
  const raritySuffixes = 'prime|sir|ir';
  const suffixMatch = term.match(
    new RegExp(`^(.+?)\\s+(${nameSuffixes}|${raritySuffixes})\\b\\s*(.+)?$`, 'i')
  );

  // Which suffixes are rarity-based (used as API rarity filter rather than name filter)
  const RARITY_KEYWORDS = new Set(['prime', 'sir', 'ir']);

  let pokemonName, setName, nameSuffix, raritySuffix;
  if (suffixMatch) {
    pokemonName  = suffixMatch[1].trim();
    const sfx    = suffixMatch[2].toLowerCase();
    setName      = suffixMatch[3]?.trim() || null;
    nameSuffix   = RARITY_KEYWORDS.has(sfx) ? null : sfx;
    raritySuffix = RARITY_KEYWORDS.has(sfx) ? sfx  : null;
  } else {
    // No suffix — first word is pokemon name, rest is set name
    const spaceIdx = term.indexOf(' ');
    if (spaceIdx !== -1) {
      pokemonName = term.slice(0, spaceIdx);
      setName = term.slice(spaceIdx + 1).trim();
    } else {
      pokemonName = term;
      setName = null;
    }
    nameSuffix = null;
    raritySuffix = null;
  }

  return { pokemonName, setName, isMega, isRadiant, nameSuffix, raritySuffix };
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
  if (detail.image) embed.setImage(detail.getImageURL('high', 'png'));
  if (detail.set?.name) embed.addFields({ name: 'Set', value: detail.set.name, inline: true });
  if (detail.rarity) embed.addFields({ name: 'Rarity', value: detail.rarity, inline: true });
  if (detail.hp) embed.addFields({ name: 'HP', value: String(detail.hp), inline: true });
  if (detail.types?.length) embed.addFields({ name: 'Type(s)', value: detail.types.join(', '), inline: true });
  if (detail.illustrator) embed.addFields({ name: 'Illustrator', value: detail.illustrator, inline: true });

  // Show which print variants exist for this card (Normal, Reverse Holo, Holo, First Edition)
  if (detail.variants) {
    const variantLabels = {
      normal: 'Normal',
      reverse: 'Reverse Holo',
      holo: 'Holo',
      firstEdition: 'First Edition',
    };
    const available = Object.entries(detail.variants)
      .filter(([key, exists]) => exists && variantLabels[key])
      .map(([key]) => variantLabels[key])
      .join(', ');
    if (available) embed.addFields({ name: 'Variants', value: available, inline: false });
  }

  // Show TCGPlayer market prices — currently null for most modern cards due to a TCGDex API issue.
  // This will populate automatically once they resolve it.
  if (detail.pricing?.tcgplayer) {
    const tcp = detail.pricing.tcgplayer;
    const variantPrices = [
      ['Normal',           tcp.normal],
      ['Reverse Holo',     tcp['reverse-holofoil']],
      ['Holo',             tcp.holofoil],
      ['1st Edition',      tcp['1st-edition']],
      ['1st Edition Holo', tcp['1st-edition-holofoil']],
      ['Unlimited',        tcp.unlimited],
    ];
    const lines = variantPrices
      .filter(([, data]) => data?.marketPrice != null)
      .map(([label, data]) => `${label}: $${data.marketPrice.toFixed(2)}`);
    if (lines.length) {
      embed.addFields({ name: `TCGPlayer Market Price (${tcp.unit})`, value: lines.join('\n'), inline: false });
    }
  }

  await interaction.editReply({ content: null, embeds: [embed], components: [] });
}

// Builds and sends a dropdown menu so the user can pick from multiple matching cards.
// Fetches full card details in parallel to show the set name and rarity in each option.
async function showMenu(interaction, cards, content) {
  // Fetch full details for up to 25 cards at the same time so we have rarity and set name
  const details = await Promise.all(
    cards.slice(0, 25).map(c => tcgdex.card.get(c.id).catch(() => null))
  );

  // Build one dropdown option per card — label is the card name, description shows set · rarity · #number · variants
  const options = details.map((detail, i) => {
    const card = cards[i];

    // Shorten variant names to keep the description within Discord's 100 character limit
    const variantLabels = { normal: 'Normal', reverse: 'Reverse', holo: 'Holo', firstEdition: '1st Ed' };
    const variants = detail?.variants
      ? Object.entries(detail.variants)
          .filter(([key, exists]) => exists && variantLabels[key])
          .map(([key]) => variantLabels[key])
          .join(', ')
      : null;

    const parts = [
      detail?.set?.name,
      detail?.rarity,
      detail?.localId ? `#${detail.localId}` : null,
      variants,
    ].filter(Boolean);

    const desc = parts.length ? parts.join(' · ') : card.id;
    return new StringSelectMenuOptionBuilder()
      .setLabel(card.name)
      .setDescription(desc.slice(0, 100)) // Discord caps descriptions at 100 characters
      .setValue(card.id);
  });

  // Wrap the options in a select menu, then wrap that in an action row (Discord requires this)
  const menu = new StringSelectMenuBuilder()
    .setCustomId('pokemon_card_select')
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
  help: {
    description: 'Look up a Pokémon TCG card by name. Supports smart search — include the card type and set name in your query.',
    examples: [
      '`/pokemon_card charizard` — all Charizard cards',
      '`/pokemon_card charizard flashfire` — narrow by set name',
      '`/pokemon_card mega charizard ex` — Mega/M Charizard EX cards only',
      '`/pokemon_card m gengar` — same as typing "mega gengar"',
      '`/pokemon_card charizard ex flashfire` — card type + set combined',
    ],
  },

  // Aliases registered in Discord alongside the main command name
  aliases: [],

  // Register the slash command with Discord — defines the name, description, and options
  data: new SlashCommandBuilder()
    .setName('poke_card')
    .setDescription('Look up a Pokémon TCG card')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Card name to search for')
        .setRequired(true)
    ),

  async execute(interaction) {
    const input = interaction.options.getString('name');

    // Break the input into pokemonName, optional setName, prefix flags, and card type suffix
    const { pokemonName, setName, isMega, isRadiant, nameSuffix, raritySuffix } = parseInput(input);
    await interaction.deferReply();

    // Helper that applies name-based filters (mega, radiant, name suffix) to a card list
    const applyFilters = (list, { mega = isMega, radiant = isRadiant, sfx = nameSuffix } = {}) => {
      let result = list ?? [];
      if (mega)    result = result.filter(c => /^(M |Mega )/i.test(c.name));
      if (radiant) result = result.filter(c => /\bradiant\b/i.test(c.name));
      // Word boundary match so "ex" doesn't match inside longer words
      if (sfx)     result = result.filter(c => new RegExp(`\\b${sfx}\\b`, 'i').test(c.name));
      return result;
    };

    // Map user-typed rarity abbreviations to the substring TCGDex stores in the rarity field
    const RARITY_MAP = {
      prime: 'PRIME',
      sir:   'Special Illustration Rare',
      ir:    'Illustration Rare',
    };

    // Build the API query — always search by pokemon name
    // Rarity keywords (prime, sir, ir) are passed to the API as a rarity filter
    // since they don't appear in card names
    let query = Query.create().contains('name', pokemonName);
    if (setName)      query = query.contains('set.name', setName);
    if (raritySuffix) query = query.contains('rarity', RARITY_MAP[raritySuffix] ?? raritySuffix);

    let cards = applyFilters((await tcgdex.card.list(query)) ?? []);

    // Handle the case where nothing was found — try progressively looser searches
    if (cards.length === 0) {

      // Name suffix/prefix filter may have removed everything — retry without those
      if (nameSuffix || isRadiant) {
        const fallback = applyFilters(
          (await tcgdex.card.list(Query.create().contains('name', pokemonName))) ?? [],
          { sfx: null, radiant: false }
        );
        if (fallback.length > 0) {
          if (fallback.length === 1) return showCard(interaction, fallback[0].id);
          return showMenu(interaction, fallback,
            `No **${pokemonName} ${nameSuffix ?? ''}** cards found. Did you mean one of these?`);
        }
      }

      // Mega filter may have removed everything — retry without it
      if (isMega) {
        const fallback = applyFilters(
          (await tcgdex.card.list(Query.create().contains('name', pokemonName))) ?? [],
          { mega: false }
        );
        if (fallback.length > 0) {
          if (fallback.length === 1) return showCard(interaction, fallback[0].id);
          return showMenu(interaction, fallback,
            `No Mega **${pokemonName}** cards found. Did you mean one of these?`);
        }
      }

      // Set name may have been wrong — retry without it
      if (setName) {
        let fallbackQuery = Query.create().contains('name', pokemonName);
        if (raritySuffix) fallbackQuery = fallbackQuery.contains('rarity', RARITY_MAP[raritySuffix] ?? raritySuffix);
        const fallback = applyFilters((await tcgdex.card.list(fallbackQuery)) ?? []);
        if (fallback.length > 0) {
          if (fallback.length === 1) return showCard(interaction, fallback[0].id);
          return showMenu(interaction, fallback,
            `No **${pokemonName}** cards found in that set. Did you mean one of these?`);
        }
      }

      return interaction.editReply(`No cards found for **${input}**.`);
    }

    // Exactly one result — skip the dropdown and show it directly
    if (cards.length === 1) return showCard(interaction, cards[0].id);

    // Multiple results — show the dropdown
    // Discord caps dropdowns at 25 options, so warn if results were truncated
    const truncated = cards.length > 25;
    return showMenu(interaction, cards,
      truncated
        ? `Found **${cards.length}** results for **${input}** (showing first 25). Try adding a set name to narrow results.`
        : `Found **${cards.length}** results for **${input}**. Pick one:`);
  },
};
