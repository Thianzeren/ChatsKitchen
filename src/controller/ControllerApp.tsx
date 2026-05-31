import { useState } from 'react'
import type { SharedSnapshot, PartialPlayerView } from '../shared/protocol'
import { SESSION_KEY } from '../shared/config'
import { usePlayerSocket, type Credentials, type RoomInfo } from './usePlayerSocket'
import JoinScreen from './JoinScreen'
import Lobby from './Lobby'
import Controller from './Controller'

export default function ControllerApp() {
  const [room, setRoom] = useState<RoomInfo | null>(null)
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<SharedSnapshot | null>(null)
  const [you, setYou] = useState<PartialPlayerView | null>(null)

  const { send, connected } = usePlayerSocket({
    credentials,
    onJoined: (r) => { setRoom(r); setJoinError(null) },
    onSnapshot: (shared, partial) => { setSnapshot(shared); setYou(partial) },
    onRoomClosed: () => { setRoom(null); setCredentials(null); setSnapshot(null) },
    onError: (msg) => { setJoinError(msg); setCredentials(null) },
  })

  const handleExitRoom = () => {
    sessionStorage.removeItem(SESSION_KEY)
    setRoom(null)
    setCredentials(null)
    setSnapshot(null)
  }

  const joining = credentials !== null && room === null

  if (!room) {
    return (
      <JoinScreen
        onCredentials={(creds) => { setJoinError(null); setCredentials(creds) }}
        error={joinError}
        loading={joining}
      />
    )
  }

  const phase = snapshot?.phase ?? 'lobby'

  if (phase !== 'playing') {
    return (
      <Lobby
        nickname={room.nickname}
        stage={phase}
        snapshot={snapshot}
        assignedTeam={you?.team ?? null}
        send={send}
        connected={connected}
        onExit={handleExitRoom}
      />
    )
  }

  return <Controller snapshot={snapshot!} send={send} connected={connected} roomCode={room.code} onExit={handleExitRoom} />
}
