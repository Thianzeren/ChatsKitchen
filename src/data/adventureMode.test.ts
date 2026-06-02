import { describe, it, expect } from 'vitest'
import { getAdventureGoal, mergePlayerStats, PER_PLAYER_GOALS, ADVENTURE_TOTAL_SHIFTS } from './adventureMode'
import { PlayerStats } from '../state/types'

describe('getAdventureGoal', () => {
  it('scales the per-player baseline linearly with the crew', () => {
    expect(getAdventureGoal(1, 1)).toBe(PER_PLAYER_GOALS[0])
    expect(getAdventureGoal(1, 3)).toBe(PER_PLAYER_GOALS[0] * 3)
  })

  it('treats a crew of 0 as 1 (host-only solo run)', () => {
    expect(getAdventureGoal(1, 0)).toBe(PER_PLAYER_GOALS[0])
  })

  it('clamps the shift index into range', () => {
    expect(getAdventureGoal(0, 1)).toBe(PER_PLAYER_GOALS[0])
    expect(getAdventureGoal(99, 1)).toBe(PER_PLAYER_GOALS[ADVENTURE_TOTAL_SHIFTS - 1])
  })
})

describe('mergePlayerStats', () => {
  const mk = (over: Partial<PlayerStats>): PlayerStats => ({
    cooked: 0, served: 0, moneyEarned: 0, extinguished: 0, firesCaused: 0, cooled: 0, eventParticipations: 0, bonusPoints: 0, ...over,
  })

  it('adds overlapping players field-by-field and carries new ones over', () => {
    const merged = mergePlayerStats(
      { alice: mk({ cooked: 2, served: 1 }) },
      { alice: mk({ cooked: 3, moneyEarned: 50 }), bob: mk({ served: 4 }) },
    )
    expect(merged.alice).toMatchObject({ cooked: 5, served: 1, moneyEarned: 50 })
    expect(merged.bob.served).toBe(4)
  })

  it('does not mutate the base record', () => {
    const base = { alice: mk({ cooked: 1 }) }
    mergePlayerStats(base, { alice: mk({ cooked: 1 }) })
    expect(base.alice.cooked).toBe(1)
  })
})
