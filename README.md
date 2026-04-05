# TCGDex

A Discord bot and REST API for looking up Pokémon and Riftbound Trading Card Game cards, with TCGPlayer price history tracking for high-rarity cards.

---

## Discord Bot

### Commands

All commands have aliases — e.g. `/pokemon_card` can also be called via `/poke_card` or `/pkm_card`.

#### Pokémon TCG

| Command | Aliases | Description |
|---------|---------|-------------|
| `/pokemon_card <name>` | `/poke_card`, `/pkm_card` | Search for a Pokémon TCG card. Supports smart input — include a card type suffix (ex, gx, v, vmax, mega, prime, sir, ir) and/or set name. |
| `/pokemon_set <name or ID>` | `/poke_set`, `/pkm_set` | Look up a Pokémon TCG set by name or ID (e.g. `base1`, `flashfire`). |
| `/pokemon_series [name]` | `/poke_series`, `/pkm_series` | List all TCG series, or look up a specific one by name. |

**Pokémon card search examples:**
- `/pokemon_card charizard` — all Charizard cards
- `/pokemon_card charizard flashfire` — Charizard cards from Flashfire
- `/pokemon_card mega charizard ex` — Mega/M Charizard EX only
- `/pokemon_card gengar prime` — Gengar cards with Rare PRIME rarity
- `/pokemon_card pikachu sir` — Pikachu Special Illustration Rares

---

#### Riftbound TCG

| Command | Aliases | Description |
|---------|---------|-------------|
| `/riftbound_card <name>` | `/rb_card`, `/rift_card` | Search for a Riftbound card by name. Optionally append a set name to filter results. |

**Riftbound card search examples:**
- `/riftbound_card yasuo` — all Yasuo cards
- `/riftbound_card ahri spiritforged` — Ahri cards from the Spiritforged set

---

#### Price History

| Command | Aliases | Description |
|---------|---------|-------------|
| `/price_history <name>` | `/ph` | Show TCGPlayer price history for a tracked high-rarity card. |

Price history is tracked daily for all **high-rarity cards** (collector number exceeds base set total, e.g. 204/165) from the **Scarlet & Violet era onwards**, including Mega Evolution sets.

**Examples:**
- `/price_history charizard` — find tracked Charizard cards
- `/price_history pikachu ex` — find tracked Pikachu ex cards

---

#### General

| Command | Description |
|---------|-------------|
| `/help` | Shows a dropdown listing all commands with descriptions and examples. |

---

### Bot Setup

#### Prerequisites
- [Node.js](https://nodejs.org) v22 or higher
- A Discord bot token — create one at the [Discord Developer Portal](https://discord.com/developers/applications)
- A PostgreSQL database (Railway Postgres recommended)

#### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/goldno/TCGDex.git
   cd TCGDex
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and fill in your values:

   | Variable | Description |
   |----------|-------------|
   | `DISCORD_TOKEN` | Your bot's token from the Developer Portal |
   | `CLIENT_ID` | Your bot's application ID |
   | `DATABASE_URL` | PostgreSQL connection string |
   | `API_URL` | Base URL of the TCGDex REST API (e.g. `https://tcgdex-api.up.railway.app`) |
   | `GUILD_ID` | *(Optional)* A specific server ID for instant command registration during development |

4. Create the database tables:
   ```bash
   npm run migrate
   ```

5. Populate tracked cards:
   ```bash
   npm run sync-cards
   ```

6. *(Optional)* Backfill historical price data from Feb 2024:
   ```bash
   npm run backfill
   ```

7. Register slash commands with Discord:
   ```bash
   npm run deploy
   ```

8. Start the bot:
   ```bash
   npm start
   ```

---

### Local Development

The recommended workflow is to run a separate dev bot locally for testing and let Railway host the production bot.

| | Dev | Production |
|---|---|---|
| Bot name | `TCGDexDev` | `TCGDex` |
| Runs on | Your PC | Railway |
| Commands update | Instantly (guild-scoped) | Up to 1 hour (global) |
| Config | Local `.env` | Railway dashboard variables |

Set `GUILD_ID` in your local `.env` to scope commands to your server so they register instantly. Leave it out of Railway's variables so production commands register globally.

---

## REST API

The REST API powers both the Discord bot's price history commands and the TCGDex website. It handles daily price syncing and weekly card discovery.

**Base URL:** `https://tcgdex-api-production.up.railway.app`

### Endpoints

#### `GET /cards`

Returns all tracked high-rarity cards.

**Query parameters:**

| Parameter | Description |
|-----------|-------------|
| `search` | Filter cards by name (case-insensitive, partial match) |

**Example:**
```
GET /cards?search=charizard
```

**Response:**
```json
[
  {
    "product_id": 509963,
    "group_id": 23228,
    "set_name": "SV03: Obsidian Flames",
    "name": "Charizard ex - 215/197",
    "collector_number": 215,
    "set_total": 197,
    "rarity": "Special Illustration Rare",
    "image_url": "https://tcgplayer-cdn.tcgplayer.com/product/509963_200w.jpg",
    "tcgplayer_url": "https://www.tcgplayer.com/product/509963/...",
    "tcgdex_id": "sv03-215",
    "tcgdex_image_url": "https://assets.tcgdex.net/en/sv/sv03/215/high.webp"
  }
]
```

---

#### `GET /cards/:id`

Returns a single tracked card by its TCGPlayer product ID.

**Example:**
```
GET /cards/509963
```

**Response:** Same shape as a single item from `GET /cards`.

**Errors:**
- `404` — card not found

---

#### `GET /cards/:id/prices`

Returns the full price history for a card, ordered by date descending.

**Example:**
```
GET /cards/509963/prices
```

**Response:**
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

### API Setup

#### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Port to listen on (default: `8080`) |

#### Starting the API

```bash
npm run start:api
```

#### Scheduled Jobs

The API runs two automatic jobs:

| Schedule | Job |
|----------|-----|
| Daily at 21:00 UTC | Fetches current TCGPlayer prices from TCGCSV and saves a snapshot |
| Mondays at 22:00 UTC | Scans for newly released sets and adds high-rarity cards to tracking |

---

## Deploying to Railway

Both the bot and API are hosted as separate services in the same Railway project, sharing one PostgreSQL instance.

| Service | Start command | Config file |
|---------|--------------|-------------|
| TCGDex Bot | `node deploy-commands.js && npm start` | `railway.json` |
| TCGDex API | `node api/index.js` | `railway.api.json` |

1. Push to GitHub — Railway auto-deploys on every push to `main`
2. The API service uses `railway.api.json` — set **Config Path** in Railway service settings
3. Add environment variables in the Railway dashboard for each service

---

## Price Tracking

**What counts as high-rarity?**
Any card whose collector number exceeds the base set total — e.g. a set with 165 base cards where high-rarity cards are numbered 166–220. This captures Illustration Rares, Special Illustration Rares, Gold cards, etc.

Tracking covers the **Scarlet & Violet era and Mega Evolution sets**, with historical data available from February 2024 via the backfill script.

---

## Data Sources

| Source | Used for |
|--------|---------|
| [TCGDex](https://tcgdex.dev) | Pokémon card, set, and series data + high-res card images |
| [TCGCSV](https://tcgcsv.com) | Daily TCGPlayer price snapshots + historical price archives |
| [Riftcodex](https://riftcodex.com) | Riftbound card data |

---

## Dependencies

| Package | Purpose |
|---------|---------|
| [`discord.js`](https://discord.js.org) | Discord bot framework |
| [`@tcgdex/sdk`](https://tcgdex.dev) | TCGDex API client |
| [`express`](https://expressjs.com) | REST API server |
| [`pg`](https://github.com/brianc/node-postgres) | PostgreSQL client |
| [`node-cron`](https://github.com/node-cron/node-cron) | Scheduled price sync and card discovery |
| [`node-7z`](https://github.com/quentinrossetti/node-7z) + [`7zip-bin`](https://github.com/develar/7zip-bin) | Extracting TCGCSV price archives for backfill |
| [`dotenv`](https://github.com/motdotla/dotenv) | Loads environment variables from `.env` |
