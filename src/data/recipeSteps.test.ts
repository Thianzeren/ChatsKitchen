import { describe, it, expect } from 'vitest'
import { orderStepsForDisplay } from './recipeSteps'
import { RECIPES } from './recipes'

describe('orderStepsForDisplay', () => {
  it('places a prerequisite immediately before its consumer (Kimchi Jjigae)', () => {
    // raw order: chop kimchi, chop tofu, simmer kimchi (requires sliced_kimchi)
    const ordered = orderStepsForDisplay(RECIPES.kimchi_jjigae.steps).map(s => `${s.action} ${s.target}`)
    expect(ordered).toEqual(['chop tofu', 'chop kimchi', 'simmer kimchi'])
  })

  it('keeps the same steps (no additions/removals)', () => {
    for (const recipe of Object.values(RECIPES)) {
      const ordered = orderStepsForDisplay(recipe.steps)
      expect(ordered).toHaveLength(recipe.steps.length)
      expect(new Set(ordered)).toEqual(new Set(recipe.steps))
    }
  })

  // The dependency invariant: in display order, any step that `requires` an
  // ingredient must be immediately preceded by the step that produces it — so the
  // "→" arrow always sits between the correct producer/consumer pair.
  it('guarantees the arrow lands after the producer for every recipe', () => {
    for (const [key, recipe] of Object.entries(RECIPES)) {
      const ordered = orderStepsForDisplay(recipe.steps)
      ordered.forEach((step, i) => {
        if (!step.requires) return
        const prev = ordered[i - 1]
        expect(prev, `${key}: step "${step.action} ${step.target}" requires "${step.requires}" but has no preceding step`).toBeDefined()
        expect(prev.produces, `${key}: "${step.action} ${step.target}" (requires ${step.requires}) is not immediately preceded by its producer`).toBe(step.requires)
      })
    }
  })
})
