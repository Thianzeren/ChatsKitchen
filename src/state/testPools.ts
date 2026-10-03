// Test-only fixture helpers. They hide how prepared-item pools are stored so
// tests describe behaviour ("alice's chopped lettuce is in the red pool"), not
// the storage shape.
import type { GameState } from './types'

export type TestPool = 'shared' | 'red' | 'blue'

export function poolItems(s: GameState, pool: TestPool = 'shared'): string[] {
  if (pool === 'shared') return s.preparedItems
  return (pool === 'red' ? s.redPreparedItems : s.bluePreparedItems) ?? []
}

export function poolSources(s: GameState, pool: TestPool = 'shared'): string[] {
  if (pool === 'shared') return s.preparedItemSources
  return (pool === 'red' ? s.redPreparedItemSources : s.bluePreparedItemSources) ?? []
}

/** Replace one pool. `sources` defaults to '' (no cook) for every item. */
export function withPool(s: GameState, pool: TestPool, items: string[], sources: string[] = items.map(() => '')): GameState {
  if (pool === 'shared') return { ...s, preparedItems: items, preparedItemSources: sources }
  if (pool === 'red') return { ...s, redPreparedItems: items, redPreparedItemSources: sources }
  return { ...s, bluePreparedItems: items, bluePreparedItemSources: sources }
}
