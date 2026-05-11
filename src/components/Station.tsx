import { useState, useEffect } from 'react'
import { Station as StationType, StationSlot } from '../state/types'
import { STATION_DEFS, NAME_COLORS, INGREDIENT_EMOJI, HEAT_EXEMPT_STATIONS } from '../data/recipes'
import FoodIcon from './FoodIcon'
import styles from './Station.module.css'

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return h
}

function SlotRow({ slot }: { slot: StationSlot }) {
  const now = Date.now()
  const elapsed = now - slot.cookStart
  const progress = slot.cookDuration > 0 ? Math.min(1, elapsed / slot.cookDuration) : 0

  const barColor = progress > 0.85
    ? 'rgba(192, 56, 48, 0.6)'
    : progress > 0.65
      ? 'rgba(224, 112, 48, 0.6)'
      : 'rgba(66, 160, 94, 0.55)'

  const nameColor = NAME_COLORS[Math.abs(hashStr(slot.user)) % NAME_COLORS.length]

  return (
    <div className={styles.slot}>
      <div className={styles.slotBar}>
        <div className={styles.barBg} />
        <div className={styles.barFill} style={{ width: `${Math.floor(progress * 100)}%`, background: barColor }} />
        <div className={styles.barText}>
          <span className={styles.barUser} style={{ color: nameColor }}>{slot.user}</span>
          <span className={styles.barItem}>{slot.target.replace(/_/g, ' ')}</span>
          <span className={styles.barRight} style={{ color: 'rgba(255,255,255,0.55)' }}>{Math.floor(progress * 100)}%</span>
        </div>
      </div>
    </div>
  )
}

interface Props {
  station: StationType
  capacity: number
  playerCount: number
  isHighlighted?: boolean
  pvpLargerTeamSize?: number
  isDisabled?: boolean
}


function heatBorderColor(heat: number, overheated: boolean): string {
  if (overheated) return '#c03830'
  if (heat > 70)  return '#e07030'
  if (heat > 40)  return '#c4a020'
  return '#42a05e'
}

export default function Station({ station, capacity, playerCount, isHighlighted, pvpLargerTeamSize, isDisabled }: Props) {
  const [coolFlash, setCoolFlash] = useState(false)
  const [showCoolText, setShowCoolText] = useState(false)
  const [coolPlayer, setCoolPlayer] = useState<string | null>(null)
  const [showExtinguishText, setShowExtinguishText] = useState(false)
  const [extinguishPlayers, setExtinguishPlayers] = useState<string[]>([])
  const [completionEmoji, setCompletionEmoji] = useState<string | null>(null)
  const [completionPlayer, setCompletionPlayer] = useState<string | null>(null)

  useEffect(() => {
    if (!station.lastCooledAt) return
    setCoolFlash(true)
    setShowCoolText(true)
    setCoolPlayer(station.lastCooledBy ?? null)
    const t1 = setTimeout(() => setCoolFlash(false), 600)
    const t2 = setTimeout(() => { setShowCoolText(false); setCoolPlayer(null) }, 1000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [station.lastCooledAt, station.lastCooledBy])

  useEffect(() => {
    if (!station.lastExtinguishedAt) return
    setShowExtinguishText(true)
    setExtinguishPlayers(station.lastExtinguishedBy ?? [])
    const t = setTimeout(() => { setShowExtinguishText(false); setExtinguishPlayers([]) }, 1200)
    return () => clearTimeout(t)
  }, [station.lastExtinguishedAt, station.lastExtinguishedBy])

  useEffect(() => {
    if (!station.lastCompletion) return
    const emoji = INGREDIENT_EMOJI[station.lastCompletion.ingredient] ?? '✅'
    setCompletionEmoji(emoji)
    setCompletionPlayer(station.lastCompletion.by)
    const t = setTimeout(() => { setCompletionEmoji(null); setCompletionPlayer(null) }, 900)
    return () => clearTimeout(t)
  }, [station.lastCompletion])

  const def = STATION_DEFS[station.id]
  if (!def) return null

  const borderColor = heatBorderColor(station.heat, station.overheated)
  const extinguishNeeded = pvpLargerTeamSize !== undefined
    ? Math.max(1, Math.ceil(pvpLargerTeamSize * 0.5))
    : Math.max(1, Math.ceil(Math.max(1, playerCount) * 0.5))

  return (
    <div className={`${styles.station} ${station.overheated ? styles.fire : ''} ${coolFlash ? styles.coolFlash : ''} ${isHighlighted ? styles.highlighted : ''} ${isDisabled ? styles.disabled : ''}`} style={{ borderColor: isDisabled ? '#2a5acc' : borderColor }}>
      <div className={styles.label}>
        <span className={styles.stationEmoji}>{def.emoji}</span>
        <span className={styles.stationName}>{def.name}</span>
        {!station.overheated && !HEAT_EXEMPT_STATIONS.has(station.id) && (
          <span className={styles.heatBadge}>{Math.floor(station.heat)}% 🔥</span>
        )}
        {capacity !== Infinity && (
          <span className={styles.capacity}>{station.slots.length}/{capacity}</span>
        )}
      </div>
      {completionEmoji && (
        <div key={station.lastCompletion?.at} className={styles.completionFloat}>
          <FoodIcon icon={completionEmoji} size={26} />
          {completionPlayer && <span className={styles.floatPlayer}>{completionPlayer}</span>}
        </div>
      )}
      {showCoolText && (
        <div className={styles.coolFloat}>
          ❄️ COOL
          {coolPlayer && <span className={styles.floatPlayer}>{coolPlayer}</span>}
        </div>
      )}
      {showExtinguishText && (
        <div className={styles.extinguishFloat}>
          🧯 EXTINGUISHED
          {extinguishPlayers.map(p => (
            <span key={p} className={styles.floatPlayer}>{p}</span>
          ))}
        </div>
      )}
      {isDisabled ? (
        <div className={styles.offlineOverlay}>
          <span className={styles.offlineTitle}>⚡ OFFLINE</span>
          <span className={styles.offlineHint}>Power Trip in progress</span>
        </div>
      ) : station.overheated ? (
        <div className={styles.overheatOverlay}>
          <span className={styles.overheatTitle}>🔥 OVERHEATED</span>
          <span className={styles.voteProgress}>
            {station.extinguishVotes.length}/{extinguishNeeded} extinguish {station.id.replace(/_/g, ' ')}
          </span>
        </div>
      ) : station.slots.length === 0 ? (
        <div className={styles.idleStatus}>
          <div className={styles.idleCmd}>!{def.actions[0]} &lt;ingredient&gt;</div>
          <div className={styles.idleHint}>available</div>
        </div>
      ) : (
        <div className={styles.slots}>
          {station.slots.map(slot => (
            <SlotRow key={slot.id} slot={slot} />
          ))}
        </div>
      )}
    </div>
  )
}
