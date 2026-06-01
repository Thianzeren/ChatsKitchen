import { useEffect, useState } from 'react'
import type { VoteSnapshot } from '../shared/protocol'
import styles from './VoteScreen.module.css'

interface Props {
  nickname: string
  vote: VoteSnapshot
  send: (command: string) => void
  connected: boolean
  onExit: () => void
}

export default function VoteScreen({ nickname, vote, send, connected, onExit }: Props) {
  const [selected, setSelected] = useState<number | null>(null)
  const [confirmingExit, setConfirmingExit] = useState(false)

  // Reset the local selection highlight when a new vote round begins
  // (option set changes after a purchase, reroll, or moving to the next pick).
  const roundKey = vote.options.map(o => o.label).join('|')
  useEffect(() => { setSelected(null) }, [roundKey])

  const handleVote = (index: number, disabled?: boolean) => {
    if (vote.resolved || disabled) return
    setSelected(index)
    send(`!${index}`)
  }

  const handleSkip = () => {
    if (vote.resolved || !vote.skipCommand) return
    send(vote.skipCommand)
  }

  const timerPct = vote.timeLeftMs !== null && vote.timeMaxMs
    ? Math.max(0, Math.min(100, (vote.timeLeftMs / vote.timeMaxMs) * 100))
    : 100
  const secondsLeft = vote.timeLeftMs !== null ? Math.ceil(vote.timeLeftMs / 1000) : null

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.title}>{vote.title}</span>
          {vote.money !== undefined && <span className={styles.money}>${vote.money}</span>}
        </div>
        <div className={styles.instruction}>{vote.instruction}</div>
      </div>

      <div className={`${styles.timerBar} ${vote.paused ? styles.timerBarPaused : ''}`}>
        <div className={styles.timerFill} style={{ width: `${timerPct}%` }} />
        <span className={styles.timerLabel}>
          {vote.paused ? '⏸ PAUSED' : secondsLeft !== null ? `${secondsLeft}s` : ''}
        </span>
      </div>

      <div className={styles.options}>
        {vote.options.map(opt => {
          const isSelected = selected === opt.index
          return (
            <button
              key={opt.index}
              className={`${styles.option} ${isSelected ? styles.optionSelected : ''}`}
              onClick={() => handleVote(opt.index, opt.disabled)}
              disabled={vote.resolved || opt.disabled}
            >
              <span className={styles.optKey}>!{opt.index}</span>
              <span className={styles.optIcon}>{opt.emoji}</span>
              <span className={styles.optBody}>
                <span className={styles.optLabel}>{opt.label}</span>
                {opt.detail && <span className={styles.optDetail}>{opt.detail}</span>}
              </span>
              <span className={styles.optVotes}>{opt.votes}</span>
            </button>
          )
        })}
      </div>

      {vote.skipCommand && vote.skipLabel && (
        <button className={styles.skipBtn} onClick={handleSkip} disabled={vote.resolved}>
          {vote.skipLabel}
        </button>
      )}

      {vote.resolved && <div className={styles.resolved}>Locked in! Waiting for the host…</div>}

      <div className={styles.footer}>
        <span className={styles.nickname}>Playing as {nickname}</span>
        <div className={styles.footerRight}>
          <span className={`${styles.dot} ${connected ? styles.dotOn : ''}`} />
          {confirmingExit ? (
            <>
              <span className={styles.exitConfirmLabel}>Leave?</span>
              <button className={styles.exitConfirmYes} onClick={onExit}>Yes</button>
              <button className={styles.exitConfirmNo} onClick={() => setConfirmingExit(false)}>No</button>
            </>
          ) : (
            <button className={styles.exitBtn} onClick={() => setConfirmingExit(true)}>Leave</button>
          )}
        </div>
      </div>
    </div>
  )
}
