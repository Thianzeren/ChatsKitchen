import type { PlayerStats } from './types'

// The local host plays through the in-game chatbox like an admin chat: their
// commands work and they appear on the leaderboard, but they are never counted
// as a participant for difficulty scaling, per-player goals, or vote thresholds.
export const LOCAL_USER = 'You'

// Distinct real participants in a playerStats map, excluding the local host.
// Used for extinguish vote thresholds, order scaling, and star thresholds.
export function countActivePlayers(playerStats: Record<string, PlayerStats>): number {
  return Object.keys(playerStats).filter(u => u !== LOCAL_USER).length
}

// A lobby/roster count excluding the local host.
export function countRoster(roster: string[]): number {
  return roster.filter(u => u !== LOCAL_USER).length
}
