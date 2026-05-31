import { RECIPES } from '../data/recipes'
import type { GameState } from './types'
import type { SharedSnapshot, PartialPlayerView } from '../shared/protocol'
import type { RoomPlayer } from './roomRoster'

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

// Snapshot pushed to phones while sitting in the PvP lobby (before RESET sets
// GameState teams). teamMoney being present is how the controller Lobby detects
// PvP and shows its Red/Blue picker.
export function pvpLobbySnapshot(): SharedSnapshot {
  return {
    phase: 'lobby',
    timeRemainingMs: 0,
    money: 0,
    teamMoney: { red: 0, blue: 0 },
    orders: [],
    stations: [],
  }
}

// Per-player team assignment so each phone reflects host-side drags.
export function pvpLobbyPerPlayer(
  players: RoomPlayer[],
  red: string[],
  blue: string[],
): Record<string, PartialPlayerView> {
  const out: Record<string, PartialPlayerView> = {}
  for (const p of players) {
    const team = red.includes(p.nickname) ? 'red' : blue.includes(p.nickname) ? 'blue' : undefined
    out[p.id] = { cooldownMs: 0, team }
  }
  return out
}
