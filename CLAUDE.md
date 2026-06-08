# CLAUDE.md — ChatsKitchen Codebase Guide

This file provides essential context for AI assistants working in this repository.

---

## Project Overview

**"Let Chat Cook"** is a browser-based real-time cooking game where Twitch chat users collectively manage a restaurant kitchen. Players issue chat commands (`!chop`, `!grill`, `!plate`, `!serve`, etc.) to cook dishes, fill orders, and earn money before the shift timer runs out.

- **Type:** Client-side React SPA + a thin socket.io **relay server** for Local Play (the game simulation always runs in the host's browser; the server only brokers messages)
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite 5
- **External API:** Twitch Chat via `tmi.js`; Local Play phones via socket.io through the relay
- **State Management:** React `useReducer` (no Redux)
- **Deploy:** static client on Vercel; relay server on Fly.io (`server/`)

---

## Development Commands

```bash
npm run dev       # Start Vite dev server with HMR
npm run build     # Type-check (tsc -b) + production bundle → dist/
npm run lint      # Run ESLint on all .ts/.tsx files
npm run preview   # Preview production build locally
```

---

## Repository Structure

```
ChatsKitchen/
├── src/
│   ├── components/         # React UI components (PascalCase)
│   ├── controller/         # Phone-player app served at /play (join/lobby/vote)
│   ├── state/
│   │   ├── gameReducer.ts  # All game logic (Redux-style reducer)
│   │   ├── commandProcessor.ts  # Parses !command input → GameAction
│   │   ├── snapshot.ts     # Serialises GameState → SharedSnapshot for phones
│   │   └── types.ts        # TypeScript interfaces (GameState, Station, Order, etc.)
│   ├── hooks/
│   │   ├── useGameLoop.ts  # 100ms game tick loop
│   │   ├── useTwitchChat.ts # Twitch IRC client lifecycle
│   │   ├── useRoomHost.ts  # Local Play host: relay socket + snapshot push
│   │   ├── useBotSimulation.ts # AI bot player (3s action interval)
│   │   └── useKitchenEvents.ts # Kitchen events lifecycle (spawn, command match, resolve/fail)
│   ├── data/
│   │   ├── recipes.ts      # Recipe definitions, station configs, bot names
│   │   └── kitchenEventDefs.ts # Event definitions, constants, generator functions
│   ├── audio/              # Howler-based AudioManager + game audio hook
│   ├── shared/             # protocol.ts — wire types shared with the relay server
│   └── main.tsx            # React entry: renders App, or Controller on /play
├── server/                 # Standalone socket.io relay (Fly.io); no game logic
│   ├── src/relay.ts        # createRelay() — rooms, join/lock, rate limit
│   └── src/relay.test.ts   # Vitest integration + rate-limiter tests
├── docs/
│   ├── Kitchen Events.md   # Kitchen events system reference
│   ├── MULTIPLAYER_SPEC.md # Local Play / relay design spec
│   ├── TESTING.md          # Testing guide & plan
│   └── superpowers/plans/  # Development planning documents
├── index.html              # SPA root (also serves /play via main.tsx)
├── vite.config.ts          # Vite + Vitest config (test.include scopes to src/**)
├── tsconfig.json           # Project references → tsconfig.app.json + tsconfig.node.json
├── eslint.config.js
└── package.json
```

---

## Architecture

### Screen Routing

`App.tsx` owns top-level screen state as a union type (`Screen` in `types.ts`):
```
'menu' | 'modehub' | 'pvplobby' | 'adventurelobby' | 'adventurerecipepick'
| 'adventurebriefing' | 'adventurepantryshop'
| 'adventureshiftpassed' | 'adventurerunend'
| 'options' | 'playsetpicker' | 'freeplaysetup'
| 'countdown' | 'playing' | 'shiftend' | 'gameover' | 'credits'
```
No router library — screens are conditionally rendered components.

`menu` is the **main menu / connection screen** (brand + Play/Tutorial/Options/Feedback/Credits on the left; Twitch + always-live Local Play QR on the right). `Play` advances to `modehub` ("Choose a mode": Free Play / Adventure / PvP). Post-game "Menu"/"Exit to Menu" actions return to `menu`; "Back" from setup screens steps back to `modehub`.

### Connection model (Jackbox-style co-play)

There is **no connection-method chooser** — a Local Play room is always live (`chatMode` is initialised to `'room'` in `App.tsx` and never changes for the session). The room's QR/code is shown on the main menu (and via a `RoomQRModal` popup elsewhere). Twitch is an **optional co-input**: when a channel is connected (`twitchChannel` set), chat plays *alongside* the room — `useTwitchChat` connects off `twitchChannel` regardless of `chatMode`, and `handleTwitchMessage` drives the game with no "view-only" guard. Phone players always play; the host can also type as `You`.

There is no standalone local-play screen — the room is surfaced through `RoomQRModal` (`src/components/RoomQRModal.tsx`), portaled to `document.body` so it stacks above the in-game `PauseModal`.

### PvP Lobby

PvP Mode adds a pre-game lobby screen (`pvplobby`) between the mode hub and `freeplaysetup`. The roster is stored in `App.tsx` as:

```typescript
pvpLobby: { red: string[], blue: string[] } | null
```

A `pvpLobbyRef` (useRef) mirrors this state so that lobby mod commands (`!move`, `!balance`) can read the current roster synchronously inside `useCallback` closures without stale-closure bugs.

**Screen flow:** `menu` → `modehub` → `pvplobby` → `freeplaysetup` → `countdown` → `playing` → `shiftend` → `gameover`. In Local Play, room players appear as an "unassigned pool" the host can drag onto a team; phones can also self-pick via `!red`/`!blue` reflected through PvP-lobby snapshots.

When the game starts, the roster is merged into the reducer's initial state via the `RESET` action's `teams` parameter (`Record<string, 'red' | 'blue'>`). Lobby state is then cleared.

**Lobby player commands** (intercept in `handleTwitchMessage` before any other processing when `screen === 'pvplobby'`):

| Command | Effect |
|---------|--------|
| `!red` | Joins Red Team (moves if already on Blue) |
| `!blue` | Joins Blue Team (moves if already on Red) |
| `!join red` | Joins Red Team directly (moves if already on Blue) |
| `!join blue` | Joins Blue Team directly (moves if already on Red) |
| `!join` | Auto-joins the team with fewer players (Red wins tie); only works if not already on a team |

**Lobby mod commands** (handled in `handleLobbyMetaCommand` inside `usePvpLobby.ts`, mods/broadcaster only):

| Command | Effect |
|---------|--------|
| `!balance` | Randomly shuffles all joined players evenly across both teams |
| `!move red @name` / `!move blue @name` | Moves a joined player to the specified team; shows ❌ toast if player not found |
| `!kick @name` | Removes a player from the lobby entirely |

The balance shuffle logic lives in `balanceLobby` (a `useCallback` exported from `usePvpLobby`). Both the `!balance` chat command and the "Balance Teams" UI button call this same function — do not duplicate the shuffle logic inline.

Drag-and-drop is also available in the `PvPLobby` component UI — players can be dragged between team cards.

### Adventure Mode (Roguelike)

A Balatro-inspired 8-shift run. Chat builds up a menu via a draft system, and shops the Pantry for permanent upgrades. Any failed shift ends the run; the goal is to clear shift 8.

**Screen flow:** `menu` → `modehub` → `adventurelobby` → `adventurerecipepick` (opening draft) → `adventurebriefing` → `countdown` → `playing` → `shiftend` → `adventureshiftpassed` → `adventurerecipepick` → `adventurepantryshop` → next `adventurebriefing` (loop) → `adventurerunend`. Resuming a saved run (Resume pill on the mode hub) lands on `adventurelobby` (Manage the Crew) first so players can re-join, then proceeds to the briefing via the lobby's "Resume" button.

Most run-level state lives in `useAdventureRun.ts` (`AdventureRun` shape in `types.ts`); the lobby roster is owned by `useAdventureLobby.ts`. The recipe-draft and shop voting screens use the shared `useChoiceVote.ts` hook (plurality `!1`..`!N` with timer + pause). Both `pvpLobbyRef` and `adventureLobbyRef` mirror their respective rosters into refs for stale-closure-safe chat command handling.

**Run structure**
- 8 shifts, constant 3-minute shift duration (`ADVENTURE_SHIFT_DURATION` in `data/adventureMode.ts`)
- Run opens with a **mandatory recipe draft**: chat picks 1 dish from 3 all-cuisine options (no skip). Between every cleared shift, chat adds 1 more dish from 3 all-cuisine options, or votes `!skip`. The menu grows from 1 dish up to 8; all owned recipes are active and orders spawn from the entire menu.
- Cuisine tags are **cosmetic flavor** — they appear on dish cards but have no mechanical role.
- Bosses on shifts 4 & 8 are **auto-assigned** (no vote) and previewed on the shift briefing.
- Goal = `PER_PLAYER_GOALS[shift-1] × participantCount` (per-player scaling). Baselines: `[20, 35, 50, 70, 85, 110, 140, 200]` — a monotonic cafe-scale ramp. Bosses apply their own debuffs; no ×1.5 goal multiplier is baked into the table.

**Lobby** — Only the local "You" auto-joins; broadcaster and viewers must `!join` themselves. `!leave`, `!kick @name`, and `!clear` (mod only) for roster management. Mid-run `!leave` / `!kick` re-counts participants at the next shift boundary in `closeShop`.

**Garnishes (Pantry shop)** — `data/adventureGarnishes.ts` defines a 24-garnish, tier-graded catalog (common / rare / legendary) built around six recipe archetype tags: `premium`, `value`, `fast`, `slow`, `prep_heavy`, `hot_line`, plus neutrals. Each garnish is **one-shot** (cannot be bought twice); the shop offers 4 garnishes per visit, no replenish on purchase. Offers are **tier-weighted by the upcoming shift** (mostly common early, rising rare/legendary; boss shops before shifts 4 & 8 spike rare/legendary). Reroll cost is `$25 × 2^rerollCount × participantCount`. Effects fire via three mechanisms: **`applyServeTriggers`** (data-driven serve-triggers keyed off `getRecipeProfile` — reward multipliers and flat bonuses gated by tag/timing), **`applyAllGarnishes`** (stat effects: cooking speed, patience, cooling, tip, chopping time, overheat threshold), and **bespoke** hooks (First Bite 3× first dish, Time Is Money patience-scaled reward, Bloodhound $12/overheat, Doppelgänger 20% duplicate, Mise en Place shift-start prep, Glass Kitchen, Snowball compound speed). All effects compose and layer on top of the boss debuff in `buildShiftReset`.

**Bosses** — `data/adventureBosses.ts`. Some bosses set GameState knobs (`heatPerCookMultiplier`, `coolAmountBonus`, `cooldownMultiplier`, `disabledStations`, `bossMoneyMultiplier`); Chaos Mode tightens kitchen-event cadence; Recipe Roulette is implemented as a lazy-init TICK timer in the reducer.

**Chat command routing** — When in any Adventure choice-vote screen (`adventurelobby`, `adventurerecipepick`, `adventurepantryshop`), `handleTwitchMessage` intercepts the message and routes it to `adventureVoteRef.current(...)` before any game-command processing. This mirrors the PvP lobby intercept pattern.

### Component Hierarchy (during gameplay)

```
App.tsx
├─ StatsBar              — money, served, lost, timer
├─ DiningRoom            — OrderTicket list (current orders); accepts isGlitched for Glitched Orders event
├─ Kitchen
│  ├─ Station[]          — 6 cooking stations with slot progress
│  ├─ PreparedItems      — ingredient inventory
│  └─ AssemblyArea       — plating in progress + finished dishes
├─ ChatPanel             — message list + local input
├─ InfoBar               — modal command reference
├─ EventCardOverlay      — receipt-ticket overlay for active kitchen events (portal → document.body)
└─ SmokeOverlay          — frosted fog overlay during Smoke Blast event (portal → document.body)
```

### Command Flow

Three input sources feed the same pipeline: Twitch chat (`handleTwitchMessage`), the local ChatPanel (`handleChatSend`), and phone-controller commands (`onPlayerCommand` in `useRoomHost`). Twitch and phones play together (co-play); all are connected at once. **All three are thin adapters over one shared `routeChatCommand(user, text, isMod, forceDuringTutorial)` in `App.tsx`** — they only differ in `isMod` (Twitch passes it through, phones are never mod, the local host is always mod) and `forceDuringTutorial` (local-only; see pitfall #13).

```
Twitch chat / local ChatPanel / phone controller
  → handleTwitchMessage | handleChatSend | onPlayerCommand  (thin adapters)
  → routeChatCommand (App.tsx)
  → screen-based intercept via classifyRoomCommand (state/roomCommandRouting.ts):
       pvpLobby        → handleLobbyJoin / handleLobbyMetaCommand        (early return)
       adventureLobby  → handleAdventureLobbyJoin / …MetaCommand / start (early return)
       adventureVote   → adventureVoteRef.current(...)  (return if consumed, else fall through)
       game            → fall through
  → mid-run roster upkeep (!leave / !kick) if an Adventure run is active
  → handleEventCommand (useKitchenEvents) // kitchen event response matching; runs before game commands
  → handleMetaCommand (App.tsx)         // handles mod-only shell commands; returns early if consumed
  → parseCommand (commandProcessor.ts)  // returns GameAction or null
  → dispatch(action)
  → gameReducer (returns new GameState)
  → React re-render
```

### Mod / Broadcaster Commands

These commands bypass the game reducer and are handled directly in `App.tsx` (`handleMetaCommand`). They only execute for Twitch moderators, the broadcaster, or the local chat input (always treated as broadcaster).

| Command | Valid Screen(s) | Effect |
|---------|----------------|--------|
| `!start` | `gameover` (Free Play only) | Immediately starts a new round |
| `!onAutoRestart` | `playing`, `gameover` | Enables auto-restart in `gameOptions` |
| `!offAutoRestart` | `playing`, `gameover` | Disables auto-restart, cancels active countdown |
| `!exit` | `playing` | Ends the round via normal shift-end → game-over flow |
| `!balance` | `pvplobby` | Randomly distributes all joined players evenly across Red and Blue |
| `!move red @name` / `!move blue @name` | `pvplobby` | Moves a joined player to the specified team |

A brief toast notification is shown on screen when any mod command fires. System messages are also added to the chat log.

Mod detection uses `tags.mod` and `tags.badges.broadcaster` from tmi.js. The local "You" user is always granted mod access.

### Game Loop (100ms ticks)

`useGameLoop` dispatches `TICK` actions every 100ms while playing:
- Increments each slot's `elapsedMs` by the tick `delta`; completes cooking when `elapsedMs >= cookDuration`; auto-collects output into `preparedItems` (and `preparedItemSources`) for all stations
- Applies heat **incrementally during cooking** (proportional to slot progress); each slot rolls a random `heatPerCook` value (10–20) on creation — the total heat it contributes when fully cooked. Chopping board, mixing bowl, grinder, and knead board are exempt.
- Decrements order patience; expires orders that run out. An expired order forfeits a base opportunity cost (`LOST_ORDER_PENALTY_FRACTION = 0.2` × the dish's reward) from the bank, plus the Bad Reviews boss's flat penalty if active; money is clamped at $0.
- Spawns new orders at regular intervals. If the order queue empties mid-game, a new order spawns immediately and the spawn rate doubles for 10 seconds.
- Triggers game over when `timeLeft <= 0`
- Pause is handled by skipping the `TICK` dispatch entirely when `paused` is true (checked inside `useGameLoop` via a ref). No cook-time adjustment action is needed because `elapsedMs` only advances when ticks are dispatched.

### Bot Simulation

`useBotSimulation` (when enabled) picks an action every 3 seconds:

Priority order: **extinguish overheated station → cool hot station (heat ≥ 60) → serve → cook**

Bots skip overheated stations, and skip `cutting_board` and `mixing_bowl` for cooling.

---

## State Shape

```typescript
interface GameState {
  money: number
  served: number
  lost: number
  timeLeft: number                           // ms remaining
  cookingSpeed: number
  orderSpeed: number
  orderSpawnRate: number
  enabledRecipes: string[]
  stations: Record<string, Station>          // id → Station
  orders: Order[]
  preparedItems: string[]                    // e.g. ["chopped_lettuce", "grilled_patty"]
  preparedItemSources: string[]              // parallel to preparedItems: username who cooked each item
  nextOrderId: number
  userCooldowns: Record<string, number>      // last action timestamp per user
  activeUsers: Record<string, string>        // username → stationId, currently busy
  nextSlotId: number
  chatMessages: ChatMessage[]                // last 200 messages
  nextMessageId: number
  playerStats: Record<string, PlayerStats>
  participantCount: number                   // known at game start (roomPlayers.length for room mode, 0 = derive from playerStats)
  cookingSpeedModifier?: { multiplier: number; expiresAt: number }  // set by Chef's Chant / Angry Chef
  moneyMultiplier?: { multiplier: number; expiresAt: number }       // set by Wifi Password (Typing Frenzy)
  disabledStations?: string[]                // station ids offline during Power Trip
  // PvP fields — only present when pvpMode is active
  teams?: Record<string, 'red' | 'blue'>    // username → team assignment
  redPreparedItems?: string[]               // Red team's ingredient pool
  bluePreparedItems?: string[]              // Blue team's ingredient pool
  redPreparedItemSources?: string[]         // parallel to redPreparedItems
  bluePreparedItemSources?: string[]        // parallel to bluePreparedItems
  redMoney?: number
  blueMoney?: number
  redServed?: number
  blueServed?: number
}
```

State is **transient** — reset on each new game. Nothing is persisted.

`GameOptions` is separate from `GameState` and lives in `App.tsx`. It is persisted to `localStorage` (`chatsKitchen_gameOptions`).

### localStorage Keys

All keys use the `chatsKitchen_` prefix + camelCase. The UI preference keys (`ShowNames`, `SimpleTickets`, `ShowCommands`) are written by their respective components and removed by `handleResetAll` in `App.tsx`.

| Key | Written by | Value |
|-----|-----------|-------|
| `chatsKitchen_gameOptions` | `App.tsx` | JSON — `GameOptions` |
| `chatsKitchen_audioSettings` | `App.tsx` | JSON — `AudioSettings` |
| `chatsKitchen_twitchChannel` | `App.tsx` | string |
| `chatsKitchen_freePlayHighScore` | `useGameSession.ts` | number string |
| `chatsKitchen_freePlayHistory` | `useGameSession.ts` | JSON — `RoundRecord[]` |
| `chatsKitchen_adventureBestRun` | `useAdventureRun.ts` | JSON — `AdventureBestRun` |
| `chatsKitchen_hideTutorialPrompt` | `useTutorialState.ts` | `'true'` |
| `chatsKitchen_adventureIntroSeen` | `App.tsx` | `'true'` (one-time Adventure overview popup dismissal) |
| `chatsKitchen_savedAdventureRun` | `useAdventureRun.ts` | JSON — `{ version: 1, run, lobby, savedAt }`. Auto-saved at every shift boundary; cleared on run end (fail / S8 win). Resumed via the ModeHub pill. |
| `chatsKitchen_preparedItemsShowNames` | `PreparedItems.tsx` | `'true'` / `'false'` |
| `chatsKitchen_diningRoomSimpleTickets` | `DiningRoom.tsx` | `'true'` / `'false'` |
| `chatsKitchen_kitchenShowCommands` | `Kitchen.tsx` | `'true'` / `'false'` |

```typescript
interface GameOptions {
  cookingSpeed: number
  orderSpeed: number
  orderSpawnRate: number
  shiftDuration: number
  enabledRecipes: string[]
  allowShortformCommands: boolean
  autoRestart: boolean        // Free Play only — auto-restart after game over
  autoRestartDelay: number    // seconds to count down before restarting (default 60)
  kitchenEventsEnabled: boolean
  enabledKitchenEvents: EventType[]  // empty = all events enabled
  kitchenEventSpawnMin: number       // seconds
  kitchenEventSpawnMax: number       // seconds
}
```

---

## Game Content

> **Recipe & station data** (the full 30-dish menu and 12-station list with rewards,
> steps, and heat exemptions) lives in **`docs/GAME-DESIGN-AND-MECHANICS.md`** →
> "Recipe Reference" / "Station Reference". The source of truth is `src/data/recipes.ts`
> (`RECIPES`, `STATION_DEFS`, `HEAT_EXEMPT_STATIONS`); read it for exact values rather than
> duplicating the tables here. The mechanics those tables feed into — heat, shift
> progression, and leaderboard scoring — are documented below.

Rewards are **cafe scale** ($5–$24). The `reward` field in `recipes.ts` is the authored base value; serving fresh adds a proportional time bonus (`SERVE_TIME_BONUS_FRACTION = 0.4` × `reward`, scaled by patience remaining), so the bonus tracks dish value rather than flattening it.

Recipe steps marked `→` require the prior ingredient in `preparedItems` before starting; steps joined by `+` can be done in any order. Only stations needed by the currently enabled recipes are rendered; stations have no slot limit (any number of concurrent cooking slots), bounded only by heat and the per-user cooldown.

### Heat Mechanic

Heat accumulates **incrementally during cooking** — each tick adds `progress × heatPerCook - heatApplied` heat, where `heatPerCook` is a per-slot random value rolled at cook start (10–20). Chopping Board and Mixing Bowl are exempt from heat.

Players use `!cool <station>` to reduce heat by a random amount (40–60). `!cool` requires the player to not be actively cooking. When heat reaches 100:
- All slots on that station are destroyed; assigned players are freed
- Station is locked (`overheated: true`) until extinguished
- Players vote via `!extinguish <station>`; the station restores when votes reach `ceil(playerCount × 0.5)` (min 1) in cooperative mode, or `ceil(max(redSize, blueSize) × 0.5)` in PvP mode
- Heat resets to 0 on restore

Station border colour reflects heat: green (0–40%) → yellow (41–70%) → orange (71–99%) → red (overheated).

### Shift Progression

Every 8 orders served increments the shift counter. Order spawn interval tightens:
```
Math.max(5000, 14000 - shift * 1000) ms
```

### Leaderboard & Points System

Each player accumulates a `PlayerStats` record during a round:

```typescript
interface PlayerStats {
  cooked: number              // total cook actions started (including those that go unused)
  served: number              // orders successfully served
  moneyEarned: number         // sum of rewards from orders they served
  extinguished: number        // extinguish votes cast
  firesCaused: number         // overheats at a station this player was cooking at (shared team-level penalty)
  cooled: number              // cool actions used
  eventParticipations: number // kitchen event responses
  bonusPoints: number         // bonus awarded for meaningful contributions (see table below)
}
```

**Score formula** (used in `GameOver`, `AdventureShiftPassed`, `AdventureRunEnd`):
```
score = cooked + served + cooled + extinguished×2 + eventParticipations×2 − firesCaused + bonusPoints
```

Extinguish and event participation are weighted ×2 to reward safety and community engagement. All other base actions count ×1. This formula is also displayed in-game as a `.lbLegend` note above the column headers on every leaderboard screen.

**Bonus point awards** (accumulated in `bonusPoints` via `addStat`):

| Action | Condition | Bonus |
|--------|-----------|-------|
| Cook | Ingredient is later consumed in a served order | +2 per ingredient |
| Cool | Station heat was ≥ 60% when cooled | +1 |
| Extinguish | ~~+2 to all voters on restore~~ **removed** — ×2 base weight covers it | — |

**Provenance tracking** — to know which player cooked each ingredient, `GameState` maintains `preparedItemSources: string[]` as a parallel array to `preparedItems`. Each slot in `preparedItemSources[i]` is the username who cooked `preparedItems[i]`. When `SERVE` consumes ingredients, it splices both arrays at the same indices and awards cooker bonuses. Items added by kitchen events (e.g. `ADD_PREPARED_ITEMS`) push `''` as their source (no cooker, no bonus). `REMOVE_PREPARED_ITEMS` splices sources at the same random indices.

In PvP mode, `redPreparedItemSources` and `bluePreparedItemSources` mirror the per-team prep pools.

---

## TypeScript Conventions

- **Strict mode enabled** (`strict: true`, `noUnusedLocals`, `noUnusedParameters`)
- Target: **ES2020** (app) / ES2022 (Vite config)
- Module resolution: **Bundler** mode (`allowImportingTsExtensions: true`, `noEmit: true`)
- All game actions are a **discriminated union** (`GameAction` in `types.ts`)
- Use `gameReducer` for all state mutations — never mutate state directly

### Naming Conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Components | PascalCase | `Kitchen.tsx`, `OrderTicket.tsx` |
| Component styles | `*.module.css` same name | `Kitchen.module.css` |
| Custom hooks | `use` prefix | `useGameLoop` |
| Action types | UPPER_SNAKE_CASE | `TICK`, `COOK`, `PLATE`, `SERVE` |
| Helper functions | camelCase | `parseCommand`, `getEnabledStations` |
| Types/interfaces | PascalCase | `GameState`, `StationSlot` |

---

## Key Files Reference

| File | Responsibility |
|------|---------------|
| `src/App.tsx` | Screen routing, game state init, Twitch/bot wiring |
| `src/state/gameReducer.ts` | **All game logic** — the single source of truth |
| `src/state/types.ts` | All TypeScript interfaces and types |
| `src/state/commandProcessor.ts` | `parseCommand()` — maps chat text to `GameAction` |
| `src/state/defaultOptions.ts` | `DEFAULT_GAME_OPTIONS` constant |
| `src/data/recipes.ts` | `RECIPES`, `STATION_DEFS`, `HEAT_EXEMPT_STATIONS`, `BOT_NAMES`, color palette |
| `src/data/kitchenEventDefs.ts` | Event definitions, tunable constants, generator functions (`makePowerTripEquation`, `makeTypingFrenzyPhrase`, `makeDanceSequence`, `makeAnagram`, `seededScramble`) |
| `src/hooks/useGameLoop.ts` | 100ms TICK dispatching, order spawning, game-over detection |
| `src/hooks/useTwitchChat.ts` | tmi.js client lifecycle, connect/disconnect; passes `isMod` (mod/broadcaster) to message handler |
| `src/hooks/useKitchenEvents.ts` | Kitchen events lifecycle — spawn timer, command matching, resolve/fail dispatch, audio triggers |
| `src/hooks/usePvpLobby.ts` | PvP lobby state, `balanceLobby`, `handleLobbyJoin`, `handleLobbyMetaCommand` |
| `src/hooks/useAdventureLobby.ts` | Adventure lobby roster, `!join`/`!leave`/`!kick`/`!clear`, ref mirror |
| `src/hooks/useAdventureRun.ts` | Adventure run state machine — `buildShiftReset`, recipe-draft/shop callbacks, best-run persistence |
| `src/hooks/useChoiceVote.ts` | Shared plurality-vote hook (`!1`..`!N`) — used by recipe draft, pantry shop |
| `src/data/adventureMode.ts` | `PER_PLAYER_GOALS`, `getAdventureGoal`, `getAdventureShiftDuration` |
| `src/data/adventureRecipeDraft.ts` | `generateRecipeOffers` — seeded all-cuisine recipe-draft roll for opening pick and between-shift adds |
| `src/data/seededRng.ts` | Deterministic seeded RNG utility used by adventure draft and boss assignment |
| `src/data/adventureGarnishes.ts` | Garnish catalog, `applyAllGarnishes`, `generateShopOffers`, tier pricing |
| `src/data/adventureBosses.ts` | Boss catalog, `applyBossDebuff`, `getBossPool`, `pickHealthInspectorStation` |
| `src/hooks/useGameSession.ts` | Free Play result state — finalStats, high score, history, star thresholds |
| `src/hooks/useBotSimulation.ts` | AI player logic, action priority, cooldown awareness |
| `src/components/EventCardOverlay.tsx` | Receipt-ticket overlay for active kitchen events; dance memorise/type phases |
| `src/components/Toast.tsx` | Brief fixed-position toast notification for mod command feedback |
| `src/components/FoodIcon.tsx` | Renders food icons — `<img>` for `/`-prefixed paths, `<span>` for emoji strings |
| `src/components/PvPLobby.tsx` | Pre-game team selection screen; drag-and-drop roster management; unassigned-pool column for Local Play room players; `!red`/`!blue`/`!join`/`!join red`/`!join blue` join flow |
| `src/components/MainMenu.tsx` | Main menu / connection screen — brand + Play/Tutorial/Options/Feedback/Credits buttons; Twitch connect card + always-live Local Play QR with joined-player chips |
| `src/components/ModeHub.tsx` | "Choose a mode" hub (Free Play / Adventure / PvP) reached via Play; room status badge, Show-QR popup trigger, Resume-Adventure pill |
| `src/components/RoomQRModal.tsx` | Shared room QR/code/player popup (portaled to `document.body`); opened from the hub badge, the in-game pause menu, and game over |
| `src/hooks/useRoomHost.ts` | Local Play room host — socket.io relay lifecycle, room code, `sendSnapshot`, join lock/unlock, `onPlayerCommand` |

---

## Linting

ESLint is configured in `eslint.config.js` with:
- `@eslint/js` recommended
- `typescript-eslint` recommended
- `eslint-plugin-react-hooks` (enforces Rules of Hooks)
- `eslint-plugin-react-refresh` (warns on non-component exports from modules)

Run `npm run lint` before committing. The build (`npm run build`) also runs `tsc -b` which catches type errors.

---

## Testing

Tests run on **Vitest**. Run the client suite with `npm test` (scoped to `src/**` via the `test.include` in `vite.config.ts`); run the relay server's suite with `npm test` inside `server/`.

- **Client tests** live next to their subject in `src/data/` and `src/state/` and cover the pure layers — the reducer (mechanics + economy), kitchen-event generators, Adventure (garnishes/bosses/draft/mode), seeded RNG, recipes, snapshot, and command routing. Hooks and components are **not** yet tested (React Testing Library is not installed; add it when component/hook tests are needed).
- **Relay tests** (`server/src/relay.test.ts`) cover the socket.io lifecycle via real connections plus a deterministic rate-limiter unit test. The relay is built by `createRelay()` (instance-scoped state, injectable CORS/grace, no auto-listen) so it's drivable from tests; `server/src/index.ts` is just the listen entry.
- **CI** (`ci.yml`) runs lint + client tests + build + relay tests on every push/PR; `deploy-server.yml` re-runs them before each Fly.io deploy.

---

## Backend: the Local Play relay server

The game is **client-first** — the simulation always runs in the host's browser and nothing about a live game is persisted. But Local Play adds a small backend:

- **`server/`** is a standalone socket.io **relay** (own `package.json`, deployed to Fly.io, `Dockerfile` + `fly.toml`). It is **stateless game-wise**: it holds only in-memory rooms (4-letter code → host socket + players), enforces join/lock and a per-player rate limit, and fans host snapshots out to phones. It contains **no game logic**.
- **Wire protocol** types live in `src/shared/protocol.ts` and are imported by **both** the client and the server — a single source of truth for the host↔relay↔phone messages. (See the "Connection model" and `useRoomHost` sections above for the client side.)
- **Env vars:** the server reads `PORT` (defaults to 8080); the deploy uses a `FLY_API_TOKEN` secret. The client resolves the relay endpoint from `VITE_RELAY_URL` (Vite build-time env, defaulting to `http://localhost:8080` — see `src/shared/config.ts`); the Twitch channel is entered in-app at runtime. There are still no databases or migrations.

---

## Development Planning Docs

`docs/superpowers/plans/` contains Markdown planning documents for significant features:

- `2026-03-24-react-conversion.md` — Notes on the initial React migration
- `2026-03-24-station-capacity-and-plating-rework.md` — Configurable station capacity limits and timed plating mechanics
- `2026-04-05-level-system-with-stars.md` — 10-level system with star thresholds
- `2026-04-06-persist-user-preferences.md` — Browser storage for audio, level progress, and options
- `2026-04-09-readability-overhaul.md` — Gameplay UI visual polish pass
- `2026-04-09-shift-end-transition.md` — Shift end / game-over transition screen
- `2026-04-09-station-readability.md` — Station component readability improvements
- `2026-04-10-main-menu-redesign.md` — 2-column Hero Split MainMenu with cheatsheet
- `2026-04-11-auto-restart-and-mod-commands.md` — Auto-restart toggle for Free Play and mod/broadcaster chat commands
- `2026-04-13-heat-rush-remove-take.md` — Station heat meter, collective extinguish, rush orders, removal of !take
- `2026-04-18-kitchen-events.md` — Kitchen events system (9 event types, `useKitchenEvents` hook, overlays)
- `2026-04-22-event-card-redesign.md` — EventCardOverlay receipt-ticket redesign with per-event colours and animations
- `2026-04-24-pvp-mode.md` — PvP Mode: team lobby, per-team prep pools, team scoring, winner banner on game over

`docs/superpowers/specs/` holds design specs that precede the plans above.

When implementing a new feature of similar scope, create a spec + plan document in these directories first.

---

## Common Pitfalls

1. **Do not mutate `GameState` directly** — the reducer must return a new object for React to detect changes.
2. **No station capacity** — there is no per-station slot limit; a station accepts any number of concurrent cooking slots. `COOK` only needs to reject commands on overheated (locked) stations and disabled stations. Do not reintroduce a `slots.length < capacity` check.
3. **User cooldown** — commands are throttled at 1500ms per user (`userCooldowns` in state). Bots use the same cooldown system.
4. **`activeUsers`** — a player cooking at one station cannot simultaneously use another. Check and clear this map correctly on station completion and overheat. `!cool` and `!extinguish` are instant actions that do not set `activeUsers`.
5. **Chat messages are capped at 200** — `ADD_CHAT` slices to `chatMessages.slice(-200)`.
6. **`elapsedMs` accumulates tick deltas** — slot progress is `slot.elapsedMs / slot.cookDuration`. `elapsedMs` starts at 0 and is incremented by `delta` each TICK. The TICK loop is skipped entirely when paused, so no cook-time adjustment is needed on unpause. Do **not** use wall-clock `Date.now()` for progress calculations — that was replaced with `elapsedMs` to make pause work correctly. The old `cookStart` field and `ADJUST_COOK_TIMES` action no longer exist.
7. **`heatApplied` and `heatPerCook` on slots** — each `StationSlot` has `heatApplied: number` (init 0, tracks heat already contributed) and `heatPerCook: number` (random 10–20, rolled at cook start). The TICK loop applies `progress × heatPerCook - heatApplied` each tick. When adding new slot-creating code paths, always initialise both to 0.
8. **Heat-exempt stations** — `cutting_board`, `mixing_bowl`, `grinder`, and `knead_board` are all exempt from heat. The canonical set is `HEAT_EXEMPT_STATIONS` exported from `recipes.ts` — always import it, never redefine it locally. Treat all four identically in heat-related checks (TICK heat loop, COOL guard, bot cool-skip).
9. **`!red`, `!blue`, `!join red`, `!join blue` are lobby-only** — These commands are intercepted exclusively in `handleTwitchMessage` when `screen === 'pvplobby'` and never reach `commandProcessor.ts`. Do not add `case 'red'` or `case 'blue'` to `commandProcessor.ts` — this would allow players to switch teams mid-game, silently rerouting cooked ingredients to the wrong team's prep pool.
10. **PvP lobby state lives in App.tsx, not GameState** — `pvpLobby: { red: string[], blue: string[] } | null` is pre-game state. It is merged into the reducer's RESET action as `teams` when the game starts, then cleared. Do not store it in `GameState`.
11. **`pvpLobbyRef` for stale closure safety** — Lobby mod commands (`!move`) check `pvpLobbyRef.current` synchronously before calling `setPvpLobby`. Reading `pvpLobby` state directly inside a `useCallback` would see a stale snapshot.
12. **Stale-ref update pattern** — When mirroring React state into a ref for use inside intervals/callbacks, update it inline (`ref.current = value`) not inside a `useEffect`. The `useEffect` runs after render, leaving a one-tick-old snapshot available to any interval that fires between render and effect execution.
13. **Tutorial command asymmetry** — All three input sources share `routeChatCommand`; the local chatbox passes `forceDuringTutorial = true` so the host always reaches `handleCommand`, while Twitch/phone pass `false` and skip it during the tutorial (`forceDuringTutorial || !isTutorialRef.current`). This is intentional — local users can practice commands during the tutorial. The asymmetry is now a single explicit flag; do not "fix" it by removing the flag.
14. **`preparedItemSources` must stay in sync with `preparedItems`** — every operation that adds or removes from `preparedItems` must do the same to `preparedItemSources` at the same index. COOK instant → push `user` to sources. TICK completion → push `slot.user` to sources. SERVE → splice both arrays at the same index. `ADD_PREPARED_ITEMS` → push `''` per item (no cooker). `REMOVE_PREPARED_ITEMS` → splice sources at the same random indices. PvP equivalents (`redPreparedItemSources`, `bluePreparedItemSources`) follow the same rule. A length mismatch silently breaks bonus point attribution.
15. **Twitch is co-play, not a `chatMode` switch** — `chatMode` is initialised to `'room'` and stays there for the whole session (there is no connection chooser). Twitch connects purely off `twitchChannel` (`useTwitchChat(twitchChannel, …)` — *not* gated by `chatMode`), so `onTwitchConnect` only calls `setTwitchChannel(ch)` and `onTwitchDisconnect` only `setTwitchChannel(null)`. `handleTwitchMessage` has **no** "view-only" early return — when a channel is connected, chat drives the game alongside the always-live room. Do not reintroduce a `chatMode === 'twitch'` gate or a view-only guard.
16. **Auto-restart Cancel persists the off state** — the Cancel button in `GameOver` calls both `setCountdown(null)` (local) and `onDisableAutoRestart()` (persists `autoRestart: false` to `gameOptions`/localStorage). Only clearing local state would cause the countdown to restart on the next game over screen because a new `GameOver` mount triggers the `useEffect([autoRestart, ...])` with the still-true value. The `!offAutoRestart` chat command does the same thing as Cancel.

## Workflow

1. Always create a new git branch, do not work on main directly.
2. Every time we plan, use the superpowers skill.