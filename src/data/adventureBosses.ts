import { GameOptions, GameState } from '../state/types'
import { RECIPES, STATION_DEFS, HEAT_EXEMPT_STATIONS } from './recipes'
import { hashStringToSeed, mulberry32 } from './seededRng'

export type BossId = 'picky_critic' | 'rush_hour' | 'health_inspector' | 'understaffed' | 'heatwave' | 'chaos_mode' | 'recipe_roulette' | 'hangry_mob' | 'bad_reviews'

export interface BossDef {
  id: BossId
  name: string
  description: string
  icon: string
}

// PR 2 boss roster — 4 of the planned 7. Heatwave / Chaos Mode / Recipe Roulette
// will land in PR 3 alongside the kitchen-event tuning.
export const BOSSES: Record<BossId, BossDef> = {
  picky_critic: {
    id: 'picky_critic',
    name: 'The Picky Critic',
    description: 'Every served dish pays 25% less. Critics are watching the whole shift.',
    icon: '🧐',
  },
  rush_hour: {
    id: 'rush_hour',
    name: 'Rush Hour',
    description: 'Orders flood in 50% faster and customers tap their feet 10% sooner.',
    icon: '⏱️',
  },
  health_inspector: {
    id: 'health_inspector',
    name: 'The Health Inspector',
    description: 'One station is shut down for the entire shift. Choose your menu carefully.',
    icon: '📋',
  },
  understaffed: {
    id: 'understaffed',
    name: 'Understaffed',
    description: 'Every chef cooks 50% slower between actions — the line is moving in slow-motion.',
    icon: '👥',
  },
  heatwave: {
    id: 'heatwave',
    name: 'Heatwave',
    description: 'Heat accumulates 50% faster and cooling pulls 10 less heat. Stay frosty.',
    icon: '🥵',
  },
  chaos_mode: {
    id: 'chaos_mode',
    name: 'Chaos Mode',
    description: 'Kitchen events spawn 3× more often. Hope your chat is paying attention.',
    icon: '🌪️',
  },
  recipe_roulette: {
    id: 'recipe_roulette',
    name: 'Recipe Roulette',
    description: 'Every 45 seconds, one of your active recipes is swapped for a random dish from the catalog.',
    icon: '🎲',
  },
  // ── Sub-project C: new bosses ──
  hangry_mob: {
    id: 'hangry_mob',
    name: 'Hangry Mob',
    description: 'Every order arrives with 30% less patience — same volume of orders, sharply less time to serve each.',
    icon: '😤',
  },
  bad_reviews: {
    id: 'bad_reviews',
    name: 'Bad Reviews',
    description: 'Every lost or expired order deducts $20 from the run bank.',
    icon: '⭐',
  },
}

export interface BossDelta {
  options: Partial<Pick<GameOptions, 'orderSpeed' | 'orderSpawnRate'>>
  state: Partial<Pick<GameState,
    | 'bossMoneyMultiplier' | 'cooldownMultiplier' | 'disabledStations'
    | 'heatPerCookMultiplier' | 'coolAmountBonus'
    | 'orderPatienceBonus' | 'lostOrderPenalty'
  >>
}

// Compute the option/state adjustments for a given boss debuff.
export function applyBossDebuff(bossId: string | undefined, disabledStationId?: string): BossDelta {
  const id = bossId as BossId | undefined
  if (!id) return { options: {}, state: {} }

  switch (id) {
    case 'picky_critic':
      return { options: {}, state: { bossMoneyMultiplier: 0.75 } }
    case 'rush_hour':
      return { options: { orderSpawnRate: 1.5, orderSpeed: 1.1 }, state: {} }
    case 'health_inspector':
      return { options: {}, state: disabledStationId ? { disabledStations: [disabledStationId] } : {} }
    case 'understaffed':
      return { options: {}, state: { cooldownMultiplier: 1.5 } }
    case 'heatwave':
      return { options: {}, state: { heatPerCookMultiplier: 1.5, coolAmountBonus: -10 } }
    case 'chaos_mode':
      return { options: {}, state: {} }
    case 'recipe_roulette':
      return { options: {}, state: {} }
    case 'hangry_mob':
      // 30% less patience: orderSpeed divides the patience pool in SPAWN_ORDER, so
      // 1/0.7 ≈ 1.43 yields ~70% of base patience. Percentage (not flat) so the
      // hit is consistent across cheap fast dishes and long slow ones.
      return { options: { orderSpeed: 1.43 }, state: {} }
    case 'bad_reviews':
      return { options: {}, state: { lostOrderPenalty: 20 } }
  }
}

// Pick a random non-chopping station from the enabled recipes' required stations.
// Returns null if the enabled recipes don't actually use any cook stations.
export function pickHealthInspectorStation(enabledRecipes: string[], rng: () => number): string | null {
  const stationIds = new Set<string>()
  for (const key of enabledRecipes) {
    const r = RECIPES[key]
    if (!r) continue
    for (const step of r.steps) stationIds.add(step.station)
  }
  // Exclude chopping-board family (heat-exempt) so the boss always disables a real cook station.
  const candidates = [...stationIds].filter(id => !HEAT_EXEMPT_STATIONS.has(id) && STATION_DEFS[id])
  if (candidates.length === 0) return null
  return candidates[Math.floor(rng() * candidates.length)]
}

// Return the boss pool. Both boss shifts (S4 + S8) draw from this set.
export function getBossPool(): BossId[] {
  return ['picky_critic', 'rush_hour', 'health_inspector', 'understaffed', 'heatwave', 'chaos_mode', 'recipe_roulette', 'hangry_mob', 'bad_reviews']
}

// Auto-assign one boss for a boss shift, seeded for determinism. Pre-rolls the
// Health Inspector's disabled station so the briefing can name it.
export function pickBossForShift(runSeed: string, shift: number, enabledRecipes: string[]): { id: string; disabledStationId?: string } {
  const rng = mulberry32(hashStringToSeed(`${runSeed}::boss::${shift}`))
  const pool = getBossPool()
  const id = pool[Math.floor(rng() * pool.length)]
  const disabledStationId = id === 'health_inspector'
    ? (pickHealthInspectorStation(enabledRecipes, rng) ?? undefined)
    : undefined
  return { id, disabledStationId }
}
