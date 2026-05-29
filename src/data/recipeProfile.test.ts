import { describe, it, expect } from 'vitest'
import { getRecipeProfile } from './recipeProfile'
import { RECIPES, Recipe } from './recipes'

// Controlled mock recipes — tag tests use these so they don't depend on the
// catalog's reward rescale (Task 3).
function mockRecipe(over: Partial<Recipe>): Recipe {
  return {
    name: 'Mock', emoji: '🍽️', reward: 12, patience: 60000,
    steps: [{ action: 'mix', target: 'x', station: 'mixing_bowl', duration: 5000, produces: 'x' }],
    plate: ['x'],
    ...over,
  }
}

describe('getRecipeProfile — derived knobs', () => {
  it('sums step durations into prepTimeMs', () => {
    expect(getRecipeProfile(RECIPES.burger).prepTimeMs).toBe(23000)
  })

  it('lists distinct stations and excludes heat-exempt ones from heatStations', () => {
    const p = getRecipeProfile(RECIPES.burger) // cutting_board, grill, oven
    expect(new Set(p.stations)).toEqual(new Set(['cutting_board', 'grill', 'oven']))
    expect(new Set(p.heatStations)).toEqual(new Set(['grill', 'oven'])) // cutting_board exempt
  })

  it('computes raw complexity = steps + 2×chains + distinctStations − 2', () => {
    expect(getRecipeProfile(RECIPES.mushroom_soup).complexity).toBe(2)
    expect(getRecipeProfile(RECIPES.burger).complexity).toBe(4)
    expect(getRecipeProfile(RECIPES.korean_fried_chicken).complexity).toBe(6)
  })

  it('buckets raw complexity into pips (≤3→1, 4–5→2, ≥6→3)', () => {
    expect(getRecipeProfile(RECIPES.mushroom_soup).complexityPips).toBe(1) // raw 2
    expect(getRecipeProfile(RECIPES.burger).complexityPips).toBe(2)        // raw 4
    expect(getRecipeProfile(RECIPES.korean_fried_chicken).complexityPips).toBe(3) // raw 6
  })

  it('lets complexityOverride win over the derived pip bucket', () => {
    const r = mockRecipe({ complexityOverride: 3 }) // raw would be 0 → pips 1
    const p = getRecipeProfile(r)
    expect(p.complexity).toBe(0)        // raw still computed
    expect(p.complexityPips).toBe(3)    // override wins
  })
})

describe('getRecipeProfile — archetype tags', () => {
  it('tags a quick cheap one-step dish fast + value + chop_heavy', () => {
    const p = getRecipeProfile(mockRecipe({ reward: 6 })) // 1 mix step, 5000ms
    expect(p.tags).toEqual(expect.arrayContaining(['fast', 'value', 'chop_heavy']))
    expect(p.tags).not.toContain('hot_line')
    expect(p.tags).not.toContain('premium')
  })

  it('tags a slow premium 2-heat-station dish slow + premium + hot_line', () => {
    const p = getRecipeProfile(mockRecipe({
      reward: 22,
      steps: [
        { action: 'grill', target: 'a', station: 'grill', duration: 15000, produces: 'a' },
        { action: 'boil',  target: 'b', station: 'stove', duration: 15000, produces: 'b' },
      ],
      plate: ['a', 'b'],
    }))
    expect(p.tags).toEqual(expect.arrayContaining(['slow', 'premium', 'hot_line']))
    expect(p.tags).not.toContain('chop_heavy')
  })
})
