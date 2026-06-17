import { describe, it, expect } from 'vitest'
import { connectedNicknames, unassignedPool, mergeAdventureRoster, type RoomPlayer } from './roomRoster'

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

describe('mergeAdventureRoster', () => {
  it('preserves a Twitch !join member who is not a phone player (the bug)', () => {
    // twitchUser joined via !join; alice/carol are connected phones.
    const lobby = ['alice', 'carol', 'twitchUser']
    expect(mergeAdventureRoster(lobby, players)).toEqual(['alice', 'carol', 'twitchUser'])
  })

  it('adds newly-connected phone players not yet in the lobby', () => {
    expect(mergeAdventureRoster(['twitchUser'], players)).toEqual(['twitchUser', 'alice', 'carol'])
  })

  it('drops phone players that have disconnected, keeps Twitch members', () => {
    // bob is disconnected → removed; alice/twitchUser kept; connected carol is added.
    const lobby = ['alice', 'bob', 'twitchUser']
    expect(mergeAdventureRoster(lobby, players)).toEqual(['alice', 'twitchUser', 'carol'])
  })

  it('never includes the local host "You"', () => {
    const withHost: RoomPlayer[] = [...players, { id: '4', nickname: 'You' }]
    expect(mergeAdventureRoster(['You', 'twitchUser'], withHost)).toEqual(['twitchUser', 'alice', 'carol'])
  })

  it('is idempotent — re-applying to its own output is a no-op', () => {
    const once = mergeAdventureRoster(['twitchUser'], players)
    expect(mergeAdventureRoster(once, players)).toEqual(once)
  })

  it('does not duplicate a phone player already present', () => {
    expect(mergeAdventureRoster(['alice'], players)).toEqual(['alice', 'carol'])
  })
})
