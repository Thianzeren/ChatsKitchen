import { Recipe, RECIPES, HEAT_EXEMPT_STATIONS } from './recipes'

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
const REWARD_VALUE_MAX = 9      // top of the ●○○ reward band — `value` aligns with cheap/simple dishes
const REWARD_PREMIUM_MIN = 19   // floor of the ●●● reward band — `premium` aligns with expensive/complex dishes

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

// ── Player-facing archetype metadata ─────────────────────────────────────────
// Labels mirror the garnish copy ("Premium dishes…", "Hot-line dishes…") so the
// synergy reads at a glance. Two icons intentionally echo existing garnishes
// (🪙 ↔ Penny Pincher, 🌶️ ↔ Fire Whisperer).
export const TAG_META: Record<RecipeTag, { label: string; icon: string; color: string }> = {
  premium:    { label: 'Premium',    icon: '💎', color: '#d4af37' },
  value:      { label: 'Value',      icon: '🪙', color: '#c08a3e' },
  fast:       { label: 'Fast',       icon: '⚡', color: '#e0a52b' },
  slow:       { label: 'Slow',       icon: '🐢', color: '#5a8bb0' },
  prep_heavy: { label: 'Prep-Heavy', icon: '🧊', color: '#3f9e92' },
  hot_line:   { label: 'Hot Line',   icon: '🌶️', color: '#d94f4f' },
}

// Fixed display order for stable chip layout across every surface.
export const TAG_ORDER: RecipeTag[] = ['premium', 'value', 'fast', 'slow', 'prep_heavy', 'hot_line']

// Re-order a recipe's derived tags into the canonical display order.
export function orderedTags(tags: RecipeTag[]): RecipeTag[] {
  return TAG_ORDER.filter(t => tags.includes(t))
}

// Aggregate archetype tag counts across a set of recipe keys (the active menu).
export function getMenuTagCounts(recipeKeys: string[]): Map<RecipeTag, number> {
  const counts = new Map<RecipeTag, number>()
  for (const key of recipeKeys) {
    const recipe = RECIPES[key]
    if (!recipe) continue
    for (const tag of getRecipeProfile(recipe).tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return counts
}
