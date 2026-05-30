import { RECIPES } from '../data/recipes'
import type { GameState } from './types'
import type { SharedSnapshot } from '../shared/protocol'

export function gameStateToSnapshot(state: GameState, phase: SharedSnapshot['phase']): SharedSnapshot {
  const activeOrders = state.orders.filter(o => !o.served && !o.outcome)

  return {
    phase,
    timeRemainingMs: Math.max(0, state.timeLeft),
    money: state.money,
    teamMoney:
      state.redMoney !== undefined
        ? { red: state.redMoney, blue: state.blueMoney ?? 0 }
        : undefined,
    orders: activeOrders.map(o => {
      const recipe = RECIPES[o.dish]
      const needed = recipe
        ? [...new Set(recipe.steps.map(s => s.target))]
        : []
      return {
        id: o.id,
        dish: recipe?.name ?? o.dish,
        emoji: recipe?.emoji ?? '🍽️',
        needed,
        patiencePct: o.patienceMax > 0 ? o.patienceLeft / o.patienceMax : 0,
      }
    }),
    stations: Object.values(state.stations).map(s => ({
      name: s.id,
      heatPct: s.heat / 100,
      overheated: s.overheated,
      busySlots: s.slots.length,
    })),
  }
}
