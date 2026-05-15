import { useState } from 'react'
import type { SharedSnapshot } from '../shared/protocol'
import styles from './Lobby.module.css'

interface Props {
  nickname: string
  stage: string
  snapshot: SharedSnapshot | null
  send: (cmd: string) => void
  connected: boolean
  onExit: () => void
}

export default function Lobby({ nickname, stage, snapshot, send, connected, onExit }: Props) {
  const [team, setTeam] = useState<'red' | 'blue' | null>(null)
  const isPvP = snapshot?.teamMoney !== undefined

  if (stage === 'gameover' && snapshot) {
    return (
      <div className={styles.screen}>
        <div className={styles.title}>Game Over!</div>
        <div className={styles.money}>${snapshot.money}</div>
        {snapshot.teamMoney && (
          <>
            <div>🔴 Red: ${snapshot.teamMoney.red}</div>
            <div>🔵 Blue: ${snapshot.teamMoney.blue}</div>
          </>
        )}
        <div className={styles.divider} />
        <div className={styles.subtitle}>Wait for the host to start a new round…</div>
        <div className={styles.conn}>
          <span className={`${styles.dot} ${connected ? styles.dotOn : ''}`} />
          {connected ? 'Connected' : 'Reconnecting…'}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      <div className={styles.title}>🍳 Kitchen Lobby</div>
      <div className={styles.nickname}>Playing as {nickname}</div>
      <div className={styles.subtitle}>Waiting for the host to start…</div>

      {isPvP && (
        <>
          <div className={styles.subtitle}>Pick your team:</div>
          <div className={styles.teamRow}>
            <button
              className={`${styles.teamBtn} ${styles.redBtn} ${team === 'red' ? styles.active : ''}`}
              onClick={() => { setTeam('red'); send('!red') }}
            >
              🔴 Red
            </button>
            <button
              className={`${styles.teamBtn} ${styles.blueBtn} ${team === 'blue' ? styles.active : ''}`}
              onClick={() => { setTeam('blue'); send('!blue') }}
            >
              🔵 Blue
            </button>
          </div>
          {team && <div className={styles.team}>You're on {team === 'red' ? '🔴 Red' : '🔵 Blue'} team</div>}
        </>
      )}

      <div className={styles.conn}>
        <span className={`${styles.dot} ${connected ? styles.dotOn : ''}`} />
        {connected ? 'Connected' : 'Reconnecting…'}
      </div>

      <button className={styles.exitBtn} onClick={onExit}>Leave Room</button>
    </div>
  )
}
