import { useState } from 'react'
import type { SharedSnapshot, PartialPlayerView } from '../shared/protocol'
import { usePlayerSocket } from './usePlayerSocket'
import JoinScreen from './JoinScreen'
import Lobby from './Lobby'
import Controller from './Controller'

type Stage = 'join' | 'lobby' | 'playing' | 'gameover'

interface RoomInfo { code: string; playerId: string; nickname: string }

export default function ControllerApp() {
  const [stage, setStage] = useState<Stage>('join')
  const [room, setRoom] = useState<RoomInfo | null>(null)
  const [snapshot, setSnapshot] = useState<SharedSnapshot | null>(null)
  const [you, setYou] = useState<PartialPlayerView>({ cooldownMs: 0 })

  const { send, connected } = usePlayerSocket({
    room,
    onSnapshot: (shared, playerView) => {
      setSnapshot(shared)
      setYou(playerView)
      if (shared.phase === 'playing' && stage !== 'playing') setStage('playing')
      if (shared.phase === 'gameover' && stage !== 'gameover') setStage('gameover')
      if (shared.phase === 'lobby' && stage !== 'lobby' && stage !== 'join') setStage('lobby')
    },
    onRoomClosed: () => { setRoom(null); setStage('join') },
  })

  if (stage === 'join' || !room) {
    return (
      <JoinScreen
        onJoined={(r) => { setRoom(r); setStage('lobby') }}
      />
    )
  }

  if (stage === 'lobby' || stage === 'gameover' || !snapshot) {
    return (
      <Lobby
        nickname={room.nickname}
        stage={stage}
        snapshot={snapshot}
        send={send}
        connected={connected}
      />
    )
  }

  return <Controller snapshot={snapshot} you={you} send={send} connected={connected} />
}
