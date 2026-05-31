import type { Screen } from './types'

export type RoomCommandTarget = 'pvpLobby' | 'adventureLobby' | 'adventureVote' | 'game'

export function classifyRoomCommand(screen: Screen): RoomCommandTarget {
  if (screen === 'pvplobby') return 'pvpLobby'
  if (screen === 'adventurelobby') return 'adventureLobby'
  if (screen === 'adventurepantryshop' || screen === 'adventurerecipepick') return 'adventureVote'
  return 'game'
}
