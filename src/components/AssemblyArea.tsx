import { Station, StationSlot } from '../state/types'
import { RECIPES, NAME_COLORS } from '../data/recipes'
import styles from './AssemblyArea.module.css'

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return h
}

function PlatingSlot({ slot }: { slot: StationSlot }) {
  const now = Date.now()
  const elapsed = now - slot.cookStart
  const progress = slot.cookDuration > 0 ? Math.min(1, elapsed / slot.cookDuration) : 0
  const recipe = RECIPES[slot.produces]
  const nameColor = NAME_COLORS[Math.abs(hashStr(slot.user)) % NAME_COLORS.length]

  return (
    <div className={styles.platingSlot}>
      <div className={styles.plateIcon}>{recipe?.emoji || '🍽️'}</div>
      <div className={styles.platingInfo}>
        <div className={styles.platingHeader}>
          <span className={styles.platingUser} style={{ color: nameColor }}>{slot.user}</span>
          <span className={styles.platingDish}>{recipe?.name ?? slot.produces}</span>
        </div>
        <div className={styles.platingProgressBg}>
          <div
            className={styles.platingProgressFill}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className={styles.platingStatus}>
          plating {Math.floor(progress * 100)}%
        </div>
      </div>
    </div>
  )
}

function DonePlate({ slot }: { slot: StationSlot }) {
  const recipe = RECIPES[slot.produces]

  return (
    <div className={`${styles.platingSlot} ${styles.platingDone}`}>
      <div className={styles.plateIcon}>{recipe?.emoji || '🍽️'}</div>
      <div className={styles.platingInfo}>
        <span className={styles.doneDish}>{recipe?.name ?? slot.produces}</span>
        <div className={styles.doneStatus}>ready to serve</div>
      </div>
    </div>
  )
}

function EmptyPlate() {
  return (
    <div className={`${styles.platingSlot} ${styles.platingEmpty}`}>
      <div className={styles.plateIcon}>🍽️</div>
      <div className={styles.platingInfo}>
        <div className={styles.emptyLabel}>empty</div>
      </div>
    </div>
  )
}

interface Props {
  platingStation: Station
  platingCapacity: number
}

export default function AssemblyArea({ platingStation, platingCapacity }: Props) {
  const activeSlots = platingStation.slots
  const emptyCount = Math.max(0, platingCapacity - activeSlots.length)

  return (
    <div className={styles.assembly}>
      <div className={styles.platingDivider}>🍽️ PLATING</div>
      <div className={styles.platingSlots}>
        {activeSlots.map(slot => (
          slot.state === 'done'
            ? <DonePlate key={slot.id} slot={slot} />
            : <PlatingSlot key={slot.id} slot={slot} />
        ))}
        {Array.from({ length: emptyCount }, (_, i) => (
          <EmptyPlate key={`empty-${i}`} />
        ))}
      </div>
    </div>
  )
}
