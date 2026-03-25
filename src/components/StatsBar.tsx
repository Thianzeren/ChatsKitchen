import styles from './StatsBar.module.css'

interface Props {
  money: number
  served: number
  lost: number
  timeLeft: number
}

export default function StatsBar({ money, served, lost, timeLeft }: Props) {
  const totalSec = Math.max(0, Math.ceil(timeLeft / 1000))
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  const timerStr = `${min}:${sec.toString().padStart(2, '0')}`
  const timerColor = totalSec <= 15 ? '#d94f4f' : totalSec <= 30 ? '#e8943a' : '#5cb85c'

  return (
    <div className={styles.bar}>
      <div className={styles.stat}>
        <span className={styles.label}>TIME</span>
        <span className={styles.value} style={{ color: timerColor }}>{timerStr}</span>
      </div>
      <div className={styles.stat}><span className={styles.label}>MONEY</span><span className={styles.value}>${money}</span></div>
      <div className={styles.stat}><span className={styles.label}>SERVED</span><span className={styles.value}>{served}</span></div>
      <div className={styles.stat}><span className={styles.label}>LOST</span><span className={styles.value}>{lost}</span></div>
    </div>
  )
}
