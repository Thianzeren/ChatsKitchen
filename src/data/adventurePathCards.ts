import { PathCard } from '../state/types'
import { isBossShift } from './adventureMode'
import { BOSSES, BossId, getBossPool, pickHealthInspectorStation } from './adventureBosses'

// ── Seeded RNG ────────────────────────────────────────────────────────────────
// Mulberry32 — small, deterministic, no external deps. Keyed off `runSeed + shift`
// so the same run+shift always rolls the same path-card pair if the user re-enters.

function hashStringToSeed(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Card variants ────────────────────────────────────────────────────────────
// Each non-boss shift offers 1 easy variant + 1 risk variant, picked
// deterministically from these pools so different runs get different choices.

interface CardVariant {
  key: string
  label: string
  icon: string
  goalDelta: number
  cashBonus: number
  flavor: string
}

const EASY_VARIANTS: readonly CardVariant[] = [
  { key: 'slow_day',  label: 'Slow Day',        icon: '😴', goalDelta: -0.15, cashBonus: 0,  flavor: 'A breather shift. Lower goal, no reward.' },
  { key: 'steady',    label: 'Steady Service',  icon: '🍵', goalDelta: -0.08, cashBonus: 20, flavor: 'Smaller break on goal — but a small tip on pass.' },
  { key: 'prep_day',  label: 'Prep Day',        icon: '📋', goalDelta: -0.20, cashBonus: 0,  flavor: 'Big goal cut. Save your cash for the Pantry.' },
]

const RISK_VARIANTS: readonly CardVariant[] = [
  { key: 'big_tab',     label: 'Big Tab',       icon: '💰', goalDelta: 0,    cashBonus: 60,  flavor: 'Same goal, cash bonus on pass.' },
  { key: 'high_roller', label: 'High Roller',   icon: '🎲', goalDelta: 0.10, cashBonus: 120, flavor: 'Harder goal — bigger payday on pass.' },
  { key: 'gambit',      label: 'Chef’s Gambit', icon: '🎯', goalDelta: 0.05, cashBonus: 90,  flavor: 'Modest goal hike for a sizeable tip.' },
]

// ── Card generators ──────────────────────────────────────────────────────────

function makeVariantCard(id: string, archetype: 'easy' | 'risk', variant: CardVariant): PathCard {
  return {
    id,
    label: variant.label,
    icon: variant.icon,
    archetype,
    goalDelta: variant.goalDelta,
    modifierIds: [],
    flavor: variant.flavor,
    rewardOnPass: variant.cashBonus > 0 ? { cashBonus: variant.cashBonus } : undefined,
  }
}

function makeBossCard(id: string, bossId: BossId, payload?: PathCard['bossPayload']): PathCard {
  const boss = BOSSES[bossId]
  return {
    id,
    label: boss.name,
    archetype: 'boss',
    goalDelta: 0,    // boss multiplier (×1.5) is already baked into PER_PLAYER_GOALS[S4|S8]
    modifierIds: [],
    bossDebuffId: bossId,
    bossPayload: payload,
  }
}

// ── Pair generator ───────────────────────────────────────────────────────────

export function generatePathPair(
  runSeed: string,
  shift: number,
  enabledRecipes: string[],
): [PathCard, PathCard] {
  const rng = mulberry32(hashStringToSeed(`${runSeed}::path::${shift}`))

  if (isBossShift(shift)) {
    // Pick two distinct bosses from the shift's pool.
    const pool = [...getBossPool()]
    // Shuffle deterministically (Fisher-Yates with the seeded RNG)
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    const [a, b] = pool
    const aPayload = a === 'health_inspector' ? { disabledStationId: pickHealthInspectorStation(enabledRecipes, rng) ?? undefined } : undefined
    const bPayload = b === 'health_inspector' ? { disabledStationId: pickHealthInspectorStation(enabledRecipes, rng) ?? undefined } : undefined
    return [
      makeBossCard(`s${shift}_boss_a`, a, aPayload),
      makeBossCard(`s${shift}_boss_b`, b, bPayload),
    ]
  }

  // Non-boss: pick 1 easy variant + 1 risk variant from the pools, then maybe
  // swap their slot positions so users can't memorise "always !1 = easy".
  const easyVariant = EASY_VARIANTS[Math.floor(rng() * EASY_VARIANTS.length)]
  const riskVariant = RISK_VARIANTS[Math.floor(rng() * RISK_VARIANTS.length)]
  const easy = makeVariantCard(`s${shift}_easy_${easyVariant.key}`, 'easy', easyVariant)
  const risk = makeVariantCard(`s${shift}_risk_${riskVariant.key}`, 'risk', riskVariant)
  const swap = rng() < 0.5
  return swap ? [risk, easy] : [easy, risk]
}
