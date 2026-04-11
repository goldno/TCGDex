# TCGDex

A Discord bot and REST API for looking up Pokémon and Riftbound Trading Card Game cards, with TCGPlayer price history tracking for high-rarity cards.

---

## Discord Bot

### Pokémon TCG

| Command | Description |
|---------|-------------|
| `/poke_card <name>` | Search for a Pokémon TCG card. Supports smart input — include a card type suffix (ex, gx, v, vmax, mega, prime, sir, ir) and/or set name. |
| `/poke_set <name or ID>` | Look up a Pokémon TCG set by name or ID. |
| `/poke_series [name]` | List all TCG series, or look up a specific one by name. |

**Examples:**
- `/poke_card charizard flashfire` — Charizard cards from Flashfire
- `/poke_card mega charizard ex` — Mega/M Charizard EX only
- `/poke_card pikachu sir` — Pikachu Special Illustration Rares

### Riftbound TCG

| Command | Description |
|---------|-------------|
| `/rift_card <name>` | Search for a Riftbound card by name. Optionally append a set name to filter results. Shows live TCGPlayer market prices. |

**Examples:**
- `/rift_card yasuo` — all Yasuo cards
- `/rift_card ahri spiritforged` — Ahri cards from the Spiritforged set

### General

| Command | Description |
|---------|-------------|
| `/help` | Shows a dropdown listing all commands with descriptions and examples. |

---

## REST API

Powers the TCGDex website. Tracks TCGPlayer prices daily for high-rarity Pokémon cards (collector number exceeds base set total — Illustration Rares, Special Illustration Rares, Gold cards, etc.) from the Scarlet & Violet and Mega Evolution eras, with history going back to February 2024.

**Base URL:** `https://tcgdex-api-production.up.railway.app`

### Endpoints

#### `GET /cards`

Returns all tracked high-rarity cards. Optionally filter by name.

| Parameter | Description |
|-----------|-------------|
| `search` | Filter by name (case-insensitive, partial match) |

**Response fields:** `product_id`, `set_name`, `name`, `collector_number`, `set_total`, `rarity`, `tcgplayer_url`, `tcgdex_id`, `tcgdex_image_url`, `latest_price`, `latest_price_type`

---

#### `GET /cards/:id`

Returns a single tracked card by its TCGPlayer product ID. Returns `404` if not found.

---

#### `GET /cards/:id/prices`

Returns the full price history for a card ordered by date descending.

```json
[
  {
    "snapshot_date": "2026-04-04T04:00:00.000Z",
    "sub_type_name": "Holofoil",
    "market_price": "20.66",
    "low_price": "15.60",
    "mid_price": "22.30",
    "high_price": "179.86"
  }
]
```

---

## Database

A PostgreSQL database stores all tracked cards and their price history. Prices are fetched daily from [TCGCSV](https://tcgcsv.com) and saved as snapshots, building up a historical record over time. The REST API reads directly from this database to serve card and price data to the website [TCGDex](https://goldno.github.io/tcgdex-website/).

---

## Data Sources

| Source | Used for |
|--------|---------|
| [TCGDex](https://tcgdex.dev) | Pokémon card, set, and series data + high-res card images |
| [TCGCSV](https://tcgcsv.com) | Daily TCGPlayer price snapshots + historical price archives |
| [Riftcodex](https://riftcodex.com) | Riftbound card data and TCGPlayer IDs |
