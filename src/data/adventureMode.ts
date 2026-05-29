import { PlayerStats } from '../state/types'

// ── 8-shift run constants ────────────────────────────────────────────────────

export const ADVENTURE_TOTAL_SHIFTS = 8
export const ADVENTURE_BOSS_SHIFTS: readonly number[] = [4, 8]

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

// Shift duration is constant across all 8 shifts. Variable duration was tried earlier
// but creates an inverse difficulty curve: longer shifts let players fulfil more orders,
// and missed orders carry no money penalty — so "easier early shifts" really means
// "lower per-minute pressure", which clashes with the goal-driven difficulty ramp.
// Keeping it fixed makes the goal number the single difficulty knob.
export const ADVENTURE_SHIFT_DURATION = 180_000

// ── Goal & duration lookups ──────────────────────────────────────────────────

export function getAdventureGoal(shift: number, participantCount: number = 1): number {
  const idx = Math.min(Math.max(shift, 1), PER_PLAYER_GOALS.length) - 1
  const crew = Math.max(1, participantCount)
  return PER_PLAYER_GOALS[idx] * crew
}

export function isBossShift(shift: number): boolean {
  return ADVENTURE_BOSS_SHIFTS.includes(shift)
}

export function makeRunSeed(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// ── Player-stats merge (unchanged) ───────────────────────────────────────────

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
