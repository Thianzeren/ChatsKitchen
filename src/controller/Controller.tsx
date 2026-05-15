import { useState, useRef, useEffect } from 'react'
import type { SharedSnapshot, PartialPlayerView } from '../shared/protocol'
import styles from './Controller.module.css'

interface Props {
  snapshot: SharedSnapshot
  you: PartialPlayerView
  send: (command: string) => void
  connected: boolean
  roomCode: string
  onExit: () => void
}

export default function Controller({ snapshot, send, connected, roomCode, onExit }: Props) {
  const [text, setText] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [confirmingExit, setConfirmingExit] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)

  const formatTime = (ms: number) => {
    const s = Math.ceil(ms / 1000)
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  const handleSend = () => {
    const cmd = text.trim()
    if (!cmd) return
    send(cmd)
    setHistory(prev => [...prev.slice(-49), cmd])
    setText('')
    inputRef.current?.focus()
  }

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight
    }
  }, [history])

  return (
    <div className={styles.controller}>
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
