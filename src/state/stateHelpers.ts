import type { ChatMessage, GameState, PlayerStats } from './types'

export const EMPTY_STATS: PlayerStats = { cooked: 0, served: 0, moneyEarned: 0, extinguished: 0, firesCaused: 0, cooled: 0, eventParticipations: 0, bonusPoints: 0 }

export function addMsg(state: GameState, username: string, text: string, msgType: ChatMessage['type'] = 'normal'): GameState {
  const msg: ChatMessage = { id: state.nextMessageId, username, text, type: msgType }
  const messages = [...state.chatMessages, msg].slice(-200)
  return { ...state, chatMessages: messages, nextMessageId: state.nextMessageId + 1 }
}

export function bumpStat(stats: Record<string, PlayerStats>, user: string, stat: keyof PlayerStats, amount: number): Record<string, PlayerStats> {
  const prev = stats[user] || { ...EMPTY_STATS }
  return { ...stats, [user]: { ...prev, [stat]: prev[stat] + amount } }
}

export function addStat(state: GameState, user: string, stat: keyof PlayerStats, amount: number): GameState {
  return { ...state, playerStats: bumpStat(state.playerStats, user, stat, amount) }
}
