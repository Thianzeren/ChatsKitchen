# Sub-project A — Recipe Archetype Model

**Date:** 2026-05-29
**Part of:** [Adventure Build-System Rework](./2026-05-29-adventure-build-system-design.md) (A → B → C)
**Status:** Approved design; ready for implementation planning.

---

## Goal

Give every recipe a legible, build-relevant profile derived from tunable knobs, and retune the dish catalog (including a reward rescale to cafe prices and gap-filler dishes) so that genuine archetypes exist. This is the shared foundation that sub-projects B (recipe draft / run flow) and C (garnish build rework) both consume.

A is **pure data + one shared helper.** It does not change run flow, screens, goals, or garnish/boss values.

## Non-Goals

- No run-flow, screen, cuisine-lock, auto-unlock, or goal changes (sub-project B).
- No garnish/boss money or synergy changes (sub-project C).
- No change to the cooking loop, stations, heat, or kitchen events.

---

## The Knob Model

New pure module **`src/data/recipeProfile.ts`**, exporting:

```ts
export function getRecipeProfile(recipe: Recipe): RecipeProfile
```

`RecipeProfile` is the single source of truth that B and C read through:

```ts
interface RecipeProfile {
  reward: number          // authored base reward (rescaled to cafe range)
  prepTimeMs: number      // DERIVED: sum of step.duration
  complexity: number      // DERIVED raw score (always computed; override does NOT change this)
  complexityPips: 1 | 2 | 3   // bucketed raw score, OR the authored override when set; chat-facing display
  stations: string[]      // DERIVED: distinct stations touched
  heatStations: string[]  // DERIVED: stations minus HEAT_EXEMPT_STATIONS
  tags: RecipeTag[]        // DERIVED archetype tags (synergy hooks for C)
}
```

Knob sources:

| Knob | Source |
|------|--------|
| `reward` | **Authored** (already on `Recipe`), rescaled in this sub-project |
| `prepTimeMs` | **Derived**: `sum(step.duration)` |
| `complexity` | **Derived** score + optional **authored override** |
| `stations` / `heatStations` | **Derived** from step stations + `HEAT_EXEMPT_STATIONS` |
| `tags` | **Derived** from the above |

The only new authored field on `Recipe`:

```ts
interface Recipe {
  // ...existing fields...
  complexityOverride?: 1 | 2 | 3   // wins over the derived bucket when set
}
```

`HEAT_EXEMPT_STATIONS` is imported from `recipes.ts` (never redefined) — covers `cutting_board`, `mixing_bowl`, `grinder`, `knead_board`.

---

## Complexity Formula

```
chainedSteps   = count of steps with a `requires` field
distinctStations = unique step.station count
raw = stepCount + 2 × chainedSteps + distinctStations − 2

pips: raw ≤ 3 → ●○○ (1)
      raw 4–5 → ●●○ (2)
      raw ≥ 6 → ●●● (3)
```

- `chainedSteps` is weighted ×2 because a `requires` dependency forces ordering — the real coordination tax.
- An authored `complexityOverride` (1–3) replaces the bucketed pip value when present; `complexity` (raw) is still computed for reference.

Worked examples against current data:

| Dish | steps | chains | stations | raw | pips |
|------|-------|--------|----------|-----|------|
| Grilled Cheese | 2 | 0 | 2 | 2 | ●○○ |
| Burger | 3 | 0 | 3 | 4 | ●●○ |
| Fish & Chips | 3 | 1 | 2 | 5 | ●●○ |
| _(hypothetical)_ 4 steps / 1 chain / 4 stations | 4 | 1 | 4 | 8 | ●●● |

> Current dishes cluster at 1–2 pips. That is expected — it is precisely why the catalog retune + gap-filler dishes add genuine ●●● options. The formula weights are calibration targets and may be nudged once profiled against the retuned catalog.

---

## Archetype Tags

Derived; a dish can hold several. These are the synergy hooks sub-project C keys off. Display on the Recipe Pick screen (sub-project B) uses the raw knobs ($reward, prep time, pips, station icons), not these tag names.

| Tag | Rule of thumb |
|-----|---------------|
| `fast` | prep time in the lowest band |
| `slow` | prep time in the highest band |
| `premium` | reward in the top band |
| `value` | reward in the bottom band |
| `prep_heavy` | majority of steps on heat-exempt (cold-prep) stations |
| `hot_line` | 2+ distinct heat-bearing stations |

Band thresholds (prep-time low/high, reward top/bottom) are constants in `recipeProfile.ts`, calibrated against the retuned catalog so each tag is meaningfully populated.

---

## Catalog Retune

### Reward rescale → $5–$25 (coupled to complexity)

**Reward tracks complexity.** Each dish is priced within the band set by its complexity pips (including any authored override) — pricier dishes are genuinely harder to make. This keeps pricing legible, at the cost of the "simple-but-premium" and "complex-but-cheap" cells: those archetypes do not exist under coupling. Build variety instead comes from **prep time, station footprint, and tags** (a ●●● dish can be `hot_line` or heat-free `prep_heavy`; a ●○○ dish can be `fast` volume).

| Complexity | Reward band |
|-----------|-------------|
| ●○○ (1) | $5–$9 |
| ●●○ (2) | $11–$18 |
| ●●● (3) | $19–$25 |

Because reward is coupled, a `complexityOverride` also moves the dish into the higher reward band — so overrides are applied together with the rescale. Full per-dish values are fixed in the implementation plan.

> Note: this supersedes some preview anchors. Salmon Donburi profiles to ●○○ (cook rice + chop + chop, no chains), so under coupling it is priced $5–$9, not $25.

### Serve time-bonus rescale (critical)

The reducer's SERVE path computes `timeBonus = floor((patienceLeft / patienceMax) × 30)` — a flat up-to-**$30** added on top of base reward. With base rewards ~3× lower, an unchanged +$30 would dominate a $7 dish (speed becomes the whole payout). Rescale the `30` cap to **~$9** (≈3× down) so fast-serving stays a meaningful edge, not the entire reward.

- Location: the SERVE handler in `gameReducer.ts`.
- Shared by all modes — consistent with the global reward rescale.
- Extract the cap to a named constant if not already, for one-line tuning.

### Gap-filler dishes

1. **Audit first:** profile all existing dishes through `getRecipeProfile` and inspect the archetype-tag spread (which cells are thin/empty).
2. **Then add ~4–6 dishes** to fill gaps. Expected candidates (final set driven by the audit):
   - An ultra-fast `value` snack/drink: 1 step, 1 station, ●○○ (e.g. a cold drink via `mix`/`grind`).
   - A `slow` + `premium` + `hot_line` ●●● showpiece: 4–5 steps across 3–4 heat-bearing stations.
   - A heat-free `prep_heavy` option for safe/no-overheat play.
3. New dishes follow existing `Recipe` conventions (emoji, steps, plate, patience) and slot into the appropriate cuisine tag.

---

## Impact & Dependencies

- **Free Play:** recipe data is shared. Star thresholds auto-recompute from average reward (`starThresholds.ts`), so they self-correct. Displayed high-score numbers shrink — acceptable.
- **Adventure:** A's reward rescale makes the existing `PER_PLAYER_GOALS` (80–600) unreachable. **A must release together with sub-project B** (goal retune). This is the binding constraint recorded in the umbrella doc.
- **Garnish/boss flat money** (sub-project C) stays in the old scale until C ships; until then those bonuses are over-powered relative to new dish prices. C should follow promptly.

---

## Acceptance Criteria

- `getRecipeProfile` returns a correct `RecipeProfile` for every recipe; derived fields match step data; `complexityOverride` takes precedence over the derived pip bucket.
- All dish rewards fall within the band dictated by their complexity pips ($5–9 / $11–18 / $19–25), overrides included.
- The serve time-bonus cap is rescaled (~$9) and lives in a named constant.
- Each archetype tag is populated by at least one dish after gap-fillers are added (no empty archetype after the retune).
- `npm run build` and `npm run lint` pass.
- No run-flow, screen, goal, or garnish code is touched.

## Open Calibration Notes (settle during implementation)

- Final complexity formula weights and pip thresholds, validated against the profiled catalog.
- Exact prep-time and reward band thresholds for the tags.
- Final gap-filler dish list (post-audit).
