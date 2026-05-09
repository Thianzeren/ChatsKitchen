import { TwitchStatus } from '../hooks/useTwitchChat'
import { getStarCount } from '../data/starThresholds'
import TwitchStatusPill from './TwitchStatusPill'
import styles from './BottomBar.module.css'

interface Props {
  money: number
  served: number
  lost: number
  twitchStatus: TwitchStatus
  twitchChannel: string | null
  starThresholds?: [number, number, number]
}

export default function BottomBar({ money, served, lost, twitchStatus, twitchChannel, starThresholds }: Props) {
  const starCount = starThresholds ? getStarCount(money, starThresholds) : null

  const filledStar = '★'
  const emptyStar = '☆'
  const starDisplay = starCount !== null
    ? filledStar.repeat(starCount) + emptyStar.repeat(3 - starCount)
    : null
  const nextLabel = starCount !== null
    ? (starCount < 3
        ? ` → ${'★'.repeat(starCount + 1)} at $${starThresholds![starCount].toLocaleString()}`
        : ' 🎉')
    : null

  return (
    <div className={styles.bar}>
      <div className={styles.stat}>
        <span className={styles.value} style={{ color: '#c4a020' }}>${money}</span>
        <span className={styles.label}>EARNED</span>
      </div>
      <div className={styles.divider} />
      <div className={styles.stat}>
        <span className={styles.value} style={{ color: '#42a05e' }}>{served}</span>
        <span className={styles.label}>SERVED</span>
      </div>
      <div className={styles.divider} />
      <div className={styles.stat}>
        <span className={styles.value} style={{ color: '#c03830' }}>{lost}</span>
        <span className={styles.label}>LOST</span>
      </div>
      {starDisplay !== null && (
        <>
          <div className={styles.divider} />
          <div className={styles.starIndicator}>
            <span>{starDisplay}</span>
            <span className={styles.starNext}>{nextLabel}</span>
          </div>
        </>
      )}
      <div className={styles.right}>
        <TwitchStatusPill status={twitchStatus} channel={twitchChannel} />
        <span className={styles.hint}>Recipes &amp; config → ⚙️</span>
      </div>
    </div>
  )
}
