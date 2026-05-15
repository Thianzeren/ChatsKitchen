import { useState, useEffect, useRef } from 'react'
import type { SharedSnapshot, PartialPlayerView } from '../shared/protocol'
import styles from './Controller.module.css'

const VERBS = ['chop','grill','fry','boil','toast','roast','stirfry','steam','simmer','cook','mix','grind','knead']
const COOLDOWN_MS = 1500

interface Props {
  snapshot: SharedSnapshot
  you: PartialPlayerView
  send: (command: string) => void
  connected: boolean
}

export default function Controller({ snapshot, you, send, connected }: Props) {
  const [verb, setVerb] = useState<string | null>(null)
  const [freeText, setFreeText] = useState('')
  const [localCooldownMs, setLocalCooldownMs] = useState(0)
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isOnCooldown = localCooldownMs > 0 || you.cooldownMs > 0
  const cooldownPct = Math.max(localCooldownMs, you.cooldownMs) / COOLDOWN_MS

  const startLocalCooldown = () => {
    setLocalCooldownMs(COOLDOWN_MS)
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)
    cooldownTimerRef.current = setInterval(() => {
      setLocalCooldownMs(prev => {
        const next = prev - 100
        if (next <= 0) { clearInterval(cooldownTimerRef.current!); return 0 }
        return next
      })
    }, 100)
  }

  useEffect(() => () => {
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)
  }, [])

  const sendCommand = (cmd: string) => {
    send(cmd)
    startLocalCooldown()
    setVerb(null)
    setFreeText('')
  }

  const liveIngredients = [...new Set(snapshot.orders.flatMap(o => o.needed))]

  const formatTime = (ms: number) => {
    const s = Math.ceil(ms / 1000)
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  return (
    <div className={styles.controller}>
      <div className={styles.header}>
        <span className={styles.money}>${snapshot.money}</span>
        <span className={styles.timer}>{formatTime(snapshot.timeRemainingMs)}</span>
        {snapshot.teamMoney && (
          <span>🔴 ${snapshot.teamMoney.red} 🔵 ${snapshot.teamMoney.blue}</span>
        )}
        <span className={`${styles.conn} ${connected ? styles.connOn : styles.connOff}`} />
      </div>

      <div
        className={styles.cooldownBar}
        style={{ width: `${Math.min(1, cooldownPct) * 100}%` }}
      />

      <div className={styles.ordersStrip}>
        {snapshot.orders.length === 0
          ? <span style={{ opacity: 0.5, fontSize: '0.85rem' }}>No active orders</span>
          : snapshot.orders.map(o => (
            <div key={o.id} className={styles.orderChip}>
              <span className={styles.orderEmoji}>{o.emoji}</span>
              <span className={styles.orderName}>{o.dish}</span>
              <div className={styles.patienceBar}>
                <div
                  className={`${styles.patienceFill} ${o.patiencePct < 0.3 ? styles.patienceLow : ''}`}
                  style={{ width: `${o.patiencePct * 100}%` }}
                />
              </div>
            </div>
          ))
        }
      </div>

      <div className={styles.section}>Cook action</div>
      <div className={styles.verbGrid}>
        {VERBS.map(v => (
          <button
            key={v}
            className={`${styles.verbBtn} ${verb === v ? styles.selected : ''}`}
            disabled={isOnCooldown}
            onClick={() => setVerb(verb === v ? null : v)}
          >
            {v}
          </button>
        ))}
      </div>

      {verb && (
        <>
          <div className={styles.section}>Ingredient ({verb})</div>
          <div className={styles.ingredientGrid}>
            {liveIngredients.map(i => (
              <button
                key={i}
                className={styles.ingredientBtn}
                onClick={() => sendCommand(`${verb} ${i}`)}
              >
                {i}
              </button>
            ))}
          </div>
          <div className={styles.freeform}>
            <input
              className={styles.freeformInput}
              placeholder="type ingredient…"
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && freeText.trim()) {
                  sendCommand(`${verb} ${freeText.trim()}`)
                }
              }}
            />
            <button
              className={styles.freeformBtn}
              onClick={() => freeText.trim() && sendCommand(`${verb} ${freeText.trim()}`)}
            >
              Go
            </button>
          </div>
        </>
      )}

      {snapshot.orders.length > 0 && (
        <>
          <div className={styles.section}>Serve</div>
          <div className={styles.serveGrid}>
            {snapshot.orders.map(o => (
              <button
                key={o.id}
                className={styles.serveBtn}
                disabled={isOnCooldown}
                onClick={() => sendCommand(`serve ${o.id}`)}
              >
                {o.emoji} {o.dish}
              </button>
            ))}
          </div>
        </>
      )}

      {snapshot.stations.some(s => s.heatPct > 0 || s.overheated) && (
        <>
          <div className={styles.section}>Stations</div>
          <div className={styles.stationRow}>
            {snapshot.stations
              .filter(s => s.heatPct > 0 || s.overheated)
              .map(s => (
                <div key={s.name} className={styles.stationChip}>
                  <div className={styles.heatBar}>
                    <div
                      className={`${styles.heatFill} ${s.heatPct > 0.7 ? styles.heatHot : s.heatPct > 0.4 ? styles.heatWarm : ''}`}
                      style={{ width: `${Math.min(1, s.heatPct) * 100}%` }}
                    />
                  </div>
                  <span className={styles.stationLabel}>{s.name}</span>
                  {s.overheated
                    ? <button className={styles.extBtn} onClick={() => send(`!extinguish ${s.name}`)}>extinguish</button>
                    : <button className={styles.coolBtn} onClick={() => send(`!cool ${s.name}`)}>cool</button>
                  }
                </div>
              ))
            }
          </div>
        </>
      )}
    </div>
  )
}
