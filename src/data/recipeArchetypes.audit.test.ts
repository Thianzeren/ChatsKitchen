import { describe, it, expect } from 'vitest'
import { RECIPES } from './recipes'
import { getRecipeProfile, RecipeTag } from './recipeProfile'

describe('archetype coverage audit', () => {
  it('populates every archetype tag and pip level', () => {
    const tagCounts: Record<string, number> = {}
    const pipCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0 }

    for (const recipe of Object.values(RECIPES)) {
      const p = getRecipeProfile(recipe)
      pipCounts[p.complexityPips]++
      for (const t of p.tags) tagCounts[t] = (tagCounts[t] ?? 0) + 1
    }

    // Visible in test output for tuning:
    console.table({ pips: pipCounts, tags: tagCounts })

    const allTags: RecipeTag[] = ['fast', 'slow', 'premium', 'value', 'prep_heavy', 'hot_line']
    for (const t of allTags) {
      expect(tagCounts[t] ?? 0, `archetype tag "${t}" is empty`).toBeGreaterThan(0)
    }
    for (const pip of [1, 2, 3]) {
      expect(pipCounts[pip], `no dishes at ${pip} pips`).toBeGreaterThan(0)
    }
  })
})
