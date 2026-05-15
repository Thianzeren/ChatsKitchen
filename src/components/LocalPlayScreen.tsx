import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import styles from './LocalPlayScreen.module.css'

interface Props {
  code: string | null
  players: Array<{ id: string; nickname: string }>
  onBack: () => void
  onStart: () => void
}

export default function LocalPlayScreen({ code, players, onBack, onStart }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!code || !canvasRef.current) return
    const url = `${window.location.origin}/play?room=${code}`
    QRCode.toCanvas(canvasRef.current, url, { width: 200, margin: 1 }).catch(console.error)
  }, [code])

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.codeLabel}>Room Code</div>

        {code
          ? <div className={styles.code}>{code}</div>
          : <div className={styles.creating}>Creating room…</div>
        }

        {code && (
          <>
            <canvas ref={canvasRef} className={styles.qr} />
            <div className={styles.joinUrl}>{window.location.origin}/play</div>
          </>
        )}

        <div className={styles.divider} />

        <div className={styles.playerCount}>
          {players.length === 0
            ? 'No players yet — share the code!'
            : `${players.length} player${players.length !== 1 ? 's' : ''} joined`
          }
        </div>

        {players.length > 0 && (
          <div className={styles.playerList}>
            {players.map(p => (
              <div key={p.id} className={styles.playerRow}>👤 {p.nickname}</div>
            ))}
          </div>
        )}

        <div className={styles.buttons}>
          <button className={styles.backBtn} onClick={onBack}>← Back</button>
          <button className={styles.startBtn} onClick={onStart}>Start →</button>
        </div>
      </div>
    </div>
  )
}
