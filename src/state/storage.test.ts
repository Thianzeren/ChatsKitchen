import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { storage } from './storage'

// Minimal in-memory localStorage stand-in (tests run in the node environment,
// which has no real localStorage).
function makeMemoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, String(v)) },
    removeItem: (k: string) => { map.delete(k) },
    clear: () => map.clear(),
  } as unknown as Storage
}

// A localStorage whose every method throws (private mode / quota exceeded).
const throwingStorage = new Proxy({}, {
  get() { return () => { throw new Error('storage unavailable') } },
}) as Storage

describe('storage', () => {
  const original = globalThis.localStorage

  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: makeMemoryStorage(), configurable: true })
  })
  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true })
  })

  it('round-trips a string value', () => {
    storage.set('k', 'hello')
    expect(storage.get('k')).toBe('hello')
  })

  it('returns null for a missing key', () => {
    expect(storage.get('absent')).toBeNull()
  })

  it('removes a key', () => {
    storage.set('k', 'v')
    storage.remove('k')
    expect(storage.get('k')).toBeNull()
  })

  it('round-trips JSON values', () => {
    const value = { a: 1, b: ['x', 'y'], c: true }
    storage.setJSON('obj', value)
    expect(storage.getJSON('obj', null)).toEqual(value)
  })

  it('getJSON returns the fallback when the key is missing', () => {
    expect(storage.getJSON('missing', { fallback: true })).toEqual({ fallback: true })
  })

  it('getJSON returns the fallback when the stored value is not valid JSON', () => {
    storage.set('broken', '{not json')
    expect(storage.getJSON('broken', 42)).toBe(42)
  })

  describe('when localStorage is unavailable', () => {
    beforeEach(() => {
      Object.defineProperty(globalThis, 'localStorage', { value: throwingStorage, configurable: true })
    })

    it('get falls back to null instead of throwing', () => {
      expect(() => storage.get('k')).not.toThrow()
      expect(storage.get('k')).toBeNull()
    })

    it('set and remove are silent no-ops', () => {
      expect(() => storage.set('k', 'v')).not.toThrow()
      expect(() => storage.remove('k')).not.toThrow()
    })

    it('getJSON falls back without throwing', () => {
      expect(() => storage.getJSON('k', 'fallback')).not.toThrow()
      expect(storage.getJSON('k', 'fallback')).toBe('fallback')
    })

    it('setJSON is a silent no-op', () => {
      expect(() => storage.setJSON('k', { a: 1 })).not.toThrow()
    })
  })
})
