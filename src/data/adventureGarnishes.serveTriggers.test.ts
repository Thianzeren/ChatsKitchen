import { describe, it, expect } from 'vitest'
import { applyServeTriggers } from './adventureGarnishes'
import { RecipeProfile } from './recipeProfile'

export function mockProfile(over: Partial<RecipeProfile>): RecipeProfile {
  return {
    reward: 14, prepTimeMs: 20000, complexity: 4, complexityPips: 2,
    stations: [], heatStations: [], tags: [], ...over,
  }
}

describe('applyServeTriggers (core)', () => {
  it('returns identity for garnishes with no serveTrigger and unknown ids', () => {
    const r = applyServeTriggers(['quick_hands', 'not_a_garnish'], mockProfile({ tags: ['premium'] }), { elapsedSinceSpawn: 1000 })
    expect(r).toEqual({ multiplier: 1, flatBonus: 0 })
  })

  it('returns identity for an empty active list', () => {
    expect(applyServeTriggers([], mockProfile({}), { elapsedSinceSpawn: 0 })).toEqual({ multiplier: 1, flatBonus: 0 })
  })
})

describe('applyServeTriggers (catalog)', () => {
  it('applies a tag-gated multiplier only when the dish has the tag', () => {
    expect(applyServeTriggers(['fine_dining'], mockProfile({ tags: ['premium'] }), { elapsedSinceSpawn: 99999 }).multiplier).toBeCloseTo(1.25)
    expect(applyServeTriggers(['fine_dining'], mockProfile({ tags: ['value'] }), { elapsedSinceSpawn: 99999 }).multiplier).toBe(1)
  })

  it('applies a tag-gated flat bonus (Penny Pincher)', () => {
    expect(applyServeTriggers(['penny_pincher'], mockProfile({ tags: ['value'] }), { elapsedSinceSpawn: 99999 }).flatBonus).toBe(3)
    expect(applyServeTriggers(['penny_pincher'], mockProfile({ tags: ['premium'] }), { elapsedSinceSpawn: 0 }).flatBonus).toBe(0)
  })

  it('respects the timing condition (Quick Bite)', () => {
    expect(applyServeTriggers(['quick_bite'], mockProfile({ tags: [] }), { elapsedSinceSpawn: 10_000 }).multiplier).toBeCloseTo(1.2)
    expect(applyServeTriggers(['quick_bite'], mockProfile({ tags: [] }), { elapsedSinceSpawn: 20_000 }).multiplier).toBe(1)
  })

  it('composes multiple garnishes (multipliers multiply, flats add)', () => {
    const r = applyServeTriggers(['fine_dining', 'penny_pincher', 'quick_bite'], mockProfile({ tags: ['premium', 'value'] }), { elapsedSinceSpawn: 5_000 })
    expect(r.multiplier).toBeCloseTo(1.25 * 1.2)
    expect(r.flatBonus).toBe(3)
  })

  it('Glass Kitchen (+50%) fires on every serve (no required tag)', () => {
    expect(applyServeTriggers(['glass_kitchen'], mockProfile({ tags: [] }), { elapsedSinceSpawn: 99999 }).multiplier).toBeCloseTo(1.5)
  })
})
