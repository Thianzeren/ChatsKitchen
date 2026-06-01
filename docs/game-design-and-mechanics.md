# Let Chat Cook: Game Design And Mechanics

## Overview

Let Chat Cook is a livestream-friendly kitchen coordination game where a streamer and their audience work together to complete food orders in real time. The core fantasy is simple: chat becomes the kitchen crew.

The game is built around short, high-energy rounds where players type commands to prepare ingredients and serve orders before time runs out. It is designed to feel readable on stream, easy to join quickly, and chaotic in a fun way when multiple people are participating.

## Design Goals

### 1. Make chat participation immediate

Players should be able to join by typing a short command without learning a deep control scheme. The game uses simple text verbs such as `chop`, `grill`, `cool`, and `serve`.

### 2. Encourage cooperation

Most dishes require multiple steps across different stations. That means one person can start a task, another can take the finished ingredient, and someone else can plate or serve the final dish.

### 3. Create readable kitchen chaos

The game is meant to be busy, but not unreadable. UI panels, order tickets, the commands panel, the tutorial, and station-specific visuals are all there to keep the chaos understandable.

### 4. Support both sandbox and progression play

The game supports:

- `Free Play`, where the player can tune settings such as speeds and order frequency
- `Adventure`, a roguelike multi-shift run where each shift must hit a money goal to continue
- `PvP Mode`, where chat splits into two competing teams

## Core Game Loop

Each round follows the same basic loop:

1. Orders spawn over time.
2. Players read the requested dish and identify the needed ingredients.
3. Players type cooking commands in chat to process those ingredients at the correct stations.
4. Finished ingredients move automatically into the prepared-items pool.
5. A player serves the dish to the correct order number once all required ingredients are ready.
6. The team earns money based on the dish value and how quickly it was delivered.

This loop repeats until the round timer expires.

## Main Modes

## PvP Mode

PvP Mode splits the chat into two teams — Red and Blue — competing to earn more money by the end of the shift. Both teams share the same kitchen, stations, and order queue. The competition comes from ownership: each team's cooked ingredients land in their own prep pool, and only their players can use those items to serve orders.

### Joining a team

Before the game starts, the streamer opens the **PvP Lobby** screen. Players type in chat:

| Command | Effect |
|---------|--------|
| `!red` | Join Red Team (moves if already on Blue) |
| `!blue` | Join Blue Team (moves if already on Red) |
| `!join red` | Join Red Team directly |
| `!join blue` | Join Blue Team directly |
| `!join` | Auto-join the team with fewer players (only if not already on a team) |

Players can only join once — switching teams after joining is not allowed in the lobby unless the streamer moves them.

### Lobby controls (streamer / mods)

The streamer has full control over the roster:

| Command | Effect |
|---------|--------|
| `!balance` | Randomly redistributes all joined players evenly across both teams |
| `!move red @name` / `!move blue @name` | Moves a specific player to the named team |

Players can also be moved by dragging their name card between the Red and Blue panels in the lobby UI.

### Gameplay in PvP

When the game starts, each team cooks independently:

- Cooking commands route the finished ingredient to the cooking player's team prep pool
- Orders can only be served using ingredients from the serving player's team's pool
- Money, served count, and stats are tracked per team

All stations are shared — both teams compete for the same limited slots. Kitchen events and heat affect everyone equally.

The **extinguish threshold** in PvP is based on the larger team: `ceil(max(redSize, blueSize) × 0.5)`.

### Winner banner

The game over screen shows a winner banner at the top based on final money totals:

- 🔴 RED WINS! / 🔵 BLUE WINS! — if one team earned more
- TIE — if both teams ended with the same amount

Each team's final money and served count appear below the banner. The normal per-player leaderboard and round history remain below.

## Free Play

Free Play is the flexible mode. Parameters are configured directly in the Free Play setup screen via sliders and editable inputs:

| Parameter | Default | Range | Step |
|-----------|---------|-------|------|
| Duration | 3 min | 1–9 min | 1 min |
| Cooking Speed | 1.0× | 0.25×–3.0× | 0.25× |
| Order Urgency | 1.0× | 0.25×–3.0× | 0.25× |
| Order Frequency | 1.0× | 0.25×–3.0× | 0.25× |
| Auto-Restart | OFF | ON / OFF | — |
| Restart Delay | 60 s | 10–300 s | 10 s |

Auto-Restart and Restart Delay are found in the More Options panel. When Auto-Restart is on, the game over screen displays a countdown and automatically begins a new round when it reaches zero. Moderators and the broadcaster can also control this live from chat (see Mod Commands below).

It is the best mode for experimenting, practicing, or playing casually with chat.

## Adventure Mode

Adventure is the roguelike campaign — a **Balatro-inspired 8-shift run** where chat builds up a single restaurant over a series of shifts. Each shift sets a money goal; hit it and the run continues, miss it and the run is over. Between shifts, chat collectively grows the menu by drafting a new dish, then shops the Pantry for permanent upgrades.

The fantasy is a single escalating night service that gets harder, weirder, and more rewarding the deeper chat pushes.

### Run Structure

A run is **8 shifts long**, each a fixed **3-minute** service. Shift duration never changes — the money goal is the single difficulty knob.

| Shift | Recipes on menu | Notes |
|-------|----------------|-------|
| 1 | 1 | Opening draft dish; no kitchen events |
| 2 | 2 | Between-shift recipe add |
| 3 | 3 | **Kitchen events begin** |
| 4 | 4 | **BOSS shift** (auto-assigned) |
| 5–8 | 5–8 | Menu keeps growing each shift; shift 8 is the **FINAL BOSS** |

The run opens with a **mandatory recipe draft**: chat picks 1 dish from 3 all-cuisine options. Between every cleared shift, chat adds 1 more dish from 3 all-cuisine options, or votes `!skip`. All owned recipes are active — orders spawn from the entire menu. Cuisine tags are cosmetic flavour labels and have no mechanical effect on gameplay.

### Money Goals & Crew Scaling

Every shift's goal is **per-player**, then multiplied by the crew size:

```
shift goal = perPlayerGoal[shift] × participantCount
```

This keeps the pressure-per-person constant whether one person or fifty are cooking. The per-player baselines are `[20, 35, 50, 70, 85, 110, 140, 200]` — a monotonic ramp on the cafe price scale. Boss shifts (4 and 8) are elevated points on that ramp, but the curve never dips after them; bosses apply their own debuffs rather than a baked-in goal multiplier.

Participant count is read from the Adventure lobby roster at run start, and re-counted at each shift boundary so mid-run `!join` / `!leave` / `!kick` changes are reflected in the next goal.

### The Between-Shift Loop

Each cleared shift flows through a short series of voting screens before the next one begins:

```
shift cleared → Shift Passed (leaderboard) → Recipe Pick → Pantry Shop → next Shift Briefing
```

1. **Shift Passed** — shows the run leaderboard and shift result.
2. **Recipe Pick** — chat votes to add a new dish from 3 all-cuisine options, or `!skip`.
3. **Pantry Shop** — chat votes to spend the shared run bank on permanent garnishes.
4. **Briefing** — the next shift's goal, active menu, and any boss debuff are previewed, then service begins.

All voting screens use plurality voting: chat types `!1`, `!2`, … `!N` and the option with the most votes wins when the timer expires (or the streamer resolves early).

### The Lobby

Adventure has its own pre-run lobby. Only the local "You" auto-joins — the broadcaster and viewers must opt in themselves.

| Command | Effect |
|---------|--------|
| `!join` | Join the run roster |
| `!leave` | Leave the roster |
| `!kick @name` | Remove a player (mod / broadcaster only) |
| `!clear` | Empty the roster (mod / broadcaster only) |

The roster size becomes the run's participant count, which drives both goal scaling and shop pricing.

### Bosses

Bosses are shift-long debuffs that reshape the kitchen. On shifts 4 and 8 a boss is **auto-assigned** — there is no vote. The boss is previewed on the shift briefing so the team can prepare. The current roster:

| Boss | Effect |
|------|--------|
| 🧐 The Picky Critic | Every served dish pays 25% less |
| ⏱️ Rush Hour | Orders spawn 50% faster and patience drains ~10% sooner |
| 📋 The Health Inspector | One station is shut down for the whole shift |
| 👥 Understaffed | Per-action cooldown is 50% longer — the line crawls |
| 🥵 Heatwave | Heat builds 50% faster and cooling pulls 10 less heat |
| 🌪️ Chaos Mode | Kitchen events spawn ~3× more often (cadence tightens to 20–40s) |
| 🎲 Recipe Roulette | Every 45s, one active recipe is swapped for a random dish |
| 😤 Hangry Mob | Every order arrives with ~30% less patience |
| ⭐ Bad Reviews | Every lost or expired order deducts $20 from the run bank |

The chosen boss's debuff is previewed on the briefing screen (e.g. the Health Inspector's closed station is named in advance) and layered into that shift's setup.

### The Pantry Shop & Garnishes

After every path pick, chat visits the **Pantry** to spend the shared run bank on **garnishes** — permanent, run-long upgrades. The shop offers **4 garnishes per visit**, drawn from a 24-garnish, tier-graded catalog (common / rare / legendary).

#### Archetype-build system

Garnishes are designed around six **recipe archetype tags** that describe the dishes chat has drafted into the menu:

| Tag | Dishes it targets | Example garnishes |
|-----|------------------|-------------------|
| `premium` | High-value dishes | Fine Dining (+25% premium reward), Michelin Star (+75% premium reward) |
| `value` | Low-cost accessible dishes | Penny Pincher (+$3 flat per value dish) |
| `fast` | Quick-cooking dishes | Drive-Thru (+35% fast dish reward) |
| `slow` | Long-cook dishes | Worth the Wait (2× reward for slow dishes) |
| `prep_heavy` | Multi-step dishes | Cold Kitchen (+$4 per prep-heavy dish) |
| `hot_line` | Grill/fry-forward dishes | Fire Whisperer (+30% hot-line reward) |

Neutral garnishes benefit any build: Quick Hands (cooking speed), Patient Diners (patience), Tip Jar (flat tip), Heat Sink (cooling), Snowball (compound speed per shift survived), Doppelgänger (20% ingredient duplicate).

The key strategic tension: chat's between-shift **recipe draft** shapes which archetype tags are represented on the menu, and the garnish shop rewards leaning into those tags. A run that drafts premium and slow dishes gets far more out of Michelin Star and Worth the Wait than a run that goes wide.

#### Shop rules

- Every garnish is **one-shot** — it can be bought only once and never reappears in the shop.
- Purchases are **not** replenished within a visit; buying one leaves the other three offers on the menu.
- Prices are on a cafe scale: common ~$25–30, rare ~$50–65, legendary ~$95–125 (scaled linearly with crew size).
- Shop offers are **tier-weighted by the upcoming shift** — mostly common early, rising rare/legendary as the run deepens. **Boss shops** (before shifts 4 & 8) spike toward rare and legendary to give chat a meaningful power jump before the hardest shifts.
- Chat can **reroll** the offers for a fresh set of 4. Reroll cost is `$25 × 2^(rerolls this visit) × participantCount` — it doubles each time and resets when the shop reopens.

#### Effect mechanisms

Garnish effects fire via three mechanisms and compose on top of the active boss debuff:

1. **`applyServeTriggers`** — data-driven serve-triggers keyed off `getRecipeProfile`. Tag- and timing-gated reward multipliers and flat bonuses that fire at the moment a dish is served (e.g. Fine Dining, Drive-Thru, Worth the Wait).
2. **`applyAllGarnishes`** — stat effects applied at shift setup: cooking speed, patience duration, cooling amount, flat tip per dish, chopping time reduction, overheat threshold adjustment.
3. **Bespoke hooks** — one-of-a-kind triggered effects: First Bite (3× first dish per shift), Time Is Money (patience-scaled reward), Bloodhound ($12 per overheat event), Doppelgänger (20% chance to duplicate a cooked ingredient), Mise en Place (shift starts with prepped ingredients), Glass Kitchen (lower overheat threshold + dish bonus), Snowball (compounding speed per shift survived).

### Kitchen Events in Adventure

Kitchen events are **off** for shifts 1–2 and turn **on from shift 3 onward**, using a curated mid-run mix (Angry Chef, Smoke Blast, Mystery Recipe, Dance, Chef's Chant) on a relaxed 60–120s cadence calibrated for stream pacing. The **Chaos Mode** boss overrides this to a frantic 20–40s cadence.

### Winning, Losing & Persistence

- **Clearing shift 8** wins the run.
- **Missing any shift's goal** ends the run immediately at the run-end screen.
- The **best run** (furthest shift, then most total money as a tiebreaker) and a running count of **won runs** are saved to the browser and persist between sessions.
- The full run is **auto-saved at every shift boundary**. If the browser is closed mid-run, a Resume pill on the mode hub restores it — it reopens the Adventure lobby (Manage the Crew) so players can re-join, then continues to the upcoming shift's briefing. Saved state is cleared when the run ends (win or fail). Mid-shift cooking state is never saved — resuming always restarts at a briefing.

## Orders And Scoring

An order contains:

- an order number
- the requested dish
- a patience timer
- a money value

Serving an order grants:

- the recipe’s base reward
- a time bonus based on how much patience remained

This means fast service is rewarded, not just successful service.

## Recipes And Food Structure

Recipes are built from step-based ingredient preparation. Each dish defines:

- the visible dish name and emoji
- a base reward
- patience
- a list of cooking/prep steps
- the exact set of prepared ingredients needed for plating

Examples:

- `Burger`: chop lettuce, grill patty, toast bun, then serve
- `Fries`: chop potato → fry potato (requires chopped potato), then serve
- `Bulgogi`: chop beef → grill beef, chop spring onion, then serve
- `Fried Rice`: cook rice → stirfry rice + stirfry egg, then serve

Some steps require a previously prepared ingredient. For example, fries require chopped potato before frying, and bulgogi requires sliced beef before grilling. These are marked with `→` in the recipe reference.

## Stations

The kitchen is divided into nine station types, each tied to specific commands:

- `Chopping Board` for `chop`
- `Grill` for `grill`
- `Fryer` for `fry`
- `Stove` for `boil`
- `Oven` for `toast` and `roast`
- `Wok` for `stirfry`
- `Steamer` for `steam`
- `Stone Pot` for `simmer`
- `Rice Pot` for `cook`
- `Mixing Bowl` for `mix`
- `Grinder` for `grind`
- `Knead Board` for `knead`
- `Wok` for `stir`
- `Steamer` for `steam`
- `Stone Pot` for `simmer`
- `Rice Pot` for `cook`

Only stations required by the currently enabled recipes are rendered — unused stations do not appear in the kitchen.

Stations accept any number of simultaneous cooking slots — there is no per-station capacity limit. Multiple players can queue actions at the same station at once, and slots stack vertically as they cook. The only thing that takes a station offline is overheating.

## Command System

The command system is the main input method for chat participation. Commands are entered by name — no prefix required. The `!` prefix is also accepted (e.g. `!chop lettuce`), making it natural for Twitch chat users. The currently supported commands are:

| Command | Syntax | Description |
|---------|--------|-------------|
| `chop` | `chop <item>` | Chop an ingredient at the chopping board |
| `grill` | `grill <item>` | Grill an ingredient |
| `fry` | `fry <item>` | Fry an ingredient |
| `boil` | `boil <item>` | Boil an ingredient on the stove |
| `toast` | `toast <item>` | Toast an item in the oven |
| `roast` | `roast <item>` | Roast an item in the oven |
| `stirfry` | `stirfry <item>` | Stir-fry an ingredient in the wok |
| `steam` | `steam <item>` | Steam an ingredient |
| `simmer` | `simmer <item>` | Simmer an ingredient in the stone pot |
| `cook` | `cook <item>` | Cook rice in the rice pot |
| `serve` | `serve <order#>` | Serve a completed dish to an order |
| `cool` | `cool <station>` | Reduce a station's heat by 40–60% (random per use) |
| `extinguish` | `extinguish <station>` | Vote to restore an overheated station (requires 50% of active players) |
| `mix` | `mix <item>` | Mix an ingredient in the mixing bowl |
| `grind` | `grind <item>` | Grind an ingredient in the grinder |
| `knead` | `knead <item>` | Knead dough on the knead board |
| `red` | `!red` | Join Red Team (PvP lobby only) |
| `blue` | `!blue` | Join Blue Team (PvP lobby only) |
| `join red` | `!join red` | Join Red Team directly (PvP lobby only) |
| `join blue` | `!join blue` | Join Blue Team directly (PvP lobby only) |
| `join` | `!join` | Auto-join the smaller team if not already on one (PvP lobby only) |

### Mod / Broadcaster Commands

Certain commands are reserved for Twitch moderators and the broadcaster (or the local chat input, which is always granted broadcaster-level access). These commands control the game session rather than the kitchen, and are processed before normal cooking commands.

| Command | Valid during | Effect |
|---------|-------------|--------|
| `!start` | Game over screen (Free Play) | Immediately starts a new round, skipping any remaining countdown |
| `!onAutoRestart` | Playing, Game over | Enables auto-restart |
| `!offAutoRestart` | Playing, Game over | Disables auto-restart and cancels any active countdown |
| `!exit` | Playing | Ends the round and triggers the normal shift-end → game-over flow |
| `!balance` | PvP lobby | Randomly distributes all joined players evenly across both teams |
| `!move red @name` / `!move blue @name` | PvP lobby | Moves a joined player to the specified team |

When a mod command fires, a brief toast notification appears on screen for the streamer and viewers to see. The game over screen also always shows the available commands as a reference, regardless of whether auto-restart is on or off.

### Shortform aliases

When shortform commands are enabled in Options, single-letter aliases can be used:

| Alias | Expands to |
|-------|-----------|
| `c` | `chop` |
| `g` | `grill` |
| `f` | `fry` |
| `b` | `boil` |
| `t` | `toast` |
| `r` | `roast` |
| `sf` | `stirfry` |
| `sm` | `steam` |
| `si` | `simmer` |
| `ck` | `cook` |
| `mx` | `mix` |
| `gr` | `grind` |
| `kn` | `knead` |
| `cl` | `cool` |
| `s` | `serve` |

### Command flow

The intended flow is:

1. Start preparation with a cooking command.
2. Wait for the ingredient to finish — completed ingredients are automatically deposited into the prepared-items pool from all stations.
3. Use `serve <order#>` once all required ingredients for that order are in the pool.

## Player Constraints And Team Dynamics

The game intentionally limits what one user can do at once.

### Busy state

A user cannot keep starting new work while already committed to an active station task. This prevents a single chatter from dominating the entire kitchen and pushes the team toward shared execution.

### Cooldown

There is a short per-user command cooldown to reduce spam and accidental repeated actions.

### Shared kitchen state

Prepared ingredients, active stations, and orders all exist in a shared state. This is what makes the game collaborative: everyone is acting on the same kitchen.

## Heat And Failure Pressure

Each cooking slot at a non-chopping station contributes a random amount of heat (10–20%) when fully cooked, applied incrementally as cooking progresses. Heat is visible on the station's border colour: green (cool) → yellow → orange → red (critical).

Players can type `cool <station>` (e.g. `cool grill`) to reduce a station's heat by a random 40–60%. There is a per-user cooldown, so the team needs to spread this responsibility.

When heat reaches 100%, the station **overheats**:

- all active slots are destroyed and assigned players are freed
- the station is locked and cannot accept new commands
- players must collectively type `extinguish <station>` — at least 50% of that round's active players must vote before the station is restored
- the station returns to 0% heat once extinguished

The chopping board is exempt from heat accumulation and never overheats.

This mechanic adds pressure and team coordination beyond recipe execution. Ignoring heat forces the whole team to stop and extinguish together.

## Rush Orders

Any order spawn has a 25% chance of being a rush order (capped at one active rush at a time). Rush orders are marked with a ⚡ badge and an amber glow.

Rush order properties compared to a standard order of the same dish:

- Patience is halved (50% of normal)
- Reward is multiplied by 1.75×
- Rush orders pin to the top of the order queue

Rush orders are high-risk, high-reward: they expire faster but pay out significantly more if served quickly.

## UI Structure

The game is designed to remain understandable even during busy rounds.

### Main Menu

The Main Menu is the **connection screen**. The left side holds the primary actions — **Play** (opens the mode hub), **Tutorial**, **Options**, **Feedback**, and **Credits**. The right side is "How players join":

- **Twitch chat** — connect a channel and chat plays the game.
- **Local Play** — an always-live room; players scan the QR (or visit `/play`) to join from their phones.

The two combine (co-play): a Local Play room is always running, and an attached Twitch channel plays alongside the phone crew. **Play** opens the **mode hub** ("Choose a mode": Free Play / Adventure / PvP), where the actual mode is picked.

### Tutorial Flow

The tutorial system is meant to lower the learning curve without forcing a long onboarding sequence.

Current tutorial behavior:

- the **Tutorial** button on the main menu starts the interactive tutorial round directly
- there is no separate tutorial prompt before entering a mode — Tutorial is an explicit choice on the menu

### Gameplay HUD

The gameplay screen includes:

- the main game logo
- a mode indicator showing either `Level X` or `Free Play`
- score and round stats
- Twitch connection indicator
- chat toggle
- bot toggle
- audio controls
- an exit button

### Commands & Recipes panel

An expandable reference panel shows valid commands, shorthand hints, and recipe breakdowns. This helps first-time chat participants join quickly without leaving the game view.

## Twitch Integration

Twitch integration is a major part of the design identity.

When connected:

- live Twitch chat messages are read into the game
- commands from chat become gameplay actions
- the UI shows connected-channel status
- moderators and the broadcaster have access to session-control commands (`!start`, `!exit`, `!onAutoRestart`, `!offAutoRestart`)

When disconnected:

- Twitch is optional — the menu notes that connecting a channel lets chat play too
- the game still plays via Local Play (phone controllers) and the local chat input
- the local chat input is always treated as broadcaster-level for mod commands

## Audio And Feedback

Audio settings are split into music and sound effects. This lets streamers balance the game against their broadcast mix.

The game also gives frequent textual feedback through kitchen messages such as:

- action success
- missing ingredient errors
- station full errors
- fire warnings
- serve rewards

These messages reinforce what the team should do next.

## Reset And Persistence Model

The project currently uses lightweight local browser storage.

Persisted data includes:

- audio settings
- level progress
- Free Play game options (duration, speeds, recipes, station slots, auto-restart settings)

Session-level or resettable state includes:

- tutorial prompt suppression
- Twitch connection state

There is also a full reset flow in Options that restores the game to a clean default state.

## Recipe Reference

Steps marked `→` require the prior ingredient in the prepared-items pool before they can start. Steps joined by `+` can be done in any order.

### Western Classics 🇺🇸

| Dish | Steps | Reward | Patience |
|------|-------|--------|---------|
| 🍔 Burger | `chop lettuce` + `grill patty` + `toast bun` | $65 | 80s |
| 🐟 Fish & Chips | `chop potato` → `fry potato` + `fry fish` | $60 | 75s |
| 🧀 Grilled Cheese | `grill cheese` + `toast bread` | $40 | 55s |
| 🫑 Roasted Veggies | `chop tomato` + `chop pepper` → `roast pepper` | $55 | 75s |

### Chinese Kitchen 🇨🇳

| Dish | Steps | Reward | Patience |
|------|-------|--------|---------|
| 🍳 Fried Rice | `cook rice` → `stirfry rice` + `stirfry egg` | $55 | 75s |
| 🥢 Stir-Fried Pork | `chop pork` → `stirfry pork` + `chop spring_onion` | $65 | 80s |
| 🧈 Steamed Tofu | `chop tofu` → `steam tofu` + `chop spring_onion` | $45 | 65s |
| 🥟 Steamed Buns | `chop cabbage` + `steam bun` | $55 | 70s |

### Korean Kitchen 🇰🇷

| Dish | Steps | Reward | Patience |
|------|-------|--------|---------|
| 🥩 Bulgogi | `chop beef` → `grill beef` + `chop spring_onion` | $70 | 85s |
| Kimchi Jjigae | `chop kimchi` → `simmer kimchi` + `chop tofu` | $65 | 80s |
| Doenjang Jjigae | `chop zucchini` → `simmer zucchini` + `chop tofu` | $60 | 75s |
| 🍱 Bibimbap | `cook rice` + `chop beef` → `simmer beef` | $75 | 90s |

### Japanese Kitchen 🇯🇵

| Dish | Steps | Reward | Patience |
|------|-------|--------|---------|
| 🍣 Sushi Roll | `cook rice` + `chop tuna` + `chop nori` | $70 | 85s |
| 🍤 Tempura | `chop shrimp` → `fry shrimp` + `chop zucchini` | $65 | 80s |
| 🥚 Chawanmushi | `chop egg` → `steam egg` + `chop shrimp` | $55 | 70s |
| 🍱 Salmon Donburi | `cook rice` + `chop salmon` + `chop nori` | $75 | 90s |

### Others (ungrouped)

| Dish | Steps | Reward | Patience |
|------|-------|--------|---------|
| 🍟 Fries | `chop potato` → `fry potato` | $40 | 55s |
| 🌭 Hot Dog | `grill sausage` + `chop onion` + `toast bun` | $45 | 55s |
| 🥗 Caesar Salad | `chop lettuce` + `chop tomato` + `toast crouton` | $35 | 50s |

## Station Reference

| Station | Command(s) | Heat |
|---------|-----------|------|
| 🔪 Chopping Board | `chop` | exempt — never overheats |
| 🔥 Grill | `grill` | +20% per cook |
| 🫕 Fryer | `fry` | +20% per cook |
| ♨️ Stove | `boil` | +20% per cook |
| 🧱 Oven | `toast` / `roast` | +20% per cook |
| 🥘 Wok | `stirfry` | +10–20% per cook |
| 🫕 Steamer | `steam` | +20% per cook |
| 🍲 Stone Pot | `simmer` | +20% per cook |
| 🍚 Rice Pot | `cook` | +20% per cook |

All cooking stations reach overheat after 5–10 completed cooks without cooling (heat per cook is random 10–20%). The border colour of each station reflects current heat level. Use `cool <station>` (-40–60% heat, random) to prevent lockouts.

Stations have no slot limit — any number of cooking actions can run concurrently at a single station. Throughput is bounded only by heat (overheating locks a station until extinguished) and the per-user cooldown / busy state.

## Adventure Mode Reference

See the **Adventure Mode** section above for the full run design (8 shifts, recipe draft, bosses, and the Pantry shop). Quick reference:

| Aspect | Value |
|--------|-------|
| Shifts per run | 8 (bosses auto-assigned on 4 & 8) |
| Shift duration | 3 minutes (fixed) |
| Goal scaling | `perPlayerGoal[shift] × participantCount` (baselines: 20/35/50/70/85/110/140/200) |
| Recipes | Opens with 1 drafted dish; chat adds 1 per cleared shift (or skips); grows up to 8 |
| Cuisine tags | Cosmetic flavour only — no mechanical effect |
| Kitchen events | Off for S1–2, on from S3 (Chaos Mode boss tightens cadence) |
| Shop | 4 garnishes/visit, one-shot, tier-weighted by shift (boss-shop spikes), reroll `$25 × 2^n × crew` |
| Win / lose | Clear S8 to win; miss any goal to end the run |
| Persistence | Best run + won-run count saved; full run auto-saved at shift boundaries for resume |

## Player Stats

The game tracks per-player statistics during each round:

| Stat | Description |
|------|-------------|
| `cooked` | Number of cooking actions completed |
| `served` | Number of orders served |
| `moneyEarned` | Total money earned from serves |
| `extinguished` | Number of overheat votes cast |
| `firesCaused` | Number of times this player's cook triggered an overheat |

## Kitchen Events

Kitchen events are timed interruptions that fire randomly during a round. They require the whole chat to respond collectively — progress scales with how many people participate. Only one event can be active at a time.

When an event spawns, a receipt-style ticket appears on screen and the kitchen announces it in chat. A screen flash signals the type: red for hazards, green for opportunities.

### Categories

**Hazard — Penalty:** The team has 10 seconds to respond. Fail and a negative effect is applied. There is no ongoing kitchen disruption — just the punishment if time runs out.

**Hazard — Immediate:** There is no time limit, but the harmful effect starts the moment the event spawns and stays active until the team resolves it.

**Opportunity:** The team has 12 seconds to hit the participation threshold. Succeed and a temporary bonus is granted. Miss the window and no reward is given.

### Participation

Every event uses the same threshold:

```
threshold = ceil(activePlayerCount × 0.8), minimum 1
```

Each player can contribute once per event (one correct response counts). The progress bar on the event card tracks how close the team is.

### Events

#### 🐀 Rat Invasion (Hazard — Penalty)

A random command is shown: one of `SHOO SHOO SHOO`, `CHASE CHASE CHASE`, or `BEGONE BEGONE BEGONE`. Players must type it exactly. If the team fails, 3 random prepared ingredients are stolen from the tray.

#### 👨‍🍳 Angry Chef (Hazard — Penalty)

A random apology phrase is shown: `SORRY CHEF`, `APOLOGIES CHEF`, or `MY BAD CHEF`. If the team fails to reach threshold in time, cooking speed is reduced to 70% for 15 seconds.

#### 🔌 Power Trip (Hazard — Immediate)

A math equation is shown on the card — for example `7 × 8 = ?`. Players type the numeric answer. Until it is resolved, two random stations are knocked offline and cannot be used. Equations are add/subtract (three operands) or multiply/divide problems. No time limit — the stations stay offline until enough players answer correctly.

#### 💨 Smoke Blast (Hazard — Immediate)

A random command is shown: `CLEAR`, `VENTILATE`, or `BLOW`. A thick smoke overlay obscures the kitchen until the team resolves it. No time limit.

#### 📦 Glitched Orders (Hazard — Immediate)

A random command is shown: `FIX`, `DEBUG`, or `PATCH`. All order tickets display scrambled dish names and ingredients until the event is resolved. No time limit.

#### 📢 Chef's Chant (Opportunity)

A random chant is shown: `YES CHEF`, `AYE CHEF`, or `OF COURSE CHEF`. Resolve within 12 seconds to earn a 1.5× cooking speed boost for 20 seconds.

#### 🧩 Mystery Recipe (Opportunity)

An anagram of a random ingredient name is shown. Players type the unscrambled ingredient name (spaces are used — no underscores). Resolve within 12 seconds to receive 3 free prepared ingredients added to the tray.

#### ⚡ Typing Frenzy (Opportunity)

A randomly generated 15-character string of letters, numbers, and symbols is shown. Every player who types it exactly within 12 seconds counts toward the threshold. Resolve to earn a 1.5× money multiplier on all serves for 20 seconds.

#### 🕺 Dance (Opportunity)

A random 4-step direction sequence is generated — for example `UP DOWN RIGHT RIGHT`. Directions can repeat.

**Memorise phase (first 3 seconds):** All four directional arrows are shown on the card simultaneously.

**Type phase (remaining 9 seconds):** The arrows are hidden. Players must type the full sequence from memory as a single chat message, e.g. `up down right right`. Any capitalisation works. Resolve to grant all active orders an extra 15 seconds of patience.

### Spawn Timing

Events spawn at a random interval between the configured minimum and maximum (default 30–60 seconds). The timer only counts down when no event is active and the game is not paused. Back-to-back identical event types are avoided. Power Trip requires at least two non-overheated stations to be eligible.

Kitchen events can be toggled off entirely in Free Play setup, and the event type pool can be narrowed to specific events. The spawn interval range is also configurable.

---

## Why The Game Works

The game works because it combines:

- very simple individual inputs
- a shared cooperative objective
- visible time pressure
- messy but readable coordination

Each individual command is easy, but running the whole kitchen well requires teamwork, timing, and awareness. That makes it especially well suited for chat-driven play.

## Future Design Expansion Ideas

Natural extension points for the design include:

- more recipes and station types
- modifiers per level
- stronger player identity or contribution summaries
- stream-specific scoring or audience challenges
- persistent progression beyond level stars

Even without these additions, the current design already delivers a clear loop: read the order, coordinate the kitchen, beat the timer, and let chat cook.
