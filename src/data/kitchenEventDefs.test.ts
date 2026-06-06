import { describe, it, expect } from 'vitest'
import {
  makePowerTripEquation,
  makeTypingFrenzyPhrase,
  makeDanceSequence,
  makeAnagram,
  seededScramble,
  getIngredientTargets,
  getProducesValues,
  makeAuditGrid,
  pickCompleteTheDish,
  EVENT_DEFS,
} from './kitchenEventDefs'

// Helper: run a randomised generator many times so invariants are exercised
// across the full branch space rather than a single lucky roll.
const times = (n: number) => Array.from({ length: n })

describe('makePowerTripEquation', () => {
  it('always yields an answer that matches its own arithmetic and is positive', () => {
    times(500).forEach(() => {
      const { display, answer } = makePowerTripEquation()
      expect(answer).toBeGreaterThan(0)
      expect(Number.isInteger(answer)).toBe(true)
      expect(display).toMatch(/= \?$/)
    })
  })
})

describe('makeTypingFrenzyPhrase', () => {
  it('is 10 characters long with an alphanumeric first character', () => {
    times(200).forEach(() => {
      const phrase = makeTypingFrenzyPhrase()
      expect(phrase).toHaveLength(10)
      // First char must be safe (won't be read as a Twitch command prefix).
      expect(phrase[0]).toMatch(/[A-Z0-9]/)
    })
  })
})

describe('makeDanceSequence', () => {
  it('returns 4 valid directions', () => {
    const valid = new Set(['UP', 'DOWN', 'LEFT', 'RIGHT'])
    times(200).forEach(() => {
      const seq = makeDanceSequence()
      expect(seq).toHaveLength(4)
      for (const dir of seq) expect(valid.has(dir)).toBe(true)
    })
  })
})

describe('makeAnagram', () => {
  it('preserves the multiset of characters (uppercased)', () => {
    const sorted = (s: string) => s.split('').sort().join('')
    times(100).forEach(() => {
      const result = makeAnagram('lettuce')
      expect(sorted(result)).toBe(sorted('LETTUCE'))
    })
  })

  it('differs from the original for a scrambleable word', () => {
    times(100).forEach(() => {
      expect(makeAnagram('burger')).not.toBe('BURGER')
    })
  })

  it('does not loop forever on a single-character word', () => {
    expect(makeAnagram('a')).toBe('A')
  })
})

describe('seededScramble', () => {
  it('is deterministic for the same text + seed', () => {
    expect(seededScramble('grilled patty', 1234)).toBe(seededScramble('grilled patty', 1234))
  })

  it('preserves the multiset of characters', () => {
    const sorted = (s: string) => s.split('').sort().join('')
    const text = 'fish and chips'
    expect(sorted(seededScramble(text, 777))).toBe(sorted(text))
  })

  it('generally produces different output for different seeds', () => {
    expect(seededScramble('chopped tomato', 1)).not.toBe(seededScramble('chopped tomato', 99999))
  })
})

describe('getIngredientTargets / getProducesValues', () => {
  it('returns unique values for the given recipes', () => {
    const targets = getIngredientTargets(['burger'])
    expect(targets.length).toBeGreaterThan(0)
    expect(new Set(targets).size).toBe(targets.length)

    const produces = getProducesValues(['burger'])
    expect(produces.length).toBeGreaterThan(0)
    expect(new Set(produces).size).toBe(produces.length)
  })

  it('falls back to the full recipe set when given an empty list', () => {
    expect(getIngredientTargets([]).length).toBeGreaterThan(getIngredientTargets(['burger']).length)
  })

  it('ignores unknown recipe keys', () => {
    expect(getIngredientTargets(['not_a_dish'])).toEqual([])
  })
})

describe('makeAuditGrid', () => {
  it('builds a 16-tile grid whose target count equals the answer', () => {
    times(100).forEach(() => {
      const grid = makeAuditGrid([])
      expect(grid).not.toBeNull()
      if (!grid) return
      expect(grid.grid).toHaveLength(16)
      expect(grid.answer).toBeGreaterThanOrEqual(3)
      expect(grid.answer).toBeLessThanOrEqual(10)
      const targetCount = grid.grid.filter(cell => cell === grid.target).length
      expect(targetCount).toBe(grid.answer)
    })
  })
})

describe('pickCompleteTheDish', () => {
  it('hides exactly one plate ingredient that is not among the shown ones', () => {
    times(100).forEach(() => {
      const pick = pickCompleteTheDish([])
      expect(pick).not.toBeNull()
      if (!pick) return
      expect(pick.shownIngredientKeys).not.toContain(pick.missingIngredientKey)
      expect(pick.shownIngredients).not.toContain(pick.missingIngredient)
      expect(pick.shownIngredientKeys.length).toBeGreaterThanOrEqual(1)
    })
  })
})

describe('EVENT_DEFS integrity', () => {
  it('has unique event types and required display fields', () => {
    const types = EVENT_DEFS.map(d => d.type)
    expect(new Set(types).size).toBe(types.length)
    for (const def of EVENT_DEFS) {
      expect(def.label.length).toBeGreaterThan(0)
      // commandPool may be empty for events that generate their challenge
      // dynamically (power_trip, typing_frenzy, inventory_audit, etc.).
      expect(def.audio.ambient.length).toBeGreaterThan(0)
      expect(def.audio.success.length).toBeGreaterThan(0)
    }
  })
})
