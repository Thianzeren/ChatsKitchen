import { describe, it, expect } from 'vitest'
import { addItems, emptyPools, itemNames, poolIdFor, removeRandom, takeItems } from './preparedPools'
import type { PreparedItem } from './types'

const pool: PreparedItem[] = [
  { item: 'chopped_lettuce', source: 'ann' },
  { item: 'grilled_patty', source: 'bob' },
  { item: 'chopped_lettuce', source: 'cat' },
]

describe('preparedPools', () => {
  it('emptyPools has all three pools empty', () => {
    expect(emptyPools()).toEqual({ shared: [], red: [], blue: [] })
  })

  it('poolIdFor routes co-op to shared, PvP to the team, and teamless PvP to null', () => {
    expect(poolIdFor({ teams: undefined }, 'x')).toBe('shared')
    expect(poolIdFor({ teams: { x: 'red' } }, 'x')).toBe('red')
    expect(poolIdFor({ teams: { x: 'blue' } }, 'x')).toBe('blue')
    expect(poolIdFor({ teams: { x: 'red' } }, 'y')).toBeNull()
  })

  it('addItems appends records with one source and does not mutate', () => {
    const out = addItems(pool, ['toasted_bun', 'toasted_bun'], 'dan')
    expect(out.slice(3)).toEqual([{ item: 'toasted_bun', source: 'dan' }, { item: 'toasted_bun', source: 'dan' }])
    expect(pool).toHaveLength(3)
  })

  it('takeItems removes the first match of each item and returns what it took', () => {
    const res = takeItems(pool, ['chopped_lettuce', 'grilled_patty'])
    expect(res).toEqual({
      ok: true,
      taken: [{ item: 'chopped_lettuce', source: 'ann' }, { item: 'grilled_patty', source: 'bob' }],
      remaining: [{ item: 'chopped_lettuce', source: 'cat' }],
    })
    expect(pool).toHaveLength(3)
  })

  it('takeItems reports the first missing item', () => {
    expect(takeItems(pool, ['grilled_patty', 'toasted_bun'])).toEqual({ ok: false, missing: 'toasted_bun' })
  })

  it('takeItems handles duplicates in the request', () => {
    expect(takeItems(pool, ['chopped_lettuce', 'chopped_lettuce']).ok).toBe(true)
    expect(takeItems(pool, ['grilled_patty', 'grilled_patty'])).toEqual({ ok: false, missing: 'grilled_patty' })
  })

  it('removeRandom removes up to count items using the given rng', () => {
    expect(removeRandom(pool, 2, () => 0)).toEqual([{ item: 'chopped_lettuce', source: 'cat' }])
    expect(removeRandom(pool, 10, () => 0)).toEqual([])
    expect(pool).toHaveLength(3)
  })

  it('itemNames lists the item ids', () => {
    expect(itemNames(pool)).toEqual(['chopped_lettuce', 'grilled_patty', 'chopped_lettuce'])
  })
})
