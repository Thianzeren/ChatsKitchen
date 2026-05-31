import { describe, it, expect } from 'vitest'
import { connectedNicknames, unassignedPool, type RoomPlayer } from './roomRoster'

const players: RoomPlayer[] = [
  { id: '1', nickname: 'alice' },
  { id: '2', nickname: 'bob', disconnected: true },
  { id: '3', nickname: 'carol' },
]

describe('connectedNicknames', () => {
  it('returns only non-disconnected nicknames in order', () => {
    expect(connectedNicknames(players)).toEqual(['alice', 'carol'])
  })
})

describe('unassignedPool', () => {
  it('excludes players already on a team', () => {
    expect(unassignedPool(players, ['alice'], [])).toEqual(['carol'])
  })
  it('returns all connected when no teams set', () => {
    expect(unassignedPool(players, [], [])).toEqual(['alice', 'carol'])
  })
})
