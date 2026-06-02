import { describe, it, expect } from 'vitest'
import { parseCommand } from './commandProcessor'

describe('parseCommand', () => {
  it('maps a cooking verb + target to a COOK action', () => {
    expect(parseCommand('alice', '!chop lettuce')).toEqual({
      type: 'COOK', user: 'alice', action: 'chop', target: 'lettuce', now: expect.any(Number),
    })
  })

  it('works with or without the leading !', () => {
    expect(parseCommand('a', 'grill patty')).toMatchObject({ type: 'COOK', action: 'grill', target: 'patty' })
  })

  it('joins multi-word targets with an underscore', () => {
    expect(parseCommand('a', '!chop spring onion')).toMatchObject({ target: 'spring_onion' })
  })

  it('parses a serve order number (bare or #-prefixed)', () => {
    expect(parseCommand('a', '!serve 3')).toEqual({ type: 'SERVE', user: 'a', orderId: 3 })
    expect(parseCommand('a', '!serve #7')).toEqual({ type: 'SERVE', user: 'a', orderId: 7 })
  })

  it('returns COOL / EXTINGUISH only with a target', () => {
    expect(parseCommand('a', '!cool grill')).toEqual({ type: 'COOL', user: 'a', stationId: 'grill' })
    expect(parseCommand('a', '!extinguish grill')).toEqual({ type: 'EXTINGUISH', user: 'a', stationId: 'grill' })
    expect(parseCommand('a', '!cool')).toBeNull()
    expect(parseCommand('a', '!extinguish')).toBeNull()
  })

  it('returns null for a cook verb with no target, and for unknown commands', () => {
    expect(parseCommand('a', '!chop')).toBeNull()
    expect(parseCommand('a', '!dance')).toBeNull()
    expect(parseCommand('a', '!red')).toBeNull() // lobby-only; must never become a game action (pitfall #9)
  })

  it('honours short-form aliases only when enabled', () => {
    expect(parseCommand('a', 'c lettuce', true)).toMatchObject({ action: 'chop', target: 'lettuce' })
    expect(parseCommand('a', 's 2', true)).toEqual({ type: 'SERVE', user: 'a', orderId: 2 })
    // Without the flag, 'c' is not a real command.
    expect(parseCommand('a', 'c lettuce', false)).toBeNull()
  })
})
