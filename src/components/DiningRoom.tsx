import { useState, useEffect } from 'react'
import { GameState } from '../state/types'
import OrderTicket from './OrderTicket'
import { storage } from '../state/storage'
import styles from './DiningRoom.module.css'

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr]
  let s = (seed * 1664525 + 1013904223) & 0xffffffff
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(s) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

interface Props {
  state: GameState
  isHighlighted?: boolean
  isGlitched?: boolean
}

export default function OrdersBar({ state, isHighlighted, isGlitched }: Props) {
  const [simpleTickets, setSimpleTickets] = useState(
    () => storage.get('chatsKitchen_diningRoomSimpleTickets') === 'true'
  )
  const [shuffleSeed, setShuffleSeed] = useState(0)

  useEffect(() => {
    if (!isGlitched) return
    const t = setInterval(() => setShuffleSeed(s => s + 1), 2000)
    return () => clearInterval(t)
  }, [isGlitched])

  const toggleSimple = () => setSimpleTickets(v => {
    const next = !v
    storage.set('chatsKitchen_diningRoomSimpleTickets', String(next))
    return next
  })

  const activeOrders = state.orders
    .filter(o => !o.served || o.outcome !== undefined)
    .sort((a, b) => a.spawnTime - b.spawnTime)

  const displayOrders = isGlitched ? seededShuffle(activeOrders, shuffleSeed) : activeOrders
  const pendingCount = activeOrders.filter(o => !o.outcome).length

  const totalSec = Math.max(0, Math.ceil(state.timeLeft / 1000))
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  const timerStr = `${min}:${sec.toString().padStart(2, '0')}`
  const isUrgent = totalSec <= 60

  return (
    <div className={`${styles.dining} ${isHighlighted ? styles.highlighted : ''} ${isGlitched ? styles.glitchedPanel : ''}`}>
      <div className={styles.timeBlock}>
        <span className={styles.timeLabel}>TIME LEFT</span>
        <span className={`${styles.timeValue} ${isUrgent ? styles.urgent : ''}`}>{timerStr}</span>
      </div>
      <div className={styles.ordersHeader}>
        <span className={styles.ordersTitle}>📋 Orders</span>
        <span className={styles.ordersCount}>{pendingCount}</span>
        <button className={styles.viewToggle} onClick={toggleSimple}>
          {simpleTickets ? 'Detailed' : 'Simple'}
        </button>
      </div>
      <div className={styles.ordersList}>
        {displayOrders.map((order) => (
          <OrderTicket
            key={order.id}
            order={order}
            orderNumber={order.id}
            simple={simpleTickets}
            isGlitched={isGlitched}
          />
        ))}
        {activeOrders.length === 0 && (
          <div className={styles.empty}>No orders yet...</div>
        )}
      </div>
    </div>
  )
}
