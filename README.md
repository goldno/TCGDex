# TCGDex Bot

A Discord bot for looking up Pokémon Trading Card Game cards, sets, and series using the [TCGDex API](https://tcgdex.dev).

## Commands

### `/card <name>`
Look up a Pokémon TCG card by name. Supports smart search — you can include the card type and set name in your query.

**Examples:**
- `/card charizard` — shows all Charizard cards to pick from
- `/card charizard flashfire` — narrows results to cards from Flashfire
- `/card mega charizard ex` — shows only Mega/M Charizard EX cards
- `/card m gengar` — same as typing "mega gengar"
- `/card charizard ex flashfire` — Charizard EX cards from Flashfire specifically

If no exact match is found, the bot suggests similar results with a "Did you mean..." prompt.

When multiple results are returned, a dropdown menu appears showing each card's set and rarity so you can pick the right one.

---

### `/set <name or ID>`
Look up a Pokémon TCG set by name or ID.

**Examples:**
- `/set base1` — Base Set by ID
- `/set Scarlet & Violet` — by full name
- `/set flashfire` — partial name match

Returns the set's series, release date, card count, and formats it is legal in.

---

### `/series [name]`
List all Pokémon TCG series, or look up a specific one.

- `/series` — lists every series
- `/series sword shield` — shows all sets in the Sword & Shield series

---

## Setup

### Prerequisites
- [Node.js](https://nodejs.org) v18 or higher
- A Discord bot token — create one at the [Discord Developer Portal](https://discord.com/developers/applications)

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
   | `GUILD_ID` | *(Optional)* A specific server ID for instant command registration during development |

4. Register the slash commands with Discord:
   ```bash
   node deploy-commands.js
   ```

5. Start the bot:
   ```bash
   node src/index.js
   ```

---

## TCG Data — TCGDex API

All card, set, and series data is provided by **[TCGDex](https://tcgdex.dev)**, a free and open-source Pokémon TCG database.

- **API base URL:** `https://api.tcgdex.net/v2/en`
- **SDK:** [`@tcgdex/sdk`](https://www.npmjs.com/package/@tcgdex/sdk)
- **Docs:** [tcgdex.dev/docs](https://tcgdex.dev/docs)
- **GitHub:** [github.com/tcgdex](https://github.com/tcgdex)

The TCGDex API is free to use, requires no authentication, and covers cards from the Base Set (1999) through current releases in multiple languages. This bot uses the English (`en`) endpoint.

Card data includes names, types, HP, rarity, illustrator, set information, and high-resolution card images.

---

## Dependencies

| Package | Purpose |
|---------|---------|
| [`discord.js`](https://discord.js.org) | Discord bot framework |
| [`@tcgdex/sdk`](https://tcgdex.dev) | TCGDex API client |
| [`dotenv`](https://github.com/motdotla/dotenv) | Loads environment variables from `.env` |
