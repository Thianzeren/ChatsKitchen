import { useState } from 'react'
import { AdventureRun, AdventureBestRun, calcPlayerScore } from '../state/types'
import { RECIPES, NAME_COLORS, hashStr } from '../data/recipes'
import { GARNISHES } from '../data/adventureGarnishes'
import { BOSSES, BossId } from '../data/adventureBosses'
import { ADVENTURE_TOTAL_SHIFTS } from '../data/adventureMode'
import FoodIcon from './FoodIcon'
import AdventureSuccessOverlay from './AdventureSuccessOverlay'
import styles from './AdventureRunEnd.module.css'

interface Props {
  run: AdventureRun
  bestRun: AdventureBestRun | null
  isNewBestRun: boolean
  onPlayAgain: () => void
  onMenu: () => void
}

export default function AdventureRunEnd({ run, bestRun, isNewBestRun, onPlayAgain, onMenu }: Props) {
  const passedShifts = run.shiftResults.filter(r => r.passed).length
  const totalMoney   = run.shiftResults.reduce((sum, r) => sum + r.moneyEarned, 0)
  const totalServed  = run.shiftResults.reduce((sum, r) => sum + r.served, 0)
  const totalLost    = run.shiftResults.reduce((sum, r) => sum + r.lost, 0)

  const ownedGarnishes = run.ownedGarnishes
    .map(p => GARNISHES[p.garnishId])
    .filter((g): g is NonNullable<typeof g> => Boolean(g))

  const leaderboard = Object.entries(run.accumulatedPlayerStats)
    .sort(([, a], [, b]) => calcPlayerScore(b) - calcPlayerScore(a))

  const isWon = run.runWon === true
  const [showOverlay, setShowOverlay] = useState(isWon)

  const mvpEntry = leaderboard[0]
  const mvpName  = mvpEntry ? mvpEntry[0] : null
  const mvpScore = mvpEntry ? calcPlayerScore(mvpEntry[1]) : null

  return (
    <div className={`${styles.screen} ${isWon ? styles.screenWon : ''}`}>
      {/* ── LEFT ── */}
      <div className={styles.leftCol}>
        {isWon && (
          <div className={styles.completedBanner}>★ ADVENTURE COMPLETED ★</div>
        )}
        <h1 className={styles.title}>{isWon ? 'Run Won!' : 'Run Over'}</h1>

        <div className={styles.stats}>
          <div className={`${styles.stat} ${isWon ? styles.statHero : ''}`}>
            <div className={styles.statValue}>{passedShifts}</div>
            <div className={styles.statLabel}>Shifts Survived</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>${totalMoney}</div>
            <div className={styles.statLabel}>Total Earned</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{totalServed}</div>
            <div className={styles.statLabel}>Served</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{totalLost}</div>
            <div className={styles.statLabel}>Lost</div>
          </div>
        </div>

        {ownedGarnishes.length > 0 && (
          <div className={styles.garnishesPanel}>
            <div className={styles.garnishesTitle}>Garnishes Collected · {ownedGarnishes.length}</div>
            <div className={styles.garnishChips}>
              {ownedGarnishes.map(g => (
                <span key={g.id} className={`${styles.garnishChip} ${styles[`tier_${g.tier}`]}`} title={g.description}>
                  <span className={styles.garnishChipIcon}>{g.icon}</span>
                  {g.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {isNewBestRun && (
          <div className={styles.newBest}>New Best Run!</div>
        )}

        {bestRun && !isNewBestRun && (
          <div className={styles.bestChip}>
            Best run: Shift {bestRun.furthestShift} · ${bestRun.totalMoney}
            {bestRun.wonRuns > 0 ? ` · ${bestRun.wonRuns} won` : ''}
          </div>
        )}

        <div className={styles.buttons}>
          <button className={styles.playAgainBtn} onClick={onPlayAgain}>Play Again</button>
          <button className={styles.menuBtn} onClick={onMenu}>Main Menu</button>
        </div>
      </div>

      {/* ── RIGHT ── */}
      <div className={styles.rightCol}>
        <div className={styles.historyPanel}>
          <div className={styles.panelTitle}>Shift History</div>
          <div className={styles.historyHeader}>
            <span className={styles.historyShift}>#</span>
            <span className={styles.historyRecipes}>Recipes</span>
            <span className={styles.historyGoal}>Goal</span>
            <span className={styles.historyEarned}>Earned</span>
            <span className={styles.historyResult}>Result</span>
          </div>
          {run.shiftResults.map(r => {
            const boss = r.bossDebuffId ? BOSSES[r.bossDebuffId as BossId] : null
            return (
              <div
                key={r.shiftNumber}
                className={`${styles.historyRow} ${!r.passed ? styles.historyRowFail : ''}`}
              >
                <span className={styles.historyShift}>{r.shiftNumber}</span>
                <span className={styles.historyRecipes}>
                  {boss && (
                    <span className={styles.historyBoss} title={`${boss.name} — ${boss.description}`}>{boss.icon}</span>
                  )}
                  {r.recipes.map(k => <FoodIcon key={k} icon={RECIPES[k]?.emoji ?? '?'} size={18} />)}
                </span>
                <span className={styles.historyGoal}>${r.goalMoney}</span>
                <span className={styles.historyEarned}>${r.moneyEarned}</span>
                <span className={r.passed ? styles.resultPass : styles.resultFail}>
                  {r.passed ? 'PASS' : 'FAIL'}
                </span>
              </div>
            )
          })}
        </div>

        <div className={styles.leaderboard}>
          <div className={styles.lbStickyHead}>
            <div className={styles.lbTitle}>Leaderboard</div>
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
            <div className={styles.lbEmpty}>No players this run</div>
          ) : (
            leaderboard.map(([name, s], i) => {
              const color = NAME_COLORS[Math.abs(hashStr(name)) % NAME_COLORS.length]
              const isYou = name === 'You'
              const isMvp = isWon && i === 0
              return (
                <div
                  key={name}
                  className={`${styles.lbRow} ${isYou ? styles.lbYou : ''} ${isMvp ? styles.lbMvp : ''}`}
                >
                  <span className={styles.lbRank}>{isMvp ? '★' : i + 1}</span>
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

      {showOverlay && (
        <AdventureSuccessOverlay
          shiftCount={ADVENTURE_TOTAL_SHIFTS}
          dishCount={run.currentRecipes.length}
          mvpName={mvpName}
          mvpScore={mvpScore}
          onDismiss={() => setShowOverlay(false)}
        />
      )}
    </div>
  )
}
