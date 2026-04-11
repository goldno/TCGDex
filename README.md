# TCGDex Bot

A Discord bot for looking up Pokémon and Riftbound TCG card information and market value.

---

## Commands

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

---

### Riftbound TCG

| Command | Description |
|---------|-------------|
| `/rift_card <name>` | Search for a Riftbound card by name. Optionally append a set name to filter results. Shows live TCGPlayer market prices. |

**Examples:**
- `/rift_card yasuo` — all Yasuo cards
- `/rift_card ahri spiritforged` — Ahri cards from the Spiritforged set

---

### General

| Command | Description |
|---------|-------------|
| `/help` | Shows a dropdown listing all commands with descriptions and examples. |

---

## Data Sources

| Source | Used for |
|--------|---------|
| [TCGDex](https://tcgdex.dev) | Pokémon card, set, and series data + card images |
| [TCGCSV](https://tcgcsv.com) | TCGPlayer market prices for Pokémon and Riftbound cards |
| [Riftcodex](https://riftcodex.com) | Riftbound card data |
