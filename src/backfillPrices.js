// One-time script to backfill price history from TCGCSV archives.
// Archives are available from 2024-02-08 onwards.
// Run locally: node src/backfillPrices.js
require('dotenv').config();
const fs      = require('fs');
const path    = require('path');
const https   = require('https');
const Seven   = require('node-7z');
const bin     = require('7zip-bin');
const db      = require('./db');

const CATEGORY = 3; // Pokemon TCG
const TMP_DIR  = path.join(__dirname, '../.tmp-backfill');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      if (res.statusCode === 404) {
        file.close();
        fs.unlinkSync(dest);
        return resolve(false);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(true); });
    }).on('error', err => { fs.unlinkSync(dest); reject(err); });
  });
}

function extract(archivePath, outputDir) {
  return new Promise((resolve, reject) => {
    const stream = Seven.extractFull(archivePath, outputDir, { $bin: bin.path7za });
    stream.on('end', resolve);
    stream.on('error', reject);
  });
}

async function backfill() {
  const { rows: cards } = await db.query('SELECT product_id, group_id FROM tracked_cards');
  if (cards.length === 0) {
    console.log('No tracked cards. Run sync-cards first.');
    return;
  }

  const trackedIds = new Set(cards.map(c => c.product_id));
  const groupIds   = [...new Set(cards.map(c => c.group_id))];

  console.log(`Backfilling ${trackedIds.size} cards across ${groupIds.length} sets...`);

  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

  const start   = new Date('2024-02-08');
  const end     = new Date();
  end.setHours(0, 0, 0, 0);

  let totalSaved = 0;
  let current    = new Date(start);

  while (current <= end) {
    const dateStr     = current.toISOString().slice(0, 10);
    const archiveUrl  = `https://tcgcsv.com/archive/tcgplayer/prices-${dateStr}.ppmd.7z`;
    const archivePath = path.join(TMP_DIR, `prices-${dateStr}.ppmd.7z`);
    const extractDir  = path.join(TMP_DIR, dateStr);

    process.stdout.write(`[${dateStr}] Downloading...`);

    try {
      const found = await download(archiveUrl, archivePath);
      if (!found) {
        console.log(' skipped (no archive).');
        current.setDate(current.getDate() + 1);
        continue;
      }

      process.stdout.write(' extracting...');
      await extract(archivePath, TMP_DIR);

      let saved = 0;
      for (const groupId of groupIds) {
        const priceFile = path.join(extractDir, String(CATEGORY), String(groupId), 'prices');
        if (!fs.existsSync(priceFile)) continue;

        const data   = JSON.parse(fs.readFileSync(priceFile, 'utf8'));
        const prices = data.results ?? data;

        for (const price of prices) {
          if (!trackedIds.has(price.productId)) continue;
          if (price.marketPrice == null)        continue;

          const result = await db.query(
            `INSERT INTO price_snapshots
               (product_id, snapshot_date, sub_type_name, market_price, low_price, mid_price, high_price)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (product_id, snapshot_date, sub_type_name) DO NOTHING`,
            [
              price.productId,
              dateStr,
              price.subTypeName,
              price.marketPrice,
              price.lowPrice  ?? null,
              price.midPrice  ?? null,
              price.highPrice ?? null,
            ]
          );
          if (result.rowCount > 0) saved++;
        }
      }

      totalSaved += saved;
      console.log(` ${saved} rows inserted.`);
    } catch (err) {
      console.log(` ERROR: ${err.message}`);
    } finally {
      if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath);
      if (fs.existsSync(extractDir))  fs.rmSync(extractDir, { recursive: true });
    }

    // Small delay to avoid hammering the server
    await new Promise(r => setTimeout(r, 300));
    current.setDate(current.getDate() + 1);
  }

  console.log(`\nDone — ${totalSaved} total rows inserted.`);
  await db.end();
}

backfill().catch(err => { console.error(err); process.exit(1); });
