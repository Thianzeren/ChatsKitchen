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
