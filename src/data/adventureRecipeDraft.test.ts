import { describe, it, expect } from 'vitest'
import { generateRecipeOffers } from './adventureRecipeDraft'
import { RECIPES } from './recipes'

const ALL_KEYS = Object.keys(RECIPES)

describe('generateRecipeOffers', () => {
  it('offers 3 recipes when plenty are unowned', () => {
    expect(generateRecipeOffers('seed1', 1, [])).toHaveLength(3)
  })

  it('only offers real recipe keys', () => {
    for (const k of generateRecipeOffers('seed1', 1, [])) expect(ALL_KEYS).toContain(k)
  })

  it('never offers an already-owned recipe', () => {
    const owned = ['burger', 'fries', 'sushi_roll']
    for (const k of generateRecipeOffers('seed1', 3, owned)) expect(owned).not.toContain(k)
  })

  it('returns no duplicates within an offer set', () => {
    const offers = generateRecipeOffers('seed-xyz', 2, [])
    expect(new Set(offers).size).toBe(offers.length)
  })

  it('is deterministic for the same runSeed + shift + owned', () => {
    expect(generateRecipeOffers('seedA', 4, ['burger'])).toEqual(generateRecipeOffers('seedA', 4, ['burger']))
  })

  it('differs across shifts', () => {
    expect(generateRecipeOffers('seedA', 1, [])).not.toEqual(generateRecipeOffers('seedA', 2, []))
  })

  it('degrades gracefully when fewer than 3 recipes remain', () => {
    const owned = ALL_KEYS.slice(0, ALL_KEYS.length - 2) // leave exactly 2
    const offers = generateRecipeOffers('seed1', 5, owned)
    expect(offers).toHaveLength(2)
    for (const k of offers) expect(owned).not.toContain(k)
  })

  it('returns empty when everything is owned', () => {
    expect(generateRecipeOffers('seed1', 8, [...ALL_KEYS])).toEqual([])
  })
})
