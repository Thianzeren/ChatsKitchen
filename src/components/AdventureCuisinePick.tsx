import { useEffect } from 'react'
import { CuisineId } from '../state/types'
import { useChoiceVote } from '../hooks/useChoiceVote'
import { RECIPES, RECIPE_SETS } from '../data/recipes'
import FoodIcon from './FoodIcon'
import styles from './AdventureCuisinePick.module.css'

const VOTE_DURATION_MS = 45_000

// Display order — index maps to chat vote keys !1..!6.
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
  const { state: voteState, registerVote, forceResolve, togglePause } = useChoiceVote(
    { numOptions: CUISINE_ORDER.length, durationMs: VOTE_DURATION_MS, allowDoneCommand: false },
    (res) => {
      const winnerIdx = res.winnerIdx >= 0 ? res.winnerIdx : 0
      const winner = CUISINE_ORDER[winnerIdx]
      onConfirm(winner.id)
    },
  )

  useEffect(() => {
    voteRef.current = registerVote
    return () => { voteRef.current = null }
  }, [voteRef, registerVote])

  const totalVotes = voteState.tallies.reduce((s, t) => s + t, 0)
  const timerPct = voteState.timeLeftMs !== null ? (voteState.timeLeftMs / VOTE_DURATION_MS) * 100 : 100

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Pick Your Cuisine</div>
          <div className={styles.subtitle}>
            Your run starts with one recipe from this cuisine; new dishes auto-unlock on
            shifts 2 and 3. Type <code>!1</code>–<code>!{CUISINE_ORDER.length}</code> to vote.
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

      <div className={styles.cuisineGrid}>
        {CUISINE_ORDER.map((entry, idx) => {
          const set = RECIPE_SETS.find(s => s.id === entry.setId)
          if (!set) return null
          const votes = voteState.tallies[idx] ?? 0
          const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
          return (
            <button
              key={entry.id}
              type="button"
              className={styles.card}
              onClick={() => { if (!voteState.resolved) forceResolve(idx) }}
              disabled={voteState.resolved}
            >
              <div className={styles.cardKey}>!{idx + 1}</div>
              <div className={styles.cardFlag}>{set.flag}</div>
              <div className={styles.cardName}>{set.name}</div>
              <div className={styles.cardDescription}>{set.description}</div>
              <div className={styles.cardRecipes}>
                {set.recipeKeys.map(key => {
                  const recipe = RECIPES[key]
                  if (!recipe) return null
                  return (
                    <span key={key} className={styles.cardRecipe} title={recipe.name}>
                      <FoodIcon icon={recipe.emoji} size={20} />
                      <span>{recipe.name}</span>
                    </span>
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
