# Adventure Archetype Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface each recipe's archetype tags (`premium`, `value`, `fast`, `slow`, `prep_heavy`, `hot_line`) on the Adventure recipe-draft cards, the shift-briefing menu, and a "Your menu" summary strip in the Pantry shop, so players can see which garnishes synergize with their dishes.

**Architecture:** Purely presentational. Add shared tag metadata + helpers to `src/data/recipeProfile.ts` (single source of truth), a small reusable `ArchetypeChip` component, then wire chips into three existing screens. No changes to `GameState`, the reducer, garnish effects, or tag-derivation thresholds.

**Tech Stack:** React 18 + TypeScript, Vite 5, CSS Modules. No test framework in repo — verification is `npm run build` + `npm run lint` per task, plus a Playwright visual walkthrough at the end.

**Spec:** `docs/superpowers/specs/2026-05-30-adventure-archetype-tags-design.md`

---

## File Structure

- **Modify** `src/data/recipeProfile.ts` — add `TAG_META`, `TAG_ORDER`, `orderedTags()`, `getMenuTagCounts()`; add `RECIPES` to the existing `./recipes` import.
- **Create** `src/components/ArchetypeChip.tsx` — one chip (icon + label, optional count), tinted by tag color.
- **Create** `src/components/ArchetypeChip.module.css` — chip layout.
- **Modify** `src/components/AdventureRecipePick.tsx` + `.module.css` — chip row on draft cards.
- **Modify** `src/components/AdventureBriefing.tsx` + `.module.css` — chip row per menu recipe.
- **Modify** `src/components/AdventurePantryShop.tsx` + `.module.css` — "Your menu" summary strip.

---

## Task 1: Tag metadata + helpers in recipeProfile.ts

**Files:**
- Modify: `src/data/recipeProfile.ts`

- [ ] **Step 1: Add `RECIPES` to the existing recipes import**

Change line 1 from:

```ts
import { Recipe, HEAT_EXEMPT_STATIONS } from './recipes'
```

to:

```ts
import { Recipe, RECIPES, HEAT_EXEMPT_STATIONS } from './recipes'
```

- [ ] **Step 2: Append metadata + helpers at the end of the file**

Add after the closing `}` of `getRecipeProfile` (end of file):

```ts
// ── Player-facing archetype metadata ─────────────────────────────────────────
// Labels mirror the garnish copy ("Premium dishes…", "Hot-line dishes…") so the
// synergy reads at a glance. Two icons intentionally echo existing garnishes
// (🪙 ↔ Penny Pincher, 🌶️ ↔ Fire Whisperer).
export const TAG_META: Record<RecipeTag, { label: string; icon: string; color: string }> = {
  premium:    { label: 'Premium',    icon: '💎', color: '#d4af37' },
  value:      { label: 'Value',      icon: '🪙', color: '#c08a3e' },
  fast:       { label: 'Fast',       icon: '⚡', color: '#e0a52b' },
  slow:       { label: 'Slow',       icon: '🐢', color: '#5a8bb0' },
  prep_heavy: { label: 'Prep-Heavy', icon: '🧊', color: '#3f9e92' },
  hot_line:   { label: 'Hot Line',   icon: '🌶️', color: '#d94f4f' },
}

// Fixed display order for stable chip layout across every surface.
export const TAG_ORDER: RecipeTag[] = ['premium', 'value', 'fast', 'slow', 'prep_heavy', 'hot_line']

// Re-order a recipe's derived tags into the canonical display order.
export function orderedTags(tags: RecipeTag[]): RecipeTag[] {
  return TAG_ORDER.filter(t => tags.includes(t))
}

// Aggregate archetype tag counts across a set of recipe keys (the active menu).
export function getMenuTagCounts(recipeKeys: string[]): Map<RecipeTag, number> {
  const counts = new Map<RecipeTag, number>()
  for (const key of recipeKeys) {
    const recipe = RECIPES[key]
    if (!recipe) continue
    for (const tag of getRecipeProfile(recipe).tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return counts
}
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: PASS — no type errors, no lint errors. (New exports are unused so far; that is fine — `noUnusedLocals` only flags locals, not exports.)

- [ ] **Step 4: Commit**

```bash
git add src/data/recipeProfile.ts
git commit -m "feat(adventure): tag metadata + menu-tag helpers in recipeProfile"
```

---

## Task 2: ArchetypeChip component

**Files:**
- Create: `src/components/ArchetypeChip.tsx`
- Create: `src/components/ArchetypeChip.module.css`

- [ ] **Step 1: Create `ArchetypeChip.module.css`**

```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid currentColor;
  background: color-mix(in srgb, currentColor 12%, transparent);
  font-family: 'Fredoka', sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.3px;
  line-height: 1.4;
  white-space: nowrap;
}

.icon {
  font-size: 12px;
  line-height: 1;
}

.count {
  opacity: 0.8;
  font-weight: 700;
}
```

- [ ] **Step 2: Create `ArchetypeChip.tsx`**

```tsx
import { RecipeTag, TAG_META } from '../data/recipeProfile'
import styles from './ArchetypeChip.module.css'

interface Props {
  tag: RecipeTag
  count?: number
}

export default function ArchetypeChip({ tag, count }: Props) {
  const meta = TAG_META[tag]
  return (
    <span
      className={styles.chip}
      style={{ color: meta.color, borderColor: meta.color }}
      title={meta.label}
    >
      <span className={styles.icon}>{meta.icon}</span>
      <span>{meta.label}</span>
      {count !== undefined && <span className={styles.count}>×{count}</span>}
    </span>
  )
}
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: PASS. (The component is not yet imported anywhere — that compiles fine.)

- [ ] **Step 4: Commit**

```bash
git add src/components/ArchetypeChip.tsx src/components/ArchetypeChip.module.css
git commit -m "feat(adventure): ArchetypeChip presentational component"
```

---

## Task 3: Chips on recipe-draft cards

**Files:**
- Modify: `src/components/AdventureRecipePick.tsx`
- Modify: `src/components/AdventureRecipePick.module.css`

- [ ] **Step 1: Add imports**

In `AdventureRecipePick.tsx`, change the profile import line:

```ts
import { getRecipeProfile } from '../data/recipeProfile'
```

to:

```ts
import { getRecipeProfile, orderedTags } from '../data/recipeProfile'
```

Then add this import alongside the other component imports (after the `useChoiceVote` import is fine):

```ts
import ArchetypeChip from './ArchetypeChip'
```

- [ ] **Step 2: Render a chip row under the dish name**

Find this block (around lines 91-93):

```tsx
                <div className={styles.cardHero}>{r.emoji}</div>
                <div className={styles.cardName}>{r.name}</div>

                <div className={styles.statRow}>
```

Replace it with:

```tsx
                <div className={styles.cardHero}>{r.emoji}</div>
                <div className={styles.cardName}>{r.name}</div>

                {profile.tags.length > 0 && (
                  <div className={styles.tagRow}>
                    {orderedTags(profile.tags).map(t => <ArchetypeChip key={t} tag={t} />)}
                  </div>
                )}

                <div className={styles.statRow}>
```

- [ ] **Step 3: Add `.tagRow` style**

Append to `AdventureRecipePick.module.css`:

```css
.tagRow {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  margin: 2px 0 6px;
}
```

- [ ] **Step 4: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/AdventureRecipePick.tsx src/components/AdventureRecipePick.module.css
git commit -m "feat(adventure): archetype chips on recipe-draft cards"
```

---

## Task 4: Chips on the briefing menu

**Files:**
- Modify: `src/components/AdventureBriefing.tsx`
- Modify: `src/components/AdventureBriefing.module.css`

- [ ] **Step 1: Add imports**

In `AdventureBriefing.tsx`, add after the existing `recipeSteps` import line (`import { orderStepsForDisplay } from '../data/recipeSteps'`):

```ts
import { getRecipeProfile, orderedTags } from '../data/recipeProfile'
import ArchetypeChip from './ArchetypeChip'
```

- [ ] **Step 2: Compute tags and render a chip row per menu recipe**

Find this block (around lines 131-141):

```tsx
          {run.currentRecipes.map((key, i) => {
            const recipe = RECIPES[key]
            if (!recipe) return null
            return (
              <div key={key} className={`${styles.recipeCard} ${i > 0 ? styles.recipeCardBorder : ''}`}>
                <div className={styles.recipeHeader}>
                  <FoodIcon icon={recipe.emoji} size={24} className={styles.recipeEmoji} />
                  <span className={styles.recipeName}>{recipe.name}</span>
                  <span className={styles.recipeReward}>${recipe.reward}</span>
                </div>
                <div className={styles.recipeSteps}>
```

Replace it with:

```tsx
          {run.currentRecipes.map((key, i) => {
            const recipe = RECIPES[key]
            if (!recipe) return null
            const tags = orderedTags(getRecipeProfile(recipe).tags)
            return (
              <div key={key} className={`${styles.recipeCard} ${i > 0 ? styles.recipeCardBorder : ''}`}>
                <div className={styles.recipeHeader}>
                  <FoodIcon icon={recipe.emoji} size={24} className={styles.recipeEmoji} />
                  <span className={styles.recipeName}>{recipe.name}</span>
                  <span className={styles.recipeReward}>${recipe.reward}</span>
                </div>
                {tags.length > 0 && (
                  <div className={styles.tagRow}>
                    {tags.map(t => <ArchetypeChip key={t} tag={t} />)}
                  </div>
                )}
                <div className={styles.recipeSteps}>
```

- [ ] **Step 3: Add `.tagRow` style**

Append to `AdventureBriefing.module.css`:

```css
.tagRow {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 4px 0 2px;
}
```

- [ ] **Step 4: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/AdventureBriefing.tsx src/components/AdventureBriefing.module.css
git commit -m "feat(adventure): archetype chips on briefing menu"
```

---

## Task 5: "Your menu" summary strip in the Pantry shop

**Files:**
- Modify: `src/components/AdventurePantryShop.tsx`
- Modify: `src/components/AdventurePantryShop.module.css`

- [ ] **Step 1: Add imports**

In `AdventurePantryShop.tsx`, change the garnish import line:

```ts
import { GARNISHES } from '../data/adventureGarnishes'
```

to add the new lines after it:

```ts
import { GARNISHES } from '../data/adventureGarnishes'
import { getMenuTagCounts, TAG_ORDER } from '../data/recipeProfile'
import ArchetypeChip from './ArchetypeChip'
```

(`useMemo` is already imported on line 1.)

- [ ] **Step 2: Compute menu tag counts**

Find this line near the top of the component body (around line 20):

```tsx
  const offers = useMemo(() => run.pendingShopOffers ?? [], [run.pendingShopOffers])
```

Add directly below it:

```tsx
  const menuTagCounts = useMemo(() => getMenuTagCounts(run.currentRecipes), [run.currentRecipes])
```

- [ ] **Step 3: Render the summary strip below the header**

Find this block (around lines 99-104):

```tsx
      <div className={styles.header}>
        <div className={styles.title}>The Pantry</div>
        <div className={styles.subtitle}>Spend earnings on garnishes. Type <code>!1</code>, <code>!2</code>… to vote, or <code>!done</code> to leave.</div>
        <div className={styles.cashBadge}>${run.currentRunMoney}</div>
      </div>
```

Replace it with:

```tsx
      <div className={styles.header}>
        <div className={styles.title}>The Pantry</div>
        <div className={styles.subtitle}>Spend earnings on garnishes. Type <code>!1</code>, <code>!2</code>… to vote, or <code>!done</code> to leave.</div>
        <div className={styles.cashBadge}>${run.currentRunMoney}</div>
      </div>

      {menuTagCounts.size > 0 && (
        <div className={styles.menuTags}>
          <span className={styles.menuTagsLabel}>Your menu:</span>
          {TAG_ORDER.filter(t => menuTagCounts.has(t)).map(t => (
            <ArchetypeChip key={t} tag={t} count={menuTagCounts.get(t)!} />
          ))}
        </div>
      )}
```

- [ ] **Step 4: Add `.menuTags` styles**

Append to `AdventurePantryShop.module.css`:

```css
.menuTags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 0 0 10px;
}

.menuTagsLabel {
  font-family: 'Fredoka', sans-serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  opacity: 0.75;
}
```

- [ ] **Step 5: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/AdventurePantryShop.tsx src/components/AdventurePantryShop.module.css
git commit -m "feat(adventure): 'Your menu' archetype summary in Pantry shop"
```

---

## Task 6: Visual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (background)
Expected: Vite ready on `http://localhost:5173/`.

- [ ] **Step 2: Walk the Adventure flow with Playwright**

Navigate to `http://localhost:5173/` → Adventure → Continue Anyway → Got it → START RUN.

Verify each surface:
1. **Recipe-draft cards** — each of the 3 cards shows a wrapped row of color-coded chips (e.g. `💎 Premium`, `🌶️ Hot Line`) under the dish name, above the Complexity/Reward/Prep tiles.
2. Pick a dish → **briefing** — the menu recipe row shows the same chips under the recipe name.
3. To reach the **Pantry shop**: it appears between shifts (after passing shift 1 and adding a recipe). Confirm the "Your menu: …" strip renders aggregated chips with `×N` counts. (If reaching a live shop is impractical in the session, instead confirm the shop renders the strip by temporarily rendering it — but prefer the real flow if a pass can be driven via bots.)

Expected: chips render with correct icons, labels, and tint colors; rows wrap cleanly; no console errors.

- [ ] **Step 3: Final no-op commit / done**

If Steps 1-2 surfaced no issues, the feature is complete (all code already committed in Tasks 1-5). If a tweak was needed, commit it:

```bash
git add -A
git commit -m "fix(adventure): polish archetype chip rendering"
```

---

## Self-Review

- **Spec coverage:**
  - TAG_META (labels/icons/colors) → Task 1. ✓
  - `getMenuTagCounts` helper → Task 1. ✓
  - Shared `ArchetypeChip` → Task 2. ✓
  - Draft cards → Task 3. ✓
  - Briefing menu → Task 4. ✓
  - Shop "Your menu" summary strip, **no** per-card badge → Task 5. ✓
  - Multi-tag = render all, wrap → handled by `.tagRow { flex-wrap: wrap }` and `orderedTags` (Tasks 3-4). ✓
  - No reducer/state/type/effect/threshold changes → confirmed; only presentational edits + new exports. ✓
- **Placeholder scan:** none — every step shows exact code/commands.
- **Type consistency:** `RecipeTag` (existing export), `TAG_META`/`TAG_ORDER`/`orderedTags`/`getMenuTagCounts` defined in Task 1 and consumed with matching signatures in Tasks 2-5. `ArchetypeChip` props `{ tag, count? }` defined in Task 2, used consistently (no `count` on recipe cards, `count` in shop). ✓
