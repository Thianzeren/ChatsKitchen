# Sub-project B — Recipe Draft & Run-Flow Rework

**Date:** 2026-05-29
**Part of:** [Adventure Build-System Rework](./2026-05-29-adventure-build-system-design.md) (A → B → C)
**Depends on:** Sub-project A (Recipe Archetype Model) — uses `getRecipeProfile`.
**Status:** Approved design; ready for implementation planning.

---

## Goal

Replace Adventure's cuisine-lock + path-pick + auto-unlock with a single **Recipe Pick** loop: chat drafts dishes from **all** cuisines over the run (add one or skip), building a player-grown menu. Recalibrate the shift goals for the cafe-scale economy from sub-project A. Bosses become auto-assigned. This is the change that makes A shippable (it replaces the goals A's rescale left unreachable).

## Non-Goals

- No garnish rework / build-payoff synergies (sub-project C). The Pantry shop is unchanged except for its position in the flow.
- No changes to the cooking loop, stations, heat, kitchen events, PvP, or Free Play.
- No new persistence keys beyond the `SavedAdventureRun` shape change.

---

## Run Flow

**Run start** (replaces the Cuisine Pick screen):
```
adventurelobby → adventurerecipepick (opening draft) → adventurebriefing (S1) → countdown → playing
```

**Between shifts** (replaces the Path Pick screen):
```
shiftend → adventureshiftpassed → adventurerecipepick (add 1 / skip) → adventurepantryshop → adventurebriefing → …
```

- The **Recipe Pick** screen is used both at run start (opening draft) and after every Shift Passed.
- The Pantry shop runs **after** the Recipe Pick (build menu, then buy garnishes). No shop before S1 (unchanged from today).
- **Menu growth:** S1 = 1 recipe (the opening draft pick). Each of the 7 between-shift picks adds 1 recipe or skips. A run ends with 1–8 active recipes.
- **All owned recipes are active** — orders spawn from the entire current menu. No active-loadout cap, no equip step.

## Recipe Pick Screen

New component `src/components/AdventureRecipePick.tsx` (+ `.module.css`), mirroring `AdventureCuisinePick` (carousel, timer bar, pause button, `useChoiceVote` + `adventureVoteRef` interception).

- **Offers:** exactly 3 recipes drawn from **all cuisines**, excluding recipes already on the run's menu. Deterministic per run: seeded by `runSeed + shift` (same mulberry32/hash approach as `adventurePathCards.ts`).
- **Per-card display** (via A's `getRecipeProfile`): dish name + emoji, complexity pips (●●○), reward ($), prep time (~Ns), and the step list (reuse the cuisine-pick card's recipe-row layout).
- **Voting:** `!1`/`!2`/`!3` add the winning recipe to the menu. `!skip` (using `useChoiceVote`'s `allowDoneCommand`, which already accepts `!done`/`!skip`/`!pass`) commits a skip. The timer auto-resolves to the plurality leader; if skip leads, or there are no votes, nothing is added.
- **Pool exhausted:** if fewer than 3 un-owned recipes remain, offer however many remain; if zero remain, auto-advance to the shop without showing the screen.
- **Opening draft:** same screen + roll, seeded at shift 1 with an empty owned-list, so all 3 come from the full catalog.

New data module `src/data/adventureRecipeDraft.ts`:
```
generateRecipeOffers(runSeed: string, shift: number, ownedRecipes: string[]): string[]
```
Returns up to 3 recipe keys (seeded shuffle of all catalog keys minus `ownedRecipes`).

## Goal Model

Keep `goal = PER_PLAYER_GOALS[shift] × participantCount` (per-player × crew). Re-derive the table for the cafe scale and make the curve monotonic. **Proposed starting values** (calibration targets — tune in playtest):

| Shift | New goal | $/player/min | Notes |
|------|----------|--------------|-------|
| S1 | 20 | 6.7 | clearable with ~1–2 serves of one cheap dish |
| S2 | 35 | 11.7 | |
| S3 | 50 | 16.7 | |
| S4 | 70 | 23.3 | boss |
| S5 | 85 | 28.3 | |
| S6 | 110 | 36.7 | |
| S7 | 140 | 46.7 | |
| S8 | 200 | 66.7 | final boss |

- **Monotonic:** each shift's bar ≥ the previous; boss shifts (S4/S8) are elevated but the curve never dips after them.
- The old ×1.5 boss multiplier is **no longer baked into the table** — bosses apply their own debuffs (below); the table is the clean ramp.
- **Design stance:** a lean menu (one reliable dish) is a valid "consistency" strategy; a wide menu with premium (●●●) dishes raises the value ceiling needed for later goals. Neither dominates by tuning. Sub-project C's garnishes add the build payoff. No variety-bonus mechanic in B.

## Boss Handling

Bosses stay on **shifts 4 & 8**, now **auto-assigned** (no vote):
- At the transition into a boss shift, pick **1 boss** from `getBossPool()`, seeded by `runSeed + shift`. For Health Inspector, pre-roll its disabled station (`pickHealthInspectorStation`) so the briefing can name it.
- Store the chosen boss on the run as `currentBoss?: { id: string; disabledStationId?: string }` (boss id typed as `string`, not `BossId`, to avoid a `types.ts ↔ adventureBosses.ts` import cycle; the Health-Inspector payload rides along here, replacing `PathCard.bossPayload`). This replaces the boss role of `chosenPath`.
- `applyBossDebuff` is adapted to take `(bossId: string, disabledStationId?: string)` instead of a `PathCard` (a small signature change, since `PathCard` is retired). Its internal switch logic is otherwise unchanged. `buildShiftReset` calls it with `run.currentBoss`.
- The **briefing** previews the boss (icon, name, effect) — same info the path card showed, minus the choice.
- The Recipe Pick screen still runs on boss shifts (menu-building is independent of boss assignment).

`adventureBosses.ts`'s catalog (`BOSSES`), `getBossPool`, and `pickHealthInspectorStation` are reused unchanged; only `applyBossDebuff`'s parameter shape and the boss *selection* (auto vs vote) change.

## File Plan

**New:**
- `src/components/AdventureRecipePick.tsx` (+ `.module.css`)
- `src/data/adventureRecipeDraft.ts` (+ unit test)

**Removed:**
- `src/components/AdventureCuisinePick.tsx` (+ css)
- `src/components/AdventurePathPick.tsx` (+ css)
- `src/data/adventurePathCards.ts`
- `adventureMode.ts` cuisine/auto-unlock helpers: `pickStartingRecipe`, `pickAutoUnlockRecipe`, `getCuisineRecipeKeys`, `getAutoUnlockedRecipeCount`, `CUISINE_TO_RECIPE_SET_ID`, `pickRandomCuisine`. (Keep `getAdventureGoal`, `PER_PLAYER_GOALS`, `ADVENTURE_SHIFT_DURATION`, `isBossShift`, `mergePlayerStats`, `makeRunSeed`.)

**Modified:**
- `src/hooks/useAdventureRun.ts` — `startAdventure` rolls the opening draft → `adventurerecipepick`; `openRecipePick`/`confirmRecipePick`(add)/`skipRecipePick` replace `openPathPick`/`confirmPathCard`; `closeShop` drops auto-unlock and applies the auto-assigned boss; `buildShiftReset` reads `currentBoss`.
- `src/state/types.ts` — `AdventureRun`: drop `startCuisine`, `pendingPathCards`, `chosenPath`; add `pendingRecipeOffers: string[] | undefined` and `currentBoss?: { id: string; disabledStationId?: string }`. Retire the `PathCard` type. Remove now-unused `CuisineId` references in the adventure run path (keep `CuisineId`/`RECIPE_SETS` where Free Play / playset picker use them).
- `src/App.tsx` — `Screen` union: replace `adventurecuisinepick` + `adventurepathpick` with `adventurerecipepick`; render the new screen and wire its `voteRef`; update run-start, resume, and saved-run routing.
- `src/data/adventureMode.ts` — remove the helpers listed above.
- `SavedAdventureRun` — bump `version` (1 → 2); on version mismatch `loadSavedAdventureRun` returns null (stale saves discarded gracefully — the existing try/catch already handles this).

**Docs:** update the Adventure section of `CLAUDE.md` and the run-flow in `docs/game-design-and-mechanics.md`.

## Cross-Cutting Constraint

**A + B ship together.** A's reward rescale made the old `PER_PLAYER_GOALS` unreachable; B installs the recalibrated curve. Until B merges, Adventure is unwinnable — so neither A nor B should reach production alone. Sub-project C (garnish rework) follows.

## Acceptance Criteria

- A full 8-shift run plays start→finish: lobby → opening draft → (shift → shift-passed → recipe pick → shop → briefing) ×7 → run end.
- The menu grows by chat vote; `!skip` adds nothing; all owned recipes spawn as orders.
- Recipe offers are 3 un-owned dishes from all cuisines, deterministic per `runSeed + shift`; pool-exhaustion degrades gracefully (fewer offers, or auto-skip at zero).
- Bosses auto-apply on S4 & S8 with a briefing preview; their debuffs match today's behavior.
- Goals use the new monotonic table.
- Cuisine Pick + Path Pick screens, path-card generation, and auto-unlock helpers are removed; no dead references remain.
- Stale saved runs (old version) are discarded without crashing.
- `generateRecipeOffers` is unit-tested (count, no-dupes, determinism, pool-exhaustion).
- `npm run build`, `npm run lint`, and existing tests pass.

## Open Calibration Notes (settle in playtest)

- The 8 goal values (and whether boss shifts need a small extra bump given debuffs replace the old ×1.5).
- Recipe Pick vote duration (start from the cuisine-pick `45_000` ms).
