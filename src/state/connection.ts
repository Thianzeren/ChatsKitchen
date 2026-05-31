import type { TwitchStatus } from '../hooks/useTwitchChat'

// Connection method = how players join. 'local' means the phone-controller room.
export type ConnectionMethod = 'twitch' | 'local' | 'solo'

// chatMode is App's existing source of truth: 'twitch' | 'room' | 'local'.
export type ChatMode = 'local' | 'twitch' | 'room'

export function methodToChatMode(method: ConnectionMethod): ChatMode {
  switch (method) {
    case 'twitch': return 'twitch'
    case 'local':  return 'room'
    case 'solo':   return 'local'
  }
}

export function isConnectionReady(
  method: ConnectionMethod | null,
  twitchStatus: TwitchStatus,
  roomCode: string | null,
): boolean {
  if (method === null) return false
  if (method === 'twitch') return twitchStatus === 'connected'
  if (method === 'local')  return roomCode != null
  return true // solo
}
