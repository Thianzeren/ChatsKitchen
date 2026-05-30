# Adventure Build-System Rework — Umbrella Design

**Date:** 2026-05-29
**Status:** Design outcome (umbrella). Sub-projects A/B/C each get their own spec → plan → build cycle.

---

## Problem

Adventure mode currently feels samey, especially in its back half:

- **Recipes flatline.** Active recipe count is capped at 3 from shift 3 onward, drawn from a single locked cuisine. Shifts 3–8 cook the same three dishes.
- **Cuisine is a one-time lock** with little ongoing strategic weight.
- **Path cards add no depth.** The Easy/Risk goal±% + cash-bonus lever is shallow.
- **Garnishes are mostly flat additive stat boosts** with little synergy — there is no real "build."
- **Money values are too high** for the cosy-kitchen fantasy ($35–$75 per dish).

## Vision

Make **recipe selection the build-enabling unit.** Over a run, chat drafts dishes from across **all** cuisines, each dish legibly characterised by tunable knobs (reward, complexity, prep time, station footprint). Garnishes are retuned to reward leaning into recipe archetypes, so recipe picks + garnish purchases compose into coherent **builds** — Balatro-style — rather than a pile of independent stat bumps. Money is rescaled to a believable cafe / average-restaurant range.

## Design Pillars

1. **Recipes are the build axis.** What you add to your menu defines your strategy.
2. **Legible knobs.** Reward, complexity, prep time, and station footprint are visible and meaningful.
3. **All cuisines, always.** No cuisine lock; cuisine is a flavour tag, not a constraint.
4. **Choice with a cost.** Adding a recipe widens variety/spread; skipping keeps the menu lean. Both are valid.
5. **Cafe-scale economy.** Dish prices read like a real cafe (~$5–$25).

---

## Decomposition (A → B → C)

The three sub-projects share one spine — a formal set of **recipe knobs** (the `RecipeProfile`). That shared model is what lets recipes and garnishes be retuned "around the knobs" as the user requested.

### Sub-project A — Recipe Archetype Model *(foundation)*
Formalise the knobs and add a `RecipeProfile` characterisation derived from step data + a minimal authored override. Retune the dish catalog so clear archetypes exist, add gap-filler dishes, and rescale rewards to the cafe range. Pure data + one shared helper; **no flow changes.** Unblocks B and C.

Spec: `2026-05-29-adventure-recipe-archetype-model-design.md`

### Sub-project B — Recipe Draft & Run-Flow Rework
Drop path-pick, the cuisine lock, and auto-unlock. Add the all-cuisine **Recipe Pick** screen (add one / skip), an opening draft at run start, free menu growth, boss **auto-assignment** with briefing preview, and a re-tuned goal model for a player-grown menu. Consumes A's profiles to roll and display offers. **Depends on A.**

Spec: *(to be written when B is brainstormed)*

### Sub-project C — Garnish Build Rework
Retune/expand garnishes so they key off the knobs/tags (e.g. reward-per-step, fast-dish bonuses, station-focus payoffs), plus shop tier curation. The payoff layer that turns recipe choices into builds. **Depends on A; best specced after B exists.**

Spec: *(to be written when C is brainstormed)*

---

## Cross-Cutting Constraint: the Money Rescale

Rewards drop ~3× (to ~$5–$25). The old money scale is referenced across all three sub-projects, so the rescale is a **binding release constraint**, not contained to A:

| Number | Old scale | Owner |
|--------|-----------|-------|
| Recipe rewards + serve time-bonus cap | $35–75 base, +$30 bonus | **A** |
| `PER_PLAYER_GOALS` (shift goals) | 80–600 | **B** |
| Garnish prices, tips, combo/boss money, penalties | flat $ (+$8 / +$50 / −$20 / …) | **C** |

- **Free Play self-corrects:** star thresholds recompute from average reward (see `starThresholds.ts`). High-score numbers shrink — acceptable.
- **Adventure breaks** if A's rescale ships without B's goal retune (goals become unreachable). **Therefore A and B must release together.** C can follow, but until C's garnish/boss money is rescaled, those flat bonuses will be over-powered relative to the new dish prices — so C should follow promptly.

**Release order:** A + B together, then C promptly.

---

## Out of Scope (whole rework)

- No change to the core cooking loop, stations, heat, or kitchen-event mechanics.
- No change to PvP or Free Play modes beyond the shared recipe-data rescale.
- No new persistence keys beyond what B requires for the changed run state.
- Station capacity is already removed and stays removed.
