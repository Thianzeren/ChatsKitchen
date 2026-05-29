# Recipe Archetype Model (Adventure Sub-project A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a derived `RecipeProfile` characterization (reward, prep time, complexity, station footprint, archetype tags), rescale all dish rewards to a $5–$25 cafe range **coupled to complexity**, and add gap-filler dishes — the shared foundation for the Adventure build-system rework.

**Architecture:** One new pure module `src/data/recipeProfile.ts` exposes `getRecipeProfile(recipe)`. Complexity is derived from step data with an optional per-recipe override. **Reward is coupled to complexity**: every dish is priced within the band its complexity pips dictate (●○○ $5–9, ●●○ $11–18, ●●● $19–25). Build variety comes from prep time, station footprint, and tags rather than reward-vs-complexity tension. The serve time-bonus cap in the reducer is rescaled to match the new money scale. No run-flow, screen, goal, or garnish code is touched (those are sub-projects B and C).

**Tech Stack:** TypeScript, React 18, Vite 5. Tests via **Vitest** (added in Task 1 — the project currently has none).

**Spec:** `docs/superpowers/specs/2026-05-29-adventure-recipe-archetype-model-design.md`
**Umbrella:** `docs/superpowers/specs/2026-05-29-adventure-build-system-design.md`

> **Release note:** A's reward rescale makes the existing Adventure `PER_PLAYER_GOALS` unreachable. That is expected — A ships together with sub-project B (goal retune). This plan is independently buildable/testable (build + lint + unit tests pass); it knowingly leaves Adventure unbalanced until B.

---

## File Structure

- **Create** `src/data/recipeProfile.ts` — the `RecipeProfile` type, `RecipeTag` type, `getRecipeProfile()`, and band-threshold constants. One responsibility: characterize a recipe.
- **Create** `src/data/recipeProfile.test.ts` — unit tests for `getRecipeProfile`.
- **Create** `src/data/recipes.test.ts` — guard tests over the real catalog (reward coupled to complexity band, gap-filler profiles).
- **Create** `src/data/recipeArchetypes.audit.test.ts` — reporting test that prints the spread and asserts no empty archetype.
- **Modify** `src/data/recipes.ts` — add `complexityOverride?` to `Recipe`; rescale all `reward` values; set overrides on two dishes; add 3 gap-filler dishes; add their `INGREDIENT_EMOJI` entries.
- **Modify** `src/state/gameReducer.ts` — extract the serve time-bonus cap into a constant and rescale it.
- **Modify** `package.json` — add `vitest` dev dependency and a `test` script.

---

## Reward Coupling Reference

Reward bands by final complexity pips (including overrides):

| Pips | Band |
|------|------|
| ●○○ (1) | $5–$9 |
| ●●○ (2) | $11–$18 |
| ●●● (3) | $19–$25 |

There is a deliberate gap between bands ($9→$11, $18→$19) so a dish's tier is unambiguous.

---

## Task 1: Set up the Vitest test harness

**Files:**
- Modify: `package.json`
- Create: `src/data/sanity.test.ts` (temporary sanity check, deleted at end of task)

- [ ] **Step 1: Install Vitest**

Run:
```bash
npm install -D vitest
```
Expected: `vitest` added under `devDependencies`; no install errors.

- [ ] **Step 2: Add the `test` script to package.json**

In `package.json`, add a `test` script to the `"scripts"` block:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run"
  },
```

- [ ] **Step 3: Write a temporary sanity test**

Create `src/data/sanity.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('vitest harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 4: Run the test to confirm the harness works**

Run:
```bash
npm test
```
Expected: PASS — 1 test passed.

- [ ] **Step 5: Confirm the build still type-checks with Vitest types present**

Run:
```bash
npm run build
```
Expected: clean build (the `vitest` import resolves its own types; `noEmit` means no test files are emitted).

- [ ] **Step 6: Delete the sanity test and commit the harness**

Run:
```bash
rm src/data/sanity.test.ts
git add package.json package-lock.json
git commit -m "test: add vitest harness and test script"
```

---

## Task 2: RecipeProfile model + complexity override

**Files:**
- Modify: `src/data/recipes.ts` (add `complexityOverride?` to `Recipe`)
- Create: `src/data/recipeProfile.ts`
- Create: `src/data/recipeProfile.test.ts`

- [ ] **Step 1: Add the optional `complexityOverride` field to the `Recipe` interface**

In `src/data/recipes.ts`, modify the `Recipe` interface (currently lines 10–17):

```ts
export interface Recipe {
  name: string
  emoji: string
  reward: number
  patience: number
  steps: RecipeStep[]
  plate: string[]
  complexityOverride?: 1 | 2 | 3   // authored override; wins over the derived pip bucket
}
```

- [ ] **Step 2: Write the failing tests for `getRecipeProfile`**

Create `src/data/recipeProfile.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getRecipeProfile } from './recipeProfile'
import { RECIPES, Recipe } from './recipes'

// Controlled mock recipes — tag tests use these so they don't depend on the
// catalog's reward rescale (Task 3).
function mockRecipe(over: Partial<Recipe>): Recipe {
  return {
    name: 'Mock', emoji: '🍽️', reward: 12, patience: 60000,
    steps: [{ action: 'mix', target: 'x', station: 'mixing_bowl', duration: 5000, produces: 'x' }],
    plate: ['x'],
    ...over,
  }
}

describe('getRecipeProfile — derived knobs', () => {
  it('sums step durations into prepTimeMs', () => {
    // Burger: 7000 + 9000 + 7000
    expect(getRecipeProfile(RECIPES.burger).prepTimeMs).toBe(23000)
  })

  it('lists distinct stations and excludes heat-exempt ones from heatStations', () => {
    const p = getRecipeProfile(RECIPES.burger) // cutting_board, grill, oven
    expect(new Set(p.stations)).toEqual(new Set(['cutting_board', 'grill', 'oven']))
    expect(new Set(p.heatStations)).toEqual(new Set(['grill', 'oven'])) // cutting_board exempt
  })

  it('computes raw complexity = steps + 2×chains + distinctStations − 2', () => {
    // Grilled Cheese: 2 steps, 0 chains, 2 stations → 2
    expect(getRecipeProfile(RECIPES.mushroom_soup).complexity).toBe(2)
    // Burger: 3 + 0 + 3 − 2 = 4
    expect(getRecipeProfile(RECIPES.burger).complexity).toBe(4)
    // Korean Fried Chicken: 3 + 2(1 chain) + 3 − 2 = 6
    expect(getRecipeProfile(RECIPES.korean_fried_chicken).complexity).toBe(6)
  })

  it('buckets raw complexity into pips (≤3→1, 4–5→2, ≥6→3)', () => {
    expect(getRecipeProfile(RECIPES.mushroom_soup).complexityPips).toBe(1) // raw 2
    expect(getRecipeProfile(RECIPES.burger).complexityPips).toBe(2)        // raw 4
    expect(getRecipeProfile(RECIPES.korean_fried_chicken).complexityPips).toBe(3) // raw 6
  })

  it('lets complexityOverride win over the derived pip bucket', () => {
    const r = mockRecipe({ complexityOverride: 3 }) // raw would be 0 → pips 1
    const p = getRecipeProfile(r)
    expect(p.complexity).toBe(0)        // raw still computed
    expect(p.complexityPips).toBe(3)    // override wins
  })
})

describe('getRecipeProfile — archetype tags', () => {
  it('tags a quick cheap one-step dish fast + value + chop_heavy', () => {
    const p = getRecipeProfile(mockRecipe({ reward: 6 })) // 1 mix step, 5000ms
    expect(p.tags).toEqual(expect.arrayContaining(['fast', 'value', 'chop_heavy']))
    expect(p.tags).not.toContain('hot_line')
    expect(p.tags).not.toContain('premium')
  })

  it('tags a slow premium 2-heat-station dish slow + premium + hot_line', () => {
    const p = getRecipeProfile(mockRecipe({
      reward: 22,
      steps: [
        { action: 'grill', target: 'a', station: 'grill', duration: 15000, produces: 'a' },
        { action: 'boil',  target: 'b', station: 'stove', duration: 15000, produces: 'b' },
      ],
      plate: ['a', 'b'],
    }))
    expect(p.tags).toEqual(expect.arrayContaining(['slow', 'premium', 'hot_line']))
    expect(p.tags).not.toContain('chop_heavy')
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run:
```bash
npm test
```
Expected: FAIL — cannot find module `./recipeProfile`.

- [ ] **Step 4: Implement `recipeProfile.ts`**

Create `src/data/recipeProfile.ts`:

```ts
import { Recipe, HEAT_EXEMPT_STATIONS } from './recipes'

export type RecipeTag = 'fast' | 'slow' | 'premium' | 'value' | 'chop_heavy' | 'hot_line'

export interface RecipeProfile {
  reward: number            // authored base reward (cafe scale, coupled to complexity)
  prepTimeMs: number        // derived: sum of step durations
  complexity: number        // derived raw score (override does NOT change this)
  complexityPips: 1 | 2 | 3 // bucketed raw score, OR the authored override when set
  stations: string[]        // derived: distinct stations touched
  heatStations: string[]    // derived: stations minus HEAT_EXEMPT_STATIONS
  tags: RecipeTag[]          // derived archetype tags
}

// Band thresholds — calibrated against the retuned catalog so each tag is populated.
const PREP_FAST_MAX_MS = 14000
const PREP_SLOW_MIN_MS = 25000
const REWARD_VALUE_MAX = 9
const REWARD_PREMIUM_MIN = 18

function rawComplexity(recipe: Recipe): number {
  const stepCount = recipe.steps.length
  const chainedSteps = recipe.steps.filter(s => s.requires).length
  const distinctStations = new Set(recipe.steps.map(s => s.station)).size
  return stepCount + 2 * chainedSteps + distinctStations - 2
}

function toPips(raw: number): 1 | 2 | 3 {
  if (raw <= 3) return 1
  if (raw <= 5) return 2
  return 3
}

export function getRecipeProfile(recipe: Recipe): RecipeProfile {
  const prepTimeMs = recipe.steps.reduce((sum, s) => sum + s.duration, 0)
  const stations = [...new Set(recipe.steps.map(s => s.station))]
  const heatStations = stations.filter(s => !HEAT_EXEMPT_STATIONS.has(s))
  const complexity = rawComplexity(recipe)
  const complexityPips = recipe.complexityOverride ?? toPips(complexity)

  const exemptStepCount = recipe.steps.filter(s => HEAT_EXEMPT_STATIONS.has(s.station)).length
  const tags: RecipeTag[] = []
  if (prepTimeMs <= PREP_FAST_MAX_MS) tags.push('fast')
  if (prepTimeMs >= PREP_SLOW_MIN_MS) tags.push('slow')
  if (recipe.reward <= REWARD_VALUE_MAX) tags.push('value')
  if (recipe.reward >= REWARD_PREMIUM_MIN) tags.push('premium')
  if (exemptStepCount * 2 > recipe.steps.length) tags.push('chop_heavy') // majority of steps heat-exempt
  if (heatStations.length >= 2) tags.push('hot_line')

  return { reward: recipe.reward, prepTimeMs, complexity, complexityPips, stations, heatStations, tags }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run:
```bash
npm test
```
Expected: PASS — all `getRecipeProfile` tests green.

- [ ] **Step 6: Lint and build**

Run:
```bash
npm run lint && npm run build
```
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add src/data/recipeProfile.ts src/data/recipeProfile.test.ts src/data/recipes.ts
git commit -m "feat(recipes): add RecipeProfile model with derived knobs + complexity override"
```

---

## Task 3: Rescale rewards (coupled to complexity) + overrides + serve time-bonus

**Files:**
- Modify: `src/data/recipes.ts` (all `reward` values; `complexityOverride` on two dishes)
- Modify: `src/state/gameReducer.ts` (serve time-bonus cap)
- Create: `src/data/recipes.test.ts` (reward-coupling guard + override assertions)

> Overrides are applied here, not in a later task: because reward is coupled to complexity, promoting a dish to ●●● also moves it into the $19–25 band. Doing both together keeps the guard test green at every commit.

- [ ] **Step 1: Write the failing reward-coupling guard test**

Create `src/data/recipes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { RECIPES } from './recipes'
import { getRecipeProfile } from './recipeProfile'

const REWARD_BANDS: Record<1 | 2 | 3, [number, number]> = {
  1: [5, 9],
  2: [11, 18],
  3: [19, 25],
}

describe('reward is coupled to complexity', () => {
  it('prices every dish within the band its complexity pips dictate', () => {
    for (const [key, recipe] of Object.entries(RECIPES)) {
      const pips = getRecipeProfile(recipe).complexityPips
      const [lo, hi] = REWARD_BANDS[pips]
      expect(recipe.reward, `${key} (${pips} pips) reward ${recipe.reward} out of band ${lo}-${hi}`).toBeGreaterThanOrEqual(lo)
      expect(recipe.reward, `${key} (${pips} pips) reward ${recipe.reward} out of band ${lo}-${hi}`).toBeLessThanOrEqual(hi)
    }
  })

  it('keeps representative anchor prices', () => {
    expect(RECIPES.pour_over_coffee.reward).toBe(5)   // ●○○
    expect(RECIPES.salmon_donburi.reward).toBe(9)     // ●○○ (simple-but-not-premium under coupling)
    expect(RECIPES.burger.reward).toBe(14)            // ●●○
    expect(RECIPES.bulgogi.reward).toBe(17)           // ●●○
    expect(RECIPES.korean_fried_chicken.reward).toBe(20) // ●●●
  })
})

describe('complexity overrides on multi-component dishes', () => {
  it('promotes economic_bee_hoon and nasi_lemak to ●●● (and into the premium band)', () => {
    expect(RECIPES.economic_bee_hoon.complexityOverride).toBe(3)
    expect(getRecipeProfile(RECIPES.economic_bee_hoon).complexityPips).toBe(3)
    expect(RECIPES.nasi_lemak.complexityOverride).toBe(3)
    expect(getRecipeProfile(RECIPES.nasi_lemak).complexityPips).toBe(3)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run:
```bash
npm test -- recipes.test.ts
```
Expected: FAIL — current rewards ($35–$75) are out of band, overrides absent.

- [ ] **Step 3: Rescale every recipe's `reward` in `recipes.ts`**

In `src/data/recipes.ts`, update each recipe's `reward` to the new cafe-scale value. Each value sits inside the band for that dish's complexity pips (shown for reference). Change only the `reward:` number — leave `patience` and `steps` untouched:

| Recipe key | Pips | New `reward` |
|------------|------|--------------|
| `burger` | ●●○ | 14 |
| `fries` | ●●○ | 11 |
| `pasta` (Hot Dog) | ●●○ | 12 |
| `salad` (Caesar) | ●○○ | 7 |
| `mushroom_soup` (Grilled Cheese) | ●○○ | 8 |
| `fish_burger` (Fish & Chips) | ●●○ | 15 |
| `roasted_veggies` | ●●○ | 13 |
| `fried_rice` | ●●○ | 14 |
| `stir_fried_pork` | ●●○ | 15 |
| `steamed_tofu` | ●●○ | 12 |
| `steamed_buns` | ●○○ | 8 |
| `bulgogi` | ●●○ | 17 |
| `kimchi_jjigae` | ●●○ | 15 |
| `korean_fried_chicken` | ●●● | 20 |
| `tteokbokki` | ●●● | 19 |
| `sushi_roll` | ●●○ | 16 |
| `tempura` | ●●○ | 13 |
| `chawanmushi` | ●●○ | 12 |
| `salmon_donburi` | ●○○ | 9 |
| `shio_pan` | ●●○ | 11 |
| `melon_pan` | ●●● | 19 |
| `pour_over_coffee` | ●○○ | 5 |
| `matcha_latte` | ●○○ | 6 |
| `kaya_toast` | ●○○ | 5 |
| `economic_bee_hoon` | ●●● (override) | 22 |
| `roti_prata` | ●●● | 21 |
| `nasi_lemak` | ●●● (override) | 23 |

- [ ] **Step 4: Add `complexityOverride: 3` to the two multi-component dishes**

In `src/data/recipes.ts`, add `complexityOverride: 3` to the header line of `economic_bee_hoon` and `nasi_lemak` (their natural raw scores are 4 and 5 = ●●○; they play like ●●● because of their 4 parallel components). Change `economic_bee_hoon`'s header from:

```ts
  economic_bee_hoon: {
    name: 'Economic Bee Hoon', emoji: '\u{1F35C}', reward: 22, patience: 80000,
```
to:
```ts
  economic_bee_hoon: {
    name: 'Economic Bee Hoon', emoji: '\u{1F35C}', reward: 22, patience: 80000, complexityOverride: 3,
```

And `nasi_lemak`'s header from:
```ts
  nasi_lemak: {
    name: 'Nasi Lemak', emoji: '\u{1F371}', reward: 23, patience: 85000,
```
to:
```ts
  nasi_lemak: {
    name: 'Nasi Lemak', emoji: '\u{1F371}', reward: 23, patience: 85000, complexityOverride: 3,
```

- [ ] **Step 5: Run the guard test to verify it passes**

Run:
```bash
npm test -- recipes.test.ts
```
Expected: PASS — every dish in its complexity band; overrides present and effective.

- [ ] **Step 6: Add the serve time-bonus constant in the reducer**

In `src/state/gameReducer.ts`, after the `COOL_AMOUNT` constant (line 6), add:

```ts
export const SERVE_TIME_BONUS_MAX = 9   // max $ bonus for serving at full patience (cafe scale; was 30)
```

- [ ] **Step 7: Use the constant in the SERVE handler**

In `src/state/gameReducer.ts`, change the `timeBonus` line (currently line 308) from:

```ts
      const timeBonus = Math.max(0, Math.floor((order.patienceLeft / order.patienceMax) * 30))
```
to:
```ts
      const timeBonus = Math.max(0, Math.floor((order.patienceLeft / order.patienceMax) * SERVE_TIME_BONUS_MAX))
```

- [ ] **Step 8: Lint, build, and run the full test suite**

Run:
```bash
npm run lint && npm run build && npm test
```
Expected: all clean / green.

- [ ] **Step 9: Commit**

```bash
git add src/data/recipes.ts src/data/recipes.test.ts src/state/gameReducer.ts
git commit -m "feat(recipes): rescale rewards coupled to complexity + overrides + serve time-bonus"
```

---

## Task 4: Add gap-filler dishes

**Files:**
- Modify: `src/data/recipes.ts` (add 3 dishes + their `INGREDIENT_EMOJI`)
- Modify: `src/data/recipes.test.ts` (profile assertions for the new dishes)

The 3 gap-fillers fill archetype cells the existing catalog lacks: a pure-volume snack (●○○ fast/value), a premium showpiece that demands heat management (●●● `hot_line`), and a premium dish that is complex but heat-free (●●● `chop_heavy`, contrasting the showpiece). Rewards stay coupled to their pips. They are intentionally left out of `RECIPE_SETS` (ungrouped, like `fries`/`pasta`) so Free Play playsets are unchanged; sub-project B defines the Adventure-eligible pool.

- [ ] **Step 1: Write failing profile assertions for the new dishes**

Append to `src/data/recipes.test.ts`:

```ts
describe('gap-filler dishes', () => {
  it('iced_lemon_tea is a fast value one-tap volume dish', () => {
    const p = getRecipeProfile(RECIPES.iced_lemon_tea)
    expect(p.complexityPips).toBe(1)
    expect(p.tags).toEqual(expect.arrayContaining(['fast', 'value', 'chop_heavy']))
    expect(p.heatStations).toHaveLength(0)
  })

  it('ramen_bowl is a premium hot_line showpiece (needs heat management)', () => {
    const p = getRecipeProfile(RECIPES.ramen_bowl)
    expect(p.complexityPips).toBe(3)
    expect(p.tags).toEqual(expect.arrayContaining(['slow', 'premium', 'hot_line']))
  })

  it('veggie_dumplings is a premium but heat-free chop_heavy dish', () => {
    const p = getRecipeProfile(RECIPES.veggie_dumplings)
    expect(p.complexityPips).toBe(3)
    expect(p.tags).toEqual(expect.arrayContaining(['premium', 'chop_heavy']))
    expect(p.tags).not.toContain('hot_line')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run:
```bash
npm test -- recipes.test.ts
```
Expected: FAIL — `RECIPES.iced_lemon_tea` (etc.) undefined.

- [ ] **Step 3: Add the 3 gap-filler dishes to `RECIPES`**

In `src/data/recipes.ts`, add these entries inside the `RECIPES` object (place them after `nasi_lemak`, before the closing `}` of `RECIPES`). Rewards are coupled: iced tea is ●○○ ($5), ramen and dumplings are ●●● ($24 / $21):

```ts
  // ── Gap-filler dishes (ungrouped; Adventure-eligible via sub-project B) ──

  iced_lemon_tea: {
    name: 'Iced Lemon Tea', emoji: '\u{1F964}', reward: 5, patience: 45000,
    steps: [
      { action: 'mix', target: 'lemon_tea', station: 'mixing_bowl', duration: 5000, produces: 'iced_lemon_tea' },
    ],
    plate: ['iced_lemon_tea']
  },
  ramen_bowl: {
    name: 'Ramen Bowl', emoji: '\u{1F35C}', reward: 24, patience: 90000,
    steps: [
      { action: 'boil',  target: 'broth',   station: 'stove',         duration: 10000, produces: 'ramen_broth' },
      { action: 'chop',  target: 'chashu',  station: 'cutting_board', duration: 6000,  produces: 'sliced_chashu' },
      { action: 'grill', target: 'chashu',  station: 'grill',         duration: 9000,  produces: 'grilled_chashu', requires: 'sliced_chashu' },
      { action: 'boil',  target: 'noodles', station: 'stove',         duration: 8000,  produces: 'boiled_noodles' },
    ],
    plate: ['ramen_broth', 'grilled_chashu', 'boiled_noodles']
  },
  veggie_dumplings: {
    name: 'Veggie Dumplings', emoji: '\u{1F95F}', reward: 21, patience: 70000,
    steps: [
      { action: 'chop',  target: 'cabbage', station: 'cutting_board', duration: 6000, produces: 'sliced_cabbage' },
      { action: 'chop',  target: 'carrot',  station: 'cutting_board', duration: 6000, produces: 'sliced_carrot' },
      { action: 'knead', target: 'wrapper', station: 'knead_board',   duration: 7000, produces: 'dumpling_wrapper' },
      { action: 'steam', target: 'dumplings', station: 'steamer',     duration: 9000, produces: 'steamed_dumplings', requires: 'dumpling_wrapper' },
    ],
    plate: ['steamed_dumplings', 'sliced_cabbage', 'sliced_carrot']
  },
```

- [ ] **Step 4: Add `INGREDIENT_EMOJI` entries for the new produced ingredients**

In `src/data/recipes.ts`, add these keys to the `INGREDIENT_EMOJI` object (anywhere inside it; group them with a comment):

```ts
  // Gap-filler dishes
  iced_lemon_tea:    '\u{1F964}',
  ramen_broth:       '\u{1F35C}',
  sliced_chashu:     '\u{1F356}',
  grilled_chashu:    '\u{1F356}',
  boiled_noodles:    '\u{1F35D}',
  sliced_carrot:     '\u{1F955}',
  dumpling_wrapper:  '\u{1F95F}',
  steamed_dumplings: '\u{1F95F}',
```

(`sliced_cabbage` already exists and is reused by `veggie_dumplings`.)

- [ ] **Step 5: Run the new dish tests to verify they pass**

Run:
```bash
npm test -- recipes.test.ts
```
Expected: PASS — gap-filler profiles assert correctly, and the coupling guard from Task 3 still holds for the new dishes (iced tea ●○○ $5, ramen/dumplings ●●● $24/$21).

- [ ] **Step 6: Lint, build, full test run**

Run:
```bash
npm run lint && npm run build && npm test
```
Expected: all clean / green.

- [ ] **Step 7: Commit**

```bash
git add src/data/recipes.ts src/data/recipes.test.ts
git commit -m "feat(recipes): add gap-filler dishes for archetype coverage"
```

---

## Task 5: Archetype audit + final verification

**Files:**
- Create: `src/data/recipeArchetypes.audit.test.ts` (a reporting test that prints the spread and asserts no empty archetype)

- [ ] **Step 1: Write the audit test**

Create `src/data/recipeArchetypes.audit.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { RECIPES } from './recipes'
import { getRecipeProfile, RecipeTag } from './recipeProfile'

describe('archetype coverage audit', () => {
  it('populates every archetype tag and pip level', () => {
    const tagCounts: Record<string, number> = {}
    const pipCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0 }

    for (const recipe of Object.values(RECIPES)) {
      const p = getRecipeProfile(recipe)
      pipCounts[p.complexityPips]++
      for (const t of p.tags) tagCounts[t] = (tagCounts[t] ?? 0) + 1
    }

    // Visible in test output for tuning:
    console.table({ pips: pipCounts, tags: tagCounts })

    const allTags: RecipeTag[] = ['fast', 'slow', 'premium', 'value', 'chop_heavy', 'hot_line']
    for (const t of allTags) {
      expect(tagCounts[t] ?? 0, `archetype tag "${t}" is empty`).toBeGreaterThan(0)
    }
    for (const pip of [1, 2, 3]) {
      expect(pipCounts[pip], `no dishes at ${pip} pips`).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run the audit and confirm coverage**

Run:
```bash
npm test -- recipeArchetypes.audit.test.ts
```
Expected: PASS — every tag and every pip level has ≥1 dish. The printed `console.table` shows the spread (use it to confirm the catalog feels balanced; adjust band thresholds in `recipeProfile.ts` only if a tag is implausibly thin).

- [ ] **Step 3: Full verification pass**

Run:
```bash
npm run lint && npm run build && npm test
```
Expected: lint clean, build clean, all test files green.

- [ ] **Step 4: Commit**

```bash
git add src/data/recipeArchetypes.audit.test.ts
git commit -m "test(recipes): archetype coverage audit"
```

---

## Self-Review Checklist (completed during planning)

- **Spec coverage:** RecipeProfile model (Task 2) ✓ · complexity formula + override (Task 2) ✓ · archetype tags (Task 2) ✓ · reward rescale coupled to complexity (Task 3) ✓ · overrides shift reward band, applied with rescale (Task 3) ✓ · serve time-bonus rescale (Task 3) ✓ · gap-filler dishes (Task 4) ✓ · archetype audit (Task 5) ✓ · "no run-flow/screen/goal/garnish changes" honored (only recipes.ts data + one reducer constant touched) ✓.
- **Reward/complexity coupling:** Task 3's guard test asserts every dish's reward is inside the band its pips dictate; overrides are applied in the same task so no commit leaves a dish mispriced for its tier. Hand-verified: all 27 + 3 gap-filler rewards sit in-band (●○○ 5–9, ●●○ 11–18, ●●● 19–25), with the inter-band gaps ($10, $18→19 boundary) unoccupied.
- **Type consistency:** `RecipeProfile`, `RecipeTag`, `getRecipeProfile`, and `complexityOverride` names are identical across the module, tests, and `Recipe` interface.
- **Calibration note:** band-threshold constants (`PREP_FAST_MAX_MS` etc.) are defined once in `recipeProfile.ts`; the audit test (Task 5) is the calibration feedback loop.
