// One-time script to look up TCGDex card IDs for all tracked cards and store them.
// TCGDex provides high-quality card images using these IDs.
// Run locally: node src/backfillTcgdexIds.js
require('dotenv').config();
const TCGdex = require('@tcgdex/sdk').default;
const db     = require('./db');

const tcgdex = new TCGdex('en');

// Maps TCGCSV set names to TCGDex set IDs
// ME sets are not in TCGDex and will be skipped
const SET_MAP = {
  'SV01: Scarlet & Violet Base Set': 'sv01',
  'SV02: Paldea Evolved':            'sv02',
  'SV03: Obsidian Flames':           'sv03',
  'SV: Scarlet & Violet 151':        'sv03.5',
  'SV04: Paradox Rift':              'sv04',
  'SV: Paldean Fates':               'sv04.5',
  'SV05: Temporal Forces':           'sv05',
  'SV06: Twilight Masquerade':       'sv06',
  'SV: Shrouded Fable':              'sv06.5',
  'SV07: Stellar Crown':             'sv07',
  'SV08: Surging Sparks':            'sv08',
  'SV: Prismatic Evolutions':        'sv08.5',
  'SV09: Journey Together':          'sv09',
  'SV10: Destined Rivals':           'sv10',
  'SV: Black Bolt':                  'sv10.5b',
  'SV: White Flare':                 'sv10.5w',
  'ME01: Mega Evolution':            'me01',
  'ME02: Phantasmal Flames':         'me02',
  'ME: Ascended Heroes':             'me02.5',
  'ME03: Perfect Order':             'me03',
};

async function backfillTcgdexIds() {
  const { rows: cards } = await db.query(
    `SELECT product_id, name, set_name, collector_number
     FROM tracked_cards
     WHERE tcgdex_id IS NULL
     ORDER BY set_name, collector_number`
  );

  console.log(`Looking up TCGDex IDs for ${cards.length} cards...`);

  // Group cards by set_name
  const bySet = {};
  for (const card of cards) {
    if (!bySet[card.set_name]) bySet[card.set_name] = [];
    bySet[card.set_name].push(card);
  }

  let found   = 0;
  let missing = 0;
  let skipped = 0;

  for (const [setName, setCards] of Object.entries(bySet)) {
    const tcgdexSetId = SET_MAP[setName];
    if (!tcgdexSetId) {
      console.log(`\n[${setName}] No TCGDex mapping — skipping ${setCards.length} cards`);
      skipped += setCards.length;
      continue;
    }

    console.log(`\n[${setName}] → ${tcgdexSetId}`);

    // Fetch all cards in this set from TCGDex, keyed by localId
    let setData;
    try {
      setData = await tcgdex.set.get(tcgdexSetId);
    } catch (err) {
      console.log(`  ERROR fetching set: ${err.message}`);
      missing += setCards.length;
      continue;
    }

    // Build lookup: localId (string) → card id
    const byLocalId = {};
    for (const card of setData.cards ?? []) {
      byLocalId[String(card.localId)] = card.id;
    }

    for (const card of setCards) {
      const num = card.collector_number;
      const tcgdexId = byLocalId[String(num)]
        ?? byLocalId[String(num).padStart(3, '0')]
        ?? byLocalId[String(num).padStart(2, '0')];
      if (tcgdexId) {
        await db.query(
          'UPDATE tracked_cards SET tcgdex_id = $1 WHERE product_id = $2',
          [tcgdexId, card.product_id]
        );
        console.log(`  ✓ #${card.collector_number} → ${tcgdexId}`);
        found++;
      } else {
        console.log(`  ✗ #${card.collector_number} (${card.name}) — not in TCGDex set`);
        missing++;
      }
    }
  }

  console.log(`\nDone — ${found} found, ${missing} not matched, ${skipped} skipped (no TCGDex mapping).`);
  await db.end();
}

backfillTcgdexIds().catch(err => { console.error(err); process.exit(1); });
