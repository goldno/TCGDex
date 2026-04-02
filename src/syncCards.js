// Discovers high-rarity cards (collector number > set total) across all tracked sets
// and saves them to the database. Safe to re-run — existing cards are skipped.
//
// Runs automatically on a weekly cron via index.js.
// Can also be run manually: node src/syncCards.js
require('dotenv').config();
const db = require('./db');

const TCGCSV_BASE = 'https://tcgcsv.com/tcgplayer/3';

// Date from which we start tracking sets — SV era launched early 2023
const TRACK_FROM = new Date('2023-01-01');

// Words in a set name that indicate it is NOT a main expansion set
const EXCLUDE_PATTERN = /promo|energ|bundle|mcdonald|academy|classic|trick.or.trade|placement|first.partner|first.battle/i;

// Returns true if a TCGCSV group entry is a main expansion set we want to track
function isMainSet(group) {
  if (new Date(group.publishedOn) < TRACK_FROM) return false;
  if (EXCLUDE_PATTERN.test(group.name)) return false;
  return true;
}

// Extracts the collector number and set total from a TCGCSV product.
// Card numbers are stored in extendedData as { name: "Number", value: "204/165" }
// and sometimes also appear in the product name as "Card Name - 204/165".
function parseCardNumber(product) {
  if (Array.isArray(product.extendedData)) {
    const field = product.extendedData.find(f => f.name === 'Number');
    if (field?.value) {
      const m = String(field.value).match(/^(\d+)\/(\d+)$/);
      if (m) return { collectorNum: parseInt(m[1]), setTotal: parseInt(m[2]) };
    }
  }
  // Fall back to parsing "Card Name - 204/165" from the product name
  const m = product.name?.match(/-\s*(\d+)\/(\d+)\s*$/);
  if (m) return { collectorNum: parseInt(m[1]), setTotal: parseInt(m[2]) };
  return null;
}

async function syncCards() {
  console.log('[syncCards] Fetching set list from TCGCSV...');

  const groupsRes = await fetch(`${TCGCSV_BASE}/groups`);
  if (!groupsRes.ok) {
    console.error(`[syncCards] Failed to fetch groups — HTTP ${groupsRes.status}`);
    return;
  }

  const groupsData = await groupsRes.json();
  const allGroups  = groupsData.results ?? [];
  const sets       = allGroups.filter(isMainSet);

  console.log(`[syncCards] ${sets.length} main sets found since ${TRACK_FROM.toISOString().slice(0, 10)}`);

  let grandTotal = 0;

  for (const set of sets) {
    const res = await fetch(`${TCGCSV_BASE}/${set.groupId}/products`);
    if (!res.ok) {
      console.log(`  SKIP "${set.name}" — HTTP ${res.status}`);
      continue;
    }

    const data     = await res.json();
    const products = data.results ?? [];
    let count = 0;

    for (const product of products) {
      const parsed = parseCardNumber(product);
      if (!parsed) continue;

      const { collectorNum, setTotal } = parsed;

      // Only track cards whose collector number exceeds the base set total
      if (collectorNum <= setTotal) continue;

      await db.query(
        `INSERT INTO tracked_cards
           (product_id, group_id, set_name, name, collector_number, set_total, image_url, tcgplayer_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (product_id) DO UPDATE
           SET name          = EXCLUDED.name,
               image_url     = EXCLUDED.image_url,
               tcgplayer_url = EXCLUDED.tcgplayer_url`,
        [
          product.productId,
          set.groupId,
          set.name,
          product.name,
          collectorNum,
          setTotal,
          product.imageUrl ?? null,
          product.url      ?? null,
        ]
      );
      count++;
    }

    if (count > 0) console.log(`  "${set.name}": ${count} high-rarity cards`);
    grandTotal += count;
  }

  console.log(`[syncCards] Done — ${grandTotal} total cards tracked.`);
}

// Allow running directly for initial setup: node src/syncCards.js
if (require.main === module) {
  require('dotenv').config();
  syncCards()
    .then(() => db.end())
    .catch(err => { console.error(err); process.exit(1); });
}

module.exports = syncCards;
