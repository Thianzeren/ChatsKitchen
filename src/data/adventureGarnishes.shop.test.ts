import { describe, it, expect } from 'vitest'
import { generateShopOffers, GARNISHES } from './adventureGarnishes'

describe('generateShopOffers (tier-weighted)', () => {
  it('returns `count` distinct un-owned garnishes', () => {
    const offers = generateShopOffers('seed1', [], 3, 1, 4)
    expect(offers).toHaveLength(4)
    expect(new Set(offers.map(o => o.garnishId)).size).toBe(4)
  })

  it('never offers an owned garnish', () => {
    const owned = [{ garnishId: 'fine_dining', acquiredOnShift: 1 }]
    const offers = generateShopOffers('seed1', owned, 3, 1, 4)
    expect(offers.map(o => o.garnishId)).not.toContain('fine_dining')
  })

  it('is deterministic for the same runSeed + shift', () => {
    const a = generateShopOffers('seedA', [], 4, 1, 4)
    const b = generateShopOffers('seedA', [], 4, 1, 4)
    expect(a).toEqual(b)
  })

  it('prices offers via the tier-scaled price', () => {
    const offers = generateShopOffers('seed1', [], 3, 1, 4)
    for (const o of offers) {
      expect(o.price).toBeGreaterThan(0)
      expect(o.rarity).toBe(GARNISHES[o.garnishId].tier)
    }
  })

  it('boss shops (4 & 8) skew rarer than the average non-boss shop', () => {
    const rareScore = (shift: number) => {
      let score = 0
      for (let s = 0; s < 60; s++) {
        for (const o of generateShopOffers(`seed${s}`, [], shift, 1, 4)) {
          score += o.rarity === 'legendary' ? 2 : o.rarity === 'rare' ? 1 : 0
        }
      }
      return score
    }
    expect(rareScore(4)).toBeGreaterThan(rareScore(3))
    expect(rareScore(8)).toBeGreaterThan(rareScore(7))
  })
})
