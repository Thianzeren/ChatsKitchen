// Test-only fixture helpers. They hide how prepared-item pools are stored so
// tests describe behaviour ("alice's chopped lettuce is in the red pool"), not
// the storage shape.
import type { GameState } from './types'

export type TestPool = 'shared' | 'red' | 'blue'

export function poolItems(s: GameState, pool: TestPool = 'shared'): string[] {
  return s.preparedPools[pool].map(p => p.item)
}

export function poolSources(s: GameState, pool: TestPool = 'shared'): string[] {
  return s.preparedPools[pool].map(p => p.source)
}

/** Replace one pool. `sources` defaults to '' (no cook) for every item. */
export function withPool(s: GameState, pool: TestPool, items: string[], sources: string[] = items.map(() => '')): GameState {
  return { ...s, preparedPools: { ...s.preparedPools, [pool]: items.map((item, i) => ({ item, source: sources[i] })) } }
}
