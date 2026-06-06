import { describe, it, expect } from 'vitest'
import { gameReducer, createInitialState } from './gameReducer'
import { RECIPES } from '../data/recipes'
import { GameState, StationSlot, Order } from './types'

// ── builders ──────────────────────────────────────────────────────────────────

const NOW = 1_000_000

function base(overrides: Partial<GameState> = {}): GameState {
  return { ...createInitialState(120_000), ...overrides }
}

function slot(over: Partial<StationSlot> = {}): StationSlot {
  return {
    id: 'slot_1', user: 'alice', target: 'lettuce', produces: 'chopped_lettuce',
    elapsedMs: 0, cookDuration: 7000, heatApplied: 0, heatPerCook: 15, state: 'cooking',
    ...over,
  }
}

function order(over: Partial<Order> = {}): Order {
  return { id: 1, dish: 'burger', served: false, patienceMax: 80_000, patienceLeft: 80_000, spawnTime: NOW, ...over }
}

// Put a cooking slot on a station (and mark its user busy) so completion/heat paths can run.
function withSlot(state: GameState, stationId: string, s: StationSlot, heat = 0): GameState {
  return {
    ...state,
    stations: { ...state.stations, [stationId]: { ...state.stations[stationId], slots: [s], heat } },
    activeUsers: { ...state.activeUsers, [s.user]: stationId },
  }
}

// ── COOK ────────────────────────────────────────────────────────────────────

describe('COOK', () => {
  it('starts a slot at the matching station and marks the user busy', () => {
    const s = gameReducer(base(), { type: 'COOK', user: 'alice', action: 'chop', target: 'lettuce', now: NOW })
    expect(s.stations.cutting_board.slots).toHaveLength(1)
    expect(s.stations.cutting_board.slots[0]).toMatchObject({ user: 'alice', produces: 'chopped_lettuce' })
    expect(s.activeUsers.alice).toBe('cutting_board')
    expect(s.playerStats.alice.cooked).toBe(1)
  })

  it('logs "chopping" (not "choping") when a chop action starts', () => {
    const s = gameReducer(base(), { type: 'COOK', user: 'alice', action: 'chop', target: 'lettuce', now: NOW })
    expect(s.chatMessages.some(m => m.text === 'alice started chopping lettuce!')).toBe(true)
  })

  it('keeps the plain +ing form for regular verbs (grill → grilling)', () => {
    const s = gameReducer(base(), { type: 'COOK', user: 'alice', action: 'grill', target: 'patty', now: NOW })
    expect(s.chatMessages.some(m => m.text === 'alice started grilling patty!')).toBe(true)
  })

  it('allows unlimited concurrent slots at one station (no capacity limit — pitfall #2)', () => {
    let s = gameReducer(base(), { type: 'COOK', user: 'alice', action: 'chop', target: 'lettuce', now: NOW })
    s = gameReducer(s, { type: 'COOK', user: 'bob', action: 'chop', target: 'tomato', now: NOW })
    expect(s.stations.cutting_board.slots).toHaveLength(2)
  })

  it('throttles a user to one action per 1500ms (pitfall #3)', () => {
    let s = gameReducer(base(), { type: 'COOK', user: 'alice', action: 'chop', target: 'lettuce', now: NOW })
    // Same timestamp → still on cooldown → second command is a no-op.
    s = gameReducer(s, { type: 'COOK', user: 'alice', action: 'grill', target: 'patty', now: NOW })
    expect(s.stations.grill.slots).toHaveLength(0)
    expect(s.playerStats.alice.cooked).toBe(1)
  })

  it('rejects a second concurrent action by the same user once off cooldown (busy — pitfall #4)', () => {
    let s = gameReducer(base(), { type: 'COOK', user: 'alice', action: 'chop', target: 'lettuce', now: NOW })
    s = gameReducer(s, { type: 'COOK', user: 'alice', action: 'grill', target: 'patty', now: NOW + 5000 })
    expect(s.stations.grill.slots).toHaveLength(0)
  })

  it('requires a prerequisite ingredient before chaining', () => {
    // fries: fry potato requires chopped_potato
    const missing = gameReducer(base(), { type: 'COOK', user: 'alice', action: 'fry', target: 'potato', now: NOW })
    expect(missing.stations.fryer.slots).toHaveLength(0)

    const ready = base({ preparedItems: ['chopped_potato'], preparedItemSources: ['bob'] })
    const ok = gameReducer(ready, { type: 'COOK', user: 'alice', action: 'fry', target: 'potato', now: NOW })
    expect(ok.stations.fryer.slots).toHaveLength(1)
    expect(ok.preparedItems).not.toContain('chopped_potato') // prereq consumed
  })

  it('refuses to cook on an overheated station', () => {
    const s = base({
      stations: { ...base().stations, grill: { id: 'grill', slots: [], heat: 100, overheated: true, extinguishVotes: [] } },
    })
    const out = gameReducer(s, { type: 'COOK', user: 'alice', action: 'grill', target: 'patty', now: NOW })
    expect(out.stations.grill.slots).toHaveLength(0)
  })

  it('completes instantly at 0 duration and records provenance (pitfall #14)', () => {
    const s = base({ choppingCookTimeMultiplier: 0 }) // Sharp Knives
    const out = gameReducer(s, { type: 'COOK', user: 'alice', action: 'chop', target: 'lettuce', now: NOW })
    expect(out.stations.cutting_board.slots).toHaveLength(0)
    expect(out.preparedItems).toEqual(['chopped_lettuce'])
    expect(out.preparedItemSources).toEqual(['alice'])
  })
})

// ── SERVE ─────────────────────────────────────────────────────────────────────

describe('SERVE', () => {
  const plate = RECIPES.burger.plate // ['chopped_lettuce','grilled_patty','toasted_bun']

  it('consumes the plate, pays out, and credits the cook (pitfall #14)', () => {
    const s = base({
      orders: [order({ patienceLeft: 80_000, patienceMax: 80_000 })],
      preparedItems: [...plate],
      preparedItemSources: ['alice', 'alice', 'alice'],
    })
    const out = gameReducer(s, { type: 'SERVE', user: 'bob', orderId: 1 })
    // burger reward 14 + round(14*0.4*1)=6 = 20
    expect(out.money).toBe(20)
    expect(out.served).toBe(1)
    expect(out.preparedItems).toHaveLength(0)
    expect(out.preparedItemSources).toHaveLength(0) // stays in sync
    expect(out.playerStats.bob.served).toBe(1)
    expect(out.playerStats.alice.bonusPoints).toBe(6) // +2 per consumed ingredient
  })

  it('rejects when an ingredient is missing', () => {
    const s = base({
      orders: [order()],
      preparedItems: ['chopped_lettuce', 'grilled_patty'], // no bun
      preparedItemSources: ['alice', 'alice'],
    })
    const out = gameReducer(s, { type: 'SERVE', user: 'bob', orderId: 1 })
    expect(out.money).toBe(0)
    expect(out.served).toBe(0)
  })

  it('rejects when the serving user is busy cooking', () => {
    let s = base({
      orders: [order()],
      preparedItems: [...plate],
      preparedItemSources: ['alice', 'alice', 'alice'],
    })
    s = withSlot(s, 'grill', slot({ user: 'bob', target: 'patty', produces: 'grilled_patty' }))
    const out = gameReducer(s, { type: 'SERVE', user: 'bob', orderId: 1 })
    expect(out.served).toBe(0)
  })

  it('uses the team pool and tracks team money in PvP', () => {
    const s = base({
      teams: { alice: 'red' },
      redPreparedItems: [...plate],
      redPreparedItemSources: ['alice', 'alice', 'alice'],
      redMoney: 0, redServed: 0,
      orders: [order()],
    })
    const out = gameReducer(s, { type: 'SERVE', user: 'alice', orderId: 1 })
    expect(out.redServed).toBe(1)
    expect(out.redMoney).toBeGreaterThan(0)
    expect(out.redPreparedItems).toHaveLength(0)
  })

  it('rejects a user with no team in PvP', () => {
    const s = base({ teams: { alice: 'red' }, redPreparedItems: [...plate], redServed: 0, orders: [order()] })
    const out = gameReducer(s, { type: 'SERVE', user: 'carol', orderId: 1 })
    expect(out.redServed).toBe(0)            // no payout
    expect(out.redPreparedItems).toHaveLength(plate.length) // pool untouched
  })
})

// ── TICK ────────────────────────────────────────────────────────────────────

describe('TICK', () => {
  it('completes a finished slot, banks the ingredient with provenance, and frees the cook', () => {
    const s = withSlot(base(), 'cutting_board', slot({ elapsedMs: 6950, cookDuration: 7000 }))
    const out = gameReducer(s, { type: 'TICK', delta: 100, now: NOW })
    expect(out.stations.cutting_board.slots).toHaveLength(0)
    expect(out.preparedItems).toEqual(['chopped_lettuce'])
    expect(out.preparedItemSources).toEqual(['alice'])
    expect(out.activeUsers.alice).toBeUndefined()
  })

  it('accrues heat on hot stations but never on heat-exempt ones (pitfall #8)', () => {
    let s = withSlot(base(), 'grill', slot({ user: 'a', target: 'patty', produces: 'grilled_patty', cookDuration: 9000 }))
    s = { ...s, stations: { ...s.stations, cutting_board: { ...s.stations.cutting_board, slots: [slot({ user: 'b' })] } } }
    const out = gameReducer(s, { type: 'TICK', delta: 4500, now: NOW })
    expect(out.stations.grill.heat).toBeGreaterThan(0)
    expect(out.stations.cutting_board.heat).toBe(0)
  })

  it('overheats at the threshold: destroys slots, locks the station, blames the cook', () => {
    const s = withSlot(base(), 'grill',
      slot({ user: 'a', target: 'patty', produces: 'grilled_patty', cookDuration: 9000, heatPerCook: 20 }), 90)
    const out = gameReducer(s, { type: 'TICK', delta: 9000, now: NOW })
    expect(out.stations.grill.overheated).toBe(true)
    expect(out.stations.grill.slots).toHaveLength(0)
    expect(out.stations.grill.heat).toBe(100)
    expect(out.playerStats.a.firesCaused).toBe(1)
  })

  it('expires an order whose patience runs out', () => {
    const s = base({ orders: [order({ patienceLeft: 50 })] })
    const out = gameReducer(s, { type: 'TICK', delta: 100, now: NOW })
    expect(out.lost).toBe(1)
    expect(out.orders[0].outcome).toBe('lost')
  })

  it('caps chat history at 200 messages (pitfall #5)', () => {
    const messages = Array.from({ length: 200 }, (_, i) => ({ id: i + 1, username: 'u', text: `m${i}`, type: 'normal' as const }))
    const s = base({ orders: [order({ patienceLeft: 50 })], chatMessages: messages, nextMessageId: 201 })
    const out = gameReducer(s, { type: 'TICK', delta: 100, now: NOW })
    expect(out.chatMessages).toHaveLength(200)
  })

  it('counts the timer down and floors at zero', () => {
    const out = gameReducer(base({ timeLeft: 50 }), { type: 'TICK', delta: 100, now: NOW })
    expect(out.timeLeft).toBe(0)
  })

  it('expires timed modifiers once their window passes', () => {
    const s = base({ cookingSpeedModifier: { multiplier: 2, expiresAt: NOW - 1 } })
    const out = gameReducer(s, { type: 'TICK', delta: 100, now: NOW })
    expect(out.cookingSpeedModifier).toBeUndefined()
  })
})

// ── EXTINGUISH ──────────────────────────────────────────────────────────────

function overheated(): GameState {
  const s = base({ participantCount: 4 })
  return { ...s, stations: { ...s.stations, grill: { id: 'grill', slots: [], heat: 100, overheated: true, extinguishVotes: [] } } }
}

describe('EXTINGUISH', () => {
  it('restores the station once enough votes arrive (coop ceil(players*0.5))', () => {
    let s = overheated() // participantCount 4 → needs 2
    s = gameReducer(s, { type: 'EXTINGUISH', user: 'a', stationId: 'grill' })
    expect(s.stations.grill.overheated).toBe(true) // 1/2
    s = gameReducer(s, { type: 'EXTINGUISH', user: 'b', stationId: 'grill' })
    expect(s.stations.grill.overheated).toBe(false) // 2/2 → restored
    expect(s.stations.grill.heat).toBe(0)
  })

  it('ignores a duplicate vote from the same user', () => {
    let s = overheated()
    s = gameReducer(s, { type: 'EXTINGUISH', user: 'a', stationId: 'grill' })
    s = gameReducer(s, { type: 'EXTINGUISH', user: 'a', stationId: 'grill' })
    expect(s.stations.grill.extinguishVotes).toEqual(['a'])
  })

  it('errors when the station is not overheated', () => {
    const out = gameReducer(base(), { type: 'EXTINGUISH', user: 'a', stationId: 'grill' })
    expect(out.stations.grill.extinguishVotes).toHaveLength(0)
  })

  it('uses the larger team size in PvP (ceil(max(red,blue)*0.5))', () => {
    const oh = overheated()
    const s = { ...oh, teams: { a: 'red' as const, b: 'red' as const, c: 'red' as const, d: 'blue' as const } }
    // max team size 3 → needs ceil(1.5)=2
    let n = gameReducer(s, { type: 'EXTINGUISH', user: 'a', stationId: 'grill' })
    expect(n.stations.grill.overheated).toBe(true)
    n = gameReducer(n, { type: 'EXTINGUISH', user: 'b', stationId: 'grill' })
    expect(n.stations.grill.overheated).toBe(false)
  })
})

// ── COOL ────────────────────────────────────────────────────────────────────

describe('COOL', () => {
  it('reduces heat by 40–60 and credits the cooler (plus a bonus at hot stations)', () => {
    const s = base({ stations: { ...base().stations, grill: { id: 'grill', slots: [], heat: 80, overheated: false, extinguishVotes: [] } } })
    const out = gameReducer(s, { type: 'COOL', user: 'a', stationId: 'grill' })
    expect(out.stations.grill.heat).toBeGreaterThanOrEqual(20) // 80 - 60
    expect(out.stations.grill.heat).toBeLessThanOrEqual(40)    // 80 - 40
    expect(out.playerStats.a.cooled).toBe(1)
    expect(out.playerStats.a.bonusPoints).toBe(1) // heat was ≥ 60
  })

  it('errors on a heat-exempt station (pitfall #8)', () => {
    const s = base({ stations: { ...base().stations, cutting_board: { id: 'cutting_board', slots: [], heat: 50, overheated: false, extinguishVotes: [] } } })
    const out = gameReducer(s, { type: 'COOL', user: 'a', stationId: 'cutting_board' })
    expect(out.stations.cutting_board.heat).toBe(50) // unchanged
  })

  it('errors when the station is already cool', () => {
    const out = gameReducer(base(), { type: 'COOL', user: 'a', stationId: 'grill' })
    expect(out.playerStats.a).toBeUndefined()
  })

  it('refuses while the user is busy cooking', () => {
    const s = withSlot(
      base({ stations: { ...base().stations, grill: { id: 'grill', slots: [], heat: 80, overheated: false, extinguishVotes: [] } } }),
      'fryer', slot({ user: 'a', target: 'fish', produces: 'fried_fish' }),
    )
    const out = gameReducer(s, { type: 'COOL', user: 'a', stationId: 'grill' })
    expect(out.stations.grill.heat).toBe(80) // unchanged — user was busy
  })
})
