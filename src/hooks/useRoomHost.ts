import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import type { SharedSnapshot, PartialPlayerView } from '../shared/protocol'
import { RELAY_URL } from '../shared/config'

// Must match PLAYER_RECONNECT_GRACE_MS on the server
const RECONNECT_GRACE_MS = 60_000

interface Args {
  enabled: boolean
  onPlayerCommand: (nickname: string, command: string) => void
  onPlayerJoined: (playerId: string, nickname: string, isReconnect: boolean) => void
  onPlayerDisconnected: (playerId: string) => void
  onPlayerLeft: (playerId: string) => void
}

export function useRoomHost({ enabled, onPlayerCommand, onPlayerJoined, onPlayerDisconnected, onPlayerLeft }: Args) {
  const [code, setCode] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const codeRef = useRef<string | null>(null)
  // Tracks players in the grace-period window: playerId → expiry timer id
  const gracePeriodTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const onPlayerCommandRef = useRef(onPlayerCommand)
  const onPlayerJoinedRef = useRef(onPlayerJoined)
  const onPlayerDisconnectedRef = useRef(onPlayerDisconnected)
  const onPlayerLeftRef = useRef(onPlayerLeft)
  onPlayerCommandRef.current = onPlayerCommand
  onPlayerJoinedRef.current = onPlayerJoined
  onPlayerDisconnectedRef.current = onPlayerDisconnected
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
      const isReconnect = gracePeriodTimers.current.has(e.playerId)
      if (isReconnect) {
        // Cancel the grace-period expiry — player came back in time
        clearTimeout(gracePeriodTimers.current.get(e.playerId))
        gracePeriodTimers.current.delete(e.playerId)
      }
      onPlayerJoinedRef.current(e.playerId, e.nickname, isReconnect)
    })

    s.on('room:player_left', (e: { playerId: string }) => {
      // Show as disconnected immediately but give them time to reconnect
      onPlayerDisconnectedRef.current(e.playerId)
      const timer = setTimeout(() => {
        gracePeriodTimers.current.delete(e.playerId)
        onPlayerLeftRef.current(e.playerId)
      }, RECONNECT_GRACE_MS)
      gracePeriodTimers.current.set(e.playerId, timer)
    })

    s.on('room:player_command', (e: { nickname: string; command: string }) => {
      onPlayerCommandRef.current(e.nickname, e.command)
    })

    const timers = gracePeriodTimers.current
    return () => {
      timers.forEach(t => clearTimeout(t))
      timers.clear()
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
