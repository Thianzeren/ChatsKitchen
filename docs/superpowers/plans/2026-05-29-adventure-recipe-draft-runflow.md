# Recipe Draft & Run-Flow Rework (Adventure Sub-project B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Adventure's cuisine-lock + path-pick + auto-unlock with an all-cuisine Recipe Pick draft (add one / skip), recalibrate the shift goals for the cafe scale, and auto-assign bosses — making sub-project A's reward rescale shippable.

**Architecture:** A new pure `generateRecipeOffers` (seeded, all-cuisine, no-dupes) feeds a new `AdventureRecipePick` vote screen that mirrors the existing cuisine-pick screen. The run state machine in `useAdventureRun.ts` is rewired: opening draft at run start, between-shift recipe pick before the shop, auto-assigned bosses on S4/S8, and a recalibrated goal table. The old cuisine/path screens, path-card generator, and auto-unlock helpers are deleted.

**Tech Stack:** React 18 + TypeScript, Vite 5, Vitest (added in sub-project A).

**Spec:** `docs/superpowers/specs/2026-05-29-adventure-recipe-draft-runflow-design.md`
**Umbrella:** `docs/superpowers/specs/2026-05-29-adventure-build-system-design.md`

> **Release note:** A + B ship together. This plan removes the now-unreachable goals A left behind and restores a playable end-to-end Adventure run on the cafe scale.

> **Coupling note:** Tasks 1–3 are additive and independently build/test green. Task 4 is the atomic switchover (types + state machine + App wiring + deletions) — TypeScript will not compile until it is fully applied, so it is one task with many steps. Task 5 is docs + final verification.

---

## File Structure

- **Create** `src/data/seededRng.ts` — `hashStringToSeed`, `mulberry32` (extracted from the to-be-deleted `adventurePathCards.ts`; shared by the recipe draft and boss picker).
- **Create** `src/data/adventureRecipeDraft.ts` — `generateRecipeOffers(runSeed, shift, ownedRecipes)`.
- **Create** `src/data/adventureRecipeDraft.test.ts` — unit tests for the draft roll.
- **Create** `src/components/AdventureRecipePick.tsx` (+ `.module.css`) — the draft vote screen.
- **Modify** `src/data/adventureMode.ts` — recalibrate `PER_PLAYER_GOALS`; delete cuisine/auto-unlock helpers.
- **Modify** `src/data/adventureBosses.ts` — `applyBossDebuff` takes `(bossId, disabledStationId?)`; add `pickBossForShift`.
- **Modify** `src/state/types.ts` — `AdventureRun` shape; retire `PathCard`; `Screen` union; `ShiftResult`; `SavedAdventureRun` version.
- **Modify** `src/hooks/useAdventureRun.ts` — the state-machine rewrite.
- **Modify** `src/App.tsx` — screen routing + handlers.
- **Modify** `src/components/AdventureBriefing.tsx` — boss source (`currentBoss`).
- **Modify** `src/components/AdventureShiftPassed.tsx` — `onNext` wording / cashBonus prop.
- **Delete** `src/components/AdventureCuisinePick.tsx` (+ css), `src/components/AdventurePathPick.tsx` (+ css), `src/data/adventurePathCards.ts`.
- **Modify** docs: `CLAUDE.md`, `docs/game-design-and-mechanics.md`.

---

## Task 1: Seeded RNG + recipe-draft roll (pure, TDD)

**Files:**
- Create: `src/data/seededRng.ts`
- Create: `src/data/adventureRecipeDraft.ts`
- Create: `src/data/adventureRecipeDraft.test.ts`

- [ ] **Step 1: Create the seeded-RNG util**

Create `src/data/seededRng.ts` (lifted verbatim from `adventurePathCards.ts` so behavior is identical):

```ts
// Mulberry32 — small, deterministic seeded RNG, no deps. Shared by the recipe
// draft and the boss picker so the same run+shift always rolls the same result.

export function hashStringToSeed(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/data/adventureRecipeDraft.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateRecipeOffers } from './adventureRecipeDraft'
import { RECIPES } from './recipes'

const ALL_KEYS = Object.keys(RECIPES)

describe('generateRecipeOffers', () => {
  it('offers 3 recipes when plenty are unowned', () => {
    const offers = generateRecipeOffers('seed1', 1, [])
    expect(offers).toHaveLength(3)
  })

  it('only offers real recipe keys', () => {
    const offers = generateRecipeOffers('seed1', 1, [])
    for (const k of offers) expect(ALL_KEYS).toContain(k)
  })

  it('never offers an already-owned recipe', () => {
    const owned = ['burger', 'fries', 'sushi_roll']
    const offers = generateRecipeOffers('seed1', 3, owned)
    for (const k of offers) expect(owned).not.toContain(k)
  })

  it('returns no duplicates within an offer set', () => {
    const offers = generateRecipeOffers('seed-xyz', 2, [])
    expect(new Set(offers).size).toBe(offers.length)
  })

  it('is deterministic for the same runSeed + shift + owned', () => {
    const a = generateRecipeOffers('seedA', 4, ['burger'])
    const b = generateRecipeOffers('seedA', 4, ['burger'])
    expect(a).toEqual(b)
  })

  it('differs across shifts (different seed input)', () => {
    const s1 = generateRecipeOffers('seedA', 1, [])
    const s2 = generateRecipeOffers('seedA', 2, [])
    expect(s1).not.toEqual(s2) // overwhelmingly likely with a 30-key catalog
  })

  it('degrades gracefully when fewer than 3 recipes remain', () => {
    const owned = ALL_KEYS.slice(0, ALL_KEYS.length - 2) // leave exactly 2
    const offers = generateRecipeOffers('seed1', 5, owned)
    expect(offers).toHaveLength(2)
    for (const k of offers) expect(owned).not.toContain(k)
  })

  it('returns empty when everything is owned', () => {
    const offers = generateRecipeOffers('seed1', 8, [...ALL_KEYS])
    expect(offers).toEqual([])
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- adventureRecipeDraft.test.ts`
Expected: FAIL — cannot find module `./adventureRecipeDraft`.

- [ ] **Step 4: Implement `generateRecipeOffers`**

Create `src/data/adventureRecipeDraft.ts`:

```ts
import { RECIPES } from './recipes'
import { hashStringToSeed, mulberry32 } from './seededRng'

// Roll up to 3 recipe keys for a Recipe Pick, drawn from the whole catalog
// minus the recipes already on the run's menu. Seeded by runSeed+shift so a
// given run always rolls the same offers (deterministic, re-enterable).
export function generateRecipeOffers(
  runSeed: string,
  shift: number,
  ownedRecipes: string[],
  count = 3,
): string[] {
  const owned = new Set(ownedRecipes)
  const pool = Object.keys(RECIPES).filter(k => !owned.has(k))
  const rng = mulberry32(hashStringToSeed(`${runSeed}::recipe::${shift}`))
  // Fisher-Yates with the seeded RNG, then take the first `count`.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- adventureRecipeDraft.test.ts`
Expected: PASS (all 8 tests).

- [ ] **Step 6: Lint, build, commit**

```bash
npm run lint && npm run build
git add src/data/seededRng.ts src/data/adventureRecipeDraft.ts src/data/adventureRecipeDraft.test.ts
git commit -m "feat(adventure): seeded recipe-draft roll (generateRecipeOffers)"
```
Expected: lint + build clean; commit succeeds.

---

## Task 2: Recalibrate the goal table

**Files:**
- Modify: `src/data/adventureMode.ts`

- [ ] **Step 1: Replace the `PER_PLAYER_GOALS` table**

In `src/data/adventureMode.ts`, replace the existing `PER_PLAYER_GOALS` array (and its comment block about per-minute pressure) with the cafe-scale, monotonic table:

```ts
// Money goal per shift PER PLAYER (1-indexed: PER_PLAYER_GOALS[shift-1]).
// Total shift goal = PER_PLAYER_GOALS[shift-1] × participantCount.
// Cafe scale (sub-project A): dishes are $5–$25. Curve is monotonic; boss
// shifts (4 & 8) are elevated but the curve never dips after them. Bosses now
// apply their own debuffs, so the old ×1.5 boss multiplier is NOT baked in here.
// $/player/min over the 3-min shift: 6.7 → 11.7 → 16.7 → 23.3 → 28.3 → 36.7 → 46.7 → 66.7
export const PER_PLAYER_GOALS: readonly number[] = [
   20,   // S1
   35,   // S2
   50,   // S3
   70,   // S4 (boss)
   85,   // S5
  110,   // S6
  140,   // S7
  200,   // S8 (final boss)
]
```

- [ ] **Step 2: Build + test**

Run: `npm run build && npm test`
Expected: clean build; all existing tests still pass (no test asserts the old goal numbers).

- [ ] **Step 3: Commit**

```bash
git add src/data/adventureMode.ts
git commit -m "balance(adventure): recalibrate shift goals to cafe scale (monotonic)"
```

---

## Task 3: AdventureRecipePick screen (additive)

**Files:**
- Create: `src/components/AdventureRecipePick.module.css`
- Create: `src/components/AdventureRecipePick.tsx`

> This task adds the component but does not yet route to it (that happens in Task 4). It must compile as an unused component.

- [ ] **Step 1: Create the stylesheet by copying the cuisine-pick styles**

Run:
```bash
cp src/components/AdventureCuisinePick.module.css src/components/AdventureRecipePick.module.css
```
This reuses the identical layout (screen, topbar, timer bar, carousel, cards, actions). No edits needed — the new component references the same class names. (The original file is deleted in Task 4; this copy is the surviving one.)

- [ ] **Step 2: Create the component**

Create `src/components/AdventureRecipePick.tsx`:

```tsx
import { useEffect, useState, Fragment } from 'react'
import { useChoiceVote } from '../hooks/useChoiceVote'
import { RECIPES } from '../data/recipes'
import { getRecipeProfile } from '../data/recipeProfile'
import { getAudioManager } from '../audio/AudioManager'
import FoodIcon from './FoodIcon'
import styles from './AdventureRecipePick.module.css'

const VOTE_DURATION_MS = 45_000
const VISIBLE = 3

function pips(n: 1 | 2 | 3): string {
  return '●'.repeat(n) + '○'.repeat(3 - n)
}

interface Props {
  offers: string[]                 // recipe keys (1–3)
  shiftNumber: number
  rosterSize: number
  allowSkip: boolean               // false for the opening draft (must pick a first dish)
  onConfirm: (offerIdx: number) => void
  onSkip: () => void
  voteRef: { current: ((user: string, text: string) => boolean) | null }
}

export default function AdventureRecipePick({ offers, shiftNumber, rosterSize, allowSkip, onConfirm, onSkip, voteRef }: Props) {
  const [carouselStart, setCarouselStart] = useState(0)

  const { state: voteState, registerVote, forceResolve, togglePause } = useChoiceVote(
    { numOptions: offers.length, durationMs: VOTE_DURATION_MS, allowDoneCommand: allowSkip },
    (res) => {
      getAudioManager().playSfx('serve-success')
      if (res.reason === 'done_command') { onSkip(); return }
      const winnerIdx = res.winnerIdx >= 0 ? res.winnerIdx : 0
      onConfirm(winnerIdx)
    },
  )

  useEffect(() => {
    voteRef.current = registerVote
    return () => { voteRef.current = null }
  }, [voteRef, registerVote])

  const totalVotes = voteState.tallies.reduce((s, t) => s + t, 0)
  const timerPct = voteState.timeLeftMs !== null ? (voteState.timeLeftMs / VOTE_DURATION_MS) * 100 : 100
  const canShiftLeft = carouselStart > 0
  const canShiftRight = carouselStart < offers.length - VISIBLE

  return (
    <div className={styles.screen}>
      <div className={styles.topbar}>
        <div>
          <div className={styles.title}>Add a Recipe</div>
          <div className={styles.subtitle}>
            Shift {shiftNumber}. Type <code>!1</code>–<code>!{offers.length}</code> to add a dish to your menu
            {allowSkip ? <> or <code>!skip</code> to add none.</> : <> for your opening menu.</>}
          </div>
        </div>
        <div className={styles.crewBadge}>
          <span className={styles.crewBadgeValue}>{rosterSize}</span>
          <span className={styles.crewBadgeLabel}>{rosterSize === 1 ? 'chef' : 'chefs'}</span>
        </div>
      </div>

      <div className={`${styles.timerBar} ${voteState.paused ? styles.timerBarPaused : ''}`}>
        <div className={styles.timerFill} style={{ width: `${timerPct}%` }} />
        {voteState.paused && <div className={styles.timerPausedLabel}>⏸ PAUSED</div>}
      </div>

      <div className={styles.carouselArea}>
        <button
          className={`${styles.navArrow} ${!canShiftLeft ? styles.navArrowDisabled : ''}`}
          disabled={!canShiftLeft}
          onClick={() => setCarouselStart(s => Math.max(0, s - 1))}
          aria-label="Scroll left"
        >‹</button>

        <div className={styles.cardsViewport}>
          {offers.slice(carouselStart, carouselStart + VISIBLE).map((key, relativeIdx) => {
            const absoluteIdx = carouselStart + relativeIdx
            const r = RECIPES[key]
            if (!r) return null
            const profile = getRecipeProfile(r)
            const votes = voteState.tallies[absoluteIdx] ?? 0
            const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
            return (
              <button
                key={key}
                type="button"
                className={styles.card}
                onClick={() => { if (!voteState.resolved) forceResolve(absoluteIdx) }}
                disabled={voteState.resolved}
              >
                <div className={styles.cardKey}>!{absoluteIdx + 1}</div>
                <div className={styles.cardHero}>{r.emoji}</div>
                <div className={styles.cardName}>{r.name}</div>
                <div className={styles.cardDescription}>
                  {pips(profile.complexityPips)} · ${profile.reward} · ~{Math.round(profile.prepTimeMs / 1000)}s
                </div>

                <div className={styles.cardRecipeList}>
                  <div className={styles.cardRecipeRow}>
                    <FoodIcon icon={r.emoji} size={22} className={styles.cardRecipeEmoji} />
                    <div className={styles.cardRecipeBody}>
                      <div className={styles.cardRecipeSteps}>
                        {r.steps.map((step, i) => (
                          <Fragment key={i}>
                            {i > 0 && (
                              <span className={step.requires ? styles.stepArrow : styles.stepSeparator}>
                                {step.requires ? '→' : '·'}
                              </span>
                            )}
                            <code className={styles.stepChip}>{step.action} {step.target.replace(/_/g, ' ')}</code>
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <span className={styles.cardVotes}>{votes} {votes === 1 ? 'vote' : 'votes'}{totalVotes > 0 ? ` · ${pct}%` : ''}</span>
                </div>
                <div className={styles.cardVoteBar}>
                  <div className={styles.cardVoteFill} style={{ width: `${pct}%` }} />
                </div>
              </button>
            )
          })}
        </div>

        <button
          className={`${styles.navArrow} ${!canShiftRight ? styles.navArrowDisabled : ''}`}
          disabled={!canShiftRight}
          onClick={() => setCarouselStart(s => Math.min(offers.length - VISIBLE, s + 1))}
          aria-label="Scroll right"
        >›</button>
      </div>

      <div className={styles.actions}>
        <button className={styles.pauseBtn} onClick={togglePause} disabled={voteState.resolved}>
          {voteState.paused ? '▶ Resume' : '⏸ Pause'}
        </button>
        {allowSkip && (
          <button className={styles.backBtn} onClick={() => { if (!voteState.resolved) onSkip() }} disabled={voteState.resolved}>
            Skip (add none)
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Build + lint**

Run: `npm run build && npm run lint`
Expected: clean (component compiles though it is not yet routed; `getRecipeProfile` and `generateRecipeOffers` already exist).

- [ ] **Step 4: Commit**

```bash
git add src/components/AdventureRecipePick.tsx src/components/AdventureRecipePick.module.css
git commit -m "feat(adventure): AdventureRecipePick draft screen (not yet routed)"
```

---

## Task 4: Switchover — types, bosses, state machine, App wiring, deletions

> Atomic refactor. Apply all steps before building; TypeScript will not compile mid-way. Build/lint/test at the end.

**Files:** `src/state/types.ts`, `src/data/adventureBosses.ts`, `src/hooks/useAdventureRun.ts`, `src/App.tsx`, `src/components/AdventureBriefing.tsx`, `src/components/AdventureShiftPassed.tsx`; delete `AdventureCuisinePick.*`, `AdventurePathPick.*`, `adventurePathCards.ts`; modify `src/data/adventureMode.ts`.

- [ ] **Step 1: Update `types.ts` — Screen union, ShiftResult, AdventureRun, retire PathCard**

In `src/state/types.ts`:

(a) Replace the `Screen` type's adventure entries — remove `'adventurepathpick'`, `'adventurecuisinepick'`, `'adventurebossbriefing'`; add `'adventurerecipepick'`:
```ts
export type Screen = 'menu' | 'localplay' | 'pvplobby' | 'adventurelobby' | 'adventurebriefing' | 'adventurepantryshop' | 'adventurerecipepick' | 'options' | 'playsetpicker' | 'freeplaysetup' | 'countdown' | 'playing' | 'shiftend' | 'gameover' | 'adventureshiftpassed' | 'adventurerunend' | 'credits'
```

(b) Delete the entire `PathCard` interface (lines beginning `export interface PathCard {` through its closing `}`).

(c) In `ShiftResult`, remove `chosenPathCardId?` and `cashBonusEarned?`; keep `bossDebuffId?: string`.

(d) Replace the `AdventureRun` interface body with:
```ts
export interface AdventureRun {
  runSeed: string
  currentShift: number                              // 1-based; shift being set up or played
  shiftResults: ShiftResult[]                       // completed shifts (appended after shiftend)
  currentRunMoney: number                           // bank — carries between shifts; spent in shop
  currentRecipes: string[]                          // the full active menu (grows via Recipe Pick)
  currentGoal: number                               // money goal for the current shift
  participantCount: number                          // crew size — scales goals + garnish prices
  pendingRecipeOffers?: string[]                    // recipe keys offered on the Recipe Pick screen
  currentBoss?: { id: string; disabledStationId?: string }  // set on boss shifts (S4/S8)
  pendingShopOffers?: ShopOffer[]
  ownedGarnishes: OwnedGarnish[]
  accumulatedPlayerStats: Record<string, PlayerStats>
  runWon?: boolean                                  // set when shift 8 is cleared
}
```
(This removes `startCuisine`, `unlockedRecipes`, `pendingPathCards`, `chosenPath`, `currentBossDebuff`.)

(e) In `AdventureBestRun`, remove `bestStartCuisine?: CuisineId` (cuisine is no longer tracked).

- [ ] **Step 2: Update `adventureBosses.ts` — applyBossDebuff signature + pickBossForShift**

In `src/data/adventureBosses.ts`:

(a) Remove the `PathCard` import from `'../state/types'` (the import line `import { GameOptions, GameState, PathCard } from '../state/types'` becomes `import { GameOptions, GameState } from '../state/types'`).

(b) Add an import at the top: `import { hashStringToSeed, mulberry32 } from './seededRng'`.

(c) Replace the `applyBossDebuff` signature and its `id`/payload reads:
```ts
// Compute the option/state adjustments for a given boss debuff.
export function applyBossDebuff(bossId: string | undefined, disabledStationId?: string): BossDelta {
  const id = bossId as BossId | undefined
  if (!id) return { options: {}, state: {} }

  switch (id) {
    case 'picky_critic':
      return { options: {}, state: { bossMoneyMultiplier: 0.75 } }
    case 'rush_hour':
      return { options: { orderSpawnRate: 1.5, orderSpeed: 1.1 }, state: {} }
    case 'health_inspector':
      return { options: {}, state: disabledStationId ? { disabledStations: [disabledStationId] } : {} }
    case 'understaffed':
      return { options: {}, state: { cooldownMultiplier: 1.5 } }
    case 'heatwave':
      return { options: {}, state: { heatPerCookMultiplier: 1.5, coolAmountBonus: -10 } }
    case 'chaos_mode':
      return { options: {}, state: {} }
    case 'recipe_roulette':
      return { options: {}, state: {} }
    case 'hangry_mob':
      return { options: {}, state: { orderPatienceBonus: -15000 } }
    case 'bad_reviews':
      return { options: {}, state: { lostOrderPenalty: 20 } }
  }
}
```

(d) Add a seeded boss picker at the end of the file:
```ts
// Auto-assign one boss for a boss shift, seeded for determinism. Pre-rolls the
// Health Inspector's disabled station so the briefing can name it.
export function pickBossForShift(runSeed: string, shift: number, enabledRecipes: string[]): { id: string; disabledStationId?: string } {
  const rng = mulberry32(hashStringToSeed(`${runSeed}::boss::${shift}`))
  const pool = getBossPool()
  const id = pool[Math.floor(rng() * pool.length)]
  const disabledStationId = id === 'health_inspector'
    ? (pickHealthInspectorStation(enabledRecipes, rng) ?? undefined)
    : undefined
  return { id, disabledStationId }
}
```

- [ ] **Step 3: Rewrite the state machine in `useAdventureRun.ts` — imports + buildShiftReset**

In `src/hooks/useAdventureRun.ts`:

(a) Update imports. Remove `pickStartingRecipe, pickAutoUnlockRecipe, pickRandomCuisine, getAutoUnlockedRecipeCount` and `generatePathPair` and `applyBossDebuff` (old usage) and `CuisineId, PathCard`. The adventure-mode and bosses imports become:
```ts
import {
  getAdventureGoal, ADVENTURE_SHIFT_DURATION, makeRunSeed,
  ADVENTURE_TOTAL_SHIFTS, isBossShift,
} from '../data/adventureMode'
import {
  applyAllGarnishes, generateShopOffers, addOwnedGarnish,
} from '../data/adventureGarnishes'
import { generateRecipeOffers } from '../data/adventureRecipeDraft'
import { applyBossDebuff, pickBossForShift } from '../data/adventureBosses'
```
And in the `react`/types import line, drop `CuisineId, PathCard` (keep `GameOptions, AdventureRun, AdventureBestRun, ShiftResult, Screen, ActiveEventOptions, FinalStats`).

(b) Change `buildShiftReset` to take a boss object instead of a `PathCard`:
```ts
function buildShiftReset(
  run: AdventureRun,
  boss: { id: string; disabledStationId?: string } | undefined,
): Extract<GameAction, { type: 'RESET' }> {
  const bossDelta = boss?.id
    ? applyBossDebuff(boss.id, boss.disabledStationId)
    : { options: {}, state: {} as const }

  const baseOrderSpeed = bossDelta.options.orderSpeed ?? 1
  const baseOrderSpawn = bossDelta.options.orderSpawnRate ?? 1

  const delta = applyAllGarnishes(run.ownedGarnishes, {
    cookingSpeed: 1,
    orderSpeed: baseOrderSpeed,
    orderSpawnRate: baseOrderSpawn,
  }, run.currentShift)

  const heatMul = (delta.state.heatPerCookMultiplier ?? 1) * (bossDelta.state.heatPerCookMultiplier ?? 1)
  const coolBonus = (delta.state.coolAmountBonus ?? 0) + (bossDelta.state.coolAmountBonus ?? 0)

  const ownsPhoenixWing = run.ownedGarnishes.some(g => g.garnishId === 'phoenix_wing')
  const ownsApprentice  = run.ownedGarnishes.some(g => g.garnishId === 'apprentice')

  const orderPatienceBonusCombined =
    (delta.state.orderPatienceBonus ?? 0) + (bossDelta.state.orderPatienceBonus ?? 0)

  return {
    type: 'RESET',
    shiftDuration: ADVENTURE_SHIFT_DURATION,
    cookingSpeed: delta.options.cookingSpeed ?? 1,
    orderSpeed: delta.options.orderSpeed ?? baseOrderSpeed,
    orderSpawnRate: delta.options.orderSpawnRate ?? baseOrderSpawn,
    enabledRecipes: run.currentRecipes,
    teams: undefined,
    participantCount: 0,
    heatPerCookMultiplier: heatMul === 1 ? undefined : heatMul,
    coolAmountBonus: coolBonus === 0 ? undefined : coolBonus,
    flatTipPerOrder: delta.state.flatTipPerOrder,
    choppingCookTimeMultiplier: delta.state.choppingCookTimeMultiplier,
    orderPatienceBonus: orderPatienceBonusCombined === 0 ? undefined : orderPatienceBonusCombined,
    overheatThreshold: delta.state.overheatThreshold,
    bossMoneyMultiplier: bossDelta.state.bossMoneyMultiplier,
    cooldownMultiplier: bossDelta.state.cooldownMultiplier,
    disabledStations: bossDelta.state.disabledStations,
    activeGarnishes: run.ownedGarnishes.map(g => g.garnishId),
    activeBossDebuff: boss?.id,
    heatDecayAboveThreshold: delta.state.heatDecayAboveThreshold,
    heatDecayRate: delta.state.heatDecayRate,
    autoExtinguishCharges: ownsPhoenixWing ? 1 : undefined,
    apprenticeTimerMs: ownsApprentice ? 0 : undefined,
    lostOrderPenalty: bossDelta.state.lostOrderPenalty,
  }
}
```

- [ ] **Step 4: Rewrite `startAdventure` (opening draft)**

Replace the whole `startAdventure` callback with:
```ts
  // startAdventure: create a fresh run and open the opening recipe draft.
  const startAdventure = useCallback(() => {
    const roster = adventureLobbyRef.current ?? []
    const participantCount = Math.max(1, roster.length)
    const shift = 1
    const runSeed = makeRunSeed()
    const run: AdventureRun = {
      runSeed,
      currentShift: shift,
      shiftResults: [],
      currentRunMoney: 0,
      currentRecipes: [],
      currentGoal: getAdventureGoal(shift, participantCount),
      participantCount,
      ownedGarnishes: [],
      accumulatedPlayerStats: {},
      pendingRecipeOffers: generateRecipeOffers(runSeed, shift, []),
    }
    setAdventureRun(run)
    setIsNewBestAdventureRun(false)
    persistSavedAdventureRun(run, roster)
    setScreen('adventurerecipepick')
  }, [setScreen, adventureLobbyRef])
```
(Note: `startAdventure` no longer takes a `cuisine` arg, and no longer dispatches RESET — that happens when the opening draft resolves into the briefing, in `resolveRecipePick` below.)

- [ ] **Step 5: Add recipe-pick resolution callbacks**

Add these callbacks (place them where `openPathPick`/`confirmPathCard` were):
```ts
  // openRecipePick: from adventureshiftpassed → recipepick for the upcoming shift.
  const openRecipePick = useCallback(() => {
    setAdventureRun(prev => {
      if (!prev) return prev
      const nextShift = prev.currentShift + 1
      const offers = generateRecipeOffers(prev.runSeed, nextShift, prev.currentRecipes)
      return { ...prev, pendingRecipeOffers: offers }
    })
    setScreen('adventurerecipepick')
  }, [setScreen])

  // resolveRecipePick: shared add-or-skip resolution. The opening draft (no shifts
  // played yet) sets up shift 1 and routes to the briefing; between-shift picks
  // route to the Pantry shop.
  const resolveRecipePick = useCallback((addedRecipe: string | null) => {
    const isOpeningDraft = (adventureRunRef.current?.shiftResults.length ?? 0) === 0
    setAdventureRun(prev => {
      if (!prev) return prev
      const currentRecipes = addedRecipe ? [...prev.currentRecipes, addedRecipe] : prev.currentRecipes
      const updated: AdventureRun = { ...prev, currentRecipes, pendingRecipeOffers: undefined }
      if (isOpeningDraft) {
        dispatch(buildShiftReset(updated, updated.currentBoss))
        setActiveEventOptions(pickEventOptions(updated.currentShift, updated.currentBoss?.id))
        activeGameOptionsRef.current = null
        persistSavedAdventureRun(updated, adventureLobbyRef.current ?? [])
      }
      return updated
    })
    setScreen(isOpeningDraft ? 'adventurebriefing' : 'adventurepantryshop')
  }, [dispatch, setScreen, setActiveEventOptions, activeGameOptionsRef, adventureLobbyRef])

  const confirmRecipePick = useCallback((offerIdx: number) => {
    const offers = adventureRunRef.current?.pendingRecipeOffers
    resolveRecipePick(offers?.[offerIdx] ?? null)
  }, [resolveRecipePick])

  const skipRecipePick = useCallback(() => {
    resolveRecipePick(null)
  }, [resolveRecipePick])
```

- [ ] **Step 6: Rewrite `closeShop` (drop auto-unlock, auto-assign boss)**

Replace the whole `closeShop` callback with:
```ts
  const closeShop = useCallback(() => {
    setAdventureRun(prev => {
      if (!prev) return prev
      const nextShift = prev.currentShift + 1

      const liveRoster = adventureLobbyRef.current
      const nextParticipantCount = liveRoster && liveRoster.length > 0
        ? liveRoster.length
        : prev.participantCount

      const currentGoal = getAdventureGoal(nextShift, nextParticipantCount)

      // Auto-assign a boss on boss shifts (seeded); clear it otherwise.
      const currentBoss = isBossShift(nextShift)
        ? pickBossForShift(prev.runSeed, nextShift, prev.currentRecipes)
        : undefined

      // Veteran's Tip garnish: +$15 to the bank at the start of every shift after S1.
      const veteransTipActive = prev.ownedGarnishes.some(g => g.garnishId === 'veterans_tip')
      const veteransTipBonus = veteransTipActive && nextShift > 1 ? 15 * Math.max(1, nextParticipantCount) : 0

      const updatedRun: AdventureRun = {
        ...prev,
        currentShift: nextShift,
        currentGoal,
        participantCount: nextParticipantCount,
        currentRunMoney: prev.currentRunMoney + veteransTipBonus,
        currentBoss,
        pendingShopOffers: undefined,
      }

      dispatch(buildShiftReset(updatedRun, currentBoss))
      setActiveEventOptions(pickEventOptions(nextShift, currentBoss?.id))
      activeGameOptionsRef.current = null
      persistSavedAdventureRun(updatedRun, liveRoster ?? [])
      return updatedRun
    })
    setScreen('adventurebriefing')
  }, [dispatch, setScreen, setActiveEventOptions, activeGameOptionsRef, adventureLobbyRef])
```

- [ ] **Step 7: Update `handleShiftEndDone` (drop path-card cash bonus)**

In `handleShiftEndDone`, replace the result-building block so it no longer reads `chosenPath`:
```ts
    const passed = fs.money >= run.currentGoal
    const result: ShiftResult = {
      shiftNumber: run.currentShift,
      recipes: run.currentRecipes,
      goalMoney: run.currentGoal,
      moneyEarned: fs.money,
      served: fs.served,
      lost: fs.lost,
      passed,
      bossDebuffId: run.currentBoss?.id,
    }
    const isFinalShift = run.currentShift >= ADVENTURE_TOTAL_SHIFTS
    const updatedRun: AdventureRun = {
      ...run,
      shiftResults: [...run.shiftResults, result],
      currentRunMoney: passed ? run.currentRunMoney + fs.money : run.currentRunMoney,
      runWon: passed && isFinalShift ? true : run.runWon,
    }
```
(Removes the `cashBonus` computation, the `chosenPath: undefined` reset, and `chosenPathCardId`/`cashBonusEarned` fields. The rest of `handleShiftEndDone` — best-run persistence, run-end routing — is unchanged. The `totalMoney`/`bestStartCuisine` block: drop `bestStartCuisine` from the `AdventureBestRun` objects since the field was removed.)

- [ ] **Step 8: Update `resumeAdventureRun` and `hydrateAdventureRun`**

In `resumeAdventureRun`, replace the goal recompute (which used `chosenPath.goalDelta`) and the dispatch:
```ts
  const resumeAdventureRun = useCallback(() => {
    setAdventureRun(prev => {
      if (!prev) return prev
      const liveRoster = adventureLobbyRef.current ?? []
      const nextParticipantCount = Math.max(1, liveRoster.length)
      const currentGoal = getAdventureGoal(prev.currentShift, nextParticipantCount)
      const updatedRun: AdventureRun = { ...prev, participantCount: nextParticipantCount, currentGoal }
      dispatch(buildShiftReset(updatedRun, prev.currentBoss))
      setActiveEventOptions(pickEventOptions(prev.currentShift, prev.currentBoss?.id))
      activeGameOptionsRef.current = null
      persistSavedAdventureRun(updatedRun, liveRoster)
      return updatedRun
    })
    setScreen('adventurebriefing')
  }, [dispatch, setScreen, setActiveEventOptions, activeGameOptionsRef, adventureLobbyRef])
```
In `hydrateAdventureRun`, change the two boss-aware calls:
```ts
    dispatch(buildShiftReset(saved.run, saved.run.currentBoss))
    setActiveEventOptions(pickEventOptions(saved.run.currentShift, saved.run.currentBoss?.id))
```

- [ ] **Step 9: Bump the saved-run version**

In `useAdventureRun.ts`, change the `SavedAdventureRun` `version` field type and the load guard from `1` to `2`:
- In the `SavedAdventureRun` interface: `version: 2`.
- In `persistSavedAdventureRun`: `const payload: SavedAdventureRun = { version: 2, run, lobby, savedAt: Date.now() }`.
- In `loadSavedAdventureRun`: `if (parsed.version !== 2 || !parsed.run || !Array.isArray(parsed.lobby)) return null`.

- [ ] **Step 10: Update the hook's return object**

In the `return { ... }` of `useAdventureRun`, replace `openPathPick, confirmPathCard` with `openRecipePick, confirmRecipePick, skipRecipePick`. Keep everything else (`startAdventure`, `purchaseGarnish`, `rerollShopOffers`, `closeShop`, `resumeAdventureRun`, `hydrateAdventureRun`, `clearSavedAdventureRun`, `getRerollPrice`, etc.).

- [ ] **Step 11: Delete cuisine/auto-unlock helpers from `adventureMode.ts`**

In `src/data/adventureMode.ts`, delete: `getAutoUnlockedRecipeCount`, `CUISINE_TO_RECIPE_SET_ID`, `getCuisineRecipeKeys`, `rankRecipesByEase`, `pickStartingRecipe`, `pickAutoUnlockRecipe`, `pickRandomCuisine`. Remove the now-unused imports (`RECIPE_SETS`, `CuisineId`, `AdventureRun` if unused). Keep `ADVENTURE_TOTAL_SHIFTS`, `ADVENTURE_BOSS_SHIFTS`, `PER_PLAYER_GOALS`, `ADVENTURE_SHIFT_DURATION`, `getAdventureGoal`, `isBossShift`, `makeRunSeed`, `mergePlayerStats`.

- [ ] **Step 12: Update `AdventureBriefing.tsx` boss source**

In `src/components/AdventureBriefing.tsx`, change the boss reads:
```ts
  const chosenBoss = run.currentBoss?.id
    ? BOSSES[run.currentBoss.id as BossId]
    : null
  const bossDisabledStation = run.currentBoss?.disabledStationId
    ? STATION_DEFS[run.currentBoss.disabledStationId]?.name
    : null
```
(Replaces the `run.chosenPath?.bossDebuffId` / `run.chosenPath?.bossPayload?.disabledStationId` reads. Everything else in the file is unchanged.)

- [ ] **Step 13: Update `AdventureShiftPassed.tsx`**

In `src/components/AdventureShiftPassed.tsx`, remove the `cashBonus` prop from the component's `Props` and any UI that displays it (the path-card cash bonus no longer exists). If removing the display is involved, replace the cash-bonus line with nothing. (The `onNext` prop is unchanged in the component; only App's wiring of it changes in Step 14.)

- [ ] **Step 14: Rewire `App.tsx`**

In `src/App.tsx`:

(a) Update imports: remove `import AdventureCuisinePick from './components/AdventureCuisinePick'` and `import AdventurePathPick from './components/AdventurePathPick'`; add `import AdventureRecipePick from './components/AdventureRecipePick'`. Remove `CuisineId` from the `./state/types` import if now unused. Remove `getAdventureGoal` from the adventureMode import if it becomes unused after (b) (it is used at line 752 for path-pick; that render is removed, so drop it if no other use remains).

(b) Update the destructure of `useAdventureRun(...)`: replace `openPathPick, confirmPathCard` with `openRecipePick, confirmRecipePick, skipRecipePick`.

(c) Replace `handleAdventureLobbyStart`'s `setScreen('adventurecuisinepick')` with `startAdventure()`:
```ts
  const handleAdventureLobbyStart = useCallback(() => {
    const roster = adventureLobbyRef.current ?? []
    if (roster.length === 0) return
    if (adventureRunRef.current) {
      resumeAdventureRun()
      return
    }
    startAdventure()
  }, [adventureLobbyRef, adventureRunRef, resumeAdventureRun, startAdventure])
```

(d) Delete the `handleCuisineConfirmed` callback (lines 313–316).

(e) Replace the two render blocks for `adventurecuisinepick` and `adventurepathpick` with a single `adventurerecipepick` block:
```tsx
  } else if (screen === 'adventurerecipepick' && adventureRun?.pendingRecipeOffers) {
    content = (
      <AdventureRecipePick
        offers={adventureRun.pendingRecipeOffers}
        shiftNumber={adventureRun.shiftResults.length === 0 ? 1 : adventureRun.currentShift + 1}
        rosterSize={adventureLobby?.length ?? adventureRun.participantCount}
        allowSkip={adventureRun.shiftResults.length > 0}
        onConfirm={confirmRecipePick}
        onSkip={skipRecipePick}
        voteRef={adventureVoteRef}
      />
    )
  }
```

(f) Update the `AdventureShiftPassed` render: change `onNext={openPathPick}` to `onNext={openRecipePick}` and remove the `cashBonus={...}` prop (it was removed from the component in Step 13).

- [ ] **Step 15: Delete the obsolete files**

Run:
```bash
git rm src/components/AdventureCuisinePick.tsx src/components/AdventureCuisinePick.module.css \
       src/components/AdventurePathPick.tsx src/components/AdventurePathPick.module.css \
       src/data/adventurePathCards.ts
```

- [ ] **Step 16: Build, lint, test — resolve any stragglers**

Run: `npm run build`
Expected: clean. If `tsc` reports remaining references (e.g. a lingering `PathCard`, `startCuisine`, `chosenPath`, `openPathPick`, `getCuisineRecipeKeys`, `bestStartCuisine`, or `adventurecuisinepick`/`adventurepathpick` string), fix each at the reported location to match the new shapes above, then rebuild.

Run: `npm run lint && npm test`
Expected: lint clean; all tests pass (recipeProfile, recipes, recipeArchetypes.audit, adventureRecipeDraft).

- [ ] **Step 17: Commit**

```bash
git add -A
git commit -m "feat(adventure): recipe-draft run flow — opening draft, between-shift picks, auto bosses

Replace cuisine lock + path-pick + auto-unlock with the all-cuisine Recipe Pick
draft. Menu grows by chat vote; bosses auto-assign on S4/S8; goals use the
recalibrated cafe-scale table. Removes AdventureCuisinePick, AdventurePathPick,
adventurePathCards, and the cuisine/auto-unlock helpers."
```
> `git add -A` here is intentional and safe: at this point the working tree contains only this task's refactor + the file deletions (sub-projects A and the capacity cleanup are already committed; there are no unrelated uncommitted files left).

---

## Task 5: Docs + final verification

**Files:** `CLAUDE.md`, `docs/game-design-and-mechanics.md`

- [ ] **Step 1: Update CLAUDE.md Adventure section**

In `CLAUDE.md`, update the Adventure Mode description to match: screen flow now `menu → adventurelobby → adventurerecipepick (opening draft) → adventurebriefing → countdown → playing → shiftend → adventureshiftpassed → adventurerecipepick → adventurepantryshop → adventurebriefing (loop) → adventurerunend`. Note: cuisine lock + path cards + auto-unlock removed; menu grows via all-cuisine Recipe Pick (add 1 / skip); bosses auto-assigned on S4/S8; goals from the recalibrated `PER_PLAYER_GOALS`. Remove references to `adventurecuisinepick`/`adventurepathpick`/`generatePathPair`/cuisine pickers.

- [ ] **Step 2: Update the game-design doc**

In `docs/game-design-and-mechanics.md`, update the Adventure Mode section: the between-shift loop is Recipe Pick → Pantry Shop (no path cards); run opens with a recipe draft (no cuisine pick); cuisine is now a flavor tag only; bosses auto-assigned. Keep it consistent with the spec.

- [ ] **Step 3: Full verification**

Run: `npm run lint && npm run build && npm test`
Expected: all clean / green.

- [ ] **Step 4: Manual smoke (optional but recommended)**

Run `npm run dev`, start an Adventure run locally (local "You" auto-joins the lobby; use the local chat input which is broadcaster-level): confirm the opening Recipe Pick offers 3 dishes and requires a pick (no skip), the briefing shows the 1-recipe menu, a shift plays, Shift Passed → Recipe Pick (now with Skip) → Pantry Shop → next briefing, and that shift 4 shows an auto-assigned boss panel.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/game-design-and-mechanics.md
git commit -m "docs(adventure): update flow for recipe-draft rework (sub-project B)"
```

---

## Self-Review Checklist (completed during planning)

- **Spec coverage:** opening draft + between-shift Recipe Pick (Tasks 3,4) ✓ · 3 all-cuisine seeded no-dupe offers + graceful exhaustion (Task 1) ✓ · `!skip` between shifts, mandatory opening pick (Task 3 `allowSkip`, Task 4 Step 14e) ✓ · all-added-active menu (`currentRecipes`, Task 4 Step 1d/5) ✓ · recalibrated monotonic goals (Task 2) ✓ · auto-assigned bosses + briefing preview (Task 4 Steps 2,6,12) ✓ · remove cuisine/path/auto-unlock (Task 4 Steps 11,15) ✓ · saved-run version bump / graceful discard (Task 4 Step 9) ✓ · `generateRecipeOffers` unit-tested (Task 1) ✓ · build/lint/tests (Tasks 4,5) ✓ · docs (Task 5) ✓.
- **Placeholder scan:** no TBD/TODO; every code step shows complete code or an exact edit with the literal new text.
- **Type consistency:** `currentBoss: { id: string; disabledStationId?: string }`, `pendingRecipeOffers: string[]`, `applyBossDebuff(bossId, disabledStationId?)`, `pickBossForShift(runSeed, shift, recipes)`, `generateRecipeOffers(runSeed, shift, ownedRecipes, count?)`, and the `openRecipePick/confirmRecipePick/skipRecipePick` names are used identically across types, hook, component, and App wiring.
- **Atomicity:** Task 4 is explicitly flagged as the one non-incrementally-compiling unit; Tasks 1–3 build green on their own.
