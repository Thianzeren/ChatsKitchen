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
