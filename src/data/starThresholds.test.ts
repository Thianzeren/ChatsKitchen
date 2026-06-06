import { describe, it, expect } from 'vitest'
import { computeStarThresholds, getStarCount } from './starThresholds'
import { DEFAULT_GAME_OPTIONS } from '../state/defaultOptions'
import type { GameOptions, EventType } from '../state/types'

const opts = (over: Partial<GameOptions> = {}): GameOptions => ({ ...DEFAULT_GAME_OPTIONS, ...over })

describe('computeStarThresholds', () => {
  it('returns three ascending thresholds', () => {
    const [one, two, three] = computeStarThresholds(opts(), 4)
    expect(one).toBeLessThan(two)
    expect(two).toBeLessThan(three)
  })

  it('rounds every threshold to a multiple of 5', () => {
    for (const t of computeStarThresholds(opts(), 6)) {
      expect(t % 5).toBe(0)
    }
  })

  it('falls back to a fixed table when no recipes are enabled', () => {
    expect(computeStarThresholds(opts({ enabledRecipes: [] }), 4)).toEqual([100, 200, 350])
  })

  it('ignores unknown recipe keys (treated as no recipes)', () => {
    expect(computeStarThresholds(opts({ enabledRecipes: ['not_a_real_dish'] }), 4)).toEqual([100, 200, 350])
  })

  it('scales thresholds up with more players', () => {
    const few = computeStarThresholds(opts(), 1)
    const many = computeStarThresholds(opts(), 12)
    expect(many[2]).toBeGreaterThan(few[2])
  })

  it('hazard events lower the bar relative to no events', () => {
    const noEvents = computeStarThresholds(opts({ kitchenEventsEnabled: false }), 4)
    const hazards = computeStarThresholds(
      opts({ kitchenEventsEnabled: true, enabledKitchenEvents: ['rat_invasion', 'smoke_blast'] as EventType[] }),
      4,
    )
    expect(hazards[2]).toBeLessThan(noEvents[2])
  })

  it('opportunity events raise the bar relative to no events', () => {
    const noEvents = computeStarThresholds(opts({ kitchenEventsEnabled: false }), 4)
    const opportunities = computeStarThresholds(
      opts({ kitchenEventsEnabled: true, enabledKitchenEvents: ['chefs_chant', 'mystery_recipe'] as EventType[] }),
      4,
    )
    expect(opportunities[2]).toBeGreaterThan(noEvents[2])
  })

  it('is deterministic (pure function of its inputs)', () => {
    expect(computeStarThresholds(opts(), 5)).toEqual(computeStarThresholds(opts(), 5))
  })
})

describe('getStarCount', () => {
  const thresholds: [number, number, number] = [100, 200, 350]

  it('awards 0 stars below the first threshold', () => {
    expect(getStarCount(0, thresholds)).toBe(0)
    expect(getStarCount(99, thresholds)).toBe(0)
  })

  it('awards stars at each threshold boundary (inclusive)', () => {
    expect(getStarCount(100, thresholds)).toBe(1)
    expect(getStarCount(200, thresholds)).toBe(2)
    expect(getStarCount(350, thresholds)).toBe(3)
  })

  it('awards the partial count between thresholds', () => {
    expect(getStarCount(150, thresholds)).toBe(1)
    expect(getStarCount(300, thresholds)).toBe(2)
    expect(getStarCount(9999, thresholds)).toBe(3)
  })
})
