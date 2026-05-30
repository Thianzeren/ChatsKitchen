import { useEffect, useState, Fragment } from 'react'
import { useChoiceVote } from '../hooks/useChoiceVote'
import { RECIPES } from '../data/recipes'
import { getRecipeProfile } from '../data/recipeProfile'
import { orderStepsForDisplay } from '../data/recipeSteps'
import { getAudioManager } from '../audio/AudioManager'
import styles from './AdventureRecipePick.module.css'

const VOTE_DURATION_MS = 45_000
const VISIBLE = 3

interface Props {
  offers: string[]                 // recipe keys (1–3)
  shiftNumber: number
  rosterSize: number
  allowSkip: boolean               // false for the opening draft (must pick a first dish)
  onConfirm: (offerIdx: number) => void
  onSkip: () => void
  voteRef: { current: ((user: string, text: string) => boolean) | null }
}

export default function AdventureRecipePick({ offers, shiftNumber, rosterSize, allowSkip, onConfirm, onSkip, voteRef }: Props) {
  const [carouselStart, setCarouselStart] = useState(0)

  const { state: voteState, registerVote, forceResolve, togglePause } = useChoiceVote(
    { numOptions: offers.length, durationMs: VOTE_DURATION_MS, allowDoneCommand: allowSkip },
    (res) => {
      getAudioManager().playSfx('serve-success')
      if (res.reason === 'done_command') { onSkip(); return }
      const winnerIdx = res.winnerIdx >= 0 ? res.winnerIdx : 0
      onConfirm(winnerIdx)
    },
  )

  useEffect(() => {
    voteRef.current = registerVote
    return () => { voteRef.current = null }
  }, [voteRef, registerVote])

  const totalVotes = voteState.tallies.reduce((s, t) => s + t, 0)
  const timerPct = voteState.timeLeftMs !== null ? (voteState.timeLeftMs / VOTE_DURATION_MS) * 100 : 100
  const canShiftLeft = carouselStart > 0
  const canShiftRight = carouselStart < offers.length - VISIBLE

  return (
    <div className={styles.screen}>
      <div className={styles.topbar}>
        <div>
          <div className={styles.title}>Add a Recipe</div>
          <div className={styles.subtitle}>
            Shift {shiftNumber}. Type <code>!1</code>–<code>!{offers.length}</code> to add a dish to your menu
            {allowSkip ? <> or <code>!skip</code> to add none.</> : <> for your opening menu.</>}
          </div>
        </div>
        <div className={styles.crewBadge}>
          <span className={styles.crewBadgeValue}>{rosterSize}</span>
          <span className={styles.crewBadgeLabel}>{rosterSize === 1 ? 'chef' : 'chefs'}</span>
        </div>
      </div>

      <div className={`${styles.timerBar} ${voteState.paused ? styles.timerBarPaused : ''}`}>
        <div className={styles.timerFill} style={{ width: `${timerPct}%` }} />
        {voteState.paused && <div className={styles.timerPausedLabel}>⏸ PAUSED</div>}
      </div>

      <div className={styles.carouselArea}>
        <button
          className={`${styles.navArrow} ${!canShiftLeft ? styles.navArrowDisabled : ''}`}
          disabled={!canShiftLeft}
          onClick={() => setCarouselStart(s => Math.max(0, s - 1))}
          aria-label="Scroll left"
        >‹</button>

        <div className={styles.cardsViewport}>
          {offers.slice(carouselStart, carouselStart + VISIBLE).map((key, relativeIdx) => {
            const absoluteIdx = carouselStart + relativeIdx
            const r = RECIPES[key]
            if (!r) return null
            const profile = getRecipeProfile(r)
            const votes = voteState.tallies[absoluteIdx] ?? 0
            const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
            return (
              <button
                key={key}
                type="button"
                className={styles.card}
                onClick={() => { if (!voteState.resolved) forceResolve(absoluteIdx) }}
                disabled={voteState.resolved}
              >
                <div className={styles.cardKey}>!{absoluteIdx + 1}</div>
                <div className={styles.cardHero}>{r.emoji}</div>
                <div className={styles.cardName}>{r.name}</div>

                <div className={styles.statRow}>
                  <div className={styles.statTile}>
                    <div className={styles.statValue}>
                      <span className={styles.pipsFilled}>{'●'.repeat(profile.complexityPips)}</span>
                      <span className={styles.pipsEmpty}>{'○'.repeat(3 - profile.complexityPips)}</span>
                    </div>
                    <div className={styles.statLabel}>Complexity</div>
                  </div>
                  <div className={styles.statTile}>
                    <div className={`${styles.statValue} ${styles.statReward}`}>${profile.reward}</div>
                    <div className={styles.statLabel}>Reward</div>
                  </div>
                  <div className={styles.statTile}>
                    <div className={styles.statValue}>~{Math.round(profile.prepTimeMs / 1000)}s</div>
                    <div className={styles.statLabel}>Prep Time</div>
                  </div>
                </div>

                <div className={`${styles.steps} ${r.steps.length >= 4 ? styles.stepsDense : ''}`}>
                  {orderStepsForDisplay(r.steps).map((step, i) => (
                    <Fragment key={i}>
                      {i > 0 && (
                        <div className={styles.stepConnector}>
                          {step.requires
                            ? <span className={styles.connectorThen}>↓ then</span>
                            : <span className={styles.connectorAnd}>+ and</span>}
                        </div>
                      )}
                      <div className={styles.stepRow}>
                        <span className={styles.stepNum}>{i + 1}</span>
                        <span className={styles.stepAction}>{step.action}</span>
                        <span className={styles.stepTarget}>{step.target.replace(/_/g, ' ')}</span>
                      </div>
                    </Fragment>
                  ))}
                </div>

                <div className={styles.cardFooter}>
                  <span className={styles.cardVotes}>{votes} {votes === 1 ? 'vote' : 'votes'}{totalVotes > 0 ? ` · ${pct}%` : ''}</span>
                </div>
                <div className={styles.cardVoteBar}>
                  <div className={styles.cardVoteFill} style={{ width: `${pct}%` }} />
                </div>
              </button>
            )
          })}
        </div>

        <button
          className={`${styles.navArrow} ${!canShiftRight ? styles.navArrowDisabled : ''}`}
          disabled={!canShiftRight}
          onClick={() => setCarouselStart(s => Math.min(offers.length - VISIBLE, s + 1))}
          aria-label="Scroll right"
        >›</button>
      </div>

      <div className={styles.actions}>
        <button className={styles.pauseBtn} onClick={togglePause} disabled={voteState.resolved}>
          {voteState.paused ? '▶ Resume' : '⏸ Pause'}
        </button>
        {allowSkip && (
          <button className={styles.backBtn} onClick={() => { if (!voteState.resolved) onSkip() }} disabled={voteState.resolved}>
            Skip (add none)
          </button>
        )}
      </div>
    </div>
  )
}
