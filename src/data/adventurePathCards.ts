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

// ── Card generators ──────────────────────────────────────────────────────────

function makeEasyCard(id: string): PathCard {
  return {
    id,
    label: 'Slow Day',
    archetype: 'easy',
    goalDelta: -0.15,
    modifierIds: [],
  }
}

function makeRiskCard(id: string): PathCard {
  return {
    id,
    label: 'Big Tab',
    archetype: 'risk',
    goalDelta: 0,
    modifierIds: [],
    rewardOnPass: { cashBonus: 60 },
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

  // Non-boss: always offer Easy vs Risk for a clear "play safe vs gamble" choice.
  // Swap order half the time so the user can't memorise card positions.
  const swap = rng() < 0.5
  const easy = makeEasyCard(`s${shift}_easy`)
  const risk = makeRiskCard(`s${shift}_risk`)
  return swap ? [risk, easy] : [easy, risk]
}
