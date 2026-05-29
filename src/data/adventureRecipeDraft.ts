import { RECIPES } from './recipes'
import { hashStringToSeed, mulberry32 } from './seededRng'

// Roll up to 3 recipe keys for a Recipe Pick, drawn from the whole catalog
// minus the recipes already on the run's menu. Seeded by runSeed+shift so a
// given run always rolls the same offers (deterministic, re-enterable).
export function generateRecipeOffers(
  runSeed: string,
  shift: number,
  ownedRecipes: string[],
  count = 3,
): string[] {
  const owned = new Set(ownedRecipes)
  const pool = Object.keys(RECIPES).filter(k => !owned.has(k))
  const rng = mulberry32(hashStringToSeed(`${runSeed}::recipe::${shift}`))
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}
