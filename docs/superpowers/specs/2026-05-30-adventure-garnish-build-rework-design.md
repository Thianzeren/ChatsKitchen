# Sub-project C — Garnish Build Rework

**Date:** 2026-05-30
**Part of:** [Adventure Build-System Rework](./2026-05-29-adventure-build-system-design.md) (A → B → C)
**Depends on:** Sub-project A (`getRecipeProfile`, archetype tags) and B (recipe-draft run flow).
**Status:** Approved design; ready for implementation planning.

---

## Goal

Rebuild the Adventure garnish catalog around the six `RecipeProfile` archetype tags so that recipe drafting (B) and garnish purchases compose into coherent **builds** — the payoff layer of the build system. Rescale the garnish economy (prices, flat-money effects, reroll, boss penalties) to the cafe scale from A, and give the shop tier-curated offers that rise across the run with a spike before each boss.

## Non-Goals

- No recipe or run-flow changes (A and B are done).
- No new screens; the Pantry shop screen stays (touched only if a garnish field changes).
- No PvP or Free Play changes.

---

## Architecture — Data-Driven Serve Triggers

Garnishes today split into stat-effects (composed in `applyAllGarnishes`) and triggered effects hardcoded as `active.includes('id')` checks scattered through the reducer. A ~23-garnish redesign must not add 15 more `if` blocks to SERVE.

**Add a data-driven on-serve trigger model.** Garnishes that fire on a served dish declare the trigger as data:

```ts
interface ServeTrigger {
  // condition (all present conditions must hold)
  requiresTag?: RecipeTag        // served dish must carry this archetype tag
  servedWithinMs?: number        // elapsed since the order spawned is below this
  // effect (accumulated across all firing garnishes)
  rewardMultiplier?: number      // multiplicative on base reward (scale-independent)
  flatBonus?: number             // cafe-scaled $ added after multipliers
}
```

At SERVE the reducer computes the served recipe's profile once via `getRecipeProfile`, then `applyServeTriggers(activeGarnishIds, profile, { elapsedSinceSpawn })` walks the active garnishes and returns `{ multiplier, flatBonus }`. This replaces the hardcoded `speed_demon`, `pressure_tip`, `glass_kitchen` (its +50% all-dish multiplier), and the cut `big_tippers`/`combo_plate`/`long_memory`/`repeat_customer` blocks. A serve-trigger with no condition (e.g. Glass Kitchen) fires on every serve; one with `requiresTag` fires only when the served dish carries that tag.

**Stays bespoke** (doesn't fit a serve-trigger): Doppelgänger (duplication in COOK), Mise en Place (shift-start seeding), Phoenix Wing / Apprentice (timers), First Bite (first-order-of-shift flag), Bloodhound (overheat payout). **Stays stat** (`applyAllGarnishes`, unchanged shape): Quick Hands, Patient Diners, Heat Sink, Tip Jar, Snowball, Sharp Knives, Glass Kitchen's overheat-threshold delta.

`adventureGarnishes.ts` ends up owning: the catalog (with optional `effects` and/or `serveTrigger`), `applyAllGarnishes` (unchanged), the new `applyServeTriggers`, and the shop/pricing helpers.

---

## The Catalog (~23 garnishes)

Money values are cafe-scaled; multipliers are scale-independent. Exact %/$ are calibration targets for the plan. "How": serveTrigger (S) / stat (T) / bespoke (B).

### 🟡 Premium — draft ●●● showpieces, amplify their value
| Garnish | Tier | Effect | How |
|---|---|---|---|
| Fine Dining | common | Premium dishes earn +25% | S |
| First Bite | rare | First dish served each shift sells 3× | B |
| Michelin Star | legendary | Premium dishes earn +75% | S |

### 🟢 Value — lean cheap menu, churn volume
| Penny Pincher | common | Value dishes +$3 | S |
| Value Meal | rare | Value dishes earn +50% | S |
| Dollar Menu | legendary | Value dishes +$8 | S |

### 💨 Fast — quick dishes, high turnover
| Quick Bite | common | Any dish served <15s after spawn: +20% | S (timing) |
| Drive-Thru | rare | Fast dishes earn +35% | S |
| Time Is Money | legendary | Bonus scales with patience remaining (up to +50%) | B |

### 🐢 Slow — a few showpieces, maximise each
| Low & Slow | common | Slow dishes +$5 | S |
| Slow-Cooked | rare | Slow dishes earn +50% | S |
| Worth the Wait | legendary | Slow dishes earn 2× | S |

### 🔪 Prep-Heavy — heat-free menu, no overheat risk
| Cold Kitchen | common | Prep-heavy dishes +$4 | S |
| Mise en Place | rare | Start each shift with 5 prepped ingredients | B |
| Sharp Knives | legendary | Chopping is instant | T |

### 🔥 Hot-Line — high-heat menu, profit from the fire
| Fire Whisperer | common | Hot-line dishes earn +30% | S |
| Bloodhound | rare | Each overheat earns +$12 | B |
| Glass Kitchen | legendary | Overheat at 60 instead of 100, but all dishes +50% | T + S |

### ⚪ Neutrals (any build)
| Quick Hands | common | +15% cooking speed | T |
| Patient Diners | common | Patience drains 20% slower | T |
| Tip Jar | common | +$2 flat per dish | T |
| Heat Sink | common | Cooling removes +30 more heat | T |
| Snowball | legendary | +8% cooking speed per shift survived | T |
| Doppelgänger | legendary | 20% chance to duplicate a cooked item | B |

**Cut** (weak/redundant, removed from the catalog and any reducer references): Slow Rush, Precise Cuts, Insulation, Friendly Faces, Slow Burner, Combo Plate, Long Memory, Repeat Customer, Big Tippers, Speed Demon, Pressure Tip, Tea Break, Compost Bin, Loose Lid, Side Salad, Veteran's Tip, Phoenix Wing, The Apprentice. *(Implementation note: some of these have bespoke reducer/RESET wiring — `combo_plate`, `long_memory`, `repeat_customer`, `big_tippers`, `speed_demon`, `pressure_tip`, `loose_lid`, `phoenix_wing`, `apprentice`, `veterans_tip` — all of which must be removed so no dead references remain. Mise en Place's seeding and the heat-decay RESET fields stay only if their garnish survives; here Loose Lid is cut, so `heatDecayAboveThreshold`/`heatDecayRate` wiring is removed.)*

Every archetype tag has ≥2 supporting garnishes. ~23 total.

---

## Economy Rescale

New per-player goals are $20–200/shift (vs old $80–600), so prices and flat effects drop ~3–4×.

**Garnish base prices** (the `× crew × (1 + 0.15×(shift−1))` scaling and $5 rounding are unchanged):
| Tier | New base |
|------|----------|
| Common | $20–35 |
| Rare | $45–70 |
| Legendary | $90–130 |

**Reroll:** `$25 × 2^rerolls × crew` (was `$100×…`).

**Flat serve effects:** the $2–$8 values above are already cafe-scaled. Multipliers (1.25×–3×) unchanged.

**Boss money:** Bad Reviews penalty −$20 → **−$5** per lost order. (Picky Critic 0.75× and Glass Kitchen +50% are multipliers — unchanged.)

---

## Shop Tier Curation

`generateShopOffers(owned, shift, participantCount, count=4)` becomes tier-weighted: each of the 4 slots rolls a **tier** by a shift-dependent weight, then picks a random un-owned garnish of that tier (no dupes within a visit; fall back to an adjacent tier if a tier is exhausted of un-owned garnishes). Seeding stays deterministic per `runSeed + shift` so offers are stable across re-render. `shift` here is the **upcoming** shift (the shop runs after shift N, for shift N+1).

| Upcoming shift | Common | Rare | Legendary |
|----------------|--------|------|-----------|
| 2 | 80% | 18% | 2% |
| 3 | 70% | 25% | 5% |
| **4 (boss)** | 50% | 35% | **15%** |
| 5 | 60% | 30% | 10% |
| 6 | 50% | 35% | 15% |
| 7 | 40% | 40% | 20% |
| **8 (boss)** | 30% | 40% | **30%** |

Early shops build the foundation (mostly common); the pre-boss shops (feeding shifts 4 & 8) spike rare/legendary odds so chat can gear up; late game trends powerful. Per-slot rolls are independent (a lucky S8 shop may show multiple legendaries — cost-gated by the bank). Exact weights are calibration targets.

---

## File Plan

**Modified:**
- `src/data/adventureGarnishes.ts` — rewrite `GARNISHES` (~23, with `effects`/`serveTrigger`); rescale base prices; add `ServeTrigger` type + `applyServeTriggers`; rewrite `generateShopOffers` (tier-weighted by upcoming shift + boss boost, no dupes, owned-aware, seeded); keep `applyAllGarnishes` shape; remove cut garnishes and any now-unused fields.
- `src/state/gameReducer.ts` — SERVE computes `getRecipeProfile(servedRecipe)` once and calls `applyServeTriggers`, replacing the cut/triggered hardcoded blocks; rescale Bloodhound overheat payout; keep bespoke Doppelgänger/Mise en Place/First Bite; remove RESET/state wiring for cut garnishes (Loose Lid heat-decay, Phoenix Wing auto-extinguish, Apprentice timer) and their action fields.
- `src/hooks/useAdventureRun.ts` — reroll constant `$100→$25`; remove Veteran's Tip bank logic (cut); the `buildShiftReset` seeds for cut garnishes (phoenix/apprentice/loose-lid) removed.
- `src/data/adventureBosses.ts` — Bad Reviews `lostOrderPenalty` `20→5`.
- `src/components/AdventurePantryShop.tsx` — only if a garnish display field changed (reads name/desc/tier/price — expected unaffected).
- Docs: CLAUDE.md garnish section + the game-design doc.

**New tests:**
- `applyServeTriggers` — tag-gated and timing-gated multiplier/flat accumulation; non-matching dishes get nothing; multiple garnishes compose.
- `generateShopOffers` — returns `count` un-owned garnishes, no dupes, deterministic per `runSeed+shift`, respects owned (degrades when a tier is exhausted), and the boss-shop weighting differs from the adjacent non-boss shift.

---

## Acceptance Criteria

- Catalog is ~23 garnishes; every archetype tag (`fast`, `slow`, `premium`, `value`, `prep_heavy`, `hot_line`) is supported by ≥2 garnishes.
- All cut garnishes are gone with **no dangling references** anywhere (reducer, RESET action type, useAdventureRun, components, tests).
- `applyServeTriggers` correctly accumulates tag/timing-gated multipliers and flat bonuses, driven by `getRecipeProfile`; unit-tested.
- `generateShopOffers` is tier-weighted by the upcoming shift with the S4/S8 boss boost, deterministic, owned-aware, no dupes; unit-tested.
- Garnish prices, reroll cost, flat-money effects, and boss penalties are on the cafe scale.
- `npm run build`, `npm run lint`, and all tests pass.

## Open Calibration Notes (settle in playtest)

- Exact garnish %/$ values and base prices within the tier bands.
- The tier-weight percentages (and how aggressive the boss-shop spike is).
- Whether any cut garnish is worth keeping after playtest (the catalog is intentionally lean to start).
