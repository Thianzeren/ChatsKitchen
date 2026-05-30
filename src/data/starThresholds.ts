import { GameOptions, EventType } from '../state/types'
import { RECIPES, getEnabledStations } from './recipes'

const BASE_SPAWN_INTERVAL_MS = 14000
const MIN_SPAWN_INTERVAL_MS  = 5000   // floor from shift progression (Math.max(5000, 14000 - shift*1000))
const REACTION_TIME_MS = 8000
const COORD_FLOOR = 0.20
const COORD_RANGE = 0.75  // ceiling = COORD_FLOOR + COORD_RANGE = 0.95

const HAZARD_TYPES: EventType[] = [
  'rat_invasion', 'angry_chef', 'power_trip', 'smoke_blast', 'glitched_orders', 'inventory_audit',
]
const OPP_TYPES: EventType[] = [
  'chefs_chant', 'mystery_recipe', 'typing_frenzy', 'dance', 'complete_dish',
]


export function computeStarThresholds(options: GameOptions, playerCount: number): [number, number, number] {
  const {
    shiftDuration, cookingSpeed, orderSpeed, orderSpawnRate,
    enabledRecipes,
    kitchenEventsEnabled, enabledKitchenEvents,
  } = options

  const recipes = enabledRecipes.map(k => RECIPES[k]).filter(Boolean)
  if (recipes.length === 0) return [100, 200, 350]

  const avgReward = recipes.reduce((s, r) => s + r.reward, 0) / recipes.length
  const avgCookTime = recipes.reduce(
    (s, r) => s + r.steps.reduce((t, step) => t + step.duration, 0), 0
  ) / recipes.length
  const avgPatience = recipes.reduce((s, r) => s + r.patience, 0) / recipes.length

  // Base orders at the slowest spawn rate (no shift progression)
  const baseSpawnTotal = shiftDuration / (BASE_SPAWN_INTERVAL_MS / orderSpawnRate)
  // Maximum orders if spawn rate stayed at the minimum interval the whole shift
  const maxSpawnTotal  = shiftDuration / (MIN_SPAWN_INTERVAL_MS  / orderSpawnRate)

  const effectiveCookTime = avgCookTime / cookingSpeed
  const effectivePatience = avgPatience / orderSpeed
  const completionTime = REACTION_TIME_MS + effectiveCookTime
  const patienceFactor = Math.min(1.0, Math.max(0.15, effectivePatience / (completionTime * 1.5)))

  // Saturation point = the number of parallel work-streams the kitchen offers.
  // Stations have no slot cap, so a single station can host unlimited concurrent
  // cooks — the real limit on useful concurrency is the count of active stations
  // (roughly one productive cook per station). Surplus players past that add only
  // diminishing coordination value, and well past it just accelerate order spawn.
  const enabledStations = getEnabledStations(enabledRecipes)
  const surplusRatio = playerCount / Math.max(1, enabledStations.length)
  const coordinationEfficiency = COORD_FLOOR + COORD_RANGE * Math.min(1.0, surplusRatio)

  // Player surplus drives shift-counter acceleration: more players → serve faster →
  // shift counter ticks up faster → spawn interval tightens toward MIN_SPAWN_INTERVAL_MS.
  // Modelled as a logarithmic blend from base toward max spawn total,
  // reaching full acceleration at surplusRatio ≈ 3 (3× the kitchen's saturation point).
  const spawnAccelFactor = surplusRatio > 1.0
    ? Math.min(1.0, Math.log(surplusRatio) / Math.log(3))
    : 0.0
  const effectiveSpawnTotal = baseSpawnTotal + spawnAccelFactor * (maxSpawnTotal - baseSpawnTotal)

  const theoreticalMax = effectiveSpawnTotal * avgReward * patienceFactor * coordinationEfficiency

  let eventFactor = 1.0
  if (kitchenEventsEnabled) {
    // empty list means all events are active (same convention as useKitchenEvents.ts)
    const activeEvents = enabledKitchenEvents
    const hazardCount = activeEvents.filter(e => HAZARD_TYPES.includes(e)).length
    const oppCount = activeEvents.filter(e => OPP_TYPES.includes(e)).length
    eventFactor = (1.0 - hazardCount * 0.03) * (1.0 + oppCount * 0.02)
  }

  const adjustedMax = theoreticalMax * eventFactor
  const round5 = (n: number) => Math.round(n / 5) * 5
  return [
    round5(adjustedMax * 0.45),
    round5(adjustedMax * 0.70),
    round5(adjustedMax * 0.92),
  ]
}

export function getStarCount(money: number, thresholds: [number, number, number]): number {
  if (money >= thresholds[2]) return 3
  if (money >= thresholds[1]) return 2
  if (money >= thresholds[0]) return 1
  return 0
}
