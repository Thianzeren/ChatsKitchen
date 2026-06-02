import { describe, it, expect } from 'vitest'
import { applyBossDebuff, pickBossForShift, pickHealthInspectorStation, getBossPool } from './adventureBosses'
import { mulberry32 } from './seededRng'

describe('applyBossDebuff', () => {
  it('maps each boss to its documented knobs', () => {
    expect(applyBossDebuff('picky_critic').state.bossMoneyMultiplier).toBe(0.75)
    expect(applyBossDebuff('rush_hour').options).toEqual({ orderSpawnRate: 1.5, orderSpeed: 1.1 })
    expect(applyBossDebuff('understaffed').state.cooldownMultiplier).toBe(1.5)
    expect(applyBossDebuff('heatwave').state).toMatchObject({ heatPerCookMultiplier: 1.5, coolAmountBonus: -10 })
  })

  it('implements Hangry Mob as a percentage patience cut via orderSpeed (not a flat -ms)', () => {
    // 1/0.7 ≈ 1.43 → orders spawn with ~70% of base patience.
    expect(applyBossDebuff('hangry_mob').options.orderSpeed).toBeCloseTo(1.43, 2)
    expect(applyBossDebuff('hangry_mob').state.orderPatienceBonus).toBeUndefined()
  })

  it('charges $20 per lost order for Bad Reviews (matches the description)', () => {
    expect(applyBossDebuff('bad_reviews').state.lostOrderPenalty).toBe(20)
  })

  it('disables the supplied station for the Health Inspector', () => {
    expect(applyBossDebuff('health_inspector', 'grill').state.disabledStations).toEqual(['grill'])
    expect(applyBossDebuff('health_inspector').state.disabledStations).toBeUndefined()
  })

  it('returns empty deltas for no boss', () => {
    expect(applyBossDebuff(undefined)).toEqual({ options: {}, state: {} })
  })
})

describe('pickBossForShift', () => {
  it('is deterministic for a given seed + shift', () => {
    const a = pickBossForShift('seed-xyz', 4, ['burger'])
    const b = pickBossForShift('seed-xyz', 4, ['burger'])
    expect(a).toEqual(b)
    expect(getBossPool()).toContain(a.id)
  })

  it('pre-rolls a disabled station when it picks the Health Inspector', () => {
    // Scan seeds until Health Inspector is chosen, then confirm a station was named.
    for (let i = 0; i < 200; i++) {
      const pick = pickBossForShift(`s${i}`, 4, ['burger', 'fish_burger'])
      if (pick.id === 'health_inspector') {
        expect(pick.disabledStationId).toBeTruthy()
        return
      }
    }
    throw new Error('Health Inspector never rolled across 200 seeds — pool may have changed')
  })
})

describe('pickHealthInspectorStation', () => {
  it('returns a real cook station used by the menu, never a heat-exempt one', () => {
    const station = pickHealthInspectorStation(['burger'], mulberry32(1))
    expect(['grill', 'oven', 'cutting_board']).toContain(station) // burger touches these…
    expect(station).not.toBe('cutting_board')                     // …but chopping is exempt
  })

  it('returns null when the menu only uses heat-exempt stations', () => {
    // iced_lemon_tea is a single mixing_bowl step (heat-exempt)
    expect(pickHealthInspectorStation(['iced_lemon_tea'], mulberry32(1))).toBeNull()
  })
})
