import { useState } from 'react'
import { YouTubeStatus, extractVideoId } from '../hooks/useYouTubeChat'
import styles from './YouTubeConnect.module.css'

interface Props {
  videoInput: string | null
  status: YouTubeStatus
  error: string | undefined
  onConnect: (videoInput: string) => void
  onDisconnect: () => void
  onBack: () => void
}

export default function YouTubeConnect({ videoInput, status, error, onConnect, onDisconnect, onBack }: Props) {
  const [input, setInput] = useState(videoInput || '')
  const isConnected = status === 'connected'
  const isConnecting = status === 'connecting'

  const handleConnect = () => {
    if (!input.trim()) return
    onConnect(input.trim())
  }

  const statusColor = isConnected ? '#5cb85c' : isConnecting ? '#e8943a' : status === 'error' ? '#d94f4f' : '#d94f4f'
  const statusText = isConnected
    ? `Connected — ${extractVideoId(videoInput ?? '')}`
    : isConnecting
      ? 'Connecting...'
      : status === 'error'
        ? `Error: ${error || 'Connection failed'}`
        : 'Not connected'

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Connect to YouTube</h1>

      <div className={styles.form}>
        <label className={styles.label}>Video URL or ID</label>
        <input
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="https://youtube.com/watch?v=... or video ID"
          disabled={isConnecting || isConnected}
          onKeyDown={e => e.key === 'Enter' && handleConnect()}
        />
        {isConnected ? (
          <button className={styles.disconnectBtn} onClick={onDisconnect}>
            Disconnect
          </button>
        ) : (
          <button
            className={styles.connectBtn}
            onClick={handleConnect}
            disabled={isConnecting || !input.trim()}
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
        )}
      </div>

      <div className={styles.status}>
        <span className={styles.dot} style={{ backgroundColor: statusColor }} />
        {statusText}
      </div>

      <p className={styles.note}>
        Paste the URL or video ID of your active YouTube livestream. Viewers can send commands
        like <strong>!chop lettuce</strong> to play together!
      </p>
      <p className={styles.noteSmall}>
        Requires <code>VITE_YOUTUBE_API_KEY</code> set in <code>.env.local</code>
      </p>

      <button className={styles.backBtn} onClick={onBack}>Back</button>
    </div>
  )
}
