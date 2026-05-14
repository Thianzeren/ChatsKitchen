import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import type { SharedSnapshot, PartialPlayerView } from '../shared/protocol'

const RELAY_URL = import.meta.env.VITE_RELAY_URL ?? 'http://localhost:8080'

interface RoomInfo { code: string; playerId: string; nickname: string }

interface Args {
  room: RoomInfo | null
  onSnapshot: (shared: SharedSnapshot, you: PartialPlayerView) => void
  onRoomClosed: () => void
}

export function usePlayerSocket({ room, onSnapshot, onRoomClosed }: Args) {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const onSnapshotRef = useRef(onSnapshot)
  const onRoomClosedRef = useRef(onRoomClosed)
  onSnapshotRef.current = onSnapshot
  onRoomClosedRef.current = onRoomClosed

  useEffect(() => {
    if (!room) return
    const s = io(RELAY_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = s
    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))
    s.on('player:snapshot', (e: { shared: SharedSnapshot; you: PartialPlayerView }) => {
      onSnapshotRef.current(e.shared, e.you)
    })
    s.on('room:closed', () => onRoomClosedRef.current())
    return () => { s.disconnect(); socketRef.current = null; setConnected(false) }
  }, [room?.code, room?.playerId])

  const send = (command: string) => {
    if (!room || !socketRef.current) return
    socketRef.current.emit('player:action', {
      code: room.code,
      playerId: room.playerId,
      command,
    })
  }

  return { send, connected }
}
