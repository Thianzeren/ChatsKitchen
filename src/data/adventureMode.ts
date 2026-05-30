import { RECIPES, RECIPE_SETS } from './recipes'
import { PlayerStats, CuisineId, AdventureRun, RecipeSet } from '../state/types'

// ── 8-shift run constants ────────────────────────────────────────────────────

export const ADVENTURE_TOTAL_SHIFTS = 8
export const ADVENTURE_BOSS_SHIFTS: readonly number[] = [4, 8]

// Money goal per shift PER PLAYER (1-indexed: PER_PLAYER_GOALS[shift-1]).
// Total shift goal = PER_PLAYER_GOALS[shift-1] × participantCount.
// Cafe scale (sub-project A): dishes are $5–$25. Curve is monotonic; boss
// shifts (4 & 8) are elevated but the curve never dips after them. Bosses now
// apply their own debuffs, so the old ×1.5 boss multiplier is NOT baked in here.
// $/player/min over the 3-min shift: 6.7 → 11.7 → 16.7 → 23.3 → 28.3 → 36.7 → 46.7 → 66.7
export const PER_PLAYER_GOALS: readonly number[] = [
   20,   // S1
   35,   // S2
   50,   // S3
   70,   // S4 (boss)
   85,   // S5
  110,   // S6
  140,   // S7
  200,   // S8 (final boss)
]

// Shift duration is constant across all 8 shifts. Variable duration was tried earlier
// but creates an inverse difficulty curve: longer shifts let players fulfil more orders,
// and missed orders carry no money penalty — so "easier early shifts" really means
// "lower per-minute pressure", which clashes with the goal-driven difficulty ramp.
// Keeping it fixed makes the goal number the single difficulty knob.
export const ADVENTURE_SHIFT_DURATION = 180_000

// ── Goal & duration lookups ──────────────────────────────────────────────────

export function getAdventureGoal(shift: number, participantCount: number = 1): number {
  const idx = Math.min(Math.max(shift, 1), PER_PLAYER_GOALS.length) - 1
  const crew = Math.max(1, participantCount)
  return PER_PLAYER_GOALS[idx] * crew
}

export function isBossShift(shift: number): boolean {
  return ADVENTURE_BOSS_SHIFTS.includes(shift)
}

// ── Cuisine helpers ──────────────────────────────────────────────────────────

const CUISINE_TO_RECIPE_SET_ID: Record<CuisineId, string> = {
  western: 'western_classics',
  chinese: 'chinese',
  japanese: 'japanese',
  korean: 'korean',
  japanese_bakery: 'japanese_bakery',
  sg: 'sg_hawker',
}

export function getCuisineRecipeKeys(cuisine: CuisineId): string[] {
  const setId = CUISINE_TO_RECIPE_SET_ID[cuisine]
  const set = RECIPE_SETS.find(s => s.id === setId)
  return set ? [...set.recipeKeys] : []
}

export function getCuisineRecipeSet(cuisine: CuisineId): RecipeSet | undefined {
  const setId = CUISINE_TO_RECIPE_SET_ID[cuisine]
  return RECIPE_SETS.find(s => s.id === setId)
}

// Rank recipes in a cuisine from easiest to hardest by total cooking duration.
// Used to pick a forgiving starter for shift 1.
function rankRecipesByEase(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const aTotal = RECIPES[a]?.steps.reduce((sum, s) => sum + s.duration, 0) ?? 0
    const bTotal = RECIPES[b]?.steps.reduce((sum, s) => sum + s.duration, 0) ?? 0
    return aTotal - bTotal
  })
}

export function pickStartingRecipe(cuisine: CuisineId): string {
  const ranked = rankRecipesByEase(getCuisineRecipeKeys(cuisine))
  // Pick from the easier half so S1 always gets a forgiving dish.
  const easyHalf = ranked.slice(0, Math.max(1, Math.ceil(ranked.length / 2)))
  return easyHalf[Math.floor(Math.random() * easyHalf.length)] ?? ranked[0]
}

// Picks one recipe from the run's starting cuisine that the run does NOT yet own.
// Returns null when every recipe in the cuisine has been unlocked.
export function pickAutoUnlockRecipe(run: AdventureRun): string | null {
  const pool = getCuisineRecipeKeys(run.startCuisine).filter(k => !run.unlockedRecipes.includes(k))
  if (pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

// PR-1 fallback when no CuisinePick screen has run yet — pick a random cuisine for the run.
export function pickRandomCuisine(): CuisineId {
  const cuisines: CuisineId[] = ['western', 'chinese', 'japanese', 'korean', 'japanese_bakery', 'sg']
  return cuisines[Math.floor(Math.random() * cuisines.length)]
}

export function makeRunSeed(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// ── Player-stats merge (unchanged) ───────────────────────────────────────────

export function mergePlayerStats(
  base: Record<string, PlayerStats>,
  incoming: Record<string, PlayerStats>
): Record<string, PlayerStats> {
  const result = { ...base }
  for (const [user, s] of Object.entries(incoming)) {
    const e = result[user] ?? {
      cooked: 0, served: 0,
      moneyEarned: 0, extinguished: 0, firesCaused: 0,
      cooled: 0, eventParticipations: 0, bonusPoints: 0,
    }
    result[user] = {
      cooked:              e.cooked              + s.cooked,
      served:              e.served              + s.served,
      moneyEarned:         e.moneyEarned         + s.moneyEarned,
      extinguished:        e.extinguished        + s.extinguished,
      firesCaused:         e.firesCaused         + s.firesCaused,
      cooled:              e.cooled              + s.cooled,
      eventParticipations: e.eventParticipations + s.eventParticipations,
      bonusPoints:         e.bonusPoints         + s.bonusPoints,
    }
  }
  return result
}
