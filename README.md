# TCGDex Bot

A Discord bot for looking up Pokémon and Riftbound Trading Card Game cards, sets, and series.

## Commands

All commands have aliases — e.g. `/pokemon_card` can also be called via `/poke_card` or `/pkm_card`.

### Pokémon TCG

| Command | Aliases | Description |
|---------|---------|-------------|
| `/pokemon_card <name>` | `/poke_card`, `/pkm_card` | Search for a Pokémon TCG card. Supports smart input — include a card type suffix (ex, gx, v, vmax, mega) and/or set name. |
| `/pokemon_set <name or ID>` | `/poke_set`, `/pkm_set` | Look up a Pokémon TCG set by name or ID (e.g. `base1`, `flashfire`). |
| `/pokemon_series [name]` | `/poke_series`, `/pkm_series` | List all TCG series, or look up a specific one by name. |

**Pokémon card search examples:**
- `/pokemon_card charizard` — all Charizard cards
- `/pokemon_card charizard flashfire` — Charizard cards from Flashfire
- `/pokemon_card mega charizard ex` — Mega/M Charizard EX only
- `/pokemon_card charizard ex flashfire` — card type + set combined

---

### Riftbound TCG

| Command | Aliases | Description |
|---------|---------|-------------|
| `/riftbound_card <name>` | `/rb_card`, `/rift_card` | Search for a Riftbound card by name. Optionally append a set name to filter results. |

**Riftbound card search examples:**
- `/riftbound_card yasuo` — all Yasuo cards
- `/riftbound_card ahri spiritforged` — Ahri cards from the Spiritforged set

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
3. Under **Variables**, add `DISCORD_TOKEN` and `CLIENT_ID`
4. Railway will build and deploy automatically — monitor logs from the dashboard

> **Note:** You do not need a `.env` file on Railway. `GUILD_ID` is only needed locally.

> **Note:** Slash commands only need to be registered once with `node deploy-commands.js` from your local machine.

---

## Data Sources

### Pokémon TCG — TCGDex API
All Pokémon card, set, and series data is provided by **[TCGDex](https://tcgdex.dev)**, a free and open-source Pokémon TCG database.

- **SDK:** [`@tcgdex/sdk`](https://www.npmjs.com/package/@tcgdex/sdk)
- **Docs:** [tcgdex.dev/docs](https://tcgdex.dev/docs)

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
| [`dotenv`](https://github.com/motdotla/dotenv) | Loads environment variables from `.env` |
