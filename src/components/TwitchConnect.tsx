import { useState } from 'react'
import { TwitchStatus } from '../hooks/useTwitchChat'
import styles from './TwitchConnect.module.css'

interface Props {
  channel: string | null
  status: TwitchStatus
  error: string | undefined
  onConnect: (channel: string) => void
  onDisconnect: () => void
  onBack: () => void
}

export default function TwitchConnect({ channel, status, error, onConnect, onDisconnect, onBack }: Props) {
  const [input, setInput] = useState(channel || '')
  const isConnected = status === 'connected'
  const isConnecting = status === 'connecting'

  const handleConnect = () => {
    if (!input.trim()) return
    onConnect(input.trim())
  }

  const statusColor = isConnected ? '#42a05e' : isConnecting ? '#e07030' : status === 'error' ? '#d94f4f' : '#d94f4f'
  const statusText = isConnected
    ? `Connected to ${channel}`
    : isConnecting
      ? 'Connecting...'
      : status === 'error'
        ? `Error: ${error || 'Connection failed'}`
        : 'Not connected'

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Connect to Twitch</h1>

      <div className={styles.form}>
        <label className={styles.label}>Channel Name</label>
        <input
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="your_channel"
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
        When connected, your Twitch chat viewers can send commands like <strong>chop lettuce</strong> to play together!
      </p>

      <button className={styles.backBtn} onClick={onBack}>{'\u{2190}'} Back</button>
    </div>
  )
}
