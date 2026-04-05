// Creates the database tables. Run once after provisioning Postgres.
// Usage: node src/migrate.js
require('dotenv').config();
const db = require('./db');

async function migrate() {
  await db.query(`
    -- Each high-rarity card we are tracking (collector number > set total)
    CREATE TABLE IF NOT EXISTS tracked_cards (
      product_id       INTEGER PRIMARY KEY,
      group_id         INTEGER NOT NULL,
      set_name         TEXT    NOT NULL,
      name             TEXT    NOT NULL,
      collector_number INTEGER NOT NULL,
      set_total        INTEGER NOT NULL,
      image_url        TEXT,
      tcgplayer_url    TEXT,
      rarity           TEXT
    );

    -- One row per card per day per variant (Normal, Holofoil, Reverse Holofoil)
    CREATE TABLE IF NOT EXISTS price_snapshots (
      product_id    INTEGER NOT NULL,
      snapshot_date DATE    NOT NULL,
      sub_type_name TEXT    NOT NULL,
      market_price  DECIMAL(10,2),
      low_price     DECIMAL(10,2),
      mid_price     DECIMAL(10,2),
      high_price    DECIMAL(10,2),
      PRIMARY KEY (product_id, snapshot_date, sub_type_name)
    );

    CREATE INDEX IF NOT EXISTS idx_snapshots_product ON price_snapshots(product_id);
    CREATE INDEX IF NOT EXISTS idx_snapshots_date    ON price_snapshots(snapshot_date);
    CREATE INDEX IF NOT EXISTS idx_cards_name        ON tracked_cards(name);
  `);

  console.log('Migration complete.');
  await db.end();
}

migrate().catch(err => { console.error(err); process.exit(1); });
