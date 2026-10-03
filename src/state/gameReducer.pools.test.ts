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
