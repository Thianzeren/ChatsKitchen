export interface RoomPlayer {
  id: string
  nickname: string
  disconnected?: boolean
}

export function connectedNicknames(players: RoomPlayer[]): string[] {
  return players.filter(p => !p.disconnected).map(p => p.nickname)
}

export function unassignedPool(players: RoomPlayer[], red: string[], blue: string[]): string[] {
  const teamed = new Set([...red, ...blue])
  return connectedNicknames(players).filter(n => !teamed.has(n))
}

// Reconcile the Adventure lobby with the connected phone roster WITHOUT discarding
// Twitch co-players who joined via !join. Phone players are mirrored from `players`;
// Twitch members are any existing lobby entries not sourced from a phone. We keep
// Twitch members + currently-connected phones, drop disconnected phones, and append
// newly-connected phones. The local host ("You") is never part of the roster.
// Order-preserving and idempotent (re-applying to its own output is a no-op).
export function mergeAdventureRoster(lobby: string[], players: RoomPlayer[]): string[] {
  const phoneNames = new Set(players.map(p => p.nickname))
  const phoneConnected = connectedNicknames(players).filter(n => n !== 'You')
  const phoneConnectedSet = new Set(phoneConnected)
  // Keep existing members still valid: Twitch joiners (not phone-sourced) or connected phones.
  const kept = lobby.filter(u => u !== 'You' && (!phoneNames.has(u) || phoneConnectedSet.has(u)))
  const keptSet = new Set(kept)
  // Append phones that connected since the last reconcile.
  const added = phoneConnected.filter(n => !keptSet.has(n))
  return [...kept, ...added]
}
