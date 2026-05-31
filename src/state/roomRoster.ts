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
