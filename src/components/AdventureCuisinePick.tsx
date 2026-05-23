import { useEffect, useState, Fragment } from 'react'
import { CuisineId } from '../state/types'
import { useChoiceVote } from '../hooks/useChoiceVote'
import { RECIPES, RECIPE_SETS } from '../data/recipes'
import { getAudioManager } from '../audio/AudioManager'
import FoodIcon from './FoodIcon'
import styles from './AdventureCuisinePick.module.css'

const VOTE_DURATION_MS = 45_000
const VISIBLE = 3

// Display order — index maps to chat vote keys !1..!6 regardless of carousel scroll.
const CUISINE_ORDER: { id: CuisineId; setId: string }[] = [
  { id: 'western',         setId: 'western_classics' },
  { id: 'chinese',         setId: 'chinese' },
  { id: 'korean',          setId: 'korean' },
  { id: 'japanese',        setId: 'japanese' },
  { id: 'japanese_bakery', setId: 'japanese_bakery' },
  { id: 'sg',              setId: 'sg_hawker' },
]

interface Props {
  rosterSize: number
  onConfirm: (cuisine: CuisineId) => void
  onBack: () => void
  voteRef: { current: ((user: string, text: string) => boolean) | null }
}

export default function AdventureCuisinePick({ rosterSize, onConfirm, onBack, voteRef }: Props) {
  const [carouselStart, setCarouselStart] = useState(0)

  const { state: voteState, registerVote, forceResolve, togglePause } = useChoiceVote(
    { numOptions: CUISINE_ORDER.length, durationMs: VOTE_DURATION_MS, allowDoneCommand: false },
    (res) => {
      const winnerIdx = res.winnerIdx >= 0 ? res.winnerIdx : 0
      getAudioManager().playSfx('serve-success')
      onConfirm(CUISINE_ORDER[winnerIdx].id)
    },
  )

  useEffect(() => {
    voteRef.current = registerVote
    return () => { voteRef.current = null }
  }, [voteRef, registerVote])

  const totalVotes = voteState.tallies.reduce((s, t) => s + t, 0)
  const timerPct = voteState.timeLeftMs !== null ? (voteState.timeLeftMs / VOTE_DURATION_MS) * 100 : 100
  const canShiftLeft = carouselStart > 0
  const canShiftRight = carouselStart < CUISINE_ORDER.length - VISIBLE

  return (
    <div className={styles.screen}>
      {/* Top bar */}
      <div className={styles.topbar}>
        <div>
          <div className={styles.title}>Pick Your Cuisine</div>
          <div className={styles.subtitle}>
            Your run starts with one recipe; new dishes auto-unlock on shifts 2 and 3.
            Type <code>!1</code>–<code>!{CUISINE_ORDER.length}</code> to vote.
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

      {/* Carousel */}
      <div className={styles.carouselArea}>
        <button
          className={`${styles.navArrow} ${!canShiftLeft ? styles.navArrowDisabled : ''}`}
          disabled={!canShiftLeft}
          onClick={() => setCarouselStart(s => Math.max(0, s - 1))}
          aria-label="Scroll left"
        >‹</button>

        <div className={styles.cardsViewport}>
          {CUISINE_ORDER.slice(carouselStart, carouselStart + VISIBLE).map((entry, relativeIdx) => {
            // Absolute idx is what !N keys and vote tallies use; the slice is just for what's visible.
            const absoluteIdx = carouselStart + relativeIdx
            const set = RECIPE_SETS.find(s => s.id === entry.setId)
            if (!set) return null
            const votes = voteState.tallies[absoluteIdx] ?? 0
            const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
            return (
              <button
                key={entry.id}
                type="button"
                className={`${styles.card} ${styles[`cuisine_${entry.id}`]}`}
                onClick={() => { if (!voteState.resolved) forceResolve(absoluteIdx) }}
                disabled={voteState.resolved}
              >
                <div className={styles.cardKey}>!{absoluteIdx + 1}</div>
                <div className={styles.cardFlagChip}>{set.flag}</div>
                <div className={styles.cardHero}>{set.emoji}</div>
                <div className={styles.cardName}>{set.name}</div>
                <div className={styles.cardDescription}>{set.description}</div>

                <div className={styles.cardRecipeList}>
                  {set.recipeKeys.map(key => {
                    const r = RECIPES[key]
                    if (!r) return null
                    return (
                      <div key={key} className={styles.cardRecipeRow}>
                        <FoodIcon icon={r.emoji} size={22} className={styles.cardRecipeEmoji} />
                        <div className={styles.cardRecipeBody}>
                          <div className={styles.cardRecipeHeader}>
                            <span className={styles.cardRecipeName}>{r.name}</span>
                            <span className={styles.cardRecipeReward}>${r.reward}</span>
                          </div>
                          <div className={styles.cardRecipeSteps}>
                            {r.steps.map((step, i) => (
                              <Fragment key={i}>
                                {i > 0 && (
                                  <span className={step.requires ? styles.stepArrow : styles.stepSeparator}>
                                    {step.requires ? '→' : '·'}
                                  </span>
                                )}
                                <code className={styles.stepChip}>{step.action} {step.target.replace(/_/g, ' ')}</code>
                              </Fragment>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
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
          onClick={() => setCarouselStart(s => Math.min(CUISINE_ORDER.length - VISIBLE, s + 1))}
          aria-label="Scroll right"
        >›</button>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.pauseBtn}
          onClick={togglePause}
          disabled={voteState.resolved}
        >
          {voteState.paused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button className={styles.backBtn} onClick={onBack} disabled={voteState.resolved}>
          ← Back to Lobby
        </button>
      </div>
    </div>
  )
}
