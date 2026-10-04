// Pure operations on prepared-ingredient pools. Every pool change goes through
// here so an ingredient and the player who cooked it always move together.
import type { GameState, PoolId, PreparedItem, PreparedPools } from './types'

/** Source recorded for items no player cooked (kitchen events, Mise en Place). */
export const NO_SOURCE = ''

export function emptyPools(): PreparedPools {
  return { shared: [], red: [], blue: [] }
}

/** The pool a user's cooking feeds and their serving draws from: 'shared' in co-op,
 *  their team's pool in PvP, or null for a PvP player with no team (items are dropped). */
export function poolIdFor(state: Pick<GameState, 'teams'>, user: string): PoolId | null {
  if (!state.teams) return 'shared'
  return state.teams[user] ?? null
}

export function getUserPool(state: GameState, user: string): PreparedItem[] {
  const id = poolIdFor(state, user)
  return id ? state.preparedPools[id] : []
}

export function setUserPool(state: GameState, user: string, pool: PreparedItem[]): GameState {
  const id = poolIdFor(state, user)
  return id ? { ...state, preparedPools: { ...state.preparedPools, [id]: pool } } : state
}

export function addItems(pool: PreparedItem[], items: string[], source: string): PreparedItem[] {
  return [...pool, ...items.map(item => ({ item, source }))]
}

export type TakeResult =
  | { ok: true; remaining: PreparedItem[]; taken: PreparedItem[] }
  | { ok: false; missing: string }

/** Remove one of each requested item, taking the oldest copy first. All-or-nothing. */
export function takeItems(pool: PreparedItem[], items: string[]): TakeResult {
  const remaining = [...pool]
  const taken: PreparedItem[] = []
  for (const item of items) {
    const idx = remaining.findIndex(p => p.item === item)
    if (idx === -1) return { ok: false, missing: item }
    taken.push(...remaining.splice(idx, 1))
  }
  return { ok: true, remaining, taken }
}

export function removeRandom(pool: PreparedItem[], count: number, random: () => number = Math.random): PreparedItem[] {
  const remaining = [...pool]
  const n = Math.min(count, remaining.length)
  for (let i = 0; i < n; i++) remaining.splice(Math.floor(random() * remaining.length), 1)
  return remaining
}

export function itemNames(pool: PreparedItem[]): string[] {
  return pool.map(p => p.item)
}
