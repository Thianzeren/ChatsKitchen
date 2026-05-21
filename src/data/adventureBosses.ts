import { GameOptions, GameState, PathCard } from '../state/types'
import { RECIPES, STATION_DEFS, HEAT_EXEMPT_STATIONS } from './recipes'

export type BossId = 'picky_critic' | 'rush_hour' | 'health_inspector' | 'understaffed' | 'heatwave'

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
}

export interface BossDelta {
  options: Partial<Pick<GameOptions, 'orderSpeed' | 'orderSpawnRate'>>
  state: Partial<Pick<GameState, 'bossMoneyMultiplier' | 'cooldownMultiplier' | 'disabledStations' | 'heatPerCookMultiplier' | 'coolAmountBonus'>>
}

// Compute the option/state adjustments for a given boss debuff.
// `pathCard.bossPayload` carries the pre-rolled health-inspector station id so the
// briefing UI can display "Stove is closed!" before the run begins.
export function applyBossDebuff(card: PathCard): BossDelta {
  const id = card.bossDebuffId as BossId | undefined
  if (!id) return { options: {}, state: {} }

  switch (id) {
    case 'picky_critic':
      return { options: {}, state: { bossMoneyMultiplier: 0.75 } }
    case 'rush_hour':
      return { options: { orderSpawnRate: 1.5, orderSpeed: 1.1 }, state: {} }
    case 'health_inspector': {
      const station = card.bossPayload?.disabledStationId
      return {
        options: {},
        state: station ? { disabledStations: [station] } : {},
      }
    }
    case 'understaffed':
      return { options: {}, state: { cooldownMultiplier: 1.5 } }
    case 'heatwave':
      return { options: {}, state: { heatPerCookMultiplier: 1.5, coolAmountBonus: -10 } }
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
// Chaos Mode + Recipe Roulette will land in a follow-up commit alongside the
// kitchen-event enablement they depend on.
export function getBossPool(): BossId[] {
  return ['picky_critic', 'rush_hour', 'health_inspector', 'understaffed', 'heatwave']
}
