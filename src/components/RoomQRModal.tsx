import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import styles from './RoomQRModal.module.css'

interface RoomPlayer { id: string; nickname: string; disconnected?: boolean }

interface Props {
  code: string | null
  players: RoomPlayer[]
  onClose: () => void
}

export default function RoomQRModal({ code, players, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const connectedCount = players.filter(p => !p.disconnected).length

  useEffect(() => {
    if (!code || !canvasRef.current) return
    const url = `${window.location.origin}/play?room=${code}`
    QRCode.toCanvas(canvasRef.current, url, {
      width: 280, margin: 1,
      color: { dark: '#1a1512', light: '#f0e5c8' },
    }).catch(console.error)
  }, [code])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>

        <div className={styles.label}>SCAN TO JOIN</div>

        <div className={styles.qrWrap}>
          {code
            ? <canvas ref={canvasRef} className={styles.qr} />
            : <div className={styles.placeholder}>Creating room…</div>}
        </div>

        <div className={styles.codeLabel}>ROOM CODE</div>
        <div className={styles.code}>{code ?? '····'}</div>
        <div className={styles.url}>{window.location.origin.replace(/^https?:\/\//, '')}/play</div>

        <div className={styles.players}>
          {connectedCount === 0
            ? 'No players yet'
            : `${connectedCount} player${connectedCount !== 1 ? 's' : ''} joined`}
        </div>

        {players.length > 0 && (
          <div className={styles.playerList}>
            {players.map(p => (
              <span
                key={p.id}
                className={`${styles.chip} ${p.disconnected ? styles.chipOffline : ''}`}
              >
                {p.disconnected ? '🔄' : '👤'} {p.nickname}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
