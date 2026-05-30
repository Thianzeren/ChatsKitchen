import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { getAudioManager } from '../audio/AudioManager'
import styles from './AdventureSuccessOverlay.module.css'

interface Props {
  shiftCount: number
  dishCount: number
  mvpName: string | null
  mvpScore: number | null
  onDismiss: () => void
}

const AUTO_DISMISS_MS = 5000
const FADE_OUT_MS = 400

export default function AdventureSuccessOverlay({
  shiftCount,
  dishCount,
  mvpName,
  mvpScore,
  onDismiss,
}: Props) {
  const [isExiting, setIsExiting] = useState(false)
  const dismissedRef = useRef(false)

  // Single dismissal path — guards against the 5s timer racing a user click.
  const beginExit = () => {
    if (dismissedRef.current) return
    dismissedRef.current = true
    setIsExiting(true)
    window.setTimeout(onDismiss, FADE_OUT_MS)
  }

  useEffect(() => {
    getAudioManager().playSfx('adventure-victory')
    const t = window.setTimeout(beginExit, AUTO_DISMISS_MS)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 14 staggered embers — positions chosen so they sit clear of the centred scroll.
  const embers = [
    { left: 5,  top: 20, lg: false }, { left: 9,  top: 48, lg: true },
    { left: 14, top: 72, lg: false }, { left: 18, top: 30, lg: false },
    { left: 24, top: 60, lg: true  }, { left: 6,  top: 88, lg: false },
    { left: 78, top: 18, lg: false }, { left: 84, top: 45, lg: true  },
    { left: 88, top: 72, lg: false }, { left: 93, top: 30, lg: false },
    { left: 96, top: 58, lg: true  }, { left: 80, top: 88, lg: false },
    { left: 48, top: 6,  lg: false }, { left: 52, top: 94, lg: false },
  ]

  return createPortal(
    <div
      className={`${styles.backdrop} ${isExiting ? styles.exiting : ''}`}
      onClick={isExiting ? undefined : beginExit}
      role="dialog"
      aria-label="Adventure success"
    >
      <div className={styles.stone} aria-hidden="true" />
      <div className={styles.embers} aria-hidden="true">
        {embers.map((e, i) => (
          <span
            key={i}
            className={`${styles.ember} ${e.lg ? styles.emberLg : ''}`}
            style={{
              left: `${e.left}%`,
              top: `${e.top}%`,
              animationDelay: `${(i * 0.18).toFixed(2)}s`,
            }}
          />
        ))}
      </div>

      <div className={styles.scrollWrap}>
        <div className={styles.scroll}>
          <span className={`${styles.flourish} ${styles.flourishTL}`} />
          <span className={`${styles.flourish} ${styles.flourishTR}`} />
          <span className={`${styles.flourish} ${styles.flourishBL}`} />
          <span className={`${styles.flourish} ${styles.flourishBR}`} />

          <div className={styles.eyebrow}>⚔ {shiftCount} shifts cleared ⚔</div>
          <div className={styles.title}>ADVENTURE<br />SUCCESS</div>
          <div className={styles.divider}>✦</div>
          <div className={styles.sub}>The kitchen prevails. The feast is yours.</div>

          <div className={styles.cuisineRow}>
            <span className={styles.cuisineLabel}>Menu Mastered ·</span>
            <span className={styles.cuisineFlag}>🍽️</span>
            <span className={styles.cuisineName}>{dishCount} Dishes</span>
          </div>
        </div>

        {mvpName && mvpScore !== null && (
          <div className={styles.mvpChip}>
            ★ MVP · {mvpName.toUpperCase()} · {mvpScore} PTS
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
