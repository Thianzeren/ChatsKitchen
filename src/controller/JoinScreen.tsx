import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import styles from './JoinScreen.module.css'

const RELAY_URL = import.meta.env.VITE_RELAY_URL ?? 'http://localhost:8080'
const SESSION_KEY = 'chatskitchen_room'

interface JoinedRoom { code: string; playerId: string; nickname: string }

interface Props {
  onJoined: (room: JoinedRoom) => void
}

export default function JoinScreen({ onJoined }: Props) {
  const params = new URLSearchParams(window.location.search)
  const [code, setCode] = useState(params.get('room') ?? '')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Attempt sessionStorage rejoin on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (!stored) return
    try {
      const cached = JSON.parse(stored) as JoinedRoom
      const urlRoom = params.get('room')
      if (!urlRoom || urlRoom.toUpperCase() === cached.code.toUpperCase()) {
        onJoined(cached)
      }
    } catch {
      sessionStorage.removeItem(SESSION_KEY)
    }
  }, [])

  const handleJoin = () => {
    const trimCode = code.trim().toUpperCase().slice(0, 4)
    const trimNick = nickname.trim().slice(0, 16) || 'guest'
    if (trimCode.length < 4) { setError('Enter a 4-letter room code'); return }
    setLoading(true)
    setError(null)
    const s = io(RELAY_URL, { transports: ['websocket', 'polling'] })
    s.emit('player:join', { code: trimCode, nickname: trimNick }, (res: any) => {
      if (res.error) {
        setError(res.error)
        setLoading(false)
        s.disconnect()
        return
      }
      const room: JoinedRoom = { code: trimCode, playerId: res.playerId, nickname: res.nickname }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(room))
      s.disconnect()
      onJoined(room)
    })
  }

  return (
    <div className={styles.screen}>
      <div className={styles.title}>🍳 Let Chat Cook</div>
      <div className={styles.subtitle}>Enter the room code shown on the host screen</div>
      <input
        className={styles.input}
        value={code}
        maxLength={4}
        placeholder="ABCD"
        onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
        onKeyDown={e => e.key === 'Enter' && handleJoin()}
      />
      <input
        className={styles.nicknameInput}
        value={nickname}
        maxLength={16}
        placeholder="Your nickname"
        onChange={e => setNickname(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleJoin()}
      />
      {error && <div className={styles.error}>{error}</div>}
      <button className={styles.btn} onClick={handleJoin} disabled={loading}>
        {loading ? 'Joining…' : 'Join Room'}
      </button>
    </div>
  )
}
