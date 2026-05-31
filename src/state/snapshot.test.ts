import { describe, it, expect } from 'vitest'
import { pvpLobbySnapshot, pvpLobbyPerPlayer } from './snapshot'
import type { RoomPlayer } from './roomRoster'

describe('pvpLobbySnapshot', () => {
  it('signals PvP via teamMoney and is otherwise empty', () => {
    const s = pvpLobbySnapshot()
    expect(s.phase).toBe('lobby')
    expect(s.teamMoney).toEqual({ red: 0, blue: 0 })
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
