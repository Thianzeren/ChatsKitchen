# Testing Guide & Plan — "Let Chat Cook"

This document is the single reference for testing ChatsKitchen: the strategy, the
tooling, the full catalogue of testable surface area, and — most importantly — the
**order in which to build the suite out**.

> **Status legend:** ✅ done · 🟡 partial · ⬜ not started

As of this writing the suite is **16 files / 104 tests**, all pure-logic + reducer.

---

## 1. Philosophy

1. **Test the contract, not the implementation.** Assert observable behaviour
   (returned state, payouts, screen transitions), never private internals. This
   keeps tests green through refactors like the command-router unification.
2. **Encode the invariants.** The "Common Pitfalls" list in `CLAUDE.md` is a spec
   of properties that must always hold (sources/items stay in sync, no station
   capacity, 1500 ms cooldown, 200-message cap, heat-exempt stations…). Each one
   should have a test that fails loudly if violated.
3. **Pure logic first.** The reducer and `data/` helpers carry the game's risk and
   are cheap to test (no DOM, no async). Exhaust these before reaching for the DOM.
4. **Determinism over coverage theatre.** Seed every RNG path; use fake timers for
   anything time-based. A flaky test is worse than no test. Prefer asserting
   *ranges/invariants* over exact values where randomness is intrinsic (heat 10–20,
   cool 40–60).
5. **Don't test what can't break.** Skip constant tables (`DIFFICULTY_PRESETS`,
   `TUTORIAL_STEPS`), pure-markup components, and re-exports. The `recipes.test.ts`
   reward-band audit is the exception worth keeping: it guards a *design rule*, not a
   constant.

---

## 2. Tooling

### Current
- **Vitest 1.6** (`npm test` → `vitest run`), node environment, no config file.
- Tests colocate next to source as `*.test.ts`, grouped by concern when a module is
  large (`gameReducer.economy.test.ts`, `adventureGarnishes.shop.test.ts`).

### To add (gated per tier below — don't add until the tier needs it)
| Need | Dependency | Unlocks |
|------|-----------|---------|
| Hook tests | `@testing-library/react`, `jsdom`, a `vitest.config.ts` with `environment: 'jsdom'` (or `// @vitest-environment jsdom` per file) | P2 — hooks |
| Component tests | `@testing-library/react` + `@testing-library/user-event` | P3 — components |
| E2E / flow tests | `@playwright/test` (Playwright already used ad-hoc in dev) | P4 — end-to-end |
| Coverage report | `@vitest/coverage-v8` (`vitest run --coverage`) | CI gate |

### Conventions
- **Builders over literals.** Reuse the `base()/slot()/order()` helper pattern from
  `gameReducer.test.ts`; consider promoting them to `src/state/testFixtures.ts` once
  a second suite needs them.
- **Seeded RNG.** Use `mulberry32(seed)` for anything that takes an rng; for modules
  that call `Math.random()` directly, `vi.spyOn(Math, 'random')`.
- **Fake timers.** `vi.useFakeTimers()` for `useGameLoop`, `useChoiceVote`,
  `useKitchenEvents`, and any `setTimeout`/`setInterval` path.
- **Naming.** `describe('<unit>')` → `it('<behaviour in plain English>')`.

---

## 3. Test layers

```
┌─ P4 E2E (Playwright)            few   — full flows in a real browser
├─ P3 Component (RTL)             some  — screens & interactive widgets
├─ P2 Hook (RTL renderHook)       more  — orchestration & lifecycles
└─ P0/P1 Pure + Reducer (Vitest)  most  — engine, data, parsing  ← the base
```

Most value lives in the bottom layer. The pyramid widens downward on purpose.

---

## 4. Prioritisation summary

Priority = **risk (blast radius if wrong) × likelihood of regression ÷ cost to test.**

| Tier | Theme | Why this order | Deps |
|------|-------|----------------|------|
| **P0** | Core engine & routing | Single source of truth; a bug here corrupts every mode | none |
| **P1** | Pure data: economy, garnishes, RNG, generators | Money/balance correctness; cheap, deterministic | none |
| **P2** | Hooks (state machines & lifecycles) | Orchestrate the engine; stale-closure & timer bugs | jsdom + RTL |
| **P3** | Components / screens | Mostly presentational; wiring & guards | jsdom + RTL |
| **P4** | End-to-end flows | Confidence on the seams the unit tests stub | Playwright |

**Build order recommendation:** finish P0 → P1 (no new deps, fast wins) → add the
jsdom harness once and do P2 → P3 → P4. Stop adding deps until the tier needs them.

---

## 5. Catalogue by module

### P0 — Core engine & routing  *(highest priority — mostly done)*

#### `state/gameReducer.ts` — ✅ COOK/SERVE/TICK/EXTINGUISH/COOL · economy · 🟡 gaps below
Done: slot creation, cooldown, busy rule, prereq chaining, instant-cook, no-capacity,
overheat destroying slots, heat-exempt stations, extinguish thresholds (coop+PvP),
cool guards, serve payout + provenance + PvP pools, patience expiry, chat cap, timer
floor, modifier expiry, proportional serve bonus, lost-order penalty + $0 clamp.

Remaining ⬜:
- **`SPAWN_ORDER`** — `maxOrders` cap = `min(15, 5 + floor(players/8))`; no spawn when
  full; patience = `recipe.patience / orderSpeed + orderPatienceBonus`.
- **`RESET`** — Mise en Place seeds 5 items with `''` sources; PvP pools initialised;
  garnish/boss knobs land on state; ticker fields cleared.
- **Kitchen-event actions** — `ADD_PREPARED_ITEMS` (sources get `''`),
  `REMOVE_PREPARED_ITEMS` (splices both arrays same indices — pitfall #14),
  `DISABLE/ENABLE_STATIONS`, `ADD_MONEY_MULTIPLIER`, `EXTEND_ORDER_PATIENCE`,
  `RECORD_EVENT_PARTICIPATION`, `SET_COOKING_SPEED_MODIFIER`.
- **Garnish runtime hooks in TICK/SERVE** — Doppelgänger duplicate (seed `Math.random`),
  Bloodhound +$12 on overheat, First Bite 3×, Time Is Money patience scaling,
  Recipe Roulette swap + orphaned-slot clearing, Bad Reviews per-expiry penalty,
  overheat threshold from Glass Kitchen/Insulation.

#### `state/commandProcessor.ts` — ✅ done
#### `state/participants.ts` — ✅ done
#### `state/roomCommandRouting.ts` — ✅ done (`classifyRoomCommand`)
#### `state/roomRoster.ts` — ✅ done (`connectedNicknames`, `unassignedPool`)
#### `state/snapshot.ts` — 🟡 partial
Done: `adventureVoteSnapshot`. ⬜ `gameStateToSnapshot` (orders/stations/teamMoney
shape, phase mapping), `pvpLobbySnapshot`, `pvpLobbyPerPlayer` (per-player team view).

---

### P1 — Pure data (no deps; do these next)

#### `data/adventureGarnishes.ts` — 🟡 partial
Done: `generateShopOffers` (shop), `applyServeTriggers`. ⬜:
- **`applyAllGarnishes`** — stat composition (Quick Hands ×1.15), additive vs
  multiplicative modes, clamps (`cookingSpeed` 0.5–4, order 0.3–2), **Snowball**
  compounding per shift survived, **Sharp Knives** → `choppingCookTimeMultiplier` 0,
  Glass Kitchen overheat-threshold delta, no-op fields returned `undefined`.
- **`getGarnishPrice`** — +15 %/shift past 1, ×crew, rounded to nearest $5.
- **`addOwnedGarnish` / `isOwned`** — one-shot (duplicate ignored).
- **`pickMiseEnPlaceIngredients`** — picks N `produces` from enabled recipes; `[]` when
  recipes empty.

#### `data/seededRng.ts` — ⬜
`mulberry32(seed)` is deterministic & in [0,1); same seed → same sequence;
`hashStringToSeed` stable per string. (Currently only exercised transitively.)

#### `data/kitchenEventDefs.ts` — ⬜ (pure generators, high ROI)
- `seededScramble(text, seed)` — deterministic per seed; same length/charset.
- `makeAnagram(word)` — differs from input; same multiset of chars.
- `makePowerTripEquation()` — answer always a positive integer; matches the display.
- `makeDanceSequence()` — length 4, valid directions.
- `makeAuditGrid(recipes)` — 16 cells, answer = count of target, `null` when <3 emoji.
- `pickCompleteTheDish(recipes)` — hides one plate item; `null` when no 2+-item recipe.
- `getIngredientTargets` / `getProducesValues` — dedup; fall back to all recipes.

#### `data/starThresholds.ts` — ⬜
`computeStarThresholds(options, playerCount)` — monotonic 1<2<3; scales with player
count & shift duration. (Drives the GameOver star rating.)

#### `data/recipes.ts` — 🟡
Done: reward-band audit. ⬜ `getEnabledStations` (distinct stations for a recipe set;
empty set), `hashStr` stability.

#### `data/adventureMode.ts` — ✅ done
#### `data/adventureBosses.ts` — ✅ done
#### `data/adventureRecipeDraft.ts` — ✅ done (`generateRecipeOffers`)
#### `data/recipeProfile.ts` — ✅ done (profile + archetype audit)
#### `data/recipeSteps.ts` — ✅ done (`orderStepsForDisplay`)
#### `state/storage.ts` — ⬜ (small)
`getJSON` returns fallback on missing/bad JSON; `set/get/remove` round-trip; never
throws when `localStorage` access throws (mock it to throw).
#### `state/types.ts` — ⬜ `toActiveEventOptions` projection only.

---

### P2 — Hooks  *(needs jsdom + `renderHook`)*

#### `hooks/useChoiceVote.ts` — ⬜ **(start here in P2)**
Plurality `!1..!N`, `!done`/`!skip`/`!pass`, one vote per user (re-vote moves it),
timer countdown + auto-resolve on expiry, pause freezes the timer, `forceResolve`,
tie-break (lowest index). Pure-ish state machine → easiest hook to test. Fake timers.

#### `hooks/usePvpLobby.ts` — ⬜
`handleLobbyJoin` (`!red`/`!blue`/`!join`/`!join red|blue`, auto-join smaller team,
move between teams), `handleLobbyMetaCommand` (`!balance`, `!move`, `!kick`, mod-gated),
`balanceLobby` even shuffle (seed RNG). Ref-mirror correctness (pitfall #11/#12).

#### `hooks/useAdventureLobby.ts` — ⬜
`!join`/`!leave`/`!quit` consumption, `!kick @name` (mod-only, not-found toast),
`!clear`, `!start` → `'start'`, host never auto-seeded.

#### `hooks/useAdventureRun.ts` — 🟡 (`buildShiftReset` indirectly covered)
`buildShiftReset` boss+garnish composition order, shift advance & goal recompute in
`closeShop`, participant re-count from live roster, save/resume round-trip
(`persist/loadSavedAdventureRun`), best-run persistence, reroll pricing.
`buildShiftReset` is **pure and can be exported for a P1-style test** — promote it.

#### `hooks/useGameSession.ts` — ⬜
High-score update only on improvement, history capped at 5, `resetSession` clears
storage. (Mock `storage`.)

#### `hooks/useKitchenEvents.ts` — ⬜
Spawn timer within [min,max], command-match resolve threshold
(`RESOLVE_THRESHOLD_RATIO` of players), fail path dispatches the debuff, audio
triggers fire, pause halts the lifecycle. Fake timers; mock `AudioManager`.

#### `hooks/useGameLoop.ts` — ⬜
First order at >2 s, interval honours `orderSpawnRate` + dynamic player multiplier +
empty-queue boost, game-over fires once at `timeLeft<=0`, paused skips TICK. Fake timers.

#### `hooks/useBotSimulation.ts` — ⬜
Action priority: extinguish overheated → cool ≥60 → serve → cook; skips
`cutting_board`/`mixing_bowl` when cooling; respects cooldown.

#### `hooks/useTutorialState.ts` — ⬜
Step advance/back, event step gating, `persistHideTutorialPrompt`, reset.

#### `hooks/useTwitchChat.ts` / `useRoomHost.ts` — ⬜ *(integration — low priority)*
External I/O (tmi.js / socket.io). Mock the client; assert connect/disconnect
lifecycle and the message/`onPlayerCommand` callback wiring. Cover at P4 instead if
mocking proves brittle.

---

### P3 — Components  *(needs jsdom + RTL)*

#### Interactive / logic-bearing (test these)
- **`App.tsx` — `routeChatCommand` integration** ⬜: drive the three sources through a
  rendered `<App/>`; assert lobby joins, vote routing, mod commands, and the tutorial
  asymmetry. This is the highest-value component test (the seam three input paths share).
- **`controller/VoteScreen.tsx`** ⬜: renders options/tally/timer; tap sends `!N`; resets
  on round change; "Locked in" when resolved.
- **`PvPLobby.tsx`** ⬜: drag-to-team, balance button, kick, unassigned pool.
- **`GameOver.tsx`** ⬜: score formula display, star tiers, auto-restart Cancel persists
  off (pitfall #16), PvP winner banner.
- **`OrderTicket.tsx`** ⬜: reward preview uses the proportional bonus; glitched render.
- **`EventCardOverlay.tsx`** ⬜: dance memorise→type phases; per-event theming.

#### Presentational (skip or smoke-test only)
`StatsBar`, `Station`, `PreparedItems`, `AssemblyArea`, `ChatPanel`, `MainMenu`,
`ModeHub`, `Countdown`, `CreditsScreen`, `FoodIcon`, `Toast`, modals — render-without-crash
smoke tests at most; their logic lives in hooks/data already covered.

---

### P4 — End-to-end (Playwright)

Full-stack confidence on the seams units stub. Run against `npm run dev` + the relay
server. Keep these few and high-level:
1. **Free Play round** — start from playset → cook → serve → game over with a score.
2. **Adventure run** — lobby `!join` → recipe draft vote → briefing → shift → pass →
   pantry purchase → next shift; verify save/resume via the ModeHub pill.
3. **PvP** — lobby team assignment (drag + `!red`/`!blue`) → per-team scoring →
   winner banner.
4. **Local Play co-play** — open `/play` controller, join the room, vote in an Adventure
   draft from the phone (the bug fixed in PR #93), and issue an in-game command.
5. **Twitch + phone co-play** — both input sources drive the same game simultaneously.

---

## 6. Coverage goals & CI

- **Targets (lines):** `state/` + `data/` ≥ 90 %, hooks ≥ 70 %, components best-effort.
  These two folders are the engine; hold them high.
- **CI gate:** add `npm test` (and later `vitest run --coverage` with thresholds) to the
  build pipeline. Today there is no CI config — a single GitHub Action running
  `npm ci && npm run lint && npm run build && npm test` would cover lint + types + tests.
- **Pre-merge:** the suite must be green; new reducer actions or data helpers ship with
  tests in the same PR.

---

## 7. Quick-start backlog (in order)

1. **P0 finish** — `SPAWN_ORDER`, `RESET`, kitchen-event reducer actions, garnish runtime
   hooks (Doppelgänger/Bloodhound/First Bite/Roulette). *(~20 tests, no deps)*
2. **P1 economy/RNG** — `applyAllGarnishes`, `getGarnishPrice`, `seededRng`,
   `computeStarThresholds`, kitchen-event generators, `getEnabledStations`, `storage`.
   *(~30 tests, no deps)*
3. **Add jsdom harness** (one-time: dep + `vitest.config.ts`).
4. **P2 hooks** — `useChoiceVote` → `usePvpLobby`/`useAdventureLobby` →
   `useAdventureRun` (export `buildShiftReset`) → `useGameSession` → loop/events/bots.
5. **P3 components** — `routeChatCommand` integration, `VoteScreen`, `PvPLobby`,
   `GameOver`.
6. **P4 e2e** — the five flows above, once the unit base is solid.
