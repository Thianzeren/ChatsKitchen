import { useState } from 'react'
import { PlayerStats, calcPlayerScore } from '../state/types'
import { NAME_COLORS, hashStr } from '../data/recipes'
import AdventureExitConfirm from './AdventureExitConfirm'
import styles from './AdventureShiftPassed.module.css'

interface Props {
  shiftNumber: number
  money: number
  goalMoney: number
  served: number
  lost: number
  cashBonus: number
  playerStats: Record<string, PlayerStats>
  onNext: () => void
  onMenu: () => void
}

export default function AdventureShiftPassed({ shiftNumber, money, goalMoney, served, lost, cashBonus, playerStats, onNext, onMenu }: Props) {
  const [confirmExit, setConfirmExit] = useState(false)

  const leaderboard = Object.entries(playerStats)
    .sort(([, a], [, b]) => calcPlayerScore(b) - calcPlayerScore(a))

  return (
    <div className={styles.screen}>
      {/* ── LEFT ── */}
      <div className={styles.leftCol}>
        <h1 className={styles.title}>Shift {shiftNumber} Passed!</h1>

        <div className={styles.goalLine}>
          <span className={styles.goalPassed}>✓ PASSED</span>
          <span className={styles.goalText}>${money} / ${goalMoney}</span>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <div className={styles.statValue}>${money}</div>
            <div className={styles.statLabel}>Money Earned</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{served}</div>
            <div className={styles.statLabel}>Orders Served</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{lost}</div>
            <div className={styles.statLabel}>Orders Lost</div>
          </div>
        </div>

        {cashBonus > 0 && (
          <div className={styles.bonusChip}>
            <span className={styles.bonusIcon}>💰</span>
            <span className={styles.bonusText}>Path bonus: <strong>+${cashBonus}</strong></span>
          </div>
        )}

        <div className={styles.earnedNote}>
          Earnings carry into the run bank — spend them in the Pantry next.
        </div>

        <div className={styles.buttons}>
          <button className={styles.nextBtn} onClick={onNext}>Choose Path →</button>
          <button className={styles.menuBtn} onClick={() => setConfirmExit(true)}>Main Menu</button>
        </div>
      </div>

      {/* ── RIGHT ── */}
      <div className={styles.rightCol}>
        <div className={styles.leaderboard}>
          <div className={styles.lbStickyHead}>
            <div className={styles.lbTitle}>Shift Leaderboard</div>
            <div className={styles.lbHeader}>
              <span className={styles.lbRank}>#</span>
              <span className={styles.lbName}>Player</span>
              <span className={styles.lbDetail} title="Cooked">🍳</span>
              <span className={styles.lbDetail} title="Served">✅</span>
              <span className={styles.lbDetail} title="Extinguished">🧯</span>
              <span className={styles.lbDetail} title="Cooled">❄️</span>
              <span className={styles.lbDetail} title="Event Participations">✨</span>
              <span className={styles.lbDetail} title="Fires Caused">🔥</span>
              <span className={styles.lbDetail} title="Bonus Points">⭐</span>
              <span className={styles.lbTotal}>Score</span>
            </div>
          </div>
          {leaderboard.length === 0 ? (
            <div className={styles.lbEmpty}>No players this shift</div>
          ) : (
            leaderboard.map(([name, s], i) => {
              const color = NAME_COLORS[Math.abs(hashStr(name)) % NAME_COLORS.length]
              const isYou = name === 'You'
              return (
                <div key={name} className={`${styles.lbRow} ${isYou ? styles.lbYou : ''}`}>
                  <span className={styles.lbRank}>{i + 1}</span>
                  <span className={styles.lbName} style={{ color }}>{name}</span>
                  <span className={styles.lbDetail}>{s.cooked}</span>
                  <span className={styles.lbDetail}>{s.served}</span>
                  <span className={styles.lbDetail}>{s.extinguished * 2}</span>
                  <span className={styles.lbDetail}>{s.cooled}</span>
                  <span className={styles.lbDetail}>{s.eventParticipations * 2}</span>
                  <span className={styles.lbDetail} style={{ color: '#d94f4f' }}>{s.firesCaused}</span>
                  <span className={styles.lbDetail} style={{ color: '#c4a020' }}>{s.bonusPoints > 0 ? `+${s.bonusPoints}` : '0'}</span>
                  <span className={styles.lbTotal}>{calcPlayerScore(s)}</span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {confirmExit && (
        <AdventureExitConfirm
          onConfirm={onMenu}
          onCancel={() => setConfirmExit(false)}
        />
      )}
    </div>
  )
}
