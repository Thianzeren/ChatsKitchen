import { useState } from 'react'
import type { SharedSnapshot, PartialPlayerView } from '../shared/protocol'
import { usePlayerSocket, type Credentials } from './usePlayerSocket'
import JoinScreen from './JoinScreen'
import Lobby from './Lobby'
import Controller from './Controller'

type Stage = 'join' | 'lobby' | 'playing' | 'gameover'

interface RoomInfo { code: string; playerId: string; nickname: string }

export default function ControllerApp() {
  const [stage, setStage] = useState<Stage>('join')
  const [room, setRoom] = useState<RoomInfo | null>(null)
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<SharedSnapshot | null>(null)
  const [you, setYou] = useState<PartialPlayerView>({ cooldownMs: 0 })

  const { send, connected } = usePlayerSocket({
    credentials,
    onJoined: (r) => { setRoom(r); setStage('lobby'); setJoinError(null) },
    onSnapshot: (shared, playerView) => {
      setSnapshot(shared)
      setYou(playerView)
      if (shared.phase === 'playing' && stage !== 'playing') setStage('playing')
      if (shared.phase === 'gameover' && stage !== 'gameover') setStage('gameover')
      if (shared.phase === 'lobby' && stage !== 'lobby' && stage !== 'join') setStage('lobby')
    },
    onRoomClosed: () => { setRoom(null); setCredentials(null); setStage('join') },
    onError: (msg) => { setJoinError(msg); setCredentials(null) },
  })

  const joining = credentials !== null && room === null

  if (stage === 'join' || !room) {
    return (
      <JoinScreen
        onCredentials={(creds) => { setJoinError(null); setCredentials(creds) }}
        error={joinError}
        loading={joining}
      />
    )
  }

  const handleExitRoom = () => {
    sessionStorage.removeItem('chatskitchen_room')
    setRoom(null)
    setCredentials(null)
    setStage('join')
  }

  if (stage === 'lobby' || stage === 'gameover' || !snapshot) {
    return (
      <Lobby
        nickname={room.nickname}
        stage={stage}
        snapshot={snapshot}
        send={send}
        connected={connected}
        onExit={handleExitRoom}
      />
    )
  }

  return <Controller snapshot={snapshot} you={you} send={send} connected={connected} roomCode={room.code} onExit={handleExitRoom} />
}
