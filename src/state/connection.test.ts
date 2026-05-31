import { describe, it, expect } from 'vitest'
import { methodToChatMode, isConnectionReady } from './connection'

describe('methodToChatMode', () => {
  it('maps twitch → twitch', () => expect(methodToChatMode('twitch')).toBe('twitch'))
  it('maps local (room) → room', () => expect(methodToChatMode('local')).toBe('room'))
  it('maps solo → local', () => expect(methodToChatMode('solo')).toBe('local'))
})

describe('isConnectionReady', () => {
  it('not ready when no method chosen', () => {
    expect(isConnectionReady(null, 'disconnected', null)).toBe(false)
  })
  it('twitch ready only when connected', () => {
    expect(isConnectionReady('twitch', 'connecting', null)).toBe(false)
    expect(isConnectionReady('twitch', 'connected', null)).toBe(true)
  })
  it('local ready only when a room code exists', () => {
    expect(isConnectionReady('local', 'disconnected', null)).toBe(false)
    expect(isConnectionReady('local', 'disconnected', 'ABCD')).toBe(true)
  })
  it('solo is always ready once chosen', () => {
    expect(isConnectionReady('solo', 'disconnected', null)).toBe(true)
  })
})
