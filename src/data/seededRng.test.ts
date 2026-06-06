import { describe, it, expect } from 'vitest'
import { hashStringToSeed, mulberry32 } from './seededRng'

describe('hashStringToSeed', () => {
  it('is deterministic for the same string', () => {
    expect(hashStringToSeed('let-chat-cook')).toBe(hashStringToSeed('let-chat-cook'))
  })

  it('returns the FNV offset basis for the empty string', () => {
    expect(hashStringToSeed('')).toBe(2166136261)
  })

  it('differs for different strings', () => {
    expect(hashStringToSeed('seedA')).not.toBe(hashStringToSeed('seedB'))
  })

  it('is order-sensitive (anagrams hash differently)', () => {
    expect(hashStringToSeed('ab')).not.toBe(hashStringToSeed('ba'))
  })

  it('always returns a non-negative 32-bit unsigned integer', () => {
    for (const s of ['', 'a', 'a much longer seed string with spaces', '🍳', 'ZZZZ']) {
      const h = hashStringToSeed(s)
      expect(Number.isInteger(h)).toBe(true)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThanOrEqual(0xffffffff)
    }
  })
})

describe('mulberry32', () => {
  it('produces an identical sequence for the same seed', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    const seqA = Array.from({ length: 20 }, () => a())
    const seqB = Array.from({ length: 20 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('produces different sequences for different seeds', () => {
    const a = Array.from({ length: 10 }, mulberry32(1))
    const b = Array.from({ length: 10 }, mulberry32(2))
    expect(a).not.toEqual(b)
  })

  it('returns values in the half-open range [0, 1)', () => {
    const rng = mulberry32(99)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('advances state (consecutive draws are not all identical)', () => {
    const rng = mulberry32(7)
    const draws = new Set(Array.from({ length: 50 }, () => rng()))
    expect(draws.size).toBeGreaterThan(1)
  })

  it('hashStringToSeed + mulberry32 compose deterministically', () => {
    const seq = (s: string) => {
      const rng = mulberry32(hashStringToSeed(s))
      return Array.from({ length: 5 }, () => rng())
    }
    expect(seq('run-42')).toEqual(seq('run-42'))
    expect(seq('run-42')).not.toEqual(seq('run-43'))
  })
})
