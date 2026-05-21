import { GameOptions, GameState, OwnedGarnish, ShopOffer, GarnishTier } from '../state/types'

// ── GarnishDef ────────────────────────────────────────────────────────────────

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

// ── Catalog ───────────────────────────────────────────────────────────────────
// Tier shape: 5 common stat-boosts (PR-1, doubled & one-shot) + 1 new triggered
// common (Speed Demon) + 4 triggered/rare/legendary garnishes for the PR-2
// validation slice. Stacking removed: every garnish can be bought at most once.

export const GARNISHES: Record<string, GarnishDef> = {
  // ── Common — stat boosts ──
  quick_hands: {
    id: 'quick_hands',
    name: 'Quick Hands',
    description: '+15% cooking speed.',
    tier: 'common',
    basePrice: 90,
    icon: '⚡',
    effects: [{ field: 'cookingSpeed', value: 0.15, mode: 'mul' }],
  },
  patient_diners: {
    id: 'patient_diners',
    name: 'Patient Diners',
    description: 'Customer patience drains 20% slower.',
    tier: 'common',
    basePrice: 90,
    icon: '🪑',
    // orderSpeed: lower value = orders drain slower (recipe.patience / orderSpeed)
    effects: [{ field: 'orderSpeed', value: -0.20, mode: 'mul' }],
  },
  slow_rush: {
    id: 'slow_rush',
    name: 'Slow Rush',
    description: 'Orders spawn 15% slower.',
    tier: 'common',
    basePrice: 100,
    icon: '🐢',
    effects: [{ field: 'orderSpawnRate', value: -0.15, mode: 'mul' }],
  },
  heat_sink: {
    id: 'heat_sink',
    name: 'Heat Sink',
    description: 'Cooling removes +30 more heat.',
    tier: 'common',
    basePrice: 110,
    icon: '❄️',
    effects: [{ field: 'coolAmountBonus', value: 30, mode: 'add' }],
  },
  tip_jar: {
    id: 'tip_jar',
    name: 'Tip Jar',
    description: '+$8 flat tip on every served dish.',
    tier: 'common',
    basePrice: 110,
    icon: '💵',
    effects: [{ field: 'flatTipPerOrder', value: 8, mode: 'add' }],
  },
  precise_cuts: {
    id: 'precise_cuts',
    name: 'Precise Cuts',
    description: 'Chopping board recipes take 40% less time.',
    tier: 'common',
    basePrice: 120,
    icon: '🔪',
    // 0.6 multiplier (mul-mode at value -0.4 means × (1 - 0.4) = × 0.6)
    effects: [{ field: 'choppingCookTimeMultiplier', value: -0.40, mode: 'mul' }],
  },
  slow_burner: {
    id: 'slow_burner',
    name: 'Slow Burner',
    description: 'Cooking stations heat up 25% slower.',
    tier: 'common',
    basePrice: 100,
    icon: '🌡️',
    effects: [{ field: 'heatPerCookMultiplier', value: -0.25, mode: 'mul' }],
  },
  insulation: {
    id: 'insulation',
    name: 'Insulation',
    description: 'Stations overheat at 110 instead of 100.',
    tier: 'common',
    basePrice: 100,
    icon: '🧱',
    effects: [{ field: 'overheatThresholdDelta', value: 10, mode: 'add' }],
  },
  friendly_faces: {
    id: 'friendly_faces',
    name: 'Friendly Faces',
    description: 'Every new order arrives with +10s of patience.',
    tier: 'common',
    basePrice: 130,
    icon: '🪑',
    effects: [{ field: 'orderPatienceBonus', value: 10_000, mode: 'add' }],
  },

  // ── Common — new triggered ──
  speed_demon: {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Orders served within 20s of spawning earn +25% money.',
    tier: 'common',
    basePrice: 130,
    icon: '💨',
  },
  pressure_tip: {
    id: 'pressure_tip',
    name: 'Pressure Tip',
    description: 'Orders served with under 15% patience left earn +50% money.',
    tier: 'common',
    basePrice: 140,
    icon: '⏳',
  },
  big_tippers: {
    id: 'big_tippers',
    name: 'Big Tippers',
    description: 'The first dish served each shift earns +$30.',
    tier: 'common',
    basePrice: 80,
    icon: '🤑',
  },

  // ── Rare ──
  first_bite: {
    id: 'first_bite',
    name: 'First Bite',
    description: 'The first order served each shift sells for 3× its value.',
    tier: 'rare',
    basePrice: 220,
    icon: '🥢',
  },
  mise_en_place: {
    id: 'mise_en_place',
    name: 'Mise en Place',
    description: 'Start each shift with 5 random prepped ingredients on the tray.',
    tier: 'rare',
    basePrice: 280,
    icon: '🥗',
  },
  bloodhound: {
    id: 'bloodhound',
    name: 'Bloodhound',
    description: 'Each station overheat earns $40 (you still lose the station).',
    tier: 'rare',
    basePrice: 240,
    icon: '🩸',
  },
  combo_plate: {
    id: 'combo_plate',
    name: 'Combo Plate',
    description: 'Serve 3 different recipes within 30s → +$50 bonus.',
    tier: 'rare',
    basePrice: 250,
    icon: '🎴',
  },
  compost_bin: {
    id: 'compost_bin',
    name: 'Compost Bin',
    description: 'Every expired order leaves behind 1 random prepped ingredient.',
    tier: 'rare',
    basePrice: 220,
    icon: '🌱',
  },
  veterans_tip: {
    id: 'veterans_tip',
    name: "Veteran's Tip",
    description: '+$15 to the run bank at the start of every shift after Shift 1.',
    tier: 'rare',
    basePrice: 200,
    icon: '🎖️',
  },
  tea_break: {
    id: 'tea_break',
    name: 'Tea Break',
    description: 'Every 60 seconds, order patience pauses for 5 seconds.',
    tier: 'rare',
    basePrice: 280,
    icon: '☕',
  },

  // ── Legendary ──
  sharp_knives: {
    id: 'sharp_knives',
    name: 'Sharp Knives',
    description: 'Chopping is instant — chopping board recipes finish in 0s.',
    tier: 'legendary',
    basePrice: 480,
    icon: '🔪',
  },
  snowball: {
    id: 'snowball',
    name: 'Snowball',
    description: '+8% cooking speed for every shift survived (Shift 8 = +56%).',
    tier: 'legendary',
    basePrice: 520,
    icon: '⛄',
  },
  doppelganger: {
    id: 'doppelganger',
    name: 'Doppelgänger',
    description: 'Every cooked ingredient has a 20% chance to produce a second copy.',
    tier: 'legendary',
    basePrice: 550,
    icon: '👯',
  },
  glass_kitchen: {
    id: 'glass_kitchen',
    name: 'Glass Kitchen',
    description: 'Stations overheat at 60 instead of 100, but every dish pays +50%.',
    tier: 'legendary',
    basePrice: 460,
    icon: '💎',
    effects: [{ field: 'overheatThresholdDelta', value: -40, mode: 'add' }],
    // +50% money is handled inline in SERVE via activeGarnishes check
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getGarnish(id: string): GarnishDef | null {
  return GARNISHES[id] ?? null
}

export function isOwned(owned: OwnedGarnish[], garnishId: string): boolean {
  return owned.some(g => g.garnishId === garnishId)
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

// Pick up to `count` distinct garnishes the run does not already own.
// PR-3 may refine to 2C + 2R + 1L tier distribution; for now it's a flat shuffle.
export function generateShopOffers(
  owned: OwnedGarnish[],
  shift: number,
  participantCount: number = 1,
  count: number = 4,
): ShopOffer[] {
  const available = Object.values(GARNISHES).filter(g => !isOwned(owned, g.id))
  const shuffled = [...available].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count).map(g => ({
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
