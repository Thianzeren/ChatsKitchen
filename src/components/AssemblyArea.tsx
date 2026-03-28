import { GameState, Station, StationSlot } from '../state/types'
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
  state: GameState
  platingStation: Station
  platingCapacity: number
}

export default function AssemblyArea({ state, platingStation, platingCapacity }: Props) {
  // Match each plated dish to a pending order for serve hints
  const usedOrderIds = new Set<number>()
  const matchedPlates = state.platedDishes.map(dish => {
    const order = state.orders.find(o => !o.served && o.dish === dish && !usedOrderIds.has(o.id))
    if (order) usedOrderIds.add(order.id)
    return { dish, orderId: order?.id ?? 0 }
  })

  const activeSlots = platingStation.slots
  const emptyCount = Math.max(0, platingCapacity - activeSlots.length)

  return (
    <div className={styles.assembly}>
      <div className={styles.divider}>🍽️ READY TO SERVE</div>
      <div className={styles.plates}>
        {matchedPlates.map((plate, i) => {
          const recipe = RECIPES[plate.dish]
          return (
            <div key={i} className={styles.plate}>
              <span className={styles.emoji}>{recipe.emoji}</span>
              <span className={styles.name}>{recipe.name}</span>
              {plate.orderId > 0 && (
                <span className={styles.serveHint}>!serve {plate.orderId}</span>
              )}
            </div>
          )
        })}
      </div>
      <div className={styles.platingDivider}>🍽️ PLATING</div>
      <div className={styles.platingSlots}>
        {activeSlots.map(slot => (
          <PlatingSlot key={slot.id} slot={slot} />
        ))}
        {Array.from({ length: emptyCount }, (_, i) => (
          <EmptyPlate key={`empty-${i}`} />
        ))}
      </div>
    </div>
  )
}
