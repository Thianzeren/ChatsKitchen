import { useState, useEffect, useMemo } from 'react'
import { PlayerStats, RoundRecord, calcPlayerScore } from '../state/types'
import { NAME_COLORS, hashStr } from '../data/recipes'
import { getStarCount } from '../data/starThresholds'
import styles from './GameOver.module.css'

interface PvpResult {
  redMoney: number
  blueMoney: number
  redServed: number
  blueServed: number
}

interface Props {
  money: number
  served: number
  lost: number
  playerStats: Record<string, PlayerStats>
  teams?: Record<string, 'red' | 'blue'>
  level: number | null
  highScore?: number
  isNewHighScore?: boolean
  roundHistory?: RoundRecord[]
  autoRestart?: boolean
  autoRestartDelay?: number
  autoRestartSignal?: number
  pvpResult?: PvpResult
  starThresholds?: [number, number, number]
  onPlayAgain: () => void
  onNextLevel?: () => void
  onMenu: () => void
  onChangePlayset?: () => void
  onOpenLobby?: () => void
  onPvpLobby?: () => void
  onSetAutoRestart?: (enabled: boolean) => void
}

export default function GameOver({ money, served, lost, playerStats, teams, level, highScore, isNewHighScore, roundHistory, autoRestart, autoRestartDelay, autoRestartSignal, pvpResult, starThresholds, onPlayAgain, onNextLevel, onMenu, onChangePlayset, onOpenLobby, onPvpLobby, onSetAutoRestart }: Props) {
  const leaderboard = useMemo(
    () => Object.entries(playerStats).sort(([, a], [, b]) => calcPlayerScore(b) - calcPlayerScore(a)),
    [playerStats]
  )

  const starCount = starThresholds ? getStarCount(money, starThresholds) : null

  const mvps = useMemo(() => {
    if (!teams) return null
    const sortByActions = (a: [string, PlayerStats], b: [string, PlayerStats]) => calcPlayerScore(b[1]) - calcPlayerScore(a[1])
    const entries = Object.entries(playerStats)
    return {
      red:  entries.filter(([n]) => teams[n] === 'red').sort(sortByActions)[0] ?? null,
      blue: entries.filter(([n]) => teams[n] === 'blue').sort(sortByActions)[0] ?? null,
    }
  }, [playerStats, teams])

  const [countdown, setCountdown] = useState<number | null>(null)

  // Sync countdown when autoRestart changes or !onAutoRestart re-fires (signal increments)
  useEffect(() => {
    if (autoRestart) {
      setCountdown(autoRestartDelay ?? 60)
    } else {
      setCountdown(null)
    }
  }, [autoRestart, autoRestartDelay, autoRestartSignal])

  // Tick the countdown down and fire onPlayAgain at zero
  useEffect(() => {
    if (countdown === null) return
    if (countdown <= 0) {
      onPlayAgain()
      return
    }
    const id = setTimeout(() => setCountdown(c => (c ?? 1) - 1), 1000)
    return () => clearTimeout(id)
  }, [countdown, onPlayAgain])

  const bestRoundMoney = roundHistory && roundHistory.length > 0
    ? Math.max(...roundHistory.map(r => r.money))
    : null

  const allRounds = roundHistory
    ? [...roundHistory].reverse().map((r, i) => ({
        ...r,
        roundNum: roundHistory.length - i,
      }))
    : []

  return (
    <div className={styles.screen}>
      <div className={styles.leftCol}>
        {pvpResult && (() => {
          const { redMoney, blueMoney, redServed, blueServed } = pvpResult
          const winner = redMoney > blueMoney ? 'red' : blueMoney > redMoney ? 'blue' : 'tie'
          const bannerClass = winner === 'red' ? styles.pvpBannerRed
            : winner === 'blue' ? styles.pvpBannerBlue
            : styles.pvpBannerTie
          const labelClass = winner === 'red' ? styles.pvpWinnerLabelRed
            : winner === 'blue' ? styles.pvpWinnerLabelBlue
            : styles.pvpWinnerLabelTie
          const redWins = winner === 'red' || winner === 'tie'
          const blueWins = winner === 'blue' || winner === 'tie'
          return (
            <div className={`${styles.pvpBanner} ${bannerClass}`}>
              <div className={`${styles.pvpWinnerLabel} ${labelClass}`}>
                {winner === 'red' ? '🔴 Red Wins!' : winner === 'blue' ? '🔵 Blue Wins!' : '🤝 Tie!'}
              </div>
              <div className={styles.pvpTeams}>
                <div className={`${styles.pvpTeamRow} ${redWins ? '' : styles.pvpTeamRowLoser}`}>
                  <span className={`${redWins ? styles.pvpMoneyWin : styles.pvpMoneyLose} ${styles.pvpRedText}`}>
                    🔴 ${redMoney.toLocaleString()}
                  </span>
                  <span className={redWins ? styles.pvpServedWin : styles.pvpServedLose}>
                    · {redServed} served
                  </span>
                </div>
                <div className={`${styles.pvpTeamRow} ${blueWins ? '' : styles.pvpTeamRowLoser}`}>
                  <span className={`${blueWins ? styles.pvpMoneyWin : styles.pvpMoneyLose} ${styles.pvpBlueText}`}>
                    🔵 ${blueMoney.toLocaleString()}
                  </span>
                  <span className={blueWins ? styles.pvpServedWin : styles.pvpServedLose}>
                    · {blueServed} served
                  </span>
                </div>
              </div>
            </div>
          )
        })()}
        {level != null && <h1 className={styles.title}>{`Level ${level} Complete!`}</h1>}

        {starThresholds && (
          <div className={styles.starDisplay}>
            <div className={styles.finalStarRow}>
              {['★', '★', '★'].map((_, i) => (
                <span key={i} className={i < (starCount ?? 0) ? styles.finalStarFilled : styles.finalStarEmpty}>
                  {i < (starCount ?? 0) ? '★' : '☆'}
                </span>
              ))}
            </div>
            <div className={styles.starThresholdRef}>
              <span>★ ${starThresholds[0].toLocaleString()}</span>
              <span>★★ ${starThresholds[1].toLocaleString()}</span>
              <span>★★★ ${starThresholds[2].toLocaleString()}</span>
            </div>
          </div>
        )}

        <div className={styles.statMoney}>
          <div className={styles.statValue}>${money.toLocaleString()}</div>
          <div className={styles.statLabel}>Money Earned</div>
          {isNewHighScore && (
            <div className={styles.highScoreNew}>🏆 New High Score!</div>
          )}
        </div>

        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <div className={styles.statValueSmall}>{served}</div>
            <div className={styles.statLabelSmall}>Orders Served</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValueSmall}>{lost}</div>
            <div className={styles.statLabelSmall}>Orders Lost</div>
          </div>
        </div>

        <div className={styles.buttons}>
          {level != null && onNextLevel && level < 10 && (
            <button className={styles.playAgainBtn} onClick={onNextLevel}>
              Next Level
            </button>
          )}
          <button className={level != null ? styles.menuBtn : styles.playAgainBtn} onClick={onPlayAgain}>
            {level != null ? 'Repeat Level' : 'Play Again'}
          </button>
          <div className={styles.btnRow}>
            {onOpenLobby && (
              <button className={styles.menuBtn} onClick={onOpenLobby}>
                Back to Lobby
              </button>
            )}
            {onChangePlayset && (
              <button className={styles.menuBtn} onClick={onChangePlayset}>
                Change Playset
              </button>
            )}
            {onPvpLobby && (
              <button className={styles.menuBtn} onClick={onPvpLobby}>
                PvP Lobby
              </button>
            )}
            <button className={styles.menuBtn} onClick={onMenu}>
              Main Menu
            </button>
          </div>
        </div>

        {level === null && (
          <div className={styles.autoRestartBar}>
            {countdown !== null ? (
              <>
                <div className={styles.autoRestartText}>
                  Auto-restarting in <span className={styles.countdownNum}>{countdown}</span>s…
                </div>
                <div className={styles.autoRestartHint}>
                  <span>!start</span> to begin now · <span>!offAutoRestart</span> to cancel
                </div>
                <button className={styles.cancelBtn} onClick={() => { setCountdown(null); onSetAutoRestart?.(false) }}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <div className={styles.autoRestartText}>Auto-restart is OFF</div>
                <div className={styles.autoRestartHint}>
                  <span>!start</span> to begin now · <span>!onAutoRestart</span> to enable
                </div>
                {onSetAutoRestart && (
                  <button className={styles.enableBtn} onClick={() => {
                    onSetAutoRestart(true)
                    setCountdown(autoRestartDelay ?? 60)
                  }}>
                    Enable Auto-Restart
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className={styles.rightCol}>
        <div className={styles.panels}>
          {pvpResult && mvps && (() => {
            const mvpStat = (s: PlayerStats) => [
              { icon: '🍳', label: 'Cooked',  value: s.cooked },
              { icon: '✅', label: 'Served',  value: s.served },
              { icon: '🧯', label: 'Extinguished', value: s.extinguished },
              { icon: '❄️', label: 'Cooled',  value: s.cooled },
              { icon: '✨', label: 'Events',  value: s.eventParticipations },
              { icon: '🔥', label: 'Fires',   value: s.firesCaused },
            ]
            return (
              <div className={styles.mvpPanel}>
                <div className={styles.panelTitle}>⭐ MVP</div>
                <div className={styles.mvpCols}>
                  {[{ mvp: mvps.red, teamClass: styles.mvpCardRed, icon: '🔴' },
                    { mvp: mvps.blue, teamClass: styles.mvpCardBlue, icon: '🔵' }].map(({ mvp, teamClass, icon }) =>
                    mvp ? (
                      <div key={icon} className={`${styles.mvpCard} ${teamClass}`}>
                        <div className={styles.mvpCardName}>{icon} {mvp[0]}</div>
                        <div className={styles.mvpCardScore}>{calcPlayerScore(mvp[1])} pts</div>
                        <div className={styles.mvpStats}>
                          {mvpStat(mvp[1]).map(({ icon: ic, label, value }) => (
                            <div key={label} className={styles.mvpStatRow}>
                              <span className={styles.mvpStatIcon}>{ic}</span>
                              <span className={styles.mvpStatLabel}>{label}</span>
                              <span className={styles.mvpStatValue}>{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            )
          })()}
          {roundHistory !== undefined && !pvpResult && (
            <div className={styles.historyPanel}>
              <div className={styles.panelTitle}>
                Round History
                {highScore !== undefined && highScore > 0 && (
                  <span className={styles.historyBest}>Best: ${highScore}</span>
                )}
              </div>
              {roundHistory.length === 0 ? (
                <div className={styles.historyEmpty}>No rounds played yet</div>
              ) : (
                <>
                  <div className={styles.historyHeader}>
                    <span className={styles.historyRound}>#</span>
                    <span className={styles.historyMoney}>Money</span>
                    <span className={styles.historyServed}>{'\u{2705}'}</span>
                    <span className={styles.historyLost}>{'\u{274C}'}</span>
                  </div>
                  <div className={styles.historyScroll}>
                    {allRounds.map((r) => (
                      <div key={r.roundNum} className={`${styles.historyRow} ${r.money === bestRoundMoney ? styles.historyRowBest : ''}`}>
                        <span className={styles.historyRound}>{r.roundNum}</span>
                        <span className={styles.historyMoney}>${r.money}</span>
                        <span className={styles.historyServed}>{r.served}</span>
                        <span className={styles.historyLost}>{r.lost}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className={styles.leaderboard}>
            <div className={styles.lbStickyHead}>
              <div className={styles.lbTitle}>Leaderboard</div>
              <div className={styles.lbHeader}>
                <span className={styles.lbRank}>#</span>
                <span className={styles.lbName}>Player</span>
                <span className={styles.lbDetail} title="Cooked">{'\u{1F373}'}</span>
                <span className={styles.lbDetail} title="Served">{'\u{2705}'}</span>
                <span className={styles.lbDetail} title="Extinguished">{'\u{1F9EF}'}</span>
                <span className={styles.lbDetail} title="Cooled">{'\u{2744}'}</span>
                <span className={styles.lbDetail} title="Event Participations">{'\u{2728}'}</span>
                <span className={styles.lbDetail} title="Fires Caused">{'\u{1F525}'}</span>
                <span className={styles.lbDetail} title="Bonus Points">{'\u{2B50}'}</span>
                <span className={styles.lbTotal}>Score</span>
              </div>
            </div>
            <div className={styles.lbScrollBody}>
            {leaderboard.length === 0 ? (
              <div className={styles.lbEmpty}>No players this round</div>
            ) : (
              leaderboard.map(([name, stats], i) => {
                const color = NAME_COLORS[Math.abs(hashStr(name)) % NAME_COLORS.length]
                const isYou = name === 'You'
                const teamColor = teams?.[name]
                const teamClass = teamColor === 'red' ? styles.lbRed : teamColor === 'blue' ? styles.lbBlue : ''
                return (
                  <div key={name} className={`${styles.lbRow} ${isYou ? styles.lbYou : ''} ${teamClass}`}>
                    <span className={styles.lbRank}>{i + 1}</span>
                    <span className={styles.lbName} style={{ color }}>{name}</span>
                    <span className={styles.lbDetail}>{stats.cooked}</span>
                    <span className={styles.lbDetail}>{stats.served}</span>
                    <span className={styles.lbDetail}>{stats.extinguished}</span>
                    <span className={styles.lbDetail}>{stats.cooled}</span>
                    <span className={styles.lbDetail}>{stats.eventParticipations}</span>
                    <span className={styles.lbDetail} style={{ color: '#d94f4f' }}>{stats.firesCaused}</span>
                    <span className={styles.lbDetail} style={{ color: '#c4a020' }}>{stats.bonusPoints > 0 ? `+${stats.bonusPoints}` : '0'}</span>
                    <span className={styles.lbTotal}>{calcPlayerScore(stats)}</span>
                  </div>
                )
              })
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
