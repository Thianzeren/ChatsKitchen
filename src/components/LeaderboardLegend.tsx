import styles from './LeaderboardLegend.module.css'

export default function LeaderboardLegend() {
  return (
    <div className={styles.legend}>
      <strong>Score</strong> = cooked + served + cooled + extinguished×2 + events×2 − fires + ⭐<br />
      <strong>⭐ bonus</strong>: +2 per ingredient used in a serve · +1 for cooling at ≥60% heat
    </div>
  )
}
