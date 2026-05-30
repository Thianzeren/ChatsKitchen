# Garnish Build Rework (Adventure Sub-project C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Adventure garnish catalog around the six `RecipeProfile` archetype tags (with a data-driven serve-trigger model), rescale the garnish economy to the cafe scale, and give the shop shift-weighted tier curation — so recipe drafts and garnish buys compose into builds.

**Architecture:** A new `applyServeTriggers` resolves tag/timing-gated reward effects at SERVE time from `getRecipeProfile`, replacing scattered hardcoded blocks. The catalog is rewritten to ~23 garnishes (cores per archetype + neutrals); ~18 weak/redundant garnishes are cut, and their reducer/state plumbing (Phoenix Wing, Tea Break, Apprentice, Loose Lid, Combo Plate, Long Memory, Repeat Customer, etc.) is removed. The shop rolls tier-weighted offers that rise across the run with boss-shop spikes.

**Tech Stack:** TypeScript, React 18, Vite 5, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-30-adventure-garnish-build-rework-design.md`
**Umbrella:** `docs/superpowers/specs/2026-05-29-adventure-build-system-design.md`

> **Incremental compile note:** Tasks 1–3 are additive (the rewritten catalog leaves dead `active.includes('cut_id')` string checks in the reducer, which still compile). Task 4 rewires SERVE. Task 5 removes the cut-garnish plumbing and state fields. Build/lint/test at the end of each task.

---

## File Structure

- **Modify** `src/data/adventureGarnishes.ts` — `GarnishDef` gains `serveTrigger?`; new `ServeTrigger` type + `applyServeTriggers`; rewritten `GARNISHES` (~23, rescaled prices); rewritten `generateShopOffers` (tier-weighted, seeded); `applyAllGarnishes` trimmed of cut-garnish fields.
- **Create** `src/data/adventureGarnishes.serveTriggers.test.ts`, `src/data/adventureGarnishes.shop.test.ts`.
- **Modify** `src/state/gameReducer.ts` — SERVE uses `applyServeTriggers`; remove cut triggered blocks; rescale Bloodhound; remove Phoenix/Tea Break/Apprentice/Loose Lid plumbing + RESET fields + state inits.
- **Modify** `src/state/types.ts` — remove cut-garnish `GameState` fields.
- **Modify** `src/hooks/useAdventureRun.ts` — reroll `$100→$25`; remove Veteran's Tip; drop cut `buildShiftReset` seeds.
- **Modify** `src/data/adventureBosses.ts` — Bad Reviews `lostOrderPenalty 20→5`.
- **Modify** docs.

---

## Task 1: ServeTrigger type + applyServeTriggers (pure, TDD)

**Files:** Modify `src/data/adventureGarnishes.ts`; Create `src/data/adventureGarnishes.serveTriggers.test.ts`.

- [ ] **Step 1: Add the `ServeTrigger` type and `serveTrigger` field**

In `src/data/adventureGarnishes.ts`, update the imports at the top to include `RecipeTag` and `RecipeProfile`:
```ts
import { RecipeTag, RecipeProfile } from './recipeProfile'
```
Then add the `ServeTrigger` interface near `GarnishDef` and add an optional field to `GarnishDef`:
```ts
export interface ServeTrigger {
  requiresTag?: RecipeTag        // served dish must carry this archetype tag
  servedWithinMs?: number        // elapsed since the order spawned must be below this
  rewardMultiplier?: number      // multiplicative on base reward (scale-independent)
  flatBonus?: number             // cafe-scaled $ added after multipliers
}
```
Add `serveTrigger?: ServeTrigger` to the `GarnishDef` interface (alongside `effects?`).

- [ ] **Step 2: Write the failing test (catalog-independent)**

Create `src/data/adventureGarnishes.serveTriggers.test.ts`. These cases don't depend on the new catalog ids (they use `quick_hands`, which exists with no `serveTrigger`, and an unknown id), so this commit stays green. The tag/timing/compose cases are added in Task 2 once the new catalog exists.
```ts
import { describe, it, expect } from 'vitest'
import { applyServeTriggers } from './adventureGarnishes'
import { RecipeProfile } from './recipeProfile'

export function mockProfile(over: Partial<RecipeProfile>): RecipeProfile {
  return {
    reward: 14, prepTimeMs: 20000, complexity: 4, complexityPips: 2,
    stations: [], heatStations: [], tags: [], ...over,
  }
}

describe('applyServeTriggers (core)', () => {
  it('returns identity for garnishes with no serveTrigger and unknown ids', () => {
    const r = applyServeTriggers(['quick_hands', 'not_a_garnish'], mockProfile({ tags: ['premium'] }), { elapsedSinceSpawn: 1000 })
    expect(r).toEqual({ multiplier: 1, flatBonus: 0 })
  })

  it('returns identity for an empty active list', () => {
    expect(applyServeTriggers([], mockProfile({}), { elapsedSinceSpawn: 0 })).toEqual({ multiplier: 1, flatBonus: 0 })
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- adventureGarnishes.serveTriggers.test.ts`
Expected: FAIL — `applyServeTriggers` is not exported yet.

- [ ] **Step 4: Implement `applyServeTriggers`**

In `src/data/adventureGarnishes.ts`, add (after the `getGarnish`/`isOwned` helpers):
```ts
export interface ServeTriggerContext {
  elapsedSinceSpawn: number
}

// Resolve all tag/timing-gated on-serve garnish effects for a served dish.
// Multipliers multiply together; flat bonuses add. Garnishes without a
// serveTrigger (stat or bespoke ones) are skipped.
export function applyServeTriggers(
  activeIds: string[],
  profile: RecipeProfile,
  ctx: ServeTriggerContext,
): { multiplier: number; flatBonus: number } {
  let multiplier = 1
  let flatBonus = 0
  for (const id of activeIds) {
    const t = GARNISHES[id]?.serveTrigger
    if (!t) continue
    if (t.requiresTag && !profile.tags.includes(t.requiresTag)) continue
    if (t.servedWithinMs !== undefined && !(ctx.elapsedSinceSpawn < t.servedWithinMs)) continue
    if (t.rewardMultiplier !== undefined) multiplier *= t.rewardMultiplier
    if (t.flatBonus !== undefined) flatBonus += t.flatBonus
  }
  return { multiplier, flatBonus }
}
```

- [ ] **Step 5: Run the test + build (now green)**

Run: `npm test -- adventureGarnishes.serveTriggers.test.ts && npm run lint && npm run build`
Expected: the core test PASSES; lint + build clean.

- [ ] **Step 6: Commit**

```bash
git add src/data/adventureGarnishes.ts src/data/adventureGarnishes.serveTriggers.test.ts
git commit -m "feat(adventure): add data-driven serve-trigger model for garnishes"
```

---

## Task 2: Rewrite the garnish catalog (~23, rescaled)

**Files:** Modify `src/data/adventureGarnishes.ts`.

- [ ] **Step 1: Replace the entire `GARNISHES` object**

In `src/data/adventureGarnishes.ts`, replace the whole `export const GARNISHES: Record<string, GarnishDef> = { ... }` block with exactly this catalog (cut garnishes removed, prices rescaled, serveTriggers added):

```ts
export const GARNISHES: Record<string, GarnishDef> = {
  // ── 🟡 Premium ──
  fine_dining:   { id: 'fine_dining',   name: 'Fine Dining',   description: 'Premium dishes earn +25%.',                 tier: 'common',    basePrice: 30,  icon: '🍽️', serveTrigger: { requiresTag: 'premium', rewardMultiplier: 1.25 } },
  first_bite:    { id: 'first_bite',    name: 'First Bite',    description: 'The first dish served each shift sells for 3× its value.', tier: 'rare', basePrice: 55, icon: '🥢' },
  michelin_star: { id: 'michelin_star', name: 'Michelin Star', description: 'Premium dishes earn +75%.',                 tier: 'legendary', basePrice: 110, icon: '⭐', serveTrigger: { requiresTag: 'premium', rewardMultiplier: 1.75 } },

  // ── 🟢 Value ──
  penny_pincher: { id: 'penny_pincher', name: 'Penny Pincher', description: 'Value dishes earn +$3.',  tier: 'common',    basePrice: 25, icon: '🪙', serveTrigger: { requiresTag: 'value', flatBonus: 3 } },
  value_meal:    { id: 'value_meal',    name: 'Value Meal',    description: 'Value dishes earn +50%.', tier: 'rare',      basePrice: 50, icon: '🍟', serveTrigger: { requiresTag: 'value', rewardMultiplier: 1.5 } },
  dollar_menu:   { id: 'dollar_menu',   name: 'Dollar Menu',   description: 'Value dishes earn +$8.',  tier: 'legendary', basePrice: 95, icon: '💵', serveTrigger: { requiresTag: 'value', flatBonus: 8 } },

  // ── 💨 Fast ──
  quick_bite:    { id: 'quick_bite',    name: 'Quick Bite',    description: 'Any dish served within 15s of the order earns +20%.', tier: 'common', basePrice: 30, icon: '💨', serveTrigger: { servedWithinMs: 15000, rewardMultiplier: 1.2 } },
  drive_thru:    { id: 'drive_thru',    name: 'Drive-Thru',    description: 'Fast dishes earn +35%.', tier: 'rare', basePrice: 55, icon: '🚗', serveTrigger: { requiresTag: 'fast', rewardMultiplier: 1.35 } },
  time_is_money: { id: 'time_is_money', name: 'Time Is Money', description: 'Dishes earn up to +50% more, scaled by patience left when served.', tier: 'legendary', basePrice: 100, icon: '⏱️' },

  // ── 🐢 Slow ──
  low_and_slow:   { id: 'low_and_slow',   name: 'Low & Slow',     description: 'Slow dishes earn +$5.',  tier: 'common',    basePrice: 30,  icon: '🍲', serveTrigger: { requiresTag: 'slow', flatBonus: 5 } },
  slow_cooked:    { id: 'slow_cooked',    name: 'Slow-Cooked',    description: 'Slow dishes earn +50%.', tier: 'rare',      basePrice: 60,  icon: '🔥', serveTrigger: { requiresTag: 'slow', rewardMultiplier: 1.5 } },
  worth_the_wait: { id: 'worth_the_wait', name: 'Worth the Wait', description: 'Slow dishes earn 2×.',   tier: 'legendary', basePrice: 115, icon: '⏳', serveTrigger: { requiresTag: 'slow', rewardMultiplier: 2 } },

  // ── 🔪 Prep-Heavy ──
  cold_kitchen:  { id: 'cold_kitchen',  name: 'Cold Kitchen',  description: 'Prep-heavy dishes earn +$4.',                 tier: 'common',    basePrice: 30,  icon: '🥗', serveTrigger: { requiresTag: 'prep_heavy', flatBonus: 4 } },
  mise_en_place: { id: 'mise_en_place', name: 'Mise en Place', description: 'Start each shift with 5 random prepped ingredients.', tier: 'rare', basePrice: 65, icon: '🥪' },
  sharp_knives:  { id: 'sharp_knives',  name: 'Sharp Knives',  description: 'Chopping is instant — chopping-board recipes finish in 0s.', tier: 'legendary', basePrice: 120, icon: '🔪', effects: [{ field: 'choppingCookTimeMultiplier', value: -1, mode: 'mul' }] },

  // ── 🔥 Hot-Line ──
  fire_whisperer: { id: 'fire_whisperer', name: 'Fire Whisperer', description: 'Hot-line dishes earn +30%.', tier: 'common', basePrice: 30, icon: '🌶️', serveTrigger: { requiresTag: 'hot_line', rewardMultiplier: 1.3 } },
  bloodhound:     { id: 'bloodhound',     name: 'Bloodhound',     description: 'Each station overheat earns $12 (you still lose the station).', tier: 'rare', basePrice: 55, icon: '🩸' },
  glass_kitchen:  { id: 'glass_kitchen',  name: 'Glass Kitchen',  description: 'Stations overheat at 60 instead of 100, but every dish pays +50%.', tier: 'legendary', basePrice: 110, icon: '💎', effects: [{ field: 'overheatThresholdDelta', value: -40, mode: 'add' }], serveTrigger: { rewardMultiplier: 1.5 } },

  // ── ⚪ Neutrals ──
  quick_hands:    { id: 'quick_hands',    name: 'Quick Hands',    description: '+15% cooking speed.',                tier: 'common',    basePrice: 30,  icon: '⚡', effects: [{ field: 'cookingSpeed', value: 0.15, mode: 'mul' }] },
  patient_diners: { id: 'patient_diners', name: 'Patient Diners', description: 'Customer patience drains 20% slower.', tier: 'common',   basePrice: 30,  icon: '🪑', effects: [{ field: 'orderSpeed', value: -0.20, mode: 'mul' }] },
  tip_jar:        { id: 'tip_jar',        name: 'Tip Jar',        description: '+$2 flat tip on every served dish.', tier: 'common',    basePrice: 25,  icon: '💵', effects: [{ field: 'flatTipPerOrder', value: 2, mode: 'add' }] },
  heat_sink:      { id: 'heat_sink',      name: 'Heat Sink',      description: 'Cooling removes +30 more heat.',     tier: 'common',    basePrice: 30,  icon: '❄️', effects: [{ field: 'coolAmountBonus', value: 30, mode: 'add' }] },
  snowball:       { id: 'snowball',       name: 'Snowball',       description: '+8% cooking speed for every shift survived.', tier: 'legendary', basePrice: 120, icon: '⛄' },
  doppelganger:   { id: 'doppelganger',   name: 'Doppelgänger',   description: 'Every cooked ingredient has a 20% chance to produce a second copy.', tier: 'legendary', basePrice: 125, icon: '👯' },
}
```

- [ ] **Step 2: Append the catalog-dependent serve-trigger tests**

Now that the new catalog exists, append this `describe` block to `src/data/adventureGarnishes.serveTriggers.test.ts` (in the same file, after the existing block — `mockProfile`, `applyServeTriggers`, `describe`/`it`/`expect` are already in scope from Task 1, no new imports needed):
```ts
describe('applyServeTriggers (catalog)', () => {
  it('applies a tag-gated multiplier only when the dish has the tag', () => {
    expect(applyServeTriggers(['fine_dining'], mockProfile({ tags: ['premium'] }), { elapsedSinceSpawn: 99999 }).multiplier).toBeCloseTo(1.25)
    expect(applyServeTriggers(['fine_dining'], mockProfile({ tags: ['value'] }), { elapsedSinceSpawn: 99999 }).multiplier).toBe(1)
  })

  it('applies a tag-gated flat bonus (Penny Pincher)', () => {
    expect(applyServeTriggers(['penny_pincher'], mockProfile({ tags: ['value'] }), { elapsedSinceSpawn: 99999 }).flatBonus).toBe(3)
    expect(applyServeTriggers(['penny_pincher'], mockProfile({ tags: ['premium'] }), { elapsedSinceSpawn: 0 }).flatBonus).toBe(0)
  })

  it('respects the timing condition (Quick Bite)', () => {
    expect(applyServeTriggers(['quick_bite'], mockProfile({ tags: [] }), { elapsedSinceSpawn: 10_000 }).multiplier).toBeCloseTo(1.2)
    expect(applyServeTriggers(['quick_bite'], mockProfile({ tags: [] }), { elapsedSinceSpawn: 20_000 }).multiplier).toBe(1)
  })

  it('composes multiple garnishes (multipliers multiply, flats add)', () => {
    const r = applyServeTriggers(['fine_dining', 'penny_pincher', 'quick_bite'], mockProfile({ tags: ['premium', 'value'] }), { elapsedSinceSpawn: 5_000 })
    expect(r.multiplier).toBeCloseTo(1.25 * 1.2)
    expect(r.flatBonus).toBe(3)
  })

  it('Glass Kitchen (+50%) fires on every serve (no required tag)', () => {
    expect(applyServeTriggers(['glass_kitchen'], mockProfile({ tags: [] }), { elapsedSinceSpawn: 99999 }).multiplier).toBeCloseTo(1.5)
  })
})
```

- [ ] **Step 3: Run the serve-trigger tests (now green)**

Run: `npm test -- adventureGarnishes.serveTriggers.test.ts`
Expected: PASS — both the core and catalog describes.

- [ ] **Step 4: Build + lint**

Run: `npm run lint && npm run build`
Expected: clean. (The reducer still has `active.includes('combo_plate')` etc. — these are string comparisons that compile fine; they become dead and are removed in Tasks 4–5. `applyAllGarnishes` still has switch cases for now-unused effect fields — harmless until trimmed in Task 5.)

- [ ] **Step 5: Commit**

```bash
git add src/data/adventureGarnishes.ts src/data/adventureGarnishes.serveTriggers.test.ts
git commit -m "feat(adventure): rebuild garnish catalog around archetypes + cafe-scale prices"
```

---

## Task 3: Tier-weighted shop offers (TDD)

**Files:** Modify `src/data/adventureGarnishes.ts`; Create `src/data/adventureGarnishes.shop.test.ts`.

- [ ] **Step 1: Write the failing tests**

Create `src/data/adventureGarnishes.shop.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { generateShopOffers, GARNISHES } from './adventureGarnishes'

describe('generateShopOffers (tier-weighted)', () => {
  it('returns `count` distinct un-owned garnishes', () => {
    const offers = generateShopOffers('seed1', [], 3, 1, 4)
    expect(offers).toHaveLength(4)
    expect(new Set(offers.map(o => o.garnishId)).size).toBe(4)
  })

  it('never offers an owned garnish', () => {
    const owned = [{ garnishId: 'fine_dining', acquiredOnShift: 1 }]
    const offers = generateShopOffers('seed1', owned, 3, 1, 4)
    expect(offers.map(o => o.garnishId)).not.toContain('fine_dining')
  })

  it('is deterministic for the same runSeed + shift', () => {
    const a = generateShopOffers('seedA', [], 4, 1, 4)
    const b = generateShopOffers('seedA', [], 4, 1, 4)
    expect(a).toEqual(b)
  })

  it('prices offers via the tier-scaled price', () => {
    const offers = generateShopOffers('seed1', [], 3, 1, 4)
    for (const o of offers) {
      expect(o.price).toBeGreaterThan(0)
      expect(o.rarity).toBe(GARNISHES[o.garnishId].tier)
    }
  })

  it('boss shops (4 & 8) skew rarer than the average non-boss shop', () => {
    // Sample many seeds; the boss-shop weights must yield more rare+legendary on average.
    const rareScore = (shift: number) => {
      let score = 0
      for (let s = 0; s < 60; s++) {
        for (const o of generateShopOffers(`seed${s}`, [], shift, 1, 4)) {
          score += o.rarity === 'legendary' ? 2 : o.rarity === 'rare' ? 1 : 0
        }
      }
      return score
    }
    expect(rareScore(4)).toBeGreaterThan(rareScore(3))
    expect(rareScore(8)).toBeGreaterThan(rareScore(7))
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- adventureGarnishes.shop.test.ts`
Expected: FAIL — `generateShopOffers` currently takes `(owned, shift, participantCount, count)` and isn't seeded; signature/behavior mismatch.

- [ ] **Step 3: Rewrite `generateShopOffers`**

In `src/data/adventureGarnishes.ts`, add the seeded-RNG import at the top:
```ts
import { hashStringToSeed, mulberry32 } from './seededRng'
```
Replace the existing `generateShopOffers` (and its comment) with:
```ts
type Tier = 'common' | 'rare' | 'legendary'

// Tier weights by the UPCOMING shift (the shop runs after shift N, for shift N+1).
// Rises across the run; boss shops (4 & 8) spike rare/legendary so chat can gear up.
const TIER_WEIGHTS: Record<number, [number, number, number]> = {
  // [common, rare, legendary]
  2: [80, 18, 2],
  3: [70, 25, 5],
  4: [50, 35, 15],   // boss
  5: [60, 30, 10],
  6: [50, 35, 15],
  7: [40, 40, 20],
  8: [30, 40, 30],   // boss
}

function rollTier(rng: () => number, shift: number): Tier {
  const w = TIER_WEIGHTS[Math.min(8, Math.max(2, shift))] ?? [70, 25, 5]
  const total = w[0] + w[1] + w[2]
  const r = rng() * total
  if (r < w[0]) return 'common'
  if (r < w[0] + w[1]) return 'rare'
  return 'legendary'
}

// Roll `count` distinct un-owned garnishes, tier-weighted by the upcoming shift,
// seeded by runSeed+shift for determinism. Falls back across tiers when a tier is
// exhausted of un-owned garnishes.
export function generateShopOffers(
  runSeed: string,
  owned: OwnedGarnish[],
  shift: number,
  participantCount: number = 1,
  count: number = 4,
): ShopOffer[] {
  const rng = mulberry32(hashStringToSeed(`${runSeed}::shop::${shift}`))
  const available = Object.values(GARNISHES).filter(g => !isOwned(owned, g.id))
  const byTier: Record<Tier, GarnishDef[]> = { common: [], rare: [], legendary: [] }
  for (const g of available) byTier[g.tier].push(g)

  const chosen: GarnishDef[] = []
  const tierFallback: Record<Tier, Tier[]> = {
    common:    ['common', 'rare', 'legendary'],
    rare:      ['rare', 'common', 'legendary'],
    legendary: ['legendary', 'rare', 'common'],
  }
  for (let i = 0; i < count && chosen.length < available.length; i++) {
    const wanted = rollTier(rng, shift)
    let pick: GarnishDef | undefined
    for (const tier of tierFallback[wanted]) {
      const pool = byTier[tier].filter(g => !chosen.includes(g))
      if (pool.length > 0) { pick = pool[Math.floor(rng() * pool.length)]; break }
    }
    if (pick) chosen.push(pick)
  }

  return chosen.map(g => ({
    garnishId: g.id,
    price: getGarnishPrice(g.id, shift, participantCount),
    rarity: g.tier,
  }))
}
```

- [ ] **Step 4: Update the caller in `useAdventureRun.ts`**

`generateShopOffers` now takes `runSeed` first. In `src/hooks/useAdventureRun.ts`, find the two call sites (in `resolveRecipePick`'s between-shift branch and any other) and update them. The between-shift shop generation currently reads roughly:
```ts
const offers = generateShopOffers(updated.ownedGarnishes, updated.currentShift + 1, updated.participantCount, 4)
```
Change to:
```ts
const offers = generateShopOffers(updated.runSeed, updated.ownedGarnishes, updated.currentShift + 1, updated.participantCount, 4)
```
(Run `grep -n "generateShopOffers" src/hooks/useAdventureRun.ts` to catch every call site and apply the same `runSeed`-first reorder.)

- [ ] **Step 5: Run tests + build**

Run: `npm test -- adventureGarnishes.shop.test.ts && npm run lint && npm run build`
Expected: shop tests PASS; lint + build clean.

- [ ] **Step 6: Commit**

```bash
git add src/data/adventureGarnishes.ts src/data/adventureGarnishes.shop.test.ts src/hooks/useAdventureRun.ts
git commit -m "feat(adventure): tier-weighted shop offers with boss-shop spikes"
```

---

## Task 4: SERVE integration — serve-triggers + bespoke First Bite / Time Is Money

**Files:** Modify `src/state/gameReducer.ts`, `src/state/types.ts`.

- [ ] **Step 1: Import the profile + serve-trigger helpers**

In `src/state/gameReducer.ts`, update the data imports:
```ts
import { RECIPES, STATION_DEFS, HEAT_EXEMPT_STATIONS } from '../data/recipes'
import { getRecipeProfile } from '../data/recipeProfile'
import { pickMiseEnPlaceIngredients, applyServeTriggers } from '../data/adventureGarnishes'
```

- [ ] **Step 2: Replace the SERVE reward block**

In `src/state/gameReducer.ts`, replace the block from `const bossMoneyMul = state.bossMoneyMultiplier ?? 1` (currently line 311) through the `const reward = ...` line (currently line 374) — i.e. the existing `bossMoneyMul`/`multiplier` declarations and all the triggered-garnish blocks — with:
```ts
      const bossMoneyMul = state.bossMoneyMultiplier ?? 1

      // ── Garnish-driven reward effects ──
      const active = state.activeGarnishes ?? []
      const isFirstOrder = !state.firstOrderServedThisShift
      const elapsedSinceSpawn = Date.now() - order.spawnTime
      const patienceFraction = order.patienceMax > 0 ? order.patienceLeft / order.patienceMax : 0

      const profile = getRecipeProfile(recipe)
      const trig = applyServeTriggers(active, profile, { elapsedSinceSpawn })
      let multiplier = (state.moneyMultiplier?.multiplier ?? 1) * bossMoneyMul * trig.multiplier
      // First Bite (bespoke): the first dish served each shift sells 3×.
      if (isFirstOrder && active.includes('first_bite')) multiplier *= 3
      // Time Is Money (bespoke): up to +50% scaled by patience remaining.
      if (active.includes('time_is_money')) multiplier *= 1 + 0.5 * patienceFraction

      const tip = (state.flatTipPerOrder ?? 0) + trig.flatBonus
      const reward = Math.round(baseReward * multiplier) + tip
```
This removes the old `bossMoneyMul`/`multiplier` declarations (re-declared here once) and the `speed_demon`, `pressure_tip`, `glass_kitchen`-multiplier, `big_tippers`-tip, `combo_plate`, `long_memory`, and `repeat_customer` blocks. Glass Kitchen's +50% now comes through its `serveTrigger`. (Keep the lines *above* line 311 — `timeBonus`, `baseReward` — and the `addStat`/pool lines *below* line 374 unchanged.)

- [ ] **Step 3: Simplify the SERVE return + remove combo/repeat message + state writes**

In the SERVE `return addMsg(...)` (currently lines 393–413), remove the `bonusTags`/`bonusSuffix` lines and the `recentServes`/`repeatCustomerStreak` writes. Replace the message-composition + return with:
```ts
      return addMsg(
        {
          ...afterPool,
          orders: newOrders,
          money: afterPool.money + reward,
          served: afterPool.served + 1,
          firstOrderServedThisShift: true,
        },
        'KITCHEN',
        `${user} served ${recipe.emoji} ${recipe.name}! +$${reward}`,
        'success',
      )
```

- [ ] **Step 4: Remove the `recentServes` / `repeatCustomerStreak` GameState fields**

In `src/state/types.ts`, delete the `recentServes?: ...` and `repeatCustomerStreak?: ...` fields from `GameState`. In `src/state/gameReducer.ts`, remove `repeatCustomerStreak: undefined` (and any `recentServes` init) from `createInitialState`'s returned object. Run `grep -rn "recentServes\|repeatCustomerStreak" src/` and remove every remaining reference.

- [ ] **Step 5: Rescale Bloodhound (overheat payout 40 → 12)**

In `src/state/gameReducer.ts`, in the overheat handler, change `bloodhoundMoney += 40` to `bloodhoundMoney += 12` and the message `Bloodhound earned $40` to `Bloodhound earned $12`.

- [ ] **Step 6: Build, lint, test**

Run: `npm run lint && npm run build && npm test`
Expected: clean / all green (existing tests + the new serve-trigger + shop tests). The reducer no longer references `combo_plate`/`long_memory`/`repeat_customer`/`speed_demon`/`pressure_tip`/`big_tippers`.

- [ ] **Step 7: Commit**

```bash
git add src/state/gameReducer.ts src/state/types.ts
git commit -m "feat(adventure): SERVE uses data-driven serve-triggers; rescale Bloodhound"
```

---

## Task 5: Remove cut-garnish plumbing + finish the rescale

**Files:** Modify `src/state/gameReducer.ts`, `src/state/types.ts`, `src/data/adventureGarnishes.ts`, `src/hooks/useAdventureRun.ts`, `src/data/adventureBosses.ts`.

The cut garnishes **Phoenix Wing**, **Tea Break**, **The Apprentice**, **Loose Lid**, and **Veteran's Tip** have bespoke reducer/state/run plumbing that must be fully removed (no dangling references). **Recipe Roulette is a BOSS, not a garnish — keep all of its logic.**

- [ ] **Step 1: Remove Phoenix Wing**

In `src/state/gameReducer.ts` overheat handler: delete the entire `// ── Phoenix Wing garnish ──` intercept block (the `const phoenixCharges = state.autoExtinguishCharges ?? 0; if (phoenixCharges > 0) { ... break }`). Delete the `let autoExtinguishChargesOut = state.autoExtinguishCharges` declaration and the `autoExtinguishCharges: autoExtinguishChargesOut` field in the TICK return. Remove the `autoExtinguishCharges?` field from the `RESET` action type and from `createInitialState`'s return, the `autoExtinguishCharges?: number` field from `GameState` in `types.ts`, and the `autoExtinguishCharges: ownsPhoenixWing ? 1 : undefined` seed (and the `ownsPhoenixWing` const) from `buildShiftReset` in `useAdventureRun.ts`.

- [ ] **Step 2: Remove Tea Break**

In `src/state/gameReducer.ts` TICK: delete the Tea Break lazy-init (`if (active.includes('tea_break') ...)`), the "Fire Tea Break" block, the `teaBreakNextAt`/`patiencePausedUntil` locals and their TICK-return fields, and the `patienceFrozen` usage if it is only driven by Tea Break (it gates patience drain — replace `const patienceFrozen = patiencePausedUntil !== undefined && now < patiencePausedUntil` with `const patienceFrozen = false` and let TS/dead-code elimination handle it, OR remove the `patienceFrozen` branch entirely; verify order-patience still decrements normally). Remove `teaBreakNextAt`/`patiencePausedUntil` from `createInitialState` and from `GameState` in `types.ts`.

- [ ] **Step 3: Remove The Apprentice**

In `src/state/gameReducer.ts` TICK: delete the apprentice timer block (`let apprenticeTimerOut = ...; if (state.apprenticeTimerMs !== undefined) { ... }`) and its TICK-return field `apprenticeTimerMs: apprenticeTimerOut`. Remove `apprenticeTimerMs?` from the `RESET` action type, `createInitialState`, and `GameState` (`types.ts`); remove the `apprenticeTimerMs: ownsApprentice ? 0 : undefined` seed (and `ownsApprentice` const) from `buildShiftReset`.

- [ ] **Step 4: Remove Loose Lid (heat decay)**

In `src/state/gameReducer.ts` TICK: delete the heat-decay block (`state.heatDecayAboveThreshold !== undefined && ...`). Remove `heatDecayAboveThreshold?`/`heatDecayRate?` from the `RESET` action type, `createInitialState`, and `GameState` (`types.ts`), and their seeds in `buildShiftReset`. In `src/data/adventureGarnishes.ts` `applyAllGarnishes`: remove the `heatDecayAboveThreshold`/`heatDecayRate` locals, their `case` arms in the effect switch, the `GarnishField` union members `'heatDecayAboveThreshold' | 'heatDecayRate'`, and the two fields from the returned `state` object.

- [ ] **Step 5: Remove Veteran's Tip + rescale reroll**

In `src/hooks/useAdventureRun.ts` `closeShop`: delete the Veteran's Tip block (`const veteransTipActive = ...; const veteransTipBonus = ...`) and remove `+ veteransTipBonus` from `currentRunMoney`. Change the reroll constant `const REROLL_BASE_PRICE = 100` to `25`.

- [ ] **Step 6: Rescale Bad Reviews boss penalty**

In `src/data/adventureBosses.ts`, in `applyBossDebuff`'s `bad_reviews` case, change `lostOrderPenalty: 20` to `lostOrderPenalty: 5`.

- [ ] **Step 7: Sweep for dead references**

Run:
```bash
grep -rnE "phoenix_wing|tea_break|apprentice|loose_lid|veterans_tip|autoExtinguishCharges|apprenticeTimerMs|heatDecay|teaBreakNextAt|patiencePausedUntil|recentServes|repeatCustomerStreak|combo_plate|long_memory|repeat_customer|speed_demon|pressure_tip|big_tippers" src/
```
Expected: **no matches in `src/`** except (a) `recipe_roulette` boss logic is untouched, and (b) any reference inside test files you intentionally keep. Fix any straggler at the reported location.

- [ ] **Step 8: Build, lint, test**

Run: `npm run lint && npm run build && npm test`
Expected: clean / all green.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(adventure): remove cut-garnish plumbing; rescale reroll + boss penalty"
```
(`git add -A` is safe here: the tree holds only this task's reducer/state/hook/boss edits.)

---

## Task 6: Docs + final verification

**Files:** Modify `CLAUDE.md`, `docs/game-design-and-mechanics.md`.

- [ ] **Step 1: Update CLAUDE.md**

In `CLAUDE.md`, update the **Garnishes** bullet under Adventure Mode: catalog is ~23 garnishes built around the six archetype tags + neutrals; effects fire via `applyServeTriggers` (data-driven, keyed off `getRecipeProfile`) plus stat (`applyAllGarnishes`) and a few bespoke (First Bite, Time Is Money, Bloodhound, Doppelgänger, Mise en Place, Sharp Knives, Snowball, Glass Kitchen). Shop offers are tier-weighted by the upcoming shift with boss-shop spikes; reroll is `$25 × 2^n × crew`. Remove mentions of the cut garnishes and the old `$100` reroll.

- [ ] **Step 2: Update the game-design doc**

In `docs/game-design-and-mechanics.md`, update the Adventure garnish/Pantry section to match: garnishes form archetype builds keyed off recipe tags; tier-curated shop; cafe-scale prices. Keep the doc's voice.

- [ ] **Step 3: Full verification**

Run: `npm run lint && npm run build && npm test`
Expected: lint clean, build clean, all test files green.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/game-design-and-mechanics.md
git commit -m "docs(adventure): garnish build rework (sub-project C)"
```

---

## Self-Review Checklist (completed during planning)

- **Spec coverage:** serve-trigger model (T1) ✓ · catalog rebuild ~23 archetype+neutral, cut list (T2) ✓ · price rescale (T2) ✓ · tier-weighted shop + boss spikes + seeded/owned/no-dupe (T3) ✓ · SERVE integration + First Bite/Time Is Money bespoke + Bloodhound rescale (T4) ✓ · cut-garnish plumbing removal + reroll + boss-penalty rescale (T5) ✓ · docs (T6) ✓ · unit tests for both new pure pieces (T1, T3) ✓.
- **Placeholder scan:** every code step has complete code or an exact, symbol-level edit; the only "find every call site" steps (T3 S4, T5 sweeps) include the exact grep and the literal replacement.
- **Type consistency:** `ServeTrigger`/`applyServeTriggers(activeIds, profile, {elapsedSinceSpawn})`, `generateShopOffers(runSeed, owned, shift, participantCount, count)` are used identically across catalog, tests, reducer, and `useAdventureRun`.
- **Incremental builds:** T1 leaves one intentionally-red test (documented) that greens in T2; T2 leaves dead reducer string-checks that T4/T5 remove; each task otherwise builds clean.
- **Cross-cutting:** T5/T6 complete the umbrella's money rescale (garnish + boss flat money) — after C the whole build system is on the cafe scale.
