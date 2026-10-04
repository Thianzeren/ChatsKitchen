# Prepared-Item Pools Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the six parallel prepared-item arrays in `GameState` with one record-based, team-keyed pool structure, fix the provenance bug that the parallel arrays allowed, and split the 225-line `TICK` case into small named steps — with no other behaviour change.

**Architecture:** Each prepared ingredient becomes a `PreparedItem { item, source }` record, so an item can no longer drift away from its cook. `GameState.preparedPools: { shared, red, blue }` replaces `preparedItems`, `preparedItemSources`, and the four `red…`/`blue…` variants; a small pure module (`preparedPools.ts`) owns every pool operation (add, take, random-remove, user→pool routing). `TICK` moves to `tick.ts` as a composition of `rotateRecipeRoulette → advanceStations → advanceOrders → expireModifiers`, sharing a per-tick working draft and chat log.

**Tech Stack:** TypeScript (strict), React 18 `useReducer`, Vitest 1.6.

---

## Why

`preparedItems[i]` and `preparedItemSources[i]` must be updated at the same index by every code path (CLAUDE.md pitfall #14). Nothing enforces it, and one path already breaks it: `COOK` with a prerequisite (`gameReducer.ts:410-419`) splices the item but **not** its source, so after any multi-step recipe every later ingredient is credited to the wrong cook. PvP doubles the surface with four more arrays and duplicate red/blue branches.

## Scope

**In:** data-model change, the `COOK` prerequisite bug fix, `TICK` decomposition, docs.

**Out (record as follow-ups, do not change):**
- In PvP, `REMOVE_PREPARED_ITEMS` (Rats) and `ADD_PREPARED_ITEMS` (Mystery) touch the `shared` pool, which PvP never displays or uses — those events are no-ops in PvP. Preserve.
- `useGameAudio`, `useBotSimulation`, and the tutorial read only the `shared` pool (so the "take-item" sound never plays in PvP). Preserve.

## File Structure

| File | Change | Responsibility |
|------|--------|----------------|
| `src/state/types.ts` | Modify | Add `PreparedItem`, `PoolId`, `PreparedPools`; replace the 6 pool fields with `preparedPools` |
| `src/state/preparedPools.ts` | Create | Pure pool operations + user→pool routing |
| `src/state/preparedPools.test.ts` | Create | Unit tests for the module |
| `src/state/stateHelpers.ts` | Create | `addMsg`, `addStat`, `bumpStat`, `EMPTY_STATS` (moved out of the reducer so `tick.ts` can share them) |
| `src/state/tick.ts` | Create | `tickReducer` and its step functions; owns `LOST_ORDER_PENALTY_FRACTION` |
| `src/state/gameReducer.ts` | Modify | Use pool helpers; delegate `TICK`; re-export `LOST_ORDER_PENALTY_FRACTION` |
| `src/state/testPools.ts` | Create | Test-only fixture helpers (`poolItems`, `poolSources`, `withPool`) so tests don't depend on the storage shape |
| `src/state/gameReducer.test.ts`, `gameReducer.economy.test.ts` | Modify | Use the fixture helpers |
| `src/state/gameReducer.pools.test.ts` | Create | Bug regression + characterisation tests for untested pool/TICK paths |
| `src/components/Kitchen.tsx`, `src/audio/useGameAudio.ts`, `src/hooks/useBotSimulation.ts`, `src/data/tutorialData.ts`, `src/data/adventureGarnishes.ts` | Modify | Read from `preparedPools` |
| `CLAUDE.md`, `docs/Kitchen Events.md` | Modify | Document the new model |

Run all commands from the repo root. Full verification at any point: `npm run lint && npx vitest run && npm run build`.

---

### Task 1: Test fixture helpers (no behaviour change)

Tests currently build state by setting the six raw fields. Route them through helpers first, so Task 5 only has to change the helpers.

**Files:**
- Create: `src/state/testPools.ts`
- Modify: `src/state/gameReducer.test.ts`, `src/state/gameReducer.economy.test.ts`

- [ ] **Step 1: Create the helpers against the current shape**

```ts
// src/state/testPools.ts
// Test-only fixture helpers. They hide how prepared-item pools are stored so
// tests describe behaviour ("alice's chopped lettuce is in the red pool"), not
// the storage shape.
import type { GameState } from './types'

export type TestPool = 'shared' | 'red' | 'blue'

export function poolItems(s: GameState, pool: TestPool = 'shared'): string[] {
  if (pool === 'shared') return s.preparedItems
  return (pool === 'red' ? s.redPreparedItems : s.bluePreparedItems) ?? []
}

export function poolSources(s: GameState, pool: TestPool = 'shared'): string[] {
  if (pool === 'shared') return s.preparedItemSources
  return (pool === 'red' ? s.redPreparedItemSources : s.bluePreparedItemSources) ?? []
}

/** Replace one pool. `sources` defaults to '' (no cook) for every item. */
export function withPool(s: GameState, pool: TestPool, items: string[], sources: string[] = items.map(() => '')): GameState {
  if (pool === 'shared') return { ...s, preparedItems: items, preparedItemSources: sources }
  if (pool === 'red') return { ...s, redPreparedItems: items, redPreparedItemSources: sources }
  return { ...s, bluePreparedItems: items, bluePreparedItemSources: sources }
}
```

- [ ] **Step 2: Rewrite `gameReducer.test.ts` fixtures and assertions**

Add `import { poolItems, poolSources, withPool } from './testPools'` after the existing imports, then make these replacements:

| Old | New |
|-----|-----|
| `const ready = base({ preparedItems: ['chopped_potato'], preparedItemSources: ['bob'] })` | `const ready = withPool(base(), 'shared', ['chopped_potato'], ['bob'])` |
| `expect(ok.preparedItems).not.toContain('chopped_potato')` | `expect(poolItems(ok)).not.toContain('chopped_potato')` |
| `expect(out.preparedItems).toEqual(['chopped_lettuce'])` (2×) | `expect(poolItems(out)).toEqual(['chopped_lettuce'])` |
| `expect(out.preparedItemSources).toEqual(['alice'])` (2×) | `expect(poolSources(out)).toEqual(['alice'])` |
| `expect(out.preparedItems).toHaveLength(0)` | `expect(poolItems(out)).toHaveLength(0)` |
| `expect(out.preparedItemSources).toHaveLength(0)` | `expect(poolSources(out)).toHaveLength(0)` |
| `expect(out.redPreparedItems).toHaveLength(0)` | `expect(poolItems(out, 'red')).toHaveLength(0)` |
| `expect(out.redPreparedItems).toHaveLength(plate.length)` | `expect(poolItems(out, 'red')).toHaveLength(plate.length)` |

Then rewrite the five `base({...})` calls in the `SERVE` block that set pool fields:

```ts
  it('consumes the plate, pays out, and credits the cook (pitfall #14)', () => {
    const s = withPool(base({ orders: [order({ patienceLeft: 80_000, patienceMax: 80_000 })] }),
      'shared', [...plate], ['alice', 'alice', 'alice'])
```
```ts
  it('rejects when an ingredient is missing', () => {
    const s = withPool(base({ orders: [order()] }), 'shared', ['chopped_lettuce', 'grilled_patty'], ['alice', 'alice']) // no bun
```
```ts
  it('rejects when the serving user is busy cooking', () => {
    let s = withPool(base({ orders: [order()] }), 'shared', [...plate], ['alice', 'alice', 'alice'])
```
```ts
  it('uses the team pool and tracks team money in PvP', () => {
    const s = withPool(base({ teams: { alice: 'red' }, redMoney: 0, redServed: 0, orders: [order()] }),
      'red', [...plate], ['alice', 'alice', 'alice'])
```
```ts
  it('rejects a user with no team in PvP', () => {
    const s = withPool(base({ teams: { alice: 'red' }, redServed: 0, orders: [order()] }), 'red', [...plate])
```

- [ ] **Step 3: Rewrite the economy fixture**

In `src/state/gameReducer.economy.test.ts` add `import { withPool } from './testPools'` and replace the `return { … }` at the end of `stateWithOrder` with:

```ts
  return withPool({ ...base, money, orders: [order] }, 'shared',
    [...RECIPES[DISH].plate], RECIPES[DISH].plate.map(() => 'cook1'))
```

- [ ] **Step 4: Verify nothing references the raw fields in tests**

Run: `grep -nE 'preparedItem|PreparedItem' src/state/*.test.ts`
Expected: no output.

Run: `npx vitest run src/state`
Expected: all pass (same count as before).

- [ ] **Step 5: Commit**

```bash
git add src/state/testPools.ts src/state/gameReducer.test.ts src/state/gameReducer.economy.test.ts
git commit -m "test: route reducer pool fixtures through shape-agnostic helpers"
```

---

### Task 2: Fix the COOK prerequisite provenance bug (TDD)

**Files:**
- Create: `src/state/gameReducer.pools.test.ts`
- Modify: `src/state/gameReducer.ts` (the `if (matchedStep.requires)` block in `COOK`)

- [ ] **Step 1: Write the failing test**

```ts
// src/state/gameReducer.pools.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { gameReducer, createInitialState } from './gameReducer'
import { RECIPES } from '../data/recipes'
import { GameState, StationSlot, Order } from './types'
import { poolItems, poolSources, withPool } from './testPools'

const NOW = 1_000_000

function base(overrides: Partial<GameState> = {}): GameState {
  return { ...createInitialState(120_000), ...overrides }
}

function slot(over: Partial<StationSlot> = {}): StationSlot {
  return {
    id: 'slot_1', user: 'alice', target: 'lettuce', produces: 'chopped_lettuce',
    elapsedMs: 6950, cookDuration: 7000, heatApplied: 0, heatPerCook: 15, state: 'cooking',
    ...over,
  }
}

function order(over: Partial<Order> = {}): Order {
  return { id: 1, dish: 'burger', served: false, patienceMax: 80_000, patienceLeft: 80_000, spawnTime: NOW, ...over }
}

function withSlot(state: GameState, stationId: string, s: StationSlot, heat = 0): GameState {
  return {
    ...state,
    stations: { ...state.stations, [stationId]: { ...state.stations[stationId], slots: [s], heat } },
    activeUsers: { ...state.activeUsers, [s.user]: stationId },
  }
}

const tick = (s: GameState, delta = 100) => gameReducer(s, { type: 'TICK', delta, now: NOW })

afterEach(() => { vi.restoreAllMocks() })

describe('provenance stays attached to its ingredient', () => {
  it('COOK consumes a prerequisite together with its source', () => {
    // fry potato requires chopped_potato (in the middle of the pool)
    const s = withPool(base(), 'shared', ['chopped_lettuce', 'chopped_potato', 'toasted_bun'], ['ann', 'bob', 'cat'])
    const out = gameReducer(s, { type: 'COOK', user: 'alice', action: 'fry', target: 'potato', now: NOW })
    expect(poolItems(out)).toEqual(['chopped_lettuce', 'toasted_bun'])
    expect(poolSources(out)).toEqual(['ann', 'cat'])
  })

  it('credits the right cook when a dish is served after a prerequisite was consumed', () => {
    let s = withPool(base({ orders: [order()] }), 'shared',
      ['chopped_potato', 'chopped_lettuce', 'grilled_patty', 'toasted_bun'], ['zed', 'ann', 'bob', 'cat'])
    s = gameReducer(s, { type: 'COOK', user: 'alice', action: 'fry', target: 'potato', now: NOW })
    s = gameReducer(s, { type: 'SERVE', user: 'dan', orderId: 1 })
    expect(s.playerStats.ann.bonusPoints).toBe(2)
    expect(s.playerStats.bob.bonusPoints).toBe(2)
    expect(s.playerStats.cat.bonusPoints).toBe(2)
    expect(s.playerStats.zed?.bonusPoints ?? 0).toBe(0)
  })
})
```

Note: `dan` serves and `alice` is busy frying, so neither is blocked. `slot`, `withSlot`, `tick`, and `RECIPES` are used by Task 3.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/state/gameReducer.pools.test.ts`
Expected: FAIL — sources are `['ann', 'bob', 'cat']` (not spliced), and the second test credits the wrong cooks. (Until Task 3 adds tests, `noUnusedLocals` is not enforced by Vitest, so unused helpers are fine.)

- [ ] **Step 3: Fix the bug**

In `COOK`, replace the prerequisite block:

```ts
      // Check ingredient prerequisite
      let afterRequire = withCooldown
      if (matchedStep.requires) {
        const teamItems = teamPrepItems(afterRequire, user)
        const idx = teamItems.indexOf(matchedStep.requires)
        if (idx === -1) {
          return addMsg(afterRequire, 'KITCHEN', `Need ${matchedStep.requires.replace(/_/g, ' ')} first!`, 'error')
        }
        const newItems = [...teamItems]
        newItems.splice(idx, 1)
        // Splice the source at the same index — otherwise every later item is
        // credited to the wrong cook (pitfall #14).
        const newSources = [...teamPrepSources(afterRequire, user)]
        newSources.splice(idx, 1)
        afterRequire = setTeamPrepSources(setTeamPrepItems(afterRequire, user, newItems), user, newSources)
      }
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/state`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/state/gameReducer.ts src/state/gameReducer.pools.test.ts
git commit -m "fix(reducer): consume a COOK prerequisite's source with the item

Splicing the item but not its source shifted every later ingredient's
cook by one, misattributing +2 serve bonuses after any multi-step recipe."
```

---

### Task 3: Characterisation tests for untested pool/TICK paths

These pass against the current code and pin behaviour before the refactor.

**Files:**
- Modify: `src/state/gameReducer.pools.test.ts` (append)

- [ ] **Step 1: Append the tests**

```ts
describe('pool routing', () => {
  it('banks a finished PvP ingredient in the cook’s team pool', () => {
    const s = withSlot(base({ teams: { alice: 'red', bob: 'blue' } }), 'cutting_board', slot())
    const out = tick(s)
    expect(poolItems(out, 'red')).toEqual(['chopped_lettuce'])
    expect(poolSources(out, 'red')).toEqual(['alice'])
    expect(poolItems(out, 'blue')).toEqual([])
  })

  it('drops the ingredient of a PvP cook who is not on a team, but frees them', () => {
    const s = withSlot(base({ teams: { bob: 'blue' } }), 'cutting_board', slot({ user: 'carol' }))
    const out = tick(s)
    expect(poolItems(out, 'shared')).toEqual([])
    expect(poolItems(out, 'red')).toEqual([])
    expect(poolItems(out, 'blue')).toEqual([])
    expect(out.activeUsers.carol).toBeUndefined()
  })

  it('SERVE takes the first matching copy, so attribution is first-in-first-out', () => {
    const s = withPool(base({ orders: [order()] }), 'shared',
      ['chopped_lettuce', 'chopped_lettuce', 'grilled_patty', 'toasted_bun'], ['ann', 'bob', 'cat', 'cat'])
    const out = gameReducer(s, { type: 'SERVE', user: 'dan', orderId: 1 })
    expect(out.playerStats.ann.bonusPoints).toBe(2)
    expect(out.playerStats.bob).toBeUndefined()
    expect(poolItems(out)).toEqual(['chopped_lettuce'])
    expect(poolSources(out)).toEqual(['bob'])
  })
})

describe('garnish and event effects on pools', () => {
  it('Doppelgänger adds a second copy credited to the same cook', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1) // < 0.2 → extra copy
    const out = tick(withSlot(base({ activeGarnishes: ['doppelganger'] }), 'cutting_board', slot()))
    expect(poolItems(out)).toEqual(['chopped_lettuce', 'chopped_lettuce'])
    expect(poolSources(out)).toEqual(['alice', 'alice'])
  })

  it('Mise en Place seeds the shared pool with uncredited items on RESET', () => {
    const out = gameReducer(base(), {
      type: 'RESET', shiftDuration: 120_000, cookingSpeed: 1, orderSpeed: 1, orderSpawnRate: 1,
      enabledRecipes: ['burger'], activeGarnishes: ['mise_en_place'],
    })
    expect(poolItems(out)).toHaveLength(5)
    expect(poolSources(out)).toEqual(['', '', '', '', ''])
    const burgerProduces = RECIPES.burger.steps.map(st => st.produces)
    for (const item of poolItems(out)) expect(burgerProduces).toContain(item)
  })

  it('REMOVE_PREPARED_ITEMS removes items together with their sources', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // always remove index 0
    const s = withPool(base(), 'shared', ['chopped_lettuce', 'grilled_patty', 'toasted_bun'], ['ann', 'bob', 'cat'])
    const out = gameReducer(s, { type: 'REMOVE_PREPARED_ITEMS', count: 2 })
    expect(poolItems(out)).toEqual(['toasted_bun'])
    expect(poolSources(out)).toEqual(['cat'])
  })

  it('REMOVE_PREPARED_ITEMS on an empty pool changes nothing', () => {
    const s = base()
    expect(gameReducer(s, { type: 'REMOVE_PREPARED_ITEMS', count: 3 })).toBe(s)
  })

  it('ADD_PREPARED_ITEMS appends uncredited items', () => {
    const s = withPool(base(), 'shared', ['chopped_lettuce'], ['ann'])
    const out = gameReducer(s, { type: 'ADD_PREPARED_ITEMS', items: ['grilled_patty', 'toasted_bun'] })
    expect(poolItems(out)).toEqual(['chopped_lettuce', 'grilled_patty', 'toasted_bun'])
    expect(poolSources(out)).toEqual(['ann', '', ''])
  })
})

describe('TICK side effects', () => {
  it('Recipe Roulette swaps a recipe when due and reschedules 45s out', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const s = base({ activeBossDebuff: 'recipe_roulette', rouletteNextAt: NOW - 1, enabledRecipes: ['burger'] })
    const out = tick(s)
    expect(out.enabledRecipes).toHaveLength(1)
    expect(out.enabledRecipes[0]).not.toBe('burger')
    expect(out.rouletteNextAt).toBe(NOW + 45_000)
    expect(out.chatMessages.some(m => m.text.startsWith('🎲 Recipe Roulette!'))).toBe(true)
  })

  it('Recipe Roulette lazily schedules its first swap', () => {
    const out = tick(base({ activeBossDebuff: 'recipe_roulette', enabledRecipes: ['burger'] }))
    expect(out.rouletteNextAt).toBe(NOW + 45_000)
    expect(out.enabledRecipes).toEqual(['burger'])
  })

  it('Bloodhound pays $12 per overheat', () => {
    const s = withSlot(base({ activeGarnishes: ['bloodhound'] }), 'grill',
      slot({ user: 'a', target: 'patty', produces: 'grilled_patty', elapsedMs: 0, cookDuration: 9000, heatPerCook: 20 }), 90)
    const out = tick(s, 9000)
    expect(out.stations.grill.overheated).toBe(true)
    expect(out.money).toBe(12)
  })

  it('charges an expired order’s penalty to both PvP teams', () => {
    const s = base({
      teams: { a: 'red', b: 'blue' }, redMoney: 50, blueMoney: 50, lostOrderPenalty: 3,
      orders: [order({ patienceLeft: 50 })],
    })
    const out = tick(s)
    const penalty = Math.floor(RECIPES.burger.reward * 0.2) + 3
    expect(out.redMoney).toBe(50 - penalty)
    expect(out.blueMoney).toBe(50 - penalty)
    expect(out.money).toBe(0) // clamped
  })
})
```

- [ ] **Step 2: Run them**

Run: `npx vitest run src/state/gameReducer.pools.test.ts`
Expected: all pass. If one fails, the test is wrong about current behaviour — fix the test, not the reducer.

- [ ] **Step 3: Commit**

```bash
git add src/state/gameReducer.pools.test.ts
git commit -m "test: characterise pool routing, garnish/event pool effects, and TICK side effects"
```

---

### Task 4: `preparedPools` module (not yet wired in)

**Files:**
- Modify: `src/state/types.ts` (add types only)
- Create: `src/state/preparedPools.ts`, `src/state/preparedPools.test.ts`

- [ ] **Step 1: Add the types**

In `src/state/types.ts`, directly above `export interface GameState`:

```ts
/** One prepared ingredient and the player who cooked it ('' = nobody: events, Mise en Place). */
export interface PreparedItem {
  item: string
  source: string
}

/** 'shared' is the co-op pool; PvP uses 'red' and 'blue'. */
export type PoolId = 'shared' | 'red' | 'blue'
export type PreparedPools = Record<PoolId, PreparedItem[]>
```

- [ ] **Step 2: Write the failing module tests**

```ts
// src/state/preparedPools.test.ts
import { describe, it, expect } from 'vitest'
import { addItems, emptyPools, itemNames, poolIdFor, removeRandom, takeItems } from './preparedPools'
import type { PreparedItem } from './types'

const pool: PreparedItem[] = [
  { item: 'chopped_lettuce', source: 'ann' },
  { item: 'grilled_patty', source: 'bob' },
  { item: 'chopped_lettuce', source: 'cat' },
]

describe('preparedPools', () => {
  it('emptyPools has all three pools empty', () => {
    expect(emptyPools()).toEqual({ shared: [], red: [], blue: [] })
  })

  it('poolIdFor routes co-op to shared, PvP to the team, and teamless PvP to null', () => {
    expect(poolIdFor({ teams: undefined }, 'x')).toBe('shared')
    expect(poolIdFor({ teams: { x: 'red' } }, 'x')).toBe('red')
    expect(poolIdFor({ teams: { x: 'blue' } }, 'x')).toBe('blue')
    expect(poolIdFor({ teams: { x: 'red' } }, 'y')).toBeNull()
  })

  it('addItems appends records with one source and does not mutate', () => {
    const out = addItems(pool, ['toasted_bun', 'toasted_bun'], 'dan')
    expect(out.slice(3)).toEqual([{ item: 'toasted_bun', source: 'dan' }, { item: 'toasted_bun', source: 'dan' }])
    expect(pool).toHaveLength(3)
  })

  it('takeItems removes the first match of each item and returns what it took', () => {
    const res = takeItems(pool, ['chopped_lettuce', 'grilled_patty'])
    expect(res).toEqual({
      ok: true,
      taken: [{ item: 'chopped_lettuce', source: 'ann' }, { item: 'grilled_patty', source: 'bob' }],
      remaining: [{ item: 'chopped_lettuce', source: 'cat' }],
    })
    expect(pool).toHaveLength(3)
  })

  it('takeItems reports the first missing item', () => {
    expect(takeItems(pool, ['grilled_patty', 'toasted_bun'])).toEqual({ ok: false, missing: 'toasted_bun' })
  })

  it('takeItems handles duplicates in the request', () => {
    expect(takeItems(pool, ['chopped_lettuce', 'chopped_lettuce']).ok).toBe(true)
    expect(takeItems(pool, ['grilled_patty', 'grilled_patty'])).toEqual({ ok: false, missing: 'grilled_patty' })
  })

  it('removeRandom removes up to count items using the given rng', () => {
    expect(removeRandom(pool, 2, () => 0)).toEqual([{ item: 'chopped_lettuce', source: 'cat' }])
    expect(removeRandom(pool, 10, () => 0)).toEqual([])
    expect(pool).toHaveLength(3)
  })

  it('itemNames lists the item ids', () => {
    expect(itemNames(pool)).toEqual(['chopped_lettuce', 'grilled_patty', 'chopped_lettuce'])
  })

})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/state/preparedPools.test.ts`
Expected: FAIL — cannot resolve `./preparedPools`.

- [ ] **Step 4: Implement the module**

```ts
// src/state/preparedPools.ts
// Pure operations on prepared-ingredient pools. Every pool change goes through
// here so an ingredient and the player who cooked it always move together.
import type { GameState, PoolId, PreparedItem, PreparedPools } from './types'

/** Source recorded for items no player cooked (kitchen events, Mise en Place). */
export const NO_SOURCE = ''

export function emptyPools(): PreparedPools {
  return { shared: [], red: [], blue: [] }
}

/** The pool a user's cooking feeds and their serving draws from: 'shared' in co-op,
 *  their team's pool in PvP, or null for a PvP player with no team (items are dropped). */
export function poolIdFor(state: Pick<GameState, 'teams'>, user: string): PoolId | null {
  if (!state.teams) return 'shared'
  return state.teams[user] ?? null
}

export function addItems(pool: PreparedItem[], items: string[], source: string): PreparedItem[] {
  return [...pool, ...items.map(item => ({ item, source }))]
}

export type TakeResult =
  | { ok: true; remaining: PreparedItem[]; taken: PreparedItem[] }
  | { ok: false; missing: string }

/** Remove one of each requested item, taking the oldest copy first. All-or-nothing. */
export function takeItems(pool: PreparedItem[], items: string[]): TakeResult {
  const remaining = [...pool]
  const taken: PreparedItem[] = []
  for (const item of items) {
    const idx = remaining.findIndex(p => p.item === item)
    if (idx === -1) return { ok: false, missing: item }
    taken.push(...remaining.splice(idx, 1))
  }
  return { ok: true, remaining, taken }
}

export function removeRandom(pool: PreparedItem[], count: number, random: () => number = Math.random): PreparedItem[] {
  const remaining = [...pool]
  const n = Math.min(count, remaining.length)
  for (let i = 0; i < n; i++) remaining.splice(Math.floor(random() * remaining.length), 1)
  return remaining
}

export function itemNames(pool: PreparedItem[]): string[] {
  return pool.map(p => p.item)
}
```

- [ ] **Step 5: Run the module tests**

Run: `npx vitest run src/state/preparedPools.test.ts`
Expected: PASS.

Run: `npm run build`
Expected: succeeds (the new module is not imported anywhere yet).

- [ ] **Step 6: Commit**

```bash
git add src/state/types.ts src/state/preparedPools.ts src/state/preparedPools.test.ts
git commit -m "feat(state): add PreparedItem records and pure pool operations"
```

---

### Task 5: Migrate `GameState` and all callers to `preparedPools`

One commit: the type change makes `tsc` fail until every caller is updated.

**Files:**
- Modify: `src/state/types.ts`, `src/state/gameReducer.ts`, `src/state/testPools.ts`, `src/components/Kitchen.tsx`, `src/audio/useGameAudio.ts`, `src/hooks/useBotSimulation.ts`, `src/data/tutorialData.ts`, `src/data/adventureGarnishes.ts`

- [ ] **Step 1: Change `GameState`**

In `src/state/types.ts` remove these six fields:

```ts
  preparedItems: string[]
  preparedItemSources: string[]    // parallel to preparedItems: username who cooked each item
```
```ts
  redPreparedItems?: string[]
  bluePreparedItems?: string[]
  redPreparedItemSources?: string[]
  bluePreparedItemSources?: string[]
```

and add, where `preparedItems` was:

```ts
  preparedPools: PreparedPools     // co-op uses 'shared'; PvP uses 'red' / 'blue'
```

- [ ] **Step 2: Add team-aware accessors to `preparedPools.ts`**

Append to `src/state/preparedPools.ts` (after `poolIdFor`):

```ts
export function getUserPool(state: GameState, user: string): PreparedItem[] {
  const id = poolIdFor(state, user)
  return id ? state.preparedPools[id] : []
}

export function setUserPool(state: GameState, user: string, pool: PreparedItem[]): GameState {
  const id = poolIdFor(state, user)
  return id ? { ...state, preparedPools: { ...state.preparedPools, [id]: pool } } : state
}
```

Append to `src/state/preparedPools.test.ts`, inside the `describe` block (and add `getUserPool, setUserPool` to its import, plus `import { createInitialState } from './gameReducer'`):

```ts
  it('getUserPool / setUserPool read and write the user’s pool; teamless PvP is a no-op', () => {
    const coop = createInitialState(1000)
    expect(getUserPool(setUserPool(coop, 'x', pool), 'x')).toBe(pool)

    const pvp = { ...createInitialState(1000), teams: { x: 'red' as const } }
    expect(getUserPool(setUserPool(pvp, 'x', pool), 'x')).toBe(pool)
    expect(setUserPool(pvp, 'nobody', pool)).toBe(pvp)
    expect(getUserPool(pvp, 'nobody')).toEqual([])
  })
```

- [ ] **Step 3: Update the reducer**

In `src/state/gameReducer.ts`:

1. Add the import:
```ts
import { NO_SOURCE, addItems, emptyPools, getUserPool, removeRandom, setUserPool, takeItems } from './preparedPools'
```
2. In `createInitialState`, replace `preparedItems: [],` / `preparedItemSources: [],` with `preparedPools: emptyPools(),` and delete the four `red…/blue…PreparedItem…` lines.
3. Delete `teamPrepItems`, `setTeamPrepItems`, `teamPrepSources`, `setTeamPrepSources`.
4. `RESET` — replace the Mise en Place block and the two spread fields:
```ts
      // Mise en Place: seed 5 random prepped ingredients from the enabled recipes.
      const preparedPools = active.includes('mise_en_place')
        ? { ...base.preparedPools, shared: addItems(base.preparedPools.shared, pickMiseEnPlaceIngredients(action.enabledRecipes, RECIPES, 5), NO_SOURCE) }
        : base.preparedPools

      return {
        ...base,
        preparedPools,
```
5. `SERVE` — replace from `// Check preparedItems has all required ingredients` through the end of the `for` loop with:
```ts
      // Take every plate ingredient from the server's pool (team-aware); each one's
      // cook earns a bonus for an ingredient that ended up in a real served order.
      const take = takeItems(getUserPool(state, user), recipe.plate)
      if (!take.ok) return addMsg(state, 'KITCHEN', `Missing ${take.missing.replace(/_/g, ' ')} for ${recipe.name}!`, 'error')
      const cookerBonuses: Record<string, number> = {}
      for (const { source } of take.taken) {
        if (source) cookerBonuses[source] = (cookerBonuses[source] ?? 0) + 2
      }
```
   and replace
```ts
      let afterPool = setTeamPrepItems(withStats, user, available)
      afterPool = setTeamPrepSources(afterPool, user, sourcesPool)
```
   with
```ts
      let afterPool = setUserPool(withStats, user, take.remaining)
```
6. `COOK` prerequisite block (the one fixed in Task 2) becomes:
```ts
      // Check ingredient prerequisite
      let afterRequire = withCooldown
      if (matchedStep.requires) {
        const take = takeItems(getUserPool(afterRequire, user), [matchedStep.requires])
        if (!take.ok) {
          return addMsg(afterRequire, 'KITCHEN', `Need ${matchedStep.requires.replace(/_/g, ' ')} first!`, 'error')
        }
        afterRequire = setUserPool(afterRequire, user, take.remaining)
      }
```
7. `COOK` instant-completion block becomes:
```ts
      if (effectiveDuration === 0) {
        const withStat = addStat(afterRequire, user, 'cooked', 1)
        const withItem = setUserPool(withStat, user, addItems(getUserPool(withStat, user), [matchedStep.produces], user))
        return addMsg(
          withItem,
          'KITCHEN', `${user} ${PAST_TENSE[cookAction] || cookAction + 'ed'} ${target.replace(/_/g, ' ')}!`, 'success'
        )
      }
```
8. `TICK` — delete the six `new…PreparedItem…` local declarations and add `const pools = { ...state.preparedPools }` in their place. Replace the whole `if (state.teams) { … } else { … }` completion block with:
```ts
            const poolId = poolIdFor(state, slot.user)
            if (poolId) {
              const produced = extraCopy ? [slot.produces, slot.produces] : [slot.produces]
              pools[poolId] = addItems(pools[poolId], produced, slot.user)
            }
            // else: PvP cook with no team — item dropped
```
   (add `poolIdFor` to the `./preparedPools` import). In the returned object, replace the six pool fields with `preparedPools: pools,`.
9. `REMOVE_PREPARED_ITEMS` becomes:
```ts
    case 'REMOVE_PREPARED_ITEMS': {
      const count = Math.min(action.count, state.preparedPools.shared.length)
      if (count === 0) return state
      const shared = removeRandom(state.preparedPools.shared, count)
      const msg = action.message ?? `🐀 Rats stole ${count} prepared ingredient(s)!`
      return addMsg({ ...state, preparedPools: { ...state.preparedPools, shared } }, 'KITCHEN', msg, 'error')
    }
```
10. `ADD_PREPARED_ITEMS` becomes:
```ts
    case 'ADD_PREPARED_ITEMS': {
      const msg = action.message ?? `🧩 Mystery solved! ${action.items.length} ingredients added to the tray!`
      const shared = addItems(state.preparedPools.shared, action.items, NO_SOURCE)
      return addMsg({ ...state, preparedPools: { ...state.preparedPools, shared } }, 'KITCHEN', msg, 'success')
    }
```

- [ ] **Step 4: Update the test helpers to the new shape**

Replace the bodies in `src/state/testPools.ts` (imports and `TestPool` stay):

```ts
export function poolItems(s: GameState, pool: TestPool = 'shared'): string[] {
  return s.preparedPools[pool].map(p => p.item)
}

export function poolSources(s: GameState, pool: TestPool = 'shared'): string[] {
  return s.preparedPools[pool].map(p => p.source)
}

/** Replace one pool. `sources` defaults to '' (no cook) for every item. */
export function withPool(s: GameState, pool: TestPool, items: string[], sources: string[] = items.map(() => '')): GameState {
  return { ...s, preparedPools: { ...s.preparedPools, [pool]: items.map((item, i) => ({ item, source: sources[i] })) } }
}
```

- [ ] **Step 5: Update UI/hook consumers**

`src/components/Kitchen.tsx` — add `import { itemNames } from '../state/preparedPools'` and change the three props:
```tsx
        items={itemNames(state.preparedPools.shared)}
```
```tsx
        redItems={state.teams ? itemNames(state.preparedPools.red) : undefined}
        blueItems={state.teams ? itemNames(state.preparedPools.blue) : undefined}
```

`src/audio/useGameAudio.ts` — replace all four `state.preparedItems.length` with `state.preparedPools.shared.length`.

`src/hooks/useBotSimulation.ts` — add `import { itemNames } from '../state/preparedPools'`; in `pickBotAction`, right after `if (state.activeUsers[name]) return null`, add `const prepared = itemNames(state.preparedPools.shared)`; then replace the three `state.preparedItems` references with `prepared` (the `available` copy, and the two `.includes` checks), and change the comment `// Serve — check if preparedItems has…` to `// Serve — check if the prepared pool has…`.

`src/data/tutorialData.ts` — replace
`state.preparedItems.includes('chopped_potato')` with `state.preparedPools.shared.some(p => p.item === 'chopped_potato')`, and the same for `'fried_potato'`.

`src/data/adventureGarnishes.ts` — comment `Used to seed \`state.preparedItems\`` → `Used to seed the shared prepared pool`.

- [ ] **Step 6: Verify nothing old remains**

Run: `grep -rnE 'preparedItems\b|preparedItemSources|redPreparedItem|bluePreparedItem|teamPrep' src`
Expected: no output. (The `PreparedItems` component and the `chatsKitchen_preparedItemsShowNames` key don't match this case-sensitive pattern.)

- [ ] **Step 7: Run everything**

Run: `npm run lint && npx vitest run && npm run build`
Expected: lint clean; all tests pass including `preparedPools.test.ts`; build succeeds.

- [ ] **Step 8: Commit**

```bash
git add -A src
git commit -m "refactor(state): store prepared ingredients as {item, source} records in team-keyed pools

Replaces preparedItems/preparedItemSources and the four red/blue variants
with GameState.preparedPools, so an ingredient can no longer drift away
from the player who cooked it."
```

---

### Task 6: Move shared reducer helpers to `stateHelpers.ts`

Pure move, so `tick.ts` (Task 7) can use them without a circular import.

**Files:**
- Create: `src/state/stateHelpers.ts`
- Modify: `src/state/gameReducer.ts`

- [ ] **Step 1: Create the module**

```ts
// src/state/stateHelpers.ts
import type { ChatMessage, GameState, PlayerStats } from './types'

export const EMPTY_STATS: PlayerStats = { cooked: 0, served: 0, moneyEarned: 0, extinguished: 0, firesCaused: 0, cooled: 0, eventParticipations: 0, bonusPoints: 0 }

export function addMsg(state: GameState, username: string, text: string, msgType: ChatMessage['type'] = 'normal'): GameState {
  const msg: ChatMessage = { id: state.nextMessageId, username, text, type: msgType }
  const messages = [...state.chatMessages, msg].slice(-200)
  return { ...state, chatMessages: messages, nextMessageId: state.nextMessageId + 1 }
}

export function bumpStat(stats: Record<string, PlayerStats>, user: string, stat: keyof PlayerStats, amount: number): Record<string, PlayerStats> {
  const prev = stats[user] || { ...EMPTY_STATS }
  return { ...stats, [user]: { ...prev, [stat]: prev[stat] + amount } }
}

export function addStat(state: GameState, user: string, stat: keyof PlayerStats, amount: number): GameState {
  return { ...state, playerStats: bumpStat(state.playerStats, user, stat, amount) }
}
```

- [ ] **Step 2: Remove them from the reducer**

Delete `addMsg`, `EMPTY_STATS`, and `addStat` from `gameReducer.ts` and add `import { addMsg, addStat } from './stateHelpers'`. Remove `PlayerStats` from the `./types` import if now unused (`tsc` will say).

- [ ] **Step 3: Verify and commit**

Run: `npm run lint && npx vitest run && npm run build`
Expected: all green.

```bash
git add src/state/stateHelpers.ts src/state/gameReducer.ts
git commit -m "refactor(state): move addMsg/addStat into stateHelpers"
```

---

### Task 7: Split `TICK` into named steps in `tick.ts`

**Files:**
- Create: `src/state/tick.ts`
- Modify: `src/state/gameReducer.ts`

- [ ] **Step 1: Create `tick.ts`**

```ts
// src/state/tick.ts
// The 100ms game tick, as a sequence of named steps. Steps share a working
// draft (fresh copies made per tick), so the reducer stays pure from outside.
import type { ChatMessage, GameState, Order, PlayerStats, PreparedPools, Station, StationSlot } from './types'
import { RECIPES, STATION_DEFS, HEAT_EXEMPT_STATIONS, getEnabledStations } from '../data/recipes'
import { addItems, poolIdFor } from './preparedPools'
import { bumpStat } from './stateHelpers'

// Letting an order expire forfeits this fraction of its reward from the bank — a small
// opportunity cost so ignoring pricey orders to cherry-pick cheap ones actually costs money.
export const LOST_ORDER_PENALTY_FRACTION = 0.2

const ROULETTE_INTERVAL_MS = 45_000
const BLOODHOUND_REWARD = 12
const DOPPELGANGER_CHANCE = 0.2
const RESOLVED_ORDER_LINGER_MS = 1500

interface ChatLog {
  push(username: string, text: string, type: ChatMessage['type']): void
  result(): Pick<GameState, 'chatMessages' | 'nextMessageId'>
}

function createChatLog(state: GameState): ChatLog {
  const messages = [...state.chatMessages]
  let nextId = state.nextMessageId
  return {
    push(username, text, type) { messages.push({ id: nextId++, username, text, type }) },
    result: () => ({ chatMessages: messages.slice(-200), nextMessageId: nextId }),
  }
}

interface TickDraft {
  stations: Record<string, Station>
  activeUsers: Record<string, string>
  pools: PreparedPools
  playerStats: Record<string, PlayerStats>
  log: ChatLog
}

export function tickReducer(state: GameState, delta: number, now: number): GameState {
  const draft: TickDraft = {
    stations: { ...state.stations },
    activeUsers: { ...state.activeUsers },
    pools: { ...state.preparedPools },
    playerStats: { ...state.playerStats },
    log: createChatLog(state),
  }

  const roulette = rotateRecipeRoulette(state, draft, now)
  const bloodhoundMoney = advanceStations(state, draft, delta, now)
  const expiry = advanceOrders(state, draft, delta, now)

  return {
    ...state,
    stations: draft.stations,
    activeUsers: draft.activeUsers,
    preparedPools: draft.pools,
    playerStats: draft.playerStats,
    ...draft.log.result(),
    orders: expiry.orders,
    lost: expiry.lost,
    timeLeft: Math.max(0, state.timeLeft - delta),
    ...expireModifiers(state, now),
    money: Math.max(0, state.money + bloodhoundMoney - expiry.penalty),
    // Lost orders aren't team-tagged, so PvP charges BOTH teams equally.
    redMoney: state.teams && state.redMoney !== undefined ? Math.max(0, state.redMoney - expiry.penalty) : state.redMoney,
    blueMoney: state.teams && state.blueMoney !== undefined ? Math.max(0, state.blueMoney - expiry.penalty) : state.blueMoney,
    enabledRecipes: roulette.enabledRecipes,
    rouletteNextAt: roulette.rouletteNextAt,
  }
}

/** Recipe Roulette boss: every 45s, swap one active recipe for a random inactive one. */
function rotateRecipeRoulette(state: GameState, draft: TickDraft, now: number): Pick<GameState, 'enabledRecipes' | 'rouletteNextAt'> {
  let rouletteNextAt = state.rouletteNextAt
  // Lazy-init on the first TICK that sees the effect (keeps Date.now() out of RESET).
  if (state.activeBossDebuff === 'recipe_roulette' && !rouletteNextAt) rouletteNextAt = now + ROULETTE_INTERVAL_MS
  if (!rouletteNextAt || now < rouletteNextAt) return { enabledRecipes: state.enabledRecipes, rouletteNextAt }

  let enabledRecipes = state.enabledRecipes
  const candidates = Object.keys(RECIPES).filter(r => !state.enabledRecipes.includes(r))
  if (candidates.length > 0 && state.enabledRecipes.length > 0) {
    const removedIdx = Math.floor(Math.random() * state.enabledRecipes.length)
    const removed = state.enabledRecipes[removedIdx]
    const added = candidates[Math.floor(Math.random() * candidates.length)]
    enabledRecipes = state.enabledRecipes.map((r, i) => i === removedIdx ? added : r)
    draft.log.push('KITCHEN', `🎲 Recipe Roulette! ${RECIPES[removed]?.name ?? removed} → ${RECIPES[added]?.name ?? added}`, 'system')
    // The swapped-out dish may leave a station no active recipe needs anymore.
    // Clear its in-flight slots (they'd otherwise cook invisibly into unusable
    // items) and free the chefs working there.
    const stillNeeded = new Set(getEnabledStations(enabledRecipes))
    for (const [sid, st] of Object.entries(draft.stations)) {
      if (st.slots.length > 0 && !stillNeeded.has(sid)) {
        for (const sl of st.slots) delete draft.activeUsers[sl.user]
        draft.stations[sid] = { ...st, slots: [] }
      }
    }
  }
  return { enabledRecipes, rouletteNextAt: now + ROULETTE_INTERVAL_MS }
}

/** Advance every cooking slot: accrue heat, overheat stations, bank finished items.
 *  Returns money earned from overheats (Bloodhound garnish). */
function advanceStations(state: GameState, draft: TickDraft, delta: number, now: number): number {
  const overheatLimit = state.overheatThreshold ?? 100  // raised by Insulation, lowered by Glass Kitchen
  let bloodhoundMoney = 0

  for (const [id, station] of Object.entries(draft.stations)) {
    if (station.overheated || station.slots.length === 0) continue

    const remainingSlots: StationSlot[] = []
    let heat = station.heat

    for (const slot of station.slots) {
      const elapsedMs = slot.elapsedMs + delta

      // Heat accrues in proportion to progress; heat-exempt stations never heat up.
      let heatApplied = slot.heatApplied
      if (!HEAT_EXEMPT_STATIONS.has(id) && slot.state === 'cooking') {
        const expectedHeat = Math.min(1, elapsedMs / slot.cookDuration) * slot.heatPerCook
        if (expectedHeat > slot.heatApplied) {
          heat += expectedHeat - slot.heatApplied
          heatApplied = expectedHeat
        }
      }

      if (heat >= overheatLimit) {
        overheatStation(draft, id, station.slots, overheatLimit)
        if ((state.activeGarnishes ?? []).includes('bloodhound')) {
          bloodhoundMoney += BLOODHOUND_REWARD
          draft.log.push('KITCHEN', `🩸 Bloodhound earned $${BLOODHOUND_REWARD} from the overheat!`, 'success')
        }
        break // station is locked; remaining slots are destroyed
      }

      if (slot.state === 'cooking' && elapsedMs >= slot.cookDuration) {
        completeSlot(state, draft, id, slot, now) // finished slots are auto-collected (not kept)
      } else {
        remainingSlots.push({ ...slot, elapsedMs, heatApplied })
      }
    }

    if (!draft.stations[id].overheated) {
      draft.stations[id] = { ...draft.stations[id], heat, slots: remainingSlots }
    }
  }
  return bloodhoundMoney
}

function overheatStation(draft: TickDraft, stationId: string, slots: StationSlot[], overheatLimit: number): void {
  // Penalise every player cooking here, not just the one whose slot tipped it
  // over — overheating is a shared, team-level failure.
  for (const s of slots) draft.playerStats = bumpStat(draft.playerStats, s.user, 'firesCaused', 1)
  for (const s of draft.stations[stationId].slots) delete draft.activeUsers[s.user]
  draft.stations[stationId] = { ...draft.stations[stationId], slots: [], heat: overheatLimit, overheated: true, extinguishVotes: [] }
  draft.log.push('KITCHEN', `🔥 ${STATION_DEFS[stationId].name} OVERHEATED! Type extinguish ${stationId} to restore it!`, 'system')
}

function completeSlot(state: GameState, draft: TickDraft, stationId: string, slot: StationSlot, now: number): void {
  // Doppelgänger garnish: chance to produce a second copy of the ingredient.
  const extraCopy = (state.activeGarnishes ?? []).includes('doppelganger') && Math.random() < DOPPELGANGER_CHANCE
  const poolId = poolIdFor(state, slot.user)
  if (poolId) {
    const produced = extraCopy ? [slot.produces, slot.produces] : [slot.produces]
    draft.pools[poolId] = addItems(draft.pools[poolId], produced, slot.user)
  }
  // else: PvP cook with no team — item dropped
  if (extraCopy) draft.log.push('KITCHEN', `✨ Doppelgänger! Bonus ${slot.produces.replace(/_/g, ' ')}!`, 'success')
  delete draft.activeUsers[slot.user]
  draft.log.push('KITCHEN', `${slot.user} finished ${slot.target.replace(/_/g, ' ')}!`, 'success')
  draft.stations[stationId] = { ...draft.stations[stationId], lastCompletion: { ingredient: slot.produces, at: now, by: slot.user } }
}

/** Drain order patience, expire orders that run out, and drop resolved orders
 *  once their exit animation has had time to play. */
function advanceOrders(state: GameState, draft: TickDraft, delta: number, now: number): { orders: Order[]; lost: number; penalty: number } {
  let lost = state.lost
  let penalty = 0
  const orders = state.orders.map(order => {
    if (order.served) return order
    const patienceLeft = order.patienceLeft - delta
    if (patienceLeft > 0) return { ...order, patienceLeft }

    lost++
    const recipe = RECIPES[order.dish]
    draft.log.push('CUSTOMER', `Order #${order.id} expired! Lost a ${recipe.emoji}!`, 'error')
    // Base opportunity cost — a fraction of the ignored dish's value.
    penalty += Math.floor(recipe.reward * LOST_ORDER_PENALTY_FRACTION)
    // Bad Reviews boss — flat $ per expired order, stacked on top.
    if (state.lostOrderPenalty !== undefined) {
      penalty += state.lostOrderPenalty
      draft.log.push('KITCHEN', `⭐ Bad Reviews · −$${state.lostOrderPenalty}`, 'error')
    }
    return { ...order, served: true, patienceLeft: 0, outcome: 'lost' as const, completedAt: now }
  })
  return {
    orders: orders.filter(o => !o.served || (o.completedAt !== undefined && now - o.completedAt < RESOLVED_ORDER_LINGER_MS)),
    lost,
    penalty,
  }
}

function expireModifiers(state: GameState, now: number): Pick<GameState, 'cookingSpeedModifier' | 'moneyMultiplier'> {
  return {
    cookingSpeedModifier: state.cookingSpeedModifier && now < state.cookingSpeedModifier.expiresAt ? state.cookingSpeedModifier : undefined,
    moneyMultiplier: state.moneyMultiplier && now < state.moneyMultiplier.expiresAt ? state.moneyMultiplier : undefined,
  }
}
```

Behaviour notes for the reviewer — each matches the old inline code:
- Message order per tick is unchanged: roulette → per-station (overheat, Bloodhound / Doppelgänger, finished) → expired orders (+ Bad Reviews).
- `Math.random` call order is unchanged (roulette ×2, then one Doppelgänger roll per completing slot, short-circuited when the garnish isn't active), so seeded/mocked tests behave identically.
- The overheat stamp spreads `draft.stations[id]`, so a `lastCompletion` set earlier in the same tick survives, as before.

- [ ] **Step 2: Delegate from the reducer**

In `gameReducer.ts`:
- Replace the entire `case 'TICK': { … }` block with
```ts
    case 'TICK':
      return tickReducer(state, action.delta, action.now)
```
- Replace the `LOST_ORDER_PENALTY_FRACTION` declaration (and its comment) with
```ts
export { LOST_ORDER_PENALTY_FRACTION } from './tick'
```
- Add `import { tickReducer } from './tick'`.
- Remove imports that are now unused (`getEnabledStations`, `poolIdFor`, and any `./types` names) — `npm run build` lists them.

- [ ] **Step 3: Verify**

Run: `npm run lint && npx vitest run && npm run build`
Expected: all green, same test count as after Task 5.

Run: `grep -c "" src/state/gameReducer.ts`
Expected: roughly 520–560 lines (down from 786).

- [ ] **Step 4: Commit**

```bash
git add src/state/tick.ts src/state/gameReducer.ts
git commit -m "refactor(state): split TICK into named steps in tick.ts"
```

---

### Task 8: Documentation

**Files:**
- Modify: `CLAUDE.md`, `docs/Kitchen Events.md`

- [ ] **Step 1: CLAUDE.md**

1. Repository Structure, under `state/`: add
```
│   │   ├── tick.ts         # TICK as named steps (roulette, stations, orders, modifiers)
│   │   ├── preparedPools.ts # Pure prepared-ingredient pool ops ({item, source} records)
```
2. Game Loop bullet: `auto-collects output into \`preparedItems\` (and \`preparedItemSources\`) for all stations` → `auto-collects output into the cook's prepared pool (\`preparedPools\`) for all stations`.
3. State Shape: replace the `preparedItems` / `preparedItemSources` lines with
```ts
  preparedPools: { shared: PreparedItem[]; red: PreparedItem[]; blue: PreparedItem[] }
                                             // PreparedItem = { item: 'grilled_patty', source: 'bob' }; co-op uses shared
```
   and delete the four `red…/blue…PreparedItem…` lines from the PvP block.
4. Recipe steps paragraph: `require the prior ingredient in \`preparedItems\`` → `require the prior ingredient in the prepared pool`.
5. Replace the **Provenance tracking** paragraph with:
> **Provenance tracking** — each prepared ingredient is a `PreparedItem { item, source }` record, where `source` is the username who cooked it (`''` for items added by kitchen events or Mise en Place — no cooker, no bonus). Co-op uses `preparedPools.shared`; PvP uses `preparedPools.red` / `.blue`. All pool changes go through `src/state/preparedPools.ts` (`addItems`, `takeItems`, `removeRandom`, `getUserPool` / `setUserPool`), so an item and its cook always move together. `SERVE` takes the oldest matching copy of each plate ingredient and awards each taken item's `source` the cook bonus.
6. Replace pitfall #14 with:
> 14. **Change prepared pools only through `preparedPools.ts`** — don't hand-roll array splices on `state.preparedPools`. Use `takeItems` (all-or-nothing, oldest copy first) to consume, `addItems(pool, items, source)` to add (`NO_SOURCE` for uncredited items), and `getUserPool` / `setUserPool` for team-aware routing (a PvP player with no team gets an empty pool and their items are dropped). The old parallel `preparedItems` / `preparedItemSources` arrays were removed because a missed splice silently misattributed cook bonuses.
7. Key Files table: add rows
```
| `src/state/preparedPools.ts` | Prepared-ingredient pool operations and user→pool routing |
| `src/state/tick.ts` | `tickReducer` — the 100ms TICK as named steps; `LOST_ORDER_PENALTY_FRACTION` |
```

- [ ] **Step 2: Kitchen Events doc**

In `docs/Kitchen Events.md`: `Removes 3 random \`preparedItems\` from inventory` → `Removes 3 random items from the shared prepared pool`, and `Adds 3 random produced ingredients to \`preparedItems\`` → `Adds 3 random produced ingredients to the shared prepared pool`.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md "docs/Kitchen Events.md"
git commit -m "docs: describe preparedPools and tick.ts; replace parallel-array pitfall"
```

---

### Task 9: Final verification

- [ ] **Step 1:** `npm run lint && npx vitest run && npm run build` — all green.
- [ ] **Step 2:** `cd server && npm test` — relay unaffected, still green.
- [ ] **Step 3: Smoke test in the browser.** `npm run dev`, open the app, start the Tutorial and confirm: `chop potato` puts chopped potato in the tray, `fry potato` consumes it and produces fried potato, and the tutorial advances. Then start a short Free Play round with bots enabled and confirm ingredients appear in the tray and orders get served.
