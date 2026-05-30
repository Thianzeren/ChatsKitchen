import { GameOptions, GameState, OwnedGarnish, ShopOffer, GarnishTier } from '../state/types'
import { RecipeTag, RecipeProfile } from './recipeProfile'
import { hashStringToSeed, mulberry32 } from './seededRng'

// ── GarnishDef ────────────────────────────────────────────────────────────────

export interface ServeTrigger {
  requiresTag?: RecipeTag        // served dish must carry this archetype tag
  servedWithinMs?: number        // elapsed since the order spawned must be below this
  rewardMultiplier?: number      // multiplicative on base reward (scale-independent)
  flatBonus?: number             // cafe-scaled $ added after multipliers
}

export interface GarnishDef {
  id: string
  name: string
  description: string
  tier: GarnishTier
  basePrice: number
  icon: string
  // Stat-boost effects, applied at shift RESET time. Optional — triggered garnishes
  // (First Bite, Bloodhound, etc.) have empty effects and are handled by ID at runtime.
  effects?: GarnishEffect[]
  serveTrigger?: ServeTrigger
}

export interface GarnishEffect {
  field: GarnishField
  value: number
  // mode: 'add' means baseValue + value; 'mul' means baseValue * (1 + value)
  mode: 'add' | 'mul'
}

export type GarnishField =
  | 'cookingSpeed'
  | 'orderSpeed'
  | 'orderSpawnRate'
  | 'coolAmountBonus'
  | 'heatPerCookMultiplier'
  | 'choppingCookTimeMultiplier'    // Precise Cuts — multiplies chop-board cook time (0.6 = 40% faster)
  | 'flatTipPerOrder'
  | 'orderPatienceBonus'   // Friendly Faces — +ms to each new order's patienceMax/patienceLeft
  | 'overheatThresholdDelta'   // Insulation +10, Glass Kitchen -40 (additive to base 100)
  // ── Sub-project C — content variety ──
  | 'heatDecayAboveThreshold'   // Loose Lid — heat above this threshold dissipates
  | 'heatDecayRate'              // Loose Lid — heat points per second dissipated

// ── Catalog ───────────────────────────────────────────────────────────────────
// Tier shape: 5 common stat-boosts (PR-1, doubled & one-shot) + 1 new triggered
// common (Speed Demon) + 4 triggered/rare/legendary garnishes for the PR-2
// validation slice. Stacking removed: every garnish can be bought at most once.

export const GARNISHES: Record<string, GarnishDef> = {
  // ── 🟡 Premium ──
  fine_dining:   { id: 'fine_dining',   name: 'Fine Dining',   description: 'Premium dishes earn +25%.',                 tier: 'common',    basePrice: 30,  icon: '🍽️', serveTrigger: { requiresTag: 'premium', rewardMultiplier: 1.25 } },
  first_bite:    { id: 'first_bite',    name: 'First Bite',    description: 'The first dish served each shift sells for 3× its value.', tier: 'rare', basePrice: 55, icon: '🥢' },
  michelin_star: { id: 'michelin_star', name: 'Michelin Star', description: 'Premium dishes earn +75%.',                 tier: 'legendary', basePrice: 110, icon: '⭐', serveTrigger: { requiresTag: 'premium', rewardMultiplier: 1.75 } },

  // ── 🟢 Value ──
  penny_pincher: { id: 'penny_pincher', name: 'Penny Pincher', description: 'Value dishes earn +$3.',  tier: 'common',    basePrice: 25, icon: '🪙', serveTrigger: { requiresTag: 'value', flatBonus: 3 } },
  value_meal:    { id: 'value_meal',    name: 'Value Meal',    description: 'Value dishes earn +50%.', tier: 'rare',      basePrice: 50, icon: '🍟', serveTrigger: { requiresTag: 'value', rewardMultiplier: 1.5 } },
  dollar_menu:   { id: 'dollar_menu',   name: 'Dollar Menu',   description: 'Value dishes earn +$8.',  tier: 'legendary', basePrice: 95, icon: '💵', serveTrigger: { requiresTag: 'value', flatBonus: 8 } },

  // ── 💨 Fast ──
  quick_bite:    { id: 'quick_bite',    name: 'Quick Bite',    description: 'Any dish served within 15s of the order earns +20%.', tier: 'common', basePrice: 30, icon: '💨', serveTrigger: { servedWithinMs: 15000, rewardMultiplier: 1.2 } },
  drive_thru:    { id: 'drive_thru',    name: 'Drive-Thru',    description: 'Fast dishes earn +35%.', tier: 'rare', basePrice: 55, icon: '🚗', serveTrigger: { requiresTag: 'fast', rewardMultiplier: 1.35 } },
  time_is_money: { id: 'time_is_money', name: 'Time Is Money', description: 'Dishes earn up to +50% more, scaled by patience left when served.', tier: 'legendary', basePrice: 100, icon: '⏱️' },

  // ── 🐢 Slow ──
  low_and_slow:   { id: 'low_and_slow',   name: 'Low & Slow',     description: 'Slow dishes earn +$5.',  tier: 'common',    basePrice: 30,  icon: '🍲', serveTrigger: { requiresTag: 'slow', flatBonus: 5 } },
  slow_cooked:    { id: 'slow_cooked',    name: 'Slow-Cooked',    description: 'Slow dishes earn +50%.', tier: 'rare',      basePrice: 60,  icon: '🔥', serveTrigger: { requiresTag: 'slow', rewardMultiplier: 1.5 } },
  worth_the_wait: { id: 'worth_the_wait', name: 'Worth the Wait', description: 'Slow dishes earn 2×.',   tier: 'legendary', basePrice: 115, icon: '⏳', serveTrigger: { requiresTag: 'slow', rewardMultiplier: 2 } },

  // ── 🔪 Prep-Heavy ──
  cold_kitchen:  { id: 'cold_kitchen',  name: 'Cold Kitchen',  description: 'Prep-heavy dishes earn +$4.',                 tier: 'common',    basePrice: 30,  icon: '🥗', serveTrigger: { requiresTag: 'prep_heavy', flatBonus: 4 } },
  mise_en_place: { id: 'mise_en_place', name: 'Mise en Place', description: 'Start each shift with 5 random prepped ingredients.', tier: 'rare', basePrice: 65, icon: '🥪' },
  sharp_knives:  { id: 'sharp_knives',  name: 'Sharp Knives',  description: 'Chopping is instant — chopping-board recipes finish in 0s.', tier: 'legendary', basePrice: 120, icon: '🔪', effects: [{ field: 'choppingCookTimeMultiplier', value: -1, mode: 'mul' }] },

  // ── 🔥 Hot-Line ──
  fire_whisperer: { id: 'fire_whisperer', name: 'Fire Whisperer', description: 'Hot-line dishes earn +30%.', tier: 'common', basePrice: 30, icon: '🌶️', serveTrigger: { requiresTag: 'hot_line', rewardMultiplier: 1.3 } },
  bloodhound:     { id: 'bloodhound',     name: 'Bloodhound',     description: 'Each station overheat earns $12 (you still lose the station).', tier: 'rare', basePrice: 55, icon: '🩸' },
  glass_kitchen:  { id: 'glass_kitchen',  name: 'Glass Kitchen',  description: 'Stations overheat at 60 instead of 100, but every dish pays +50%.', tier: 'legendary', basePrice: 110, icon: '💎', effects: [{ field: 'overheatThresholdDelta', value: -40, mode: 'add' }], serveTrigger: { rewardMultiplier: 1.5 } },

  // ── ⚪ Neutrals ──
  quick_hands:    { id: 'quick_hands',    name: 'Quick Hands',    description: '+15% cooking speed.',                tier: 'common',    basePrice: 30,  icon: '⚡', effects: [{ field: 'cookingSpeed', value: 0.15, mode: 'mul' }] },
  patient_diners: { id: 'patient_diners', name: 'Patient Diners', description: 'Customer patience drains 20% slower.', tier: 'common',   basePrice: 30,  icon: '🪑', effects: [{ field: 'orderSpeed', value: -0.20, mode: 'mul' }] },
  tip_jar:        { id: 'tip_jar',        name: 'Tip Jar',        description: '+$2 flat tip on every served dish.', tier: 'common',    basePrice: 25,  icon: '💵', effects: [{ field: 'flatTipPerOrder', value: 2, mode: 'add' }] },
  heat_sink:      { id: 'heat_sink',      name: 'Heat Sink',      description: 'Cooling removes +30 more heat.',     tier: 'common',    basePrice: 30,  icon: '❄️', effects: [{ field: 'coolAmountBonus', value: 30, mode: 'add' }] },
  snowball:       { id: 'snowball',       name: 'Snowball',       description: '+8% cooking speed for every shift survived.', tier: 'legendary', basePrice: 120, icon: '⛄' },
  doppelganger:   { id: 'doppelganger',   name: 'Doppelgänger',   description: 'Every cooked ingredient has a 20% chance to produce a second copy.', tier: 'legendary', basePrice: 125, icon: '👯' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getGarnish(id: string): GarnishDef | null {
  return GARNISHES[id] ?? null
}

export function isOwned(owned: OwnedGarnish[], garnishId: string): boolean {
  return owned.some(g => g.garnishId === garnishId)
}

export interface ServeTriggerContext {
  elapsedSinceSpawn: number
}

// Resolve all tag/timing-gated on-serve garnish effects for a served dish.
// Multipliers multiply together; flat bonuses add. Garnishes without a
// serveTrigger (stat or bespoke ones) are skipped.
export function applyServeTriggers(
  activeIds: string[],
  profile: RecipeProfile,
  ctx: ServeTriggerContext,
): { multiplier: number; flatBonus: number } {
  let multiplier = 1
  let flatBonus = 0
  for (const id of activeIds) {
    const t = GARNISHES[id]?.serveTrigger
    if (!t) continue
    if (t.requiresTag && !profile.tags.includes(t.requiresTag)) continue
    if (t.servedWithinMs !== undefined && !(ctx.elapsedSinceSpawn < t.servedWithinMs)) continue
    if (t.rewardMultiplier !== undefined) multiplier *= t.rewardMultiplier
    if (t.flatBonus !== undefined) flatBonus += t.flatBonus
  }
  return { multiplier, flatBonus }
}

// Price scales with shift (+15%/shift past 1) and linearly with participant count.
// participantCount of 1 = baseline; larger crews face proportionally higher prices,
// matching the goal scaling so "shifts of team earnings to afford X" stays constant.
export function getGarnishPrice(garnishId: string, shift: number, participantCount: number = 1): number {
  const garnish = GARNISHES[garnishId]
  if (!garnish) return 0
  const crew = Math.max(1, participantCount)
  const scaled = garnish.basePrice * (1 + 0.15 * Math.max(0, shift - 1)) * crew
  return Math.round(scaled / 5) * 5
}

// ── Shop offer generation ────────────────────────────────────────────────────

type Tier = 'common' | 'rare' | 'legendary'

// Tier weights by the UPCOMING shift (the shop runs after shift N, for shift N+1).
// Rises across the run; boss shops (4 & 8) spike rare/legendary so chat can gear up.
const TIER_WEIGHTS: Record<number, [number, number, number]> = {
  // [common, rare, legendary]
  2: [80, 18, 2],
  3: [70, 25, 5],
  4: [50, 35, 15],   // boss
  5: [60, 30, 10],
  6: [50, 35, 15],
  7: [40, 40, 20],
  8: [30, 40, 30],   // boss
}

function rollTier(rng: () => number, shift: number): Tier {
  const w = TIER_WEIGHTS[Math.min(8, Math.max(2, shift))] ?? [70, 25, 5]
  const total = w[0] + w[1] + w[2]
  const r = rng() * total
  if (r < w[0]) return 'common'
  if (r < w[0] + w[1]) return 'rare'
  return 'legendary'
}

// Roll `count` distinct un-owned garnishes, tier-weighted by the upcoming shift,
// seeded by runSeed+shift for determinism. Falls back across tiers when a tier is
// exhausted of un-owned garnishes.
export function generateShopOffers(
  runSeed: string,
  owned: OwnedGarnish[],
  shift: number,
  participantCount: number = 1,
  count: number = 4,
): ShopOffer[] {
  const rng = mulberry32(hashStringToSeed(`${runSeed}::shop::${shift}`))
  const available = Object.values(GARNISHES).filter(g => !isOwned(owned, g.id))
  const byTier: Record<Tier, GarnishDef[]> = { common: [], rare: [], legendary: [] }
  for (const g of available) byTier[g.tier].push(g)

  const chosen: GarnishDef[] = []
  const tierFallback: Record<Tier, Tier[]> = {
    common:    ['common', 'rare', 'legendary'],
    rare:      ['rare', 'common', 'legendary'],
    legendary: ['legendary', 'rare', 'common'],
  }
  for (let i = 0; i < count && chosen.length < available.length; i++) {
    const wanted = rollTier(rng, shift)
    let pick: GarnishDef | undefined
    for (const tier of tierFallback[wanted]) {
      const pool = byTier[tier].filter(g => !chosen.includes(g))
      if (pool.length > 0) { pick = pool[Math.floor(rng() * pool.length)]; break }
    }
    if (pick) chosen.push(pick)
  }

  return chosen.map(g => ({
    garnishId: g.id,
    price: getGarnishPrice(g.id, shift, participantCount),
    rarity: g.tier,
  }))
}

// ── applyAllGarnishes ────────────────────────────────────────────────────────

const CLAMP_COOKING_SPEED: [number, number] = [0.5, 4.0]   // raised cap — let stacks break the game
const CLAMP_ORDER_SPEED: [number, number] = [0.3, 2.0]
const CLAMP_ORDER_SPAWN: [number, number] = [0.3, 2.0]

function clamp(v: number, [lo, hi]: [number, number]): number {
  return Math.max(lo, Math.min(hi, v))
}

const OVERHEAT_THRESHOLD_BASE = 100

interface GarnishDelta {
  options: Partial<GameOptions>
  state: Partial<GameState>
}

// Compose all owned garnishes on top of base options/state.
// `currentShift` is read by scaling garnishes (Snowball: +8% cooking speed per shift survived).
export function applyAllGarnishes(
  owned: OwnedGarnish[],
  baseOptions: Pick<GameOptions, 'cookingSpeed' | 'orderSpeed' | 'orderSpawnRate'>,
  currentShift: number = 1,
): GarnishDelta {
  let cookingMul = 1
  let orderSpeedMul = 1
  let orderSpawnMul = 1
  let coolAmountBonus = 0
  let heatPerCookMul = 1
  let choppingCookTimeMul = 1
  let flatTipPerOrder = 0
  let orderPatienceBonus = 0
  let overheatThreshold = OVERHEAT_THRESHOLD_BASE
  let heatDecayAboveThreshold: number | undefined = undefined
  let heatDecayRate: number | undefined = undefined

  // Stat-effect aggregation
  for (const entry of owned) {
    const garnish = GARNISHES[entry.garnishId]
    if (!garnish || !garnish.effects) continue
    for (const effect of garnish.effects) {
      switch (effect.field) {
        case 'cookingSpeed':
          if (effect.mode === 'mul') cookingMul *= 1 + effect.value
          else cookingMul += effect.value
          break
        case 'orderSpeed':
          if (effect.mode === 'mul') orderSpeedMul *= 1 + effect.value
          else orderSpeedMul += effect.value
          break
        case 'orderSpawnRate':
          if (effect.mode === 'mul') orderSpawnMul *= 1 + effect.value
          else orderSpawnMul += effect.value
          break
        case 'coolAmountBonus':
          coolAmountBonus += effect.value
          break
        case 'heatPerCookMultiplier':
          if (effect.mode === 'mul') heatPerCookMul *= 1 + effect.value
          else heatPerCookMul += effect.value
          break
        case 'choppingCookTimeMultiplier':
          if (effect.mode === 'mul') choppingCookTimeMul *= 1 + effect.value
          else choppingCookTimeMul += effect.value
          break
        case 'flatTipPerOrder':
          flatTipPerOrder += effect.value
          break
        case 'orderPatienceBonus':
          orderPatienceBonus += effect.value
          break
        case 'overheatThresholdDelta':
          overheatThreshold += effect.value
          break
        case 'heatDecayAboveThreshold':
          heatDecayAboveThreshold = effect.value
          break
        case 'heatDecayRate':
          heatDecayRate = effect.value
          break
      }
    }
  }

  // Snowball — applied here so cooking speed compounds with Quick Hands etc.
  if (isOwned(owned, 'snowball')) {
    const shiftsSurvived = Math.max(0, currentShift - 1)
    cookingMul *= 1 + 0.08 * shiftsSurvived
  }

  void orderPatienceBonus  // Friendly Faces field reserved; not used by any garnish in this PR

  return {
    options: {
      cookingSpeed:   clamp(baseOptions.cookingSpeed   * cookingMul,    CLAMP_COOKING_SPEED),
      orderSpeed:     clamp(baseOptions.orderSpeed     * orderSpeedMul, CLAMP_ORDER_SPEED),
      orderSpawnRate: clamp(baseOptions.orderSpawnRate * orderSpawnMul, CLAMP_ORDER_SPAWN),
    },
    state: {
      coolAmountBonus:            coolAmountBonus       === 0 ? undefined : coolAmountBonus,
      heatPerCookMultiplier:      heatPerCookMul        === 1 ? undefined : heatPerCookMul,
      choppingCookTimeMultiplier: choppingCookTimeMul   === 1 ? undefined : choppingCookTimeMul,
      flatTipPerOrder:            flatTipPerOrder       === 0 ? undefined : flatTipPerOrder,
      orderPatienceBonus:         orderPatienceBonus    === 0 ? undefined : orderPatienceBonus,
      overheatThreshold:          overheatThreshold     === OVERHEAT_THRESHOLD_BASE ? undefined : overheatThreshold,
      heatDecayAboveThreshold,
      heatDecayRate,
    },
  }
}

// Add an acquired garnish to the list. Each garnish is one-shot — duplicates are ignored.
export function addOwnedGarnish(owned: OwnedGarnish[], garnishId: string, shift: number): OwnedGarnish[] {
  if (isOwned(owned, garnishId)) return owned
  return [...owned, { garnishId, acquiredOnShift: shift }]
}

// ── Mise en Place ingredient seeding ─────────────────────────────────────────

// Pick `count` random `produces` values from the enabled recipes' steps.
// Used to seed `state.preparedItems` when Mise en Place is owned, at shift RESET.
export function pickMiseEnPlaceIngredients(
  enabledRecipes: string[],
  recipes: Record<string, { steps: { produces: string }[] }>,
  count: number,
): string[] {
  const pool: string[] = []
  for (const key of enabledRecipes) {
    const recipe = recipes[key]
    if (!recipe) continue
    for (const step of recipe.steps) {
      pool.push(step.produces)
    }
  }
  if (pool.length === 0) return []
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    out.push(pool[Math.floor(Math.random() * pool.length)])
  }
  return out
}
