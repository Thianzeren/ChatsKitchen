import { describe, it, expect } from 'vitest'
import { RECIPES } from './recipes'
import { getRecipeProfile } from './recipeProfile'

const REWARD_BANDS: Record<1 | 2 | 3, [number, number]> = {
  1: [5, 9],
  2: [11, 18],
  3: [19, 25],
}

describe('reward is coupled to complexity', () => {
  it('prices every dish within the band its complexity pips dictate', () => {
    for (const [key, recipe] of Object.entries(RECIPES)) {
      const pips = getRecipeProfile(recipe).complexityPips
      const [lo, hi] = REWARD_BANDS[pips]
      expect(recipe.reward, `${key} (${pips} pips) reward ${recipe.reward} out of band ${lo}-${hi}`).toBeGreaterThanOrEqual(lo)
      expect(recipe.reward, `${key} (${pips} pips) reward ${recipe.reward} out of band ${lo}-${hi}`).toBeLessThanOrEqual(hi)
    }
  })

  it('keeps representative anchor prices', () => {
    expect(RECIPES.pour_over_coffee.reward).toBe(5)   // ●○○
    expect(RECIPES.salmon_donburi.reward).toBe(9)     // ●○○ (simple-but-not-premium under coupling)
    expect(RECIPES.burger.reward).toBe(14)            // ●●○
    expect(RECIPES.bulgogi.reward).toBe(17)           // ●●○
    expect(RECIPES.korean_fried_chicken.reward).toBe(20) // ●●●
  })
})

describe('complexity overrides on multi-component dishes', () => {
  it('promotes economic_bee_hoon and nasi_lemak to ●●● (and into the premium band)', () => {
    expect(RECIPES.economic_bee_hoon.complexityOverride).toBe(3)
    expect(getRecipeProfile(RECIPES.economic_bee_hoon).complexityPips).toBe(3)
    expect(RECIPES.nasi_lemak.complexityOverride).toBe(3)
    expect(getRecipeProfile(RECIPES.nasi_lemak).complexityPips).toBe(3)
  })
})
