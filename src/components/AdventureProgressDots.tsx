import { ADVENTURE_TOTAL_SHIFTS, isBossShift } from '../data/adventureMode'
import styles from './AdventureProgressDots.module.css'

interface Props {
  currentShift: number   // the shift number that is currently being set up or just finished
}

export default function AdventureProgressDots({ currentShift }: Props) {
  return (
    <div className={styles.dots}>
      {Array.from({ length: ADVENTURE_TOTAL_SHIFTS }, (_, i) => {
        const shiftNum = i + 1
        const isPast = shiftNum < currentShift
        const isCurrent = shiftNum === currentShift
        const isBoss = isBossShift(shiftNum)
        const cls = [
          styles.dot,
          isPast && styles.done,
          isCurrent && styles.current,
          isBoss && styles.boss,
        ].filter(Boolean).join(' ')
        return (
          <span key={shiftNum} className={cls} title={`Shift ${shiftNum}${isBoss ? ' (Boss)' : ''}`}>
            {isBoss ? '★' : shiftNum}
          </span>
        )
      })}
    </div>
  )
}
