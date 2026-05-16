import { RECIPES } from './recipes'
import { PlayerStats } from '../state/types'

export const ADVENTURE_SHIFT_DURATION = 180_000   // 3 min per shift
export const ADVENTURE_BASE_GOAL      = 150
export const ADVENTURE_GOAL_INCREMENT = 60

export function getAdventureGoal(shift: number): number {
  return ADVENTURE_BASE_GOAL + (shift - 1) * ADVENTURE_GOAL_INCREMENT
}

export function pickAdventureRecipes(): string[] {
  const keys = Object.keys(RECIPES)
  return [...keys].sort(() => Math.random() - 0.5).slice(0, 3)
}

export function mergePlayerStats(
  base: Record<string, PlayerStats>,
  incoming: Record<string, PlayerStats>
): Record<string, PlayerStats> {
  const result = { ...base }
  for (const [user, s] of Object.entries(incoming)) {
    const e = result[user] ?? {
      cooked: 0, served: 0,
      moneyEarned: 0, extinguished: 0, firesCaused: 0,
      cooled: 0, eventParticipations: 0, bonusPoints: 0,
    }
    result[user] = {
      cooked:              e.cooked              + s.cooked,
      served:              e.served              + s.served,
      moneyEarned:         e.moneyEarned         + s.moneyEarned,
      extinguished:        e.extinguished        + s.extinguished,
      firesCaused:         e.firesCaused         + s.firesCaused,
      cooled:              e.cooled              + s.cooled,
      eventParticipations: e.eventParticipations + s.eventParticipations,
      bonusPoints:         e.bonusPoints         + s.bonusPoints,
    }
  }
  return result
}
