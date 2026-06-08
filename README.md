# ChatsKitchen — Let Chat Cook

A browser-based real-time kitchen game where Twitch chat collectively runs a restaurant. Players type commands in chat to chop, grill, fry, mix, and serve dishes before the shift timer runs out.

---

## Features

- **Twitch integration** — connect any channel and chat commands become gameplay actions
- **Local Play** — an always-live room; players scan a QR to join from their phones (works with or without Twitch, and the two can play together)
- **Cooperative chaos** — 30 recipes across 6 cuisine sets (plus ungrouped extras), 12 station types, one shared kitchen
- **Heat mechanic** — stations heat up during cooking; cool with `cool <station>` (40–60% reduction) or the team must `extinguish` if it overheats
- **Kitchen Events** — random mid-round challenges (hazards and opportunities) that the whole chat must respond to together
- **PvP mode** — split chat into Red and Blue teams competing for money in the same kitchen
- **Adventure mode** — roguelike multi-shift run; survive each shift to unlock the next
- **Star rating** — dynamic difficulty threshold calibrated to the actual number of players after each round
- **Bot simulation** — optional AI players fill in when chat is quiet
- **Configurable** — tune cooking speed, order speed, shift duration, kitchen events, and more in Options

---

## Getting Started

**Prerequisites:** Node.js 18+

```bash
git clone <repo-url>
cd ChatsKitchen
npm install
npm run dev        # → http://localhost:5173
```

Other scripts:

```bash
npm run build      # type-check + production bundle → dist/
npm run preview    # preview production build locally
npm run lint       # ESLint on all .ts/.tsx files
```

---

## How to Play

Type commands by name in chat. Spaces in ingredient names can be written as spaces or underscores. The `!` prefix is also accepted (e.g. `!chop lettuce`).

### Commands

| Command | Syntax | Station |
|---------|--------|---------|
| Chop | `chop <item>` | Chopping Board |
| Grill | `grill <item>` | Grill |
| Fry | `fry <item>` | Fryer |
| Boil | `boil <item>` | Stove |
| Toast | `toast <item>` | Oven |
| Roast | `roast <item>` | Oven |
| Stir-fry | `stirfry <item>` | Wok |
| Steam | `steam <item>` | Steamer |
| Simmer | `simmer <item>` | Stone Pot |
| Cook | `cook <item>` | Rice Pot |
| Mix | `mix <item>` | Mixing Bowl |
| Grind | `grind <item>` | Grinder |
| Knead | `knead <item>` | Knead Board |
| Serve | `serve <order#>` | — |
| Cool | `cool <station>` | — |
| Extinguish | `extinguish <station>` | — |

**Shortform aliases** (enable in Options): `c`, `g`, `f`, `b`, `t`, `r`, `sf`, `sm`, `si`, `ck`, `mx`, `gr`, `kn`, `cl`, `s` map to chop, grill, fry, boil, toast, roast, stirfry, steam, simmer, cook, mix, grind, knead, cool, serve.

### Gameplay flow

1. An order appears with a dish name and patience timer.
2. Cook the required ingredients at the appropriate stations.
3. Finished ingredients are automatically deposited into the shared prepared-items pool.
4. Once all required ingredients are in the pool, type `serve <order#>`.

Each player can only work one station at a time and has a 1.5-second command cooldown.

### Recipes

Steps marked `→` require the prior ingredient in the pool first. Steps joined by `+` can be done in any order.

**Western Classics 🇺🇸**

| Dish | Steps | Reward |
|------|-------|--------|
| 🍔 Burger | `chop lettuce` + `grill patty` + `toast bun` | $65 |
| 🐟 Fish & Chips | `chop potato` → `fry potato` + `fry fish` | $60 |
| 🥪 Grilled Cheese | `grill cheese` + `toast bread` | $40 |
| 🫑 Roasted Veggies | `chop tomato` + `chop pepper` → `roast pepper` | $55 |

**Chinese Kitchen 🇨🇳**

| Dish | Steps | Reward |
|------|-------|--------|
| 🍳 Fried Rice | `cook rice` → `stirfry rice` + `stirfry egg` | $55 |
| 🍛 Stir-Fried Pork | `chop pork` → `stirfry pork` + `chop spring_onion` | $65 |
| 🧈 Steamed Tofu | `chop tofu` → `steam tofu` + `chop spring_onion` | $45 |
| 🥟 Steamed Buns | `chop cabbage` + `steam bun` | $55 |

**Korean Kitchen 🇰🇷**

| Dish | Steps | Reward |
|------|-------|--------|
| 🥩 Bulgogi | `chop beef` → `grill beef` + `chop spring_onion` | $70 |
| 🥘 Kimchi Jjigae | `chop kimchi` → `simmer kimchi` + `chop tofu` | $65 |
| 🍗 Korean Fried Chicken | `chop chicken` → `fry chicken` + `mix gochujang` | $75 |
| 🌶️ Tteokbokki | `chop tteok` + `mix gochujang` → `boil tteok` | $65 |

**Japanese Kitchen 🇯🇵**

| Dish | Steps | Reward |
|------|-------|--------|
| 🍣 Sushi Roll | `cook rice` + `chop tuna` + `toast nori` | $70 |
| 🍤 Tempura | `chop shrimp` → `fry shrimp` | $65 |
| 🥚 Chawanmushi | `chop egg` → `steam egg` + `chop shrimp` | $55 |
| 🍱 Salmon Donburi | `cook rice` + `chop salmon` + `chop nori` | $75 |

**Japanese Bakery 🇯🇵**

| Dish | Steps | Reward |
|------|-------|--------|
| 🥐 Shio Pan | `knead dough` → `toast dough` | $50 |
| 🍪 Melon Pan | `knead dough` → `toast dough` + `mix topping` | $65 |
| ☕ Pour-Over Coffee | `grind beans` + `boil water` | $45 |
| 🍵 Matcha Latte | `mix matcha` + `steam milk` | $55 |

**SG Hawker Breakfast 🇸🇬**

| Dish | Steps | Reward |
|------|-------|--------|
| 🍞 Kaya Toast | `toast bread` + `mix kaya` | $40 |
| 🍜 Economic Bee Hoon | `fry chicken_wing` + `stirfry bee_hoon` + `stirfry cabbage` + `fry egg` | $65 |
| 🫓 Roti Prata | `knead prata` → `grill prata` + `boil curry` | $55 |
| 🍱 Nasi Lemak | `cook rice` + `mix sambal` + `fry anchovies` + `fry egg` | $75 |

**Others**

| Dish | Steps | Reward |
|------|-------|--------|
| 🍟 Fries | `chop potato` → `fry potato` | $40 |
| 🌭 Hot Dog | `grill sausage` + `chop onion` + `toast bun` | $45 |
| 🥗 Caesar Salad | `chop lettuce` + `chop tomato` + `toast crouton` | $35 |

Each dish also earns a time bonus of up to +$30 based on how much patience the order had remaining when served.

### Heat & Overheat

Stations heat up **gradually during cooking** — heat is applied incrementally as each cook progresses, contributing a random 10–20% per full cook (rolled when cooking starts). The station border colour shows the current level: green (safe) → yellow → orange → red (critical). Type `cool <station>` to reduce heat by a random 40–60% (requires not currently cooking).

At 100% the station overheats: all active cooks are cancelled and the station locks. At least 50% of that round's players must type `extinguish <station>` to vote it back online. Heat resets to 0 once extinguished.

The chopping board, mixing bowl, grinder, and knead board are exempt from heat and never overheat.

### Order Spawning

If the queue is cleared, a new order spawns immediately and the spawn rate doubles for 10 seconds to keep the pressure on.

---

## Game Modes

### Free Play

Sandbox mode. Configure duration (1–9 min, default 3 min), cooking speed, order urgency, order frequency (all 0.25×–3.0×), station slot capacity, kitchen events, and which recipes can appear. The recipe select screen includes a **Selected** panel with Remove All, Select All, and Random 3 shortcuts. Good for practice and casual streaming.

Order capacity and spawn rate scale dynamically during the game based on the number of active players, so the kitchen stays challenging as more viewers join.

### PvP Mode

Split chat into Red and Blue teams. Each team has its own prep tray and earns money independently. The team with more money at the end wins. Join via `!red`, `!blue`, `!join`, `!join red`, or `!join blue` in the lobby.

### Adventure Mode

A roguelike multi-shift run. Each shift must meet a money goal to unlock the next. Fail a shift and the run ends. Recipes and difficulty scale as you progress through shifts.

---

## Twitch Integration

From the Main Menu, enter a channel name in the **Twitch Connect** card on the right panel and click **Connect**. Once connected:

- Live chat messages appear in the game's chat panel.
- Any message starting with `!` is parsed as a game command.
- The UI shows the connected channel and connection status.

The game can also be played locally without Twitch using the built-in chat input.

---

## Options

| Setting | Effect |
|---------|--------|
| Cooking Speed | Multiplier for how fast items cook (higher = faster) |
| Order Speed | Multiplier for how fast order patience drains (higher = faster) |
| Order Spawn Rate | How frequently new orders arrive |
| Round Duration | Length of a free play shift |
| Chopping Slots | Max concurrent items on the chopping board and mixing bowl |
| Cooking Slots | Max concurrent items per cooking station |
| Restrict Slots | Enforce slot limits (off = unlimited) |
| Enabled Recipes | Which dishes can appear as orders |
| Kitchen Events | Toggle events on/off; configure which event types and frequency |
| Auto-Restart | Automatically start a new round after game over (Free Play only) |
| Shortform Commands | Allow single-letter command aliases |
| Theme | Dark or Light mode |
| Mobile Friendly | Increases base text size for easier reading on phones and tablets |

Audio settings, display preferences, and high scores persist in the browser. A full reset is available at the bottom of Options.

---

## Tech Stack

| | |
|--|--|
| Framework | React 18 + TypeScript |
| Build | Vite 5 |
| State | React `useReducer` (no Redux) |
| Chat | tmi.js |
| Local Play | socket.io (client) ↔ a thin Fly.io relay server (`server/`) |
| Audio | Howler.js |
| Styles | CSS Modules |

The game simulation runs entirely in the browser; nothing about a live game is persisted and there is no database. Local Play adds a small **socket.io relay server** (`server/`, deployed to Fly.io) that only brokers messages between the host browser and players' phones — it holds no game logic. The client resolves the relay URL from `VITE_RELAY_URL` (defaults to `http://localhost:8080`).

---

## Project Structure

```
src/
├── App.tsx                    # Screen routing and top-level state (host game)
├── main.tsx                   # Entry: renders App, or the Controller on /play
├── state/
│   ├── gameReducer.ts         # All game logic (single source of truth)
│   ├── commandProcessor.ts    # Parses chat input → GameAction
│   ├── snapshot.ts            # Serialises GameState for Local Play phones
│   └── types.ts               # TypeScript interfaces
├── hooks/
│   ├── useGameLoop.ts         # 100ms tick loop
│   ├── useTwitchChat.ts       # tmi.js client lifecycle
│   ├── useRoomHost.ts         # Local Play host: relay socket + snapshots
│   ├── useBotSimulation.ts    # AI bot players
│   └── useKitchenEvents.ts    # Kitchen event lifecycle
├── controller/                # Phone-player app served at /play (join/lobby/vote)
├── components/                # React UI components (PascalCase)
├── data/                      # Recipes, events, Adventure content, RNG (pure)
├── audio/                     # Howler-based AudioManager + game audio hook
└── shared/                    # protocol.ts — wire types shared with the server
server/                        # Standalone socket.io relay (Fly.io); no game logic
├── src/relay.ts               # createRelay() — rooms, join/lock, rate limit
└── src/relay.test.ts          # Vitest integration + rate-limiter tests
public/icons/                  # SVG icons for dishes/ and ingredients/
docs/
├── GAME-DESIGN-AND-MECHANICS.md  # Full design reference
├── DESIGN.md                     # Design overview
├── PRODUCT.md                    # Product overview
├── MULTIPLAYER_SPEC.md           # Local Play / relay design spec
├── TESTING.md                    # Testing guide & plan
└── Kitchen Events.md             # Kitchen events system reference
```

---

## Development

```bash
npm run lint     # run before committing
npm run build    # catches TypeScript errors
```

- Always develop on a branch, never directly on `main`.
- Tests run on [Vitest](https://vitest.dev/): `npm test` runs the client suite (the pure `state/` + `data/` layers); `npm test` inside `server/` runs the relay suite. CI (`.github/workflows/ci.yml`) gates lint + tests + build on every push/PR. Hooks and components aren't covered yet — add React Testing Library when they need it. See [`docs/TESTING.md`](docs/TESTING.md).
- All game logic lives in `src/state/gameReducer.ts`. Never mutate `GameState` directly — the reducer must return a new object.
- Food icons use `FoodIcon.tsx` which renders `<img>` for `/`-prefixed paths and `<span>` for emoji strings — drop SVGs into `public/icons/` and update the `emoji` field in `recipes.ts` to use the path.

For a deeper look at design decisions, see [`docs/GAME-DESIGN-AND-MECHANICS.md`](docs/GAME-DESIGN-AND-MECHANICS.md).
