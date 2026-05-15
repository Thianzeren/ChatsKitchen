import { useState, useRef, useEffect } from 'react'
import type { SharedSnapshot } from '../shared/protocol'
import styles from './Controller.module.css'

const VALID_VERBS = new Set([
  'chop','grill','fry','boil','toast','roast','stirfry','steam','simmer',
  'cook','mix','grind','knead','serve','cool','extinguish',
])
const COOLDOWN_MS = 1500

type FeedbackKind = 'invalid' | 'busy'

function formatTime(ms: number): string {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

interface Props {
  snapshot: SharedSnapshot
  send: (command: string) => void
  connected: boolean
  roomCode: string
  onExit: () => void
}

export default function Controller({ snapshot, send, connected, roomCode, onExit }: Props) {
  const [text, setText] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [confirmingExit, setConfirmingExit] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: FeedbackKind; label: string; key: number } | null>(null)
  const [onCooldown, setOnCooldown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const feedbackKeyRef = useRef(0)

  const showFeedback = (kind: FeedbackKind, label: string) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    feedbackKeyRef.current += 1
    setFeedback({ kind, label, key: feedbackKeyRef.current })
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 1600)
  }

  const startCooldown = () => {
    setOnCooldown(true)
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current)
    cooldownTimerRef.current = setTimeout(() => setOnCooldown(false), COOLDOWN_MS)
  }

  useEffect(() => () => {
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current)
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
  }, [])

  const handleSend = () => {
    const cmd = text.trim()
    if (!cmd) return

    if (onCooldown) {
      showFeedback('busy', 'Still Busy')
      return
    }

    const parts = cmd.replace(/^!/, '').toLowerCase().trim().split(/\s+/)
    const verb = parts[0]
    if (!VALID_VERBS.has(verb) || parts.length < 2) {
      showFeedback('invalid', 'Invalid Command')
      return
    }

    send(cmd)
    setHistory(prev => [...prev.slice(-49), cmd.toLowerCase()])
    setText('')
    inputRef.current?.focus()
    startCooldown()
  }

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight
    }
  }, [history])

  const flashClass = feedback?.kind === 'invalid' ? styles.flashRed
    : feedback?.kind === 'busy' ? styles.flashOrange
    : ''

  return (
    <div className={styles.controller}>
      {/* Screen flash overlay */}
      {feedback && flashClass && (
        <div key={`flash-${feedback.key}`} className={`${styles.flashOverlay} ${flashClass}`} />
      )}

      {/* Floating feedback text */}
      {feedback && (
        <div
          key={`float-${feedback.key}`}
          className={`${styles.floatingFeedback} ${
            feedback.kind === 'invalid' ? styles.floatingInvalid : styles.floatingBusy
          }`}
        >
          {feedback.label}
        </div>
      )}

      <div className={styles.header}>
        <span className={styles.money}>${snapshot.money}</span>
        <span className={styles.timer}>{formatTime(snapshot.timeRemainingMs)}</span>
        <div className={styles.headerRight}>
          {snapshot.teamMoney && (
            <span className={styles.teamMoney}>
              🔴 ${snapshot.teamMoney.red} 🔵 ${snapshot.teamMoney.blue}
            </span>
          )}
          <span className={styles.roomCode}>{roomCode}</span>
          <span className={`${styles.conn} ${connected ? styles.connOn : styles.connOff}`} />
          {confirmingExit ? (
            <>
              <span className={styles.exitConfirmLabel}>Leave?</span>
              <button className={styles.exitConfirmYes} onClick={onExit}>Yes</button>
              <button className={styles.exitConfirmNo} onClick={() => setConfirmingExit(false)}>No</button>
            </>
          ) : (
            <button className={styles.exitBtn} onClick={() => setConfirmingExit(true)}>✕</button>
          )}
        </div>
      </div>

      <div className={styles.history} ref={historyRef}>
        {history.length === 0
          ? <span className={styles.historyHint}>Type commands below — e.g. chop lettuce · serve 1</span>
          : history.map((cmd, i) => (
            <div key={i} className={styles.historyEntry}>
              <span className={styles.historyPrompt}>!</span>{cmd}
            </div>
          ))
        }
      </div>

      <div className={styles.inputRow}>
        <input
          ref={inputRef}
          className={styles.chatInput}
          value={text}
          placeholder="chop lettuce · serve 1 · cool grill…"
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        <button className={styles.sendBtn} onClick={handleSend}>Send</button>
      </div>
    </div>
  )
}
