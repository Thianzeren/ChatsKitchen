import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import type { SharedSnapshot, PartialPlayerView } from '../shared/protocol'
import { RELAY_URL } from '../shared/config'

interface Args {
  enabled: boolean
  onPlayerCommand: (nickname: string, command: string) => void
  onPlayerJoined: (playerId: string, nickname: string) => void
  onPlayerLeft: (playerId: string) => void
}

export function useRoomHost({ enabled, onPlayerCommand, onPlayerJoined, onPlayerLeft }: Args) {
  const [code, setCode] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const codeRef = useRef<string | null>(null)

  const onPlayerCommandRef = useRef(onPlayerCommand)
  const onPlayerJoinedRef = useRef(onPlayerJoined)
  const onPlayerLeftRef = useRef(onPlayerLeft)
  onPlayerCommandRef.current = onPlayerCommand
  onPlayerJoinedRef.current = onPlayerJoined
  onPlayerLeftRef.current = onPlayerLeft

  useEffect(() => {
    if (!enabled) return
    const s = io(RELAY_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = s

    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))

    s.emit('host:create', {}, ({ code }: { code: string }) => {
      setCode(code)
      codeRef.current = code
    })

    s.on('room:player_joined', (e: { playerId: string; nickname: string }) => {
      onPlayerJoinedRef.current(e.playerId, e.nickname)
    })
    s.on('room:player_left', (e: { playerId: string }) => {
      onPlayerLeftRef.current(e.playerId)
    })
    s.on('room:player_command', (e: { nickname: string; command: string }) => {
      onPlayerCommandRef.current(e.nickname, e.command)
    })

    return () => {
      s.disconnect()
      socketRef.current = null
      codeRef.current = null
      setCode(null)
      setConnected(false)
    }
  }, [enabled])

  const sendSnapshot = (snapshot: SharedSnapshot, perPlayer?: Record<string, PartialPlayerView>) => {
    const c = codeRef.current
    if (!c || !socketRef.current) return
    socketRef.current.emit('host:snapshot', { code: c, snapshot, perPlayer })
  }

  const lockJoins = () => {
    const c = codeRef.current
    if (!c || !socketRef.current) return
    socketRef.current.emit('host:lock_joins', { code: c })
  }

  const unlockJoins = () => {
    const c = codeRef.current
    if (!c || !socketRef.current) return
    socketRef.current.emit('host:unlock_joins', { code: c })
  }

  const closeRoom = () => {
    const c = codeRef.current
    if (!c || !socketRef.current) return
    socketRef.current.emit('host:close', { code: c })
  }

  return { code, connected, sendSnapshot, lockJoins, unlockJoins, closeRoom }
}
