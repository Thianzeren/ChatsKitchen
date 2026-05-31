import { describe, it, expect } from 'vitest'
import { classifyRoomCommand } from './roomCommandRouting'

describe('classifyRoomCommand', () => {
  it('routes pvp lobby', () => expect(classifyRoomCommand('pvplobby')).toBe('pvpLobby'))
  it('routes adventure lobby', () => expect(classifyRoomCommand('adventurelobby')).toBe('adventureLobby'))
  it('routes adventure vote screens', () => {
    expect(classifyRoomCommand('adventurerecipepick')).toBe('adventureVote')
    expect(classifyRoomCommand('adventurepantryshop')).toBe('adventureVote')
  })
  it('routes everything else to game', () => {
    expect(classifyRoomCommand('playing')).toBe('game')
    expect(classifyRoomCommand('modehub')).toBe('game')
  })
})
