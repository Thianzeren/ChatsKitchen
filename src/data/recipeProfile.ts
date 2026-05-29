import { Recipe, HEAT_EXEMPT_STATIONS } from './recipes'

export type RecipeTag = 'fast' | 'slow' | 'premium' | 'value' | 'prep_heavy' | 'hot_line'

export interface RecipeProfile {
  reward: number            // authored base reward (cafe scale, coupled to complexity)
  prepTimeMs: number        // derived: sum of step durations
  complexity: number        // derived raw score (override does NOT change this)
  complexityPips: 1 | 2 | 3 // bucketed raw score, OR the authored override when set
  stations: string[]        // derived: distinct stations touched
  heatStations: string[]    // derived: stations minus HEAT_EXEMPT_STATIONS
  tags: RecipeTag[]          // derived archetype tags
}

// Band thresholds — calibrated against the retuned catalog so each tag is populated.
const PREP_FAST_MAX_MS = 14000
const PREP_SLOW_MIN_MS = 25000
const REWARD_VALUE_MAX = 9
const REWARD_PREMIUM_MIN = 18

function rawComplexity(recipe: Recipe): number {
  const stepCount = recipe.steps.length
  const chainedSteps = recipe.steps.filter(s => s.requires).length
  const distinctStations = new Set(recipe.steps.map(s => s.station)).size
  return stepCount + 2 * chainedSteps + distinctStations - 2
}

function toPips(raw: number): 1 | 2 | 3 {
  if (raw <= 3) return 1
  if (raw <= 5) return 2
  return 3
}

export function getRecipeProfile(recipe: Recipe): RecipeProfile {
  const prepTimeMs = recipe.steps.reduce((sum, s) => sum + s.duration, 0)
  const stations = [...new Set(recipe.steps.map(s => s.station))]
  const heatStations = stations.filter(s => !HEAT_EXEMPT_STATIONS.has(s))
  const complexity = rawComplexity(recipe)
  const complexityPips = recipe.complexityOverride ?? toPips(complexity)

  const exemptStepCount = recipe.steps.filter(s => HEAT_EXEMPT_STATIONS.has(s.station)).length
  const tags: RecipeTag[] = []
  if (prepTimeMs <= PREP_FAST_MAX_MS) tags.push('fast')
  if (prepTimeMs >= PREP_SLOW_MIN_MS) tags.push('slow')
  if (recipe.reward <= REWARD_VALUE_MAX) tags.push('value')
  if (recipe.reward >= REWARD_PREMIUM_MIN) tags.push('premium')
  if (exemptStepCount * 2 > recipe.steps.length) tags.push('prep_heavy') // prep_heavy: majority of steps on heat-exempt (cold-prep) stations
  if (heatStations.length >= 2) tags.push('hot_line')

  return { reward: recipe.reward, prepTimeMs, complexity, complexityPips, stations, heatStations, tags }
}
