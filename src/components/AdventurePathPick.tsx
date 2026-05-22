import { useEffect } from 'react'
import { PathCard } from '../state/types'
import { useChoiceVote } from '../hooks/useChoiceVote'
import { BOSSES, BossId } from '../data/adventureBosses'
import { STATION_DEFS } from '../data/recipes'
import { getAudioManager } from '../audio/AudioManager'
import AdventureProgressDots from './AdventureProgressDots'
import styles from './AdventurePathPick.module.css'

const VOTE_DURATION_MS = 30_000

interface Props {
  cards: [PathCard, PathCard]
  shiftNumber: number
  baseGoal: number
  onConfirm: (cardIdx: number) => void
  voteRef: { current: ((user: string, text: string) => boolean) | null }
}

export default function AdventurePathPick({ cards, shiftNumber, baseGoal, onConfirm, voteRef }: Props) {
  const { state: voteState, registerVote, forceResolve, togglePause } = useChoiceVote(
    { numOptions: 2, durationMs: VOTE_DURATION_MS, allowDoneCommand: false },
    (res) => {
      const winnerIdx = res.winnerIdx >= 0 ? res.winnerIdx : 0
      // Use error-buzzer for boss-card selection (you just locked in a debuff),
      // serve-success for the safer easy/risk picks.
      const isBoss = cards[winnerIdx]?.archetype === 'boss'
      getAudioManager().playSfx(isBoss ? 'error-buzzer' : 'serve-success')
      onConfirm(winnerIdx)
    },
  )

  useEffect(() => {
    voteRef.current = registerVote
    return () => { voteRef.current = null }
  }, [voteRef, registerVote])

  const totalVotes = voteState.tallies.reduce((s, t) => s + t, 0)
  const timerPct = voteState.timeLeftMs !== null ? (voteState.timeLeftMs / VOTE_DURATION_MS) * 100 : 100
  const isBossPick = cards[0].archetype === 'boss'

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>{isBossPick ? `Boss Shift ${shiftNumber}` : `Choose Your Path — Shift ${shiftNumber}`}</div>
          <div className={styles.subtitle}>
            {isBossPick
              ? <>Pick the lesser evil. Type <code>!1</code> or <code>!2</code> to vote.</>
              : <>Two ways to play the next shift. Type <code>!1</code> or <code>!2</code> to vote.</>}
          </div>
        </div>
        <AdventureProgressDots currentShift={shiftNumber} />
      </div>

      <div className={`${styles.timerBar} ${voteState.paused ? styles.timerBarPaused : ''}`}>
        <div className={styles.timerFill} style={{ width: `${timerPct}%` }} />
        {voteState.paused && <div className={styles.timerPausedLabel}>⏸ PAUSED</div>}
      </div>

      <div className={styles.cardsGrid}>
        {cards.map((card, idx) => {
          const votes = voteState.tallies[idx] ?? 0
          const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
          return (
            <PathCardView
              key={card.id}
              card={card}
              idx={idx}
              baseGoal={baseGoal}
              votes={votes}
              totalVotes={totalVotes}
              votePct={pct}
              onClick={() => { if (!voteState.resolved) forceResolve(idx) }}
              disabled={voteState.resolved}
            />
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
      </div>
    </div>
  )
}

// ── PathCardView ────────────────────────────────────────────────────────────

interface PathCardViewProps {
  card: PathCard
  idx: number
  baseGoal: number
  votes: number
  totalVotes: number
  votePct: number
  onClick: () => void
  disabled: boolean
}

function PathCardView({ card, idx, baseGoal, votes, totalVotes, votePct, onClick, disabled }: PathCardViewProps) {
  const archetypeClass =
    card.archetype === 'easy' ? styles.archetypeEasy :
    card.archetype === 'risk' ? styles.archetypeRisk :
                                styles.archetypeBoss

  const effectiveGoal = Math.round(baseGoal * (1 + card.goalDelta) / 5) * 5
  const goalDeltaLabel = card.goalDelta === 0 ? null
    : card.goalDelta > 0 ? `+${Math.round(card.goalDelta * 100)}% harder`
    : `${Math.round(card.goalDelta * 100)}% easier`

  const boss = card.bossDebuffId ? BOSSES[card.bossDebuffId as BossId] : null
  const inspectorStationName = card.bossPayload?.disabledStationId
    ? STATION_DEFS[card.bossPayload.disabledStationId]?.name
    : null

  return (
    <button
      type="button"
      className={`${styles.card} ${archetypeClass}`}
      onClick={onClick}
      disabled={disabled}
    >
      <div className={styles.ribbon}>{card.archetype.toUpperCase()}</div>
      <span className={styles.cardKey}>!{idx + 1}</span>

      <div className={styles.cardLabel}>{card.label}</div>

      {boss && (
        <div className={styles.bossBlock}>
          <div className={styles.bossIcon}>{boss.icon}</div>
          <div className={styles.bossDesc}>
            {boss.description}
            {inspectorStationName && (
              <div className={styles.bossExtra}>📋 Disabled: <strong>{inspectorStationName}</strong></div>
            )}
          </div>
        </div>
      )}

      {!boss && (
        <>
          {card.icon && <div className={styles.variantIcon}>{card.icon}</div>}
          <div className={styles.flavor}>
            {card.flavor ?? (card.archetype === 'easy'
              ? 'A breather shift. Lower goal, no extras.'
              : 'Same goal, cash bonus on pass.')}
          </div>
        </>
      )}

      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Goal</div>
          <div className={styles.statValue}>${effectiveGoal}</div>
          {goalDeltaLabel && <div className={styles.statHint}>{goalDeltaLabel}</div>}
        </div>
        {card.rewardOnPass?.cashBonus !== undefined && (
          <div className={styles.stat}>
            <div className={styles.statLabel}>On Pass</div>
            <div className={styles.statValue}>+${card.rewardOnPass.cashBonus}</div>
            <div className={styles.statHint}>cash bonus</div>
          </div>
        )}
      </div>

      <div className={styles.cardVoteBar}>
        <div className={styles.cardVoteFill} style={{ width: `${votePct}%` }} />
      </div>
      <div className={styles.cardVotes}>{votes} {votes === 1 ? 'vote' : 'votes'}{totalVotes > 0 ? ` · ${votePct}%` : ''}</div>
    </button>
  )
}
