# TCGDex Bot

A Discord bot for looking up Pokémon and Riftbound Trading Card Game cards, sets, and series — with TCGPlayer price history tracking for high-rarity cards.

## Commands

All commands have aliases — e.g. `/pokemon_card` can also be called via `/poke_card` or `/pkm_card`.

### Pokémon TCG

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

### Riftbound TCG

| Command | Aliases | Description |
|---------|---------|-------------|
| `/riftbound_card <name>` | `/rb_card`, `/rift_card` | Search for a Riftbound card by name. Optionally append a set name to filter results. |

**Riftbound card search examples:**
- `/riftbound_card yasuo` — all Yasuo cards
- `/riftbound_card ahri spiritforged` — Ahri cards from the Spiritforged set

---

### Price History

| Command | Aliases | Description |
|---------|---------|-------------|
| `/price_history <name>` | `/ph` | Show TCGPlayer price history for a tracked high-rarity card. |

Price history is tracked daily for all **high-rarity cards** (collector number exceeds base set total, e.g. 204/165) from the **Scarlet & Violet era onwards**, including Mega Evolution sets. New sets are picked up automatically each week as they become available.

**Examples:**
- `/price_history charizard` — find tracked Charizard cards
- `/price_history pikachu ex` — find tracked Pikachu ex cards

---

### General

| Command | Description |
|---------|-------------|
| `/help` | Shows a dropdown listing all commands with descriptions and examples. |

---

## Setup

### Prerequisites
- [Node.js](https://nodejs.org) v22 or higher
- A Discord bot token — create one at the [Discord Developer Portal](https://discord.com/developers/applications)
- A PostgreSQL database (Railway Postgres recommended)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/tcgdex-bot.git
   cd tcgdex-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

   | Variable | Description |
   |----------|-------------|
   | `DISCORD_TOKEN` | Your bot's token from the Developer Portal |
   | `CLIENT_ID` | Your bot's application ID |
   | `DATABASE_URL` | PostgreSQL connection string |
   | `GUILD_ID` | *(Optional)* A specific server ID for instant command registration during development |

   > **Local development:** Use `DATABASE_PUBLIC_URL` from Railway (the public-facing hostname). The internal `DATABASE_URL` only works inside Railway's network.

4. Create the database tables:
   ```bash
   node src/migrate.js
   ```

5. Populate tracked cards (high-rarity SV/ME cards):
   ```bash
   node src/syncCards.js
   ```

6. Run an initial price snapshot:
   ```bash
   node src/priceSync.js
   ```

7. Register the slash commands with Discord:
   ```bash
   node deploy-commands.js
   ```

8. Start the bot:
   ```bash
   node src/index.js
   ```

---

## Price Tracking

The bot automatically tracks TCGPlayer market prices for high-rarity cards (collector number > base set total) from the Scarlet & Violet era and Mega Evolution sets onwards.

**How it works:**
- **Daily at 21:00 UTC** — fetches current prices from [TCGCSV](https://tcgcsv.com) (a free public TCGPlayer data mirror) and saves a snapshot to the database
- **Weekly on Mondays at 22:00 UTC** — scans for newly released sets and adds their high-rarity cards to the tracking list automatically
- Price data includes Normal, Holofoil, and Reverse Holofoil variants where available

**What counts as high-rarity?**
Any card whose collector number exceeds the base set total — e.g. a set with 165 base cards where high-rarity cards are numbered 166–220. This captures Illustration Rares, Special Illustration Rares, Gold cards, etc.

---

## Local Development vs Production

The recommended workflow is to run a separate dev bot locally for testing and let Railway host the production bot.

### Two bots, two environments

| | Dev | Production |
|---|---|---|
| Bot name | `TCGDexDev` | `TCGDex` |
| Runs on | Your PC | Railway |
| Commands update | Instantly (guild-scoped) | Up to 1 hour (global) |
| Config | Local `.env` | Railway dashboard variables |

### Setting up the dev bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create a second application called `TCGDexDev`
2. Create a bot user for it, copy the token, and invite it to your server
3. Set your local `.env` to use the dev bot's credentials and add your `GUILD_ID`:

```env
DISCORD_TOKEN=your-dev-bot-token
CLIENT_ID=your-dev-client-id
GUILD_ID=your-server-id
DATABASE_URL=your-railway-public-database-url
```

`GUILD_ID` scopes commands to your server so they register instantly. Leave it out of Railway's variables so production commands register globally.

### Workflow

- Develop and test locally with `node src/index.js` — changes appear on `TCGDexDev` immediately
- When ready, push to GitHub — Railway automatically redeploys the production bot

---

## Deploying to Railway

[Railway](https://railway.app) is the recommended way to host the bot so it runs 24/7.

1. Push your code to a GitHub repository
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
3. Add a **PostgreSQL** database service to the project
4. Under the bot service **Variables**, add `DISCORD_TOKEN`, `CLIENT_ID`, and link `DATABASE_URL` from the Postgres service
5. Railway will build and deploy automatically — monitor logs from the dashboard

> **Note:** Run `node src/migrate.js` and `node src/syncCards.js` locally (with `DATABASE_URL` pointed at the public Railway Postgres URL) before or just after first deploy to initialise the database.

> **Note:** `deploy-commands.js` runs automatically on each Railway deploy via `railway.json`.

---

## Data Sources

### Pokémon TCG — TCGDex API
Card, set, and series data is provided by **[TCGDex](https://tcgdex.dev)**, a free and open-source Pokémon TCG database.

- **SDK:** [`@tcgdex/sdk`](https://www.npmjs.com/package/@tcgdex/sdk)
- **Docs:** [tcgdex.dev/docs](https://tcgdex.dev/docs)

### Pokémon TCG Pricing — TCGCSV
Daily TCGPlayer market price snapshots are sourced from **[TCGCSV](https://tcgcsv.com)**, a free public mirror of TCGPlayer's pricing data updated daily at ~20:00 UTC.

### Riftbound TCG — Riftcodex API
Riftbound card data is provided by **[Riftcodex](https://riftcodex.com)**, a community-built Riftbound TCG database.

- **API base URL:** `https://api.riftcodex.com`
- **Docs:** [riftcodex.com/docs](https://riftcodex.com/docs/endpoints/cards/)

---

## Dependencies

| Package | Purpose |
|---------|---------|
| [`discord.js`](https://discord.js.org) | Discord bot framework |
| [`@tcgdex/sdk`](https://tcgdex.dev) | TCGDex API client |
| [`pg`](https://github.com/brianc/node-postgres) | PostgreSQL client |
| [`node-cron`](https://github.com/node-cron/node-cron) | Scheduled jobs for daily price sync |
| [`dotenv`](https://github.com/motdotla/dotenv) | Loads environment variables from `.env` |
