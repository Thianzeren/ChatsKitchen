import { useState, useCallback } from 'react'
import { ConnectionMethod, methodToChatMode, isConnectionReady, ChatMode } from '../state/connection'
import { TwitchStatus } from './useTwitchChat'

interface Args {
  setChatMode: (m: ChatMode) => void
  enterRoom: () => void   // unlock joins + create/keep room (App provides; calls roomRef)
  closeRoom: () => void   // tear down room (App provides)
}

export function useConnection({ setChatMode, enterRoom, closeRoom }: Args) {
  const [method, setMethod] = useState<ConnectionMethod | null>(null)

  const chooseTwitch = useCallback(() => {
    setMethod('twitch'); setChatMode(methodToChatMode('twitch'))
  }, [setChatMode])

  const chooseLocalPlay = useCallback(() => {
    setMethod('local'); setChatMode(methodToChatMode('local')); enterRoom()
  }, [setChatMode, enterRoom])

  const chooseSolo = useCallback(() => {
    setMethod('solo'); setChatMode(methodToChatMode('solo'))
  }, [setChatMode])

  const changeConnection = useCallback(() => {
    closeRoom(); setChatMode('local'); setMethod(null)
  }, [setChatMode, closeRoom])

  const ready = useCallback(
    (twitchStatus: TwitchStatus, roomCode: string | null) => isConnectionReady(method, twitchStatus, roomCode),
    [method],
  )

  return { method, chooseTwitch, chooseLocalPlay, chooseSolo, changeConnection, ready }
}
