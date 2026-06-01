import { describe, it, expect } from 'vitest'
import { pvpLobbySnapshot, pvpLobbyPerPlayer, adventureVoteSnapshot } from './snapshot'
import type { RoomPlayer } from './roomRoster'
import type { VoteSnapshot } from '../shared/protocol'

describe('pvpLobbySnapshot', () => {
  it('signals PvP via teamMoney and is otherwise empty', () => {
    const s = pvpLobbySnapshot()
    expect(s.phase).toBe('lobby')
    expect(s.teamMoney).toEqual({ red: 0, blue: 0 })
    expect(s.orders).toEqual([])
    expect(s.stations).toEqual([])
  })
})

describe('adventureVoteSnapshot', () => {
  const vote: VoteSnapshot = {
    kind: 'shop',
    title: 'The Pantry',
    instruction: 'vote!',
    money: 120,
    options: [{ index: 1, label: 'Sharp Knives', emoji: '🔪', detail: '$40 · common', votes: 2 }],
    skipCommand: '!done',
    skipLabel: 'Done',
    timeLeftMs: 30_000,
    timeMaxMs: 60_000,
    paused: false,
    resolved: false,
  }

  it('carries the vote view so phones render voting UI', () => {
    const s = adventureVoteSnapshot(vote)
    expect(s.vote).toBe(vote)
    expect(s.phase).toBe('lobby')
    expect(s.money).toBe(120)
    expect(s.timeRemainingMs).toBe(30_000)
    expect(s.orders).toEqual([])
    expect(s.stations).toEqual([])
  })
})

describe('pvpLobbyPerPlayer', () => {
  it('maps each playerId to their team (or undefined)', () => {
    const players: RoomPlayer[] = [
      { id: 'p1', nickname: 'alice' },
      { id: 'p2', nickname: 'bob' },
      { id: 'p3', nickname: 'carol' },
    ]
    const view = pvpLobbyPerPlayer(players, ['alice'], ['bob'])
    expect(view.p1.team).toBe('red')
    expect(view.p2.team).toBe('blue')
    expect(view.p3.team).toBeUndefined()
    expect(view.p1.cooldownMs).toBe(0)
  })
})
