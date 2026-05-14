import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import styles from './RoomHostCard.module.css'

interface Props {
  code: string | null
  connected: boolean
  players: Array<{ id: string; nickname: string }>
  onHostRoom: () => void
  onLeaveRoom: () => void
}

export default function RoomHostCard({ code, connected, players, onHostRoom, onLeaveRoom }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!code || !canvasRef.current) return
    const url = `${window.location.origin}/play?room=${code}`
    QRCode.toCanvas(canvasRef.current, url, { width: 120, margin: 1 }).catch(console.error)
  }, [code])

  if (!code) {
    return (
      <div className={styles.card}>
        <div className={styles.label}>Room Mode</div>
        <button className={`${styles.btn} ${styles.startBtn}`} onClick={onHostRoom}>
          Host a Room
        </button>
        <div className={styles.emptyPlayers}>
          Players join at {window.location.origin}/play
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.card} ${styles.cardActive}`}>
      <div className={styles.label}>Room Code</div>
      <div className={styles.code}>{code}</div>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.statusRow}>
        <span className={`${styles.dot} ${connected ? styles.dotOn : ''}`} />
        {connected ? `${players.length} player${players.length !== 1 ? 's' : ''} connected` : 'Connecting…'}
      </div>
      <div className={styles.playerList}>
        {players.length === 0
          ? <div className={styles.emptyPlayers}>No players yet — share the code!</div>
          : players.map(p => <div key={p.id} className={styles.player}>👤 {p.nickname}</div>)
        }
      </div>
      <button className={`${styles.btn} ${styles.leaveBtn}`} onClick={onLeaveRoom}>
        Leave Room
      </button>
    </div>
  )
}
