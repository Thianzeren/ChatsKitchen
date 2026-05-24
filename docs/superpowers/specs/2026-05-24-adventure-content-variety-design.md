# Adventure Content Variety — Design

**Status:** Approved · 2026-05-24
**Sub-project:** C (third of four) — Adventure Mode release polish
**Tracking branch:** `feat/adventure-content-variety` (off `origin/release/adventure-roguelike`)

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:writing-plans` is the next step after this spec is approved.

## Problem

The current Adventure roguelike content pool feels thin after a player has seen all 7 bosses and 4 legendary garnishes. Replay drops sharply once the content surface is exhausted. Goal: add enough new garnishes, bosses, and path variants to refresh the experience without destabilising the existing balance.

## Goals

1. Add 10 new pieces of Adventure content — 3 common garnishes, 3 rare garnishes, 2 bosses, 1 easy path variant, 1 risk path variant.
2. Stay within the existing tonal/balance language — variations on the existing knob set, with new GameState knobs only where a mechanic genuinely demands one.
3. Rebalance one existing variant (Big Tab) that's mathematically a strict upgrade in the risk pool.
4. Ship as a data-focused PR — no UI changes, no new screens, no audio assets.

## Non-goals

- New legendaries (the current 4 stay; user explicitly wanted novelty in commons + rares instead).
- New Adventure UI surfaces, screens, or modals.
- New audio assets.
- Rebalancing any existing garnish or boss outside Big Tab.
- Touching the AdventureRunEnd screen (Sub-project A already polished it).

## Content lineup

### New common garnishes (3)

| ID | Name | Icon | Effect | Base price | Implementation |
|----|------|:----:|--------|-----------:|----------------|
| `loose_lid` | Loose Lid | 🥘 | Heat above 75 dissipates passively at 4/sec | $110 | New `GarnishField` values `heatDecayAboveThreshold` (= 75) and `heatDecayRate` (= 4). Garnish has both effects (mode `add`). TICK loop reads `state.heatDecayAboveThreshold` and `state.heatDecayRate`, subtracts decay above threshold per tick. |
| `repeat_customer` | Repeat Customer | 🔁 | Every 3rd consecutive dish of the same recipe earns +$25 | $130 | Triggered (no `effects`). SERVE checks `repeatCustomerStreak` (per shift); awards +$25 when the same user serves the same recipe 3 times in a row. Streak resets on different user OR different recipe. |
| `side_salad` | Side Salad | 🥗 | Each new order arrives with 1 free prepped ingredient from its recipe added to the tray | $120 | Triggered. ORDER_SPAWN handler: when owned, pushes a random `produces` from the order's recipe to `preparedItems` and `''` to `preparedItemSources`. |

### New rare garnishes (3)

| ID | Name | Icon | Effect | Base price | Implementation |
|----|------|:----:|--------|-----------:|----------------|
| `phoenix_wing` | Phoenix Wing | 🪶 | The first station overheat each shift is auto-extinguished (slots still lost, station restores instantly) | $240 | New GameState field `autoExtinguishCharges?: number`. Shift RESET sets to 1 when owned. OVERHEAT handler decrements; if > 0, immediately fires the EXTINGUISH side-effect: `station.overheated = false`, `station.heat = 0`. System chat: `Phoenix Wing saved the {stationName}!`. |
| `apprentice` | The Apprentice | 👨‍🍳 | Every 35 seconds, one random prepped ingredient appears in the tray | $260 | New GameState field `apprenticeTimerMs?: number`. Shift RESET sets to 0 when owned. TICK loop accumulates by `delta`; when ≥ 35_000, push a random `produces` from the active recipes' steps to `preparedItems` + `''` to `preparedItemSources`, then subtract 35_000 from the timer. |
| `long_memory` | Long Memory | 📖 | Every 5th dish served each shift earns +$40 | $220 | Triggered. SERVE checks `(shiftServedCount + 1) % 5 === 0` after increment. Awards +$40 inline to `money` (PvP: per-team `redMoney` / `blueMoney`). |

### New bosses (2)

| ID | Name | Icon | Effect | Implementation |
|----|------|:----:|--------|----------------|
| `hangry_mob` | Hangry Mob | 😤 | Every order arrives with 30% less patience | Existing knob: `orderPatienceBonus` set to `-15000` (ms). Approximate −30% on the typical ~50s baseline patience for current recipes. Implementer should verify the value lands within −25% to −35% across the recipe roster; tighten only if observed range falls outside. |
| `bad_reviews` | Bad Reviews | ⭐ | Every lost / expired order deducts $20 from the run bank | New GameState field `lostOrderPenalty?: number`. `applyBossDebuff` returns `state: { lostOrderPenalty: 20 }`. ORDER_EXPIRED handler subtracts from `money` (PvP: per-team) when set, plus system chat `−$20 (Bad Reviews)`. |

Both join the existing 7 in `getBossPool()`. `generatePathPair` already picks 2 distinct bosses per S4/S8 — no change needed to the path-card pair generator.

### New path-card variants (2)

| Archetype | Key | Label | Icon | goalDelta | cashBonus | Flavor |
|-----------|-----|-------|:----:|----------:|----------:|--------|
| Easy | `friend_of_the_house` | Friend of the House | 🤝 | `-0.12` | `30` | "A regular tips the chef. Smaller goal, modest reward on pass." |
| Risk | `all_in` | All-In | 🃏 | `+0.20` | `200` | "Push every chip in. Toughest goal of the run — biggest payday." |

`EASY_VARIANTS` grows 3 → 4; `RISK_VARIANTS` grows 3 → 4. `generatePathPair`'s `Math.floor(rng() * EASY_VARIANTS.length)` already handles the size change.

### Big Tab rebalance

| | Old | New |
|---|---:|---:|
| `goalDelta` | `0` | `+0.05` |
| `cashBonus` | `60` | `80` |

The `0` goal-delta + `+$60` reward was a strict upgrade in the risk pool. The new numbers create a genuine tradeoff (small risk for a solid reward) and integrate cleanly with the existing risk pool progression:

| Card | Goal Δ | Cash bonus |
|------|-------:|----------:|
| Big Tab (rebalanced) | +5% | $80 |
| Chef's Gambit | +5% | $90 |
| High Roller | +10% | $120 |
| All-In (new) | +20% | $200 |

(Big Tab and Chef's Gambit are near-twins by design — same goal pressure, slightly different rewards — giving the seeded RNG more variety without making either dominant.)

### No other rebalances

Considered and rejected: *Veteran's Tip* ($15/shift × ≤7 shifts = $105 lifetime on a $200 base price). Looks underpowered, but `getGarnishPrice` is `basePrice × (1 + 0.15 × (shift − 1))` — if bought on Shift 1, price is just $200, which is fair given the bank-tip stream. Skipped to keep PR scope tight.

## Architecture

### Files touched (data-only + targeted reducer additions)

| File | Action | Lines (approx) |
|------|--------|---------------|
| `src/data/adventureGarnishes.ts` | Modify — add 6 new entries; extend `GarnishField` union with 2 new fields | +120 |
| `src/data/adventureBosses.ts` | Modify — add 2 new entries; extend `BossId` union; add 2 cases to `applyBossDebuff`; extend `getBossPool` return | +30 |
| `src/data/adventurePathCards.ts` | Modify — add 1 easy + 1 risk variant; tweak Big Tab numbers | +5, ±2 |
| `src/state/types.ts` | Modify — 5 new optional GameState fields + extend RESET action shape | +12 |
| `src/state/gameReducer.ts` | Modify — TICK loop additions (heat decay, apprentice timer), SERVE additions (repeat customer, long memory), OVERHEAT consults phoenix wing, ORDER_EXPIRED applies bad reviews, ORDER_SPAWN handles side salad, RESET passes new fields | +80 |
| `src/hooks/useAdventureRun.ts` | Modify — `buildShiftReset` composes the new garnish-driven fields (autoExtinguishCharges, apprenticeTimerMs) on shift entry; routes Bad Reviews boss into RESET | +15 |

**Total estimated:** ~260 lines added across 6 existing files. No new files.

### New TypeScript types

#### `GarnishField` (in `adventureGarnishes.ts`)

```typescript
export type GarnishField =
  | 'cookingSpeed' | 'orderSpeed' | 'orderSpawnRate'
  | 'coolAmountBonus' | 'heatPerCookMultiplier'
  | 'choppingCookTimeMultiplier' | 'flatTipPerOrder'
  | 'orderPatienceBonus' | 'overheatThresholdDelta'
  // ── NEW (Loose Lid) ──
  | 'heatDecayAboveThreshold'
  | 'heatDecayRate'
```

#### `BossId` (in `adventureBosses.ts`)

```typescript
export type BossId =
  | 'picky_critic' | 'rush_hour' | 'health_inspector' | 'understaffed'
  | 'heatwave' | 'chaos_mode' | 'recipe_roulette'
  | 'hangry_mob' | 'bad_reviews'   // ── NEW ──
```

#### `GameState` (in `types.ts`)

```typescript
// Additions only — all optional, default undefined
heatDecayAboveThreshold?: number    // Loose Lid — threshold above which heat decays
heatDecayRate?: number               // Loose Lid — decay rate in heat/sec
autoExtinguishCharges?: number       // Phoenix Wing — decrements on OVERHEAT
apprenticeTimerMs?: number           // Apprentice — TICK accumulator
lostOrderPenalty?: number            // Bad Reviews boss — $ deducted per expired order
shiftServedCount?: number            // Long Memory — per-shift SERVE counter
repeatCustomerStreak?: {             // Repeat Customer — per-shift streak tracker
  user: string
  recipe: string
  count: number
}
```

All optional; `undefined` = no behaviour change for existing Free Play / saved runs.

### Reducer change hot-spots

#### 1. TICK loop

```typescript
// Inside the per-station TICK loop, AFTER the heat-application block, BEFORE the slot-completion check:

// Loose Lid — passive heat decay above threshold
if (state.heatDecayAboveThreshold != null &&
    state.heatDecayRate != null &&
    station.heat > state.heatDecayAboveThreshold) {
  const decay = state.heatDecayRate * (delta / 1000)
  station.heat = Math.max(state.heatDecayAboveThreshold, station.heat - decay)
}
```

```typescript
// Outside the station loop, in TICK reducer body:

// Apprentice — interval drip
if (state.apprenticeTimerMs != null) {
  const newTimer = state.apprenticeTimerMs + delta
  if (newTimer >= 35_000) {
    const pool = collectProducesPool(state.enabledRecipes, RECIPES)
    if (pool.length > 0) {
      const pick = pool[Math.floor(Math.random() * pool.length)]
      state.preparedItems = [...state.preparedItems, pick]
      state.preparedItemSources = [...state.preparedItemSources, '']
    }
    state.apprenticeTimerMs = newTimer - 35_000
  } else {
    state.apprenticeTimerMs = newTimer
  }
}
```

#### 2. SERVE

```typescript
// After the dish reward is computed and added, before the action returns:

// Long Memory — 5th-dish milestone
if (isGarnishOwned(state, 'long_memory')) {
  const newCount = (state.shiftServedCount ?? 0) + 1
  state.shiftServedCount = newCount
  if (newCount % 5 === 0) {
    addMoneyByTeam(state, team, 40)
    pushSystemChat(state, '📖 Long Memory · +$40')
  }
}

// Repeat Customer — same-user, same-recipe streak
if (isGarnishOwned(state, 'repeat_customer')) {
  const cur = state.repeatCustomerStreak
  if (cur && cur.user === user && cur.recipe === recipeKey) {
    const nextCount = cur.count + 1
    if (nextCount >= 3) {
      addMoneyByTeam(state, team, 25)
      pushSystemChat(state, '🔁 Repeat Customer · +$25')
      state.repeatCustomerStreak = { user, recipe: recipeKey, count: 0 }
    } else {
      state.repeatCustomerStreak = { user, recipe: recipeKey, count: nextCount }
    }
  } else {
    state.repeatCustomerStreak = { user, recipe: recipeKey, count: 1 }
  }
}
```

#### 3. OVERHEAT

```typescript
// In the station-overheat path, before the "overheated: true" assignment:

if ((state.autoExtinguishCharges ?? 0) > 0) {
  state.autoExtinguishCharges = (state.autoExtinguishCharges ?? 0) - 1
  // Slots are already destroyed by the existing logic. Just restore the station instead of marking overheated.
  station.overheated = false
  station.heat = 0
  pushSystemChat(state, `🪶 Phoenix Wing saved the ${STATION_DEFS[station.id].name}!`)
  return // skip the normal overheat side-effects
}
```

#### 4. ORDER_EXPIRED

```typescript
// In the lost-order branch, after `state.lost++`:

if (state.lostOrderPenalty != null) {
  // Orders aren't team-tagged — penalty hits both teams in PvP, or the global bank in coop.
  if (state.teams) {
    state.redMoney  = (state.redMoney  ?? 0) - state.lostOrderPenalty
    state.blueMoney = (state.blueMoney ?? 0) - state.lostOrderPenalty
  } else {
    state.money -= state.lostOrderPenalty
  }
  pushSystemChat(state, `⭐ Bad Reviews · −$${state.lostOrderPenalty}`)
}
```

#### 5. ORDER_SPAWN

```typescript
// After the new order is pushed to state.orders:

if (isGarnishOwned(state, 'side_salad')) {
  const recipe = RECIPES[order.recipeKey]
  if (recipe && recipe.steps.length > 0) {
    const step = recipe.steps[Math.floor(Math.random() * recipe.steps.length)]
    state.preparedItems = [...state.preparedItems, step.produces]
    state.preparedItemSources = [...state.preparedItemSources, '']
  }
}
```

### `useAdventureRun.buildShiftReset` additions

```typescript
// After the existing applyAllGarnishes() composition:

const ownsPhoenixWing = run.ownedGarnishes.some(g => g.garnishId === 'phoenix_wing')
const ownsApprentice  = run.ownedGarnishes.some(g => g.garnishId === 'apprentice')

const stateAdditions: Partial<GameState> = {
  ...garnishDelta.state,
  ...bossDelta.state,
  autoExtinguishCharges: ownsPhoenixWing ? 1 : undefined,
  apprenticeTimerMs:     ownsApprentice  ? 0 : undefined,
  shiftServedCount:      0,
  repeatCustomerStreak:  undefined,
}
```

`shiftServedCount` is always 0 (cheap to zero — only used by Long Memory checks). `repeatCustomerStreak` always undefined per shift. These reset every shift so no cross-shift state leaks.

### Helper additions

Two small helpers needed in the reducer (or imported from data files):

```typescript
// In gameReducer.ts (or a small helpers file)
function isGarnishOwned(state: GameState, id: string): boolean {
  return state.activeGarnishes?.includes(id) ?? false
}

function addMoneyByTeam(state: GameState, team: 'red' | 'blue' | null, delta: number) {
  if (team === 'red')      state.redMoney  = (state.redMoney  ?? 0) + delta
  else if (team === 'blue') state.blueMoney = (state.blueMoney ?? 0) + delta
  else                      state.money += delta
}

function pushSystemChat(state: GameState, text: string) {
  state.chatMessages = [...state.chatMessages,
    { id: state.nextMessageId, user: 'System', text, ts: Date.now() }
  ].slice(-200)
  state.nextMessageId++
}
```

`state.activeGarnishes` already exists as the canonical list of owned-garnish IDs in active play (set up by `useAdventureRun.buildShiftReset`); same source of truth for the existing inline garnish checks like First Bite.

## Edge cases

| Case | Behaviour |
|------|-----------|
| Free Play (non-Adventure) | None of the new garnish or boss IDs can ever appear in Free Play. All new GameState fields stay `undefined` → reducer code paths are no-ops. Zero regression risk. |
| PvP mode | All new garnishes apply globally. Long Memory routes the +$40 to whichever team's player triggered the 5th serve (existing SERVE handler already knows). Bad Reviews has no team to charge (lost orders aren't team-tagged), so the penalty hits **both** teams equally — symmetric pressure for symmetric loss. Repeat Customer's streak is global (one streak slot in state); ties resolved by whichever player serves first. |
| Saved-run resume | `chatsKitchen_savedAdventureRun` stores `ownedGarnishes` and `currentBossDebuff` as strings — both already pass through `GARNISHES[id]` / `BOSSES[id]` lookups that simply return `undefined` for unknown IDs. Pre-PR saves won't have new IDs; post-PR saves with new IDs route correctly on resume. No migration needed. |
| `repeatCustomerStreak` after RESET | Always cleared. No cross-shift leak. |
| Pause | TICK skipped entirely while paused — apprentice timer and loose-lid decay both pause cleanly. |
| Apprentice tick rate vs interval | `delta` accumulator pattern handles variable tick gaps (e.g. browser tab unfocus). The 35_000 ms interval is approximate but not drifty over a 3-min shift. |
| Phoenix Wing during boss-shift overheat | Phoenix Wing fires before Heatwave / other boss-induced overheat penalties (no penalties exist today; this is forward-safe). |
| Big Tab rebalance affecting mid-flight saved runs | Path cards are not persisted (only `chosenPath` is). On resume, the next path-pick generates with the new numbers. Acceptable — no migration concern. |
| Boss pool RNG | `generatePathPair` shuffles via Fisher-Yates, picks 2 distinct. Adding 2 new IDs increases pool to 9; same algorithm, no code change. |

## Manual test plan

No test framework. All verification is manual.

### Per-garnish

| Garnish | Verification |
|---------|--------------|
| Loose Lid | Buy in Pantry. Heat one station to 80+; observe heat ticks down toward 75 without active cooling. |
| Repeat Customer | Buy in Pantry. Same user serves the same recipe 3× in a row → confirm +$25 toast / system chat on the 3rd serve. Mix users or recipes mid-streak → streak resets, no bonus. |
| Side Salad | Buy in Pantry. Watch a new order spawn → confirm tray receives a free random `produces` from that order's recipe. |
| Phoenix Wing | Buy in Pantry. Overheat any station the first time this shift → station instantly restores, heat = 0, chat shows "🪶 Phoenix Wing saved …". Overheat a second station this shift → normal overheat (no auto-restore). |
| The Apprentice | Buy in Pantry. Wait ~35s → confirm a random prepped ingredient is added to the tray. Repeats every ~35s. Pause game → timer pauses. |
| Long Memory | Buy in Pantry. Serve dishes; confirm +$40 toast / chat on the 5th, 10th, 15th dishes (cumulative for the shift, regardless of which user serves). |

### Per-boss

| Boss | Verification |
|------|--------------|
| Hangry Mob | Force on S4 or S8. Briefing screen shows the boss; in-shift orders visibly arrive with much shorter patience timers. |
| Bad Reviews | Force on S4 or S8. Let one order expire → money decreases by $20, chat shows "⭐ Bad Reviews · −$20". |

### Per path variant

- **Friend of the House:** play multiple runs; eventually appears as the easy slot. Briefing shows `-12%` goal and `+$30` cashBonus chip.
- **All-In:** play multiple runs; eventually appears as the risk slot. Briefing shows `+20%` goal and `+$200` cashBonus chip.

### Big Tab rebalance

- Force Big Tab as the risk slot (replay runs until it appears). Briefing shows `+5%` goal and `+$80` cashBonus.

### Build + lint + regression

- `npm run build` and `npm run lint` clean.
- A run with no owned garnishes and no boss debuffs should be byte-identical in behaviour to pre-PR (no regressions in vanilla play).
- Saved-run resume from a pre-PR save loads without errors.

## Files touched — summary

| File | Action |
|------|--------|
| `src/data/adventureGarnishes.ts` | Modify — 6 new garnishes + extend `GarnishField` |
| `src/data/adventureBosses.ts` | Modify — 2 new bosses + extend `BossId`, `applyBossDebuff`, `getBossPool` |
| `src/data/adventurePathCards.ts` | Modify — 2 new variants + Big Tab rebalance |
| `src/state/types.ts` | Modify — 5 new optional `GameState` fields + 2 new RESET action fields |
| `src/state/gameReducer.ts` | Modify — TICK / SERVE / OVERHEAT / ORDER_EXPIRED / ORDER_SPAWN handlers; new helpers |
| `src/hooks/useAdventureRun.ts` | Modify — `buildShiftReset` seeds new shift-local fields |

No new files. No new assets. No new dependencies.

## References

- Existing garnish data: `src/data/adventureGarnishes.ts`
- Existing boss data: `src/data/adventureBosses.ts`
- Existing path-card generator: `src/data/adventurePathCards.ts`
- Reducer knob inventory: `src/state/types.ts:240-285` (`GameState`)
- `applyAllGarnishes` composition pattern: `src/data/adventureGarnishes.ts:287`
- `applyBossDebuff` dispatch pattern: `src/data/adventureBosses.ts:68`
- Shift RESET composition: `src/hooks/useAdventureRun.ts` (`buildShiftReset`)
- Triggered-garnish precedent (First Bite, Combo Plate): `src/state/gameReducer.ts` (SERVE handler)
- `getGarnishPrice` shift+crew scaling: `src/data/adventureGarnishes.ts:260`
