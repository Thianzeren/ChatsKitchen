import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import type { SharedSnapshot, PartialPlayerView, PlayerJoinAck, PlayerJoinErr } from '../shared/protocol'
import { RELAY_URL, SESSION_KEY } from '../shared/config'

export interface Credentials { code: string; nickname: string; playerId?: string }
export interface RoomInfo { code: string; playerId: string; nickname: string }

interface Args {
  credentials: Credentials | null
  onJoined: (room: RoomInfo) => void
  onSnapshot: (shared: SharedSnapshot, you: PartialPlayerView) => void
  onRoomClosed: () => void
  onError: (msg: string) => void
}

export function usePlayerSocket({ credentials, onJoined, onSnapshot, onRoomClosed, onError }: Args) {
  const [connected, setConnected] = useState(false)
  const roomRef = useRef<RoomInfo | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const onJoinedRef = useRef(onJoined)
  const onSnapshotRef = useRef(onSnapshot)
  const onRoomClosedRef = useRef(onRoomClosed)
  const onErrorRef = useRef(onError)
  onJoinedRef.current = onJoined
  onSnapshotRef.current = onSnapshot
  onRoomClosedRef.current = onRoomClosed
  onErrorRef.current = onError

  useEffect(() => {
    if (!credentials) return
    const s = io(RELAY_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = s

    s.on('connect', () => {
      setConnected(true)
      // On reconnect, socket.io fires 'connect' again — skip re-join if already in the room
      if (roomRef.current) return
      s.emit('player:join', { code: credentials.code, nickname: credentials.nickname, playerId: credentials.playerId }, (res: PlayerJoinAck | PlayerJoinErr) => {
        if ('error' in res) {
          onErrorRef.current(res.error)
          s.disconnect()
          return
        }
        const room: RoomInfo = { code: credentials.code, playerId: res.playerId, nickname: res.nickname }
        roomRef.current = room
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(room))
        onJoinedRef.current(room)
      })
    })
    s.on('disconnect', () => setConnected(false))
    s.on('player:snapshot', (e: { shared: SharedSnapshot; you: PartialPlayerView }) => {
      onSnapshotRef.current(e.shared, e.you)
    })
    s.on('room:closed', () => onRoomClosedRef.current())

    return () => { s.disconnect(); socketRef.current = null; roomRef.current = null; setConnected(false) }
  }, [credentials?.code, credentials?.nickname])

  const send = (command: string) => {
    const room = roomRef.current
    if (!room || !socketRef.current) return
    socketRef.current.emit('player:action', { code: room.code, playerId: room.playerId, command })
  }

  return { send, connected }
}
