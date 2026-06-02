import { describe, it, expect } from 'vitest'
import { countActivePlayers, countRoster, LOCAL_USER } from './participants'
import { PlayerStats } from './types'

const stat = (): PlayerStats => ({
  cooked: 0, served: 0, moneyEarned: 0, extinguished: 0, firesCaused: 0, cooled: 0, eventParticipations: 0, bonusPoints: 0,
})

describe('participants', () => {
  it('counts active players but never the local admin "You"', () => {
    expect(countActivePlayers({ You: stat(), alice: stat(), bob: stat() })).toBe(2)
  })

  it('counts a roster excluding "You"', () => {
    expect(countRoster([LOCAL_USER, 'alice', 'bob'])).toBe(2)
  })

  it('returns 0 for empty / You-only inputs', () => {
    expect(countActivePlayers({})).toBe(0)
    expect(countActivePlayers({ You: stat() })).toBe(0)
    expect(countRoster([])).toBe(0)
    expect(countRoster(['You'])).toBe(0)
  })
})
