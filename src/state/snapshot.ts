import type { GameState } from './types'
import type { SharedSnapshot } from '../shared/protocol'
export function gameStateToSnapshot(_state: GameState, phase: SharedSnapshot['phase']): SharedSnapshot {
  return { phase, timeRemainingMs: 0, money: 0, orders: [], stations: [] }
}
