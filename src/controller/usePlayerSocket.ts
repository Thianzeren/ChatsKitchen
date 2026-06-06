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
      // (Re)join on every connect. socket.io assigns a new socket.id on reconnect
      // and drops all room memberships, so even an already-joined player MUST
      // re-emit player:join — otherwise the new socket never re-joins the
      // `players:<code>` broadcast room and stops receiving snapshots (the phone
      // freezes on its last lobby view and never sees the game start). When we
      // already have a room, reconnect with its playerId so the server takes its
      // reconnection path (restores the record, re-joins rooms, bypasses the lock).
      const existing = roomRef.current
      const joinMsg = existing
        ? { code: existing.code, nickname: existing.nickname, playerId: existing.playerId }
        : { code: credentials.code, nickname: credentials.nickname, playerId: credentials.playerId }
      s.emit('player:join', joinMsg, (res: PlayerJoinAck | PlayerJoinErr) => {
        if ('error' in res) {
          onErrorRef.current(res.error)
          s.disconnect()
          return
        }
        const room: RoomInfo = { code: joinMsg.code, playerId: res.playerId, nickname: res.nickname }
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
    // Intentionally narrow deps: a new credentials object reference shouldn't force a reconnect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials?.code, credentials?.nickname])

  const send = (command: string) => {
    const room = roomRef.current
    if (!room || !socketRef.current) return
    socketRef.current.emit('player:action', { code: room.code, playerId: room.playerId, command })
  }

  return { send, connected }
}
