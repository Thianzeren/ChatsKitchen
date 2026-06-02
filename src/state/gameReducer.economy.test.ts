import { describe, it, expect } from 'vitest'
import { gameReducer, createInitialState, SERVE_TIME_BONUS_FRACTION, LOST_ORDER_PENALTY_FRACTION } from './gameReducer'
import { RECIPES } from '../data/recipes'
import { GameState, Order } from './types'

// iced_lemon_tea is the simplest dish (1 step, single plate item) — ideal for
// isolating the serve/expiry economy without juggling multiple ingredients.
const DISH = 'iced_lemon_tea'
const REWARD = RECIPES[DISH].reward  // 5

function stateWithOrder(patienceFraction: number, money = 0): GameState {
  const base = createInitialState(180_000, 1, 1, 1, [DISH], {}, 1)
  const patienceMax = 45_000
  const order: Order = {
    id: 1, dish: DISH, served: false,
    patienceMax, patienceLeft: Math.round(patienceMax * patienceFraction),
    spawnTime: 0,
  }
  return {
    ...base,
    money,
    orders: [order],
    preparedItems: [...RECIPES[DISH].plate],
    preparedItemSources: RECIPES[DISH].plate.map(() => 'cook1'),
  }
}

describe('serve-time bonus is proportional to reward', () => {
  it('adds the full fraction when served at full patience', () => {
    const next = gameReducer(stateWithOrder(1), { type: 'SERVE', user: 'alice', orderId: 1 })
    const expectedBonus = Math.round(REWARD * SERVE_TIME_BONUS_FRACTION) // round(5 * 0.4) = 2
    expect(next.money).toBe(REWARD + expectedBonus)
  })

  it('adds (almost) no bonus when served at the last moment', () => {
    const next = gameReducer(stateWithOrder(0.01), { type: 'SERVE', user: 'alice', orderId: 1 })
    expect(next.money).toBe(REWARD) // round(5 * 0.4 * 0.01) = 0
  })

  it('scales the bonus with the dish value, not a flat amount', () => {
    // A pricier dish earns a larger absolute bonus than a cheap one at the same freshness.
    const cheap = gameReducer(stateWithOrder(1), { type: 'SERVE', user: 'a', orderId: 1 }).money
    expect(cheap - REWARD).toBe(Math.round(REWARD * SERVE_TIME_BONUS_FRACTION))
  })
})

describe('lost orders forfeit a value-proportional penalty', () => {
  it('deducts a fraction of the expired dish reward', () => {
    const s = stateWithOrder(0.0001, 100) // ~no patience left → expires on the first tick
    const next = gameReducer(s, { type: 'TICK', delta: 1000, now: 1000 })
    const penalty = Math.floor(REWARD * LOST_ORDER_PENALTY_FRACTION) // floor(5 * 0.2) = 1
    expect(next.lost).toBe(1)
    expect(next.money).toBe(100 - penalty)
  })

  it('clamps money at zero rather than going negative', () => {
    const s = stateWithOrder(0.0001, 0)
    const next = gameReducer(s, { type: 'TICK', delta: 1000, now: 1000 })
    expect(next.money).toBe(0)
  })
})
