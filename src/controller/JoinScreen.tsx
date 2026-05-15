import { useState, useEffect } from 'react'
import styles from './JoinScreen.module.css'

const SESSION_KEY = 'chatskitchen_room'

interface Props {
  onCredentials: (creds: { code: string; nickname: string; playerId?: string }) => void
  error: string | null
  loading: boolean
}

export default function JoinScreen({ onCredentials, error, loading }: Props) {
  const params = new URLSearchParams(window.location.search)
  const [code, setCode] = useState(params.get('room') ?? '')
  const [nickname, setNickname] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  // Auto-rejoin from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (!stored) return
    try {
      const cached = JSON.parse(stored) as { code: string; nickname: string; playerId?: string }
      const urlRoom = params.get('room')
      if (!urlRoom || urlRoom.toUpperCase() === cached.code.toUpperCase()) {
        onCredentials({ code: cached.code, nickname: cached.nickname, playerId: cached.playerId })
      }
    } catch {
      sessionStorage.removeItem(SESSION_KEY)
    }
  }, [])

  const handleJoin = () => {
    const trimCode = code.trim().toUpperCase().slice(0, 4)
    const trimNick = nickname.trim().slice(0, 16) || 'guest'
    if (trimCode.length < 4) { setLocalError('Enter a 4-letter room code'); return }
    setLocalError(null)
    onCredentials({ code: trimCode, nickname: trimNick })
  }

  const displayError = error ?? localError

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
      {displayError && <div className={styles.error}>{displayError}</div>}
      <button className={styles.btn} onClick={handleJoin} disabled={loading}>
        {loading ? 'Joining…' : 'Join Room'}
      </button>
    </div>
  )
}
