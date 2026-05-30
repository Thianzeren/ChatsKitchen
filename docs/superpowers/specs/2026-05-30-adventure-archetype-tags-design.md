# Adventure — Surface Recipe Archetype Tags

**Date:** 2026-05-30
**Status:** Design approved; pending spec review
**Branch:** `feat/adventure-archetype-garnish-tweaks`

## Problem

Adventure garnishes describe their effects in terms of recipe **archetypes** —
e.g. *"Premium dishes earn +25%"* (Fine Dining), *"Prep-heavy dishes earn +$4"*
(Cold Kitchen), *"Hot-line dishes earn +30%"* (Fire Whisperer). These archetype
tags (`premium`, `value`, `fast`, `slow`, `prep_heavy`, `hot_line`) are derived
per recipe in `src/data/recipeProfile.ts` and already drive garnish serve-triggers
via `getRecipeProfile`.

But the tags are **never shown in the UI** — not on the recipe-draft cards, not on
the shift briefing menu, and not in the Pantry shop. A player reading "Premium
dishes earn +25%" has no way to know which of their menu dishes count as
"premium," so the garnish-buying decision is opaque.

## Goal

Surface each recipe's archetype tags wherever the player reasons about recipes and
garnishes, so synergies are legible. **Purely presentational** — surface data that
already exists. No changes to `GameState`, the reducer, garnish effects, or the tag
derivation thresholds.

## Design

### 1. Shared tag metadata — `src/data/recipeProfile.ts`

Add a single source of truth so all surfaces render chips identically:

```ts
export const TAG_META: Record<RecipeTag, { label: string; icon: string; color: string }> = {
  premium:    { label: 'Premium',    icon: '💎', color: '#d4af37' }, // gold
  value:      { label: 'Value',      icon: '🪙', color: '#c08a3e' }, // copper
  fast:       { label: 'Fast',       icon: '⚡', color: '#e0a52b' }, // amber
  slow:       { label: 'Slow',       icon: '🐢', color: '#5a8bb0' }, // slate-blue
  prep_heavy: { label: 'Prep-Heavy', icon: '🧊', color: '#3f9e92' }, // teal
  hot_line:   { label: 'Hot Line',   icon: '🌶️', color: '#d94f4f' }, // red
}
```

Labels deliberately mirror the garnish copy ("Premium dishes…", "Hot-line
dishes…"). Two icons intentionally echo existing garnishes (🪙 ↔ Penny Pincher,
🌶️ ↔ Fire Whisperer) to reinforce the synergy visually.

Also add a small read-only helper for the shop summary:

```ts
// Aggregate archetype tag counts across a set of recipe keys (the active menu).
export function getMenuTagCounts(recipeKeys: string[]): Map<RecipeTag, number>
```

Iterates `recipeKeys`, looks up `RECIPES[key]`, runs `getRecipeProfile`, and tallies
each tag. Returns a map; callers render in a fixed `TAG_META` key order for stable
layout.

### 2. Shared component — `src/components/ArchetypeChip.tsx` (+ `.module.css`)

One presentational component reused by all three surfaces:

```ts
interface Props { tag: RecipeTag; count?: number }
```

Renders `icon + label`, tinted with `TAG_META[tag].color` (color used for text +
subtle border/background tint). When `count` is provided (shop summary), appends
`×{count}`. Small, self-contained, no dependencies beyond `TAG_META`.

### 3. Surfaces

All three read tags via `getRecipeProfile(recipe).tags` (or the menu helper). No new
props threaded through state.

| Surface | Change |
|---------|--------|
| `AdventureRecipePick.tsx` | Chip row under the dish name, above the Complexity/Reward/Prep stat tiles. `profile` is already computed per card. |
| `AdventureBriefing.tsx` | Chip row inside each menu recipe row, under the recipe name. Compute `getRecipeProfile(recipe).tags`. |
| `AdventurePantryShop.tsx` | A "Your menu" summary strip near the header showing aggregated chips with counts via `getMenuTagCounts(run.currentRecipes)`. **No per-offer-card matching badge** (explicitly out of scope). |

### Multi-tag handling

A recipe can carry up to ~4 tags (`fast` XOR `slow`; `value` XOR `premium`; plus
`prep_heavy` and/or `hot_line`). Render **all** derived tags; the chip row wraps. No
truncation or capping.

## Out of scope

- Per-offer-card "matches your menu" badge in the shop (explicitly declined).
- Any change to tag derivation thresholds in `recipeProfile.ts`.
- Any change to garnish effects, pricing, or shop offer generation.
- Reducer / `GameState` / type changes (beyond exporting `TAG_META` + the helper).

## Testing / verification

No automated test framework in repo. Verify via:
- `npm run build` (tsc -b + vite) and `npm run lint` — green.
- Manual Playwright walkthrough of the three screens: opening draft card shows
  chips, briefing menu shows chips, Pantry shop shows the "Your menu" summary strip.
