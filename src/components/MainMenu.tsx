import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { TwitchStatus } from '../hooks/useTwitchChat'
import styles from './MainMenu.module.css'

interface RoomPlayer { id: string; nickname: string; disconnected?: boolean }

interface Props {
  onPlay: () => void
  onTutorial: () => void
  onOptions: () => void
  onFeedback: () => void
  onCredits: () => void
  twitchChannel: string | null
  twitchStatus: TwitchStatus
  twitchError: string | undefined
  onTwitchConnect: (channel: string) => void
  onTwitchDisconnect: () => void
  roomCode: string | null
  roomPlayers: RoomPlayer[]
}

export default function MainMenu({
  onPlay, onTutorial, onOptions, onFeedback, onCredits,
  twitchChannel, twitchStatus, twitchError, onTwitchConnect, onTwitchDisconnect,
  roomCode, roomPlayers,
}: Props) {
  const [twitchInput, setTwitchInput] = useState(twitchChannel || '')
  const isConnected = twitchStatus === 'connected'
  const isConnecting = twitchStatus === 'connecting'
  const isDisconnected = twitchStatus === 'disconnected'
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const connectedCount = roomPlayers.filter(p => !p.disconnected).length

  const handleConnect = () => {
    if (!twitchInput.trim()) return
    onTwitchConnect(twitchInput.trim())
  }

  useEffect(() => {
    if (!roomCode || !canvasRef.current) return
    const url = `${window.location.origin}/play?room=${roomCode}`
    QRCode.toCanvas(canvasRef.current, url, {
      width: 168, margin: 1,
      color: { dark: '#1a1512', light: '#f0e5c8' },
    }).catch(console.error)
  }, [roomCode])

  return (
    <div className={styles.screen}>
      <div className={styles.body}>

        {/* ── LEFT: brand + menu ── */}
        <div className={styles.leftCol}>
          <div className={styles.banner}>
            <div className={styles.bannerTitle}>Let Chat Cook</div>
            <div className={styles.bannerTagline}>⚔&nbsp;&nbsp;Dungeon Kitchen &nbsp;·&nbsp; Twitch Chat Restaurant Game</div>
          </div>

          <div className={styles.menuButtons}>
            <button className={styles.playBtn} onClick={onPlay}>
              <span className={styles.playLabel}>Play</span>
              <span className={styles.playArrow}>▶</span>
            </button>
            <button className={styles.menuBtn} onClick={onTutorial}>Tutorial</button>
            <button className={styles.menuBtn} onClick={onOptions}>Options</button>
            <button className={styles.menuBtn} onClick={onFeedback}>Feedback</button>
            <button className={styles.menuBtn} onClick={onCredits}>Credits</button>
          </div>

          <div className={styles.leftFooter}>
            created by THIANzeren &nbsp;·&nbsp; work in progress
          </div>
        </div>

        {/* ── RIGHT: how players join ── */}
        <div className={styles.rightCol}>
          <div className={styles.joinHeading}>How players join</div>

          {/* Twitch */}
          <div className={`${styles.twitchCard} ${isDisconnected ? styles.twitchCardDisconnected : ''}`}>
            <div className={styles.twitchLabel}>TWITCH CHAT</div>
            <div className={styles.twitchForm}>
              <input
                className={styles.twitchInput}
                value={twitchInput}
                onChange={e => setTwitchInput(e.target.value)}
                placeholder="channel name"
                disabled={isConnecting || isConnected}
                onKeyDown={e => e.key === 'Enter' && handleConnect()}
              />
              {isConnected ? (
                <button className={styles.twitchDisconnectBtn} onClick={onTwitchDisconnect}>Disconnect</button>
              ) : (
                <button className={styles.twitchConnectBtn} onClick={handleConnect} disabled={isConnecting || !twitchInput.trim()}>
                  {isConnecting ? '...' : 'Connect'}
                </button>
              )}
            </div>
            {isConnected && twitchChannel && (
              <div className={styles.twitchStatus}>
                <span className={styles.twitchDot} />
                Chat&nbsp;<span className={styles.twitchChannel}>{twitchChannel}</span>&nbsp;is cooking with you!
              </div>
            )}
            {!isConnected && twitchStatus === 'error' && (
              <div className={`${styles.twitchStatus} ${styles.twitchStatusWarning}`}>
                <span className={`${styles.twitchDot} ${styles.twitchDotWarning}`} />
                {twitchError || 'Connection failed'}
              </div>
            )}
            {isDisconnected && (
              <div className={styles.twitchStatusDisconnected}>
                <span className={styles.twitchDotDisconnected} />
                Optional — connect a channel to let chat play too
              </div>
            )}
          </div>

          {/* Local Play */}
          <div className={styles.localCard}>
            <div className={styles.localLabel}>LOCAL PLAY — SCAN TO JOIN</div>
            <div className={styles.localBody}>
              <div className={styles.localQrWrap}>
                {roomCode
                  ? <canvas ref={canvasRef} className={styles.localQr} />
                  : <div className={styles.localQrPlaceholder}>Creating room…</div>}
              </div>
              <div className={styles.localInfo}>
                <div className={styles.localCodeLabel}>ROOM CODE</div>
                <div className={styles.localCode}>{roomCode ?? '····'}</div>
                <div className={styles.localUrl}>{window.location.origin.replace(/^https?:\/\//, '')}/play</div>
                <div className={styles.localPlayers}>
                  {connectedCount === 0
                    ? 'No players yet'
                    : `${connectedCount} player${connectedCount !== 1 ? 's' : ''} joined`}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
