import { useEffect, useMemo, useRef } from 'react'
import { AdventureRun, ShopOffer } from '../state/types'
import { useChoiceVote } from '../hooks/useChoiceVote'
import { GARNISHES } from '../data/adventureGarnishes'
import { getMenuTagCounts, TAG_ORDER } from '../data/recipeProfile'
import ArchetypeChip from './ArchetypeChip'
import { getAudioManager } from '../audio/AudioManager'
import type { VoteSnapshot } from '../shared/protocol'
import styles from './AdventurePantryShop.module.css'

const VOTE_DURATION_MS = 60_000

interface Props {
  run: AdventureRun
  onPurchase: (offerIdx: number) => void
  onReroll: () => boolean
  onClose: () => void
  voteRef: { current: ((user: string, text: string) => boolean) | null }
  snapshotRef?: { current: VoteSnapshot | null }
  rerollPrice: number
}

export default function AdventurePantryShop({ run, onPurchase, onReroll, onClose, voteRef, snapshotRef, rerollPrice }: Props) {
  const offers = useMemo(() => run.pendingShopOffers ?? [], [run.pendingShopOffers])
  const menuTagCounts = useMemo(() => getMenuTagCounts(run.currentRecipes), [run.currentRecipes])

  const { state: voteState, registerVote, reset: resetVote, forceResolve, togglePause } = useChoiceVote(
    { numOptions: Math.max(1, offers.length), durationMs: VOTE_DURATION_MS, allowDoneCommand: true },
    (res) => {
      if (res.reason === 'done_command') {
        onClose()
        return
      }
      // For 'force' (single-player click), always buy the explicitly chosen offer.
      // For 'timer', buy the plurality winner only if at least one chat vote was cast.
      const totalVotes = res.finalState.tallies.reduce((sum, t) => sum + t, 0)
      const shouldBuy = res.winnerIdx >= 0 && (res.reason === 'force' || totalVotes > 0)
      if (!shouldBuy) {
        onClose()
        return
      }
      const winner = offers[res.winnerIdx]
      if (!winner || run.currentRunMoney < winner.price) {
        onClose()
        return
      }
      // Tier-aware purchase sound: serve-success for legendary so chat hears the "win"
      const sfx = winner.rarity === 'legendary' ? 'serve-success' : 'take-item'
      getAudioManager().playSfx(sfx)
      onPurchase(res.winnerIdx)
      // Vote round auto-resets on the offers-changed effect below.
    },
  )

  // Register our vote handler with App.tsx for the duration this screen is mounted.
  useEffect(() => {
    voteRef.current = registerVote
    return () => { voteRef.current = null }
  }, [voteRef, registerVote])

  // Reset vote round when the offer set changes (after a purchase or reroll).
  const lastOffersKeyRef = useRef('')
  useEffect(() => {
    const key = offers.map(o => `${o.garnishId}:${o.price}`).join('|')
    if (key !== lastOffersKeyRef.current) {
      lastOffersKeyRef.current = key
      resetVote()
    }
  }, [offers, resetVote])

  // Auto-close when nothing affordable remains, or when every offer has been bought.
  const canAffordAny = offers.some(o => run.currentRunMoney >= o.price)
  const canAffordReroll = run.currentRunMoney >= rerollPrice
  useEffect(() => {
    if (!canAffordAny && !canAffordReroll) {
      const t = setTimeout(onClose, 1500)
      return () => clearTimeout(t)
    }
  }, [canAffordAny, canAffordReroll, onClose])

  const handleCardClick = (offerIdx: number) => {
    if (voteState.resolved) return
    const offer = offers[offerIdx]
    if (!offer || run.currentRunMoney < offer.price) return
    forceResolve(offerIdx)
  }

  const handleReroll = () => {
    if (!canAffordReroll) return
    const ok = onReroll()
    if (ok) getAudioManager().playSfx('cook-start')
  }

  const handleDone = () => {
    onClose()
  }

  const timerPct = voteState.timeLeftMs !== null
    ? (voteState.timeLeftMs / VOTE_DURATION_MS) * 100
    : 100

  // Publish the live vote view so the room snapshot loop can push voting UI to
  // phones. Written during render (idempotent) and cleared on unmount.
  if (snapshotRef) {
    snapshotRef.current = {
      kind: 'shop',
      title: 'The Pantry',
      instruction: offers.length > 0
        ? `Tap a garnish — or type !1–!${offers.length} / !done`
        : 'Closing pantry…',
      money: run.currentRunMoney,
      options: offers.map((offer, idx) => {
        const g = GARNISHES[offer.garnishId]
        return {
          index: idx + 1,
          label: g?.name ?? offer.garnishId,
          emoji: g?.icon ?? '🌿',
          detail: `$${offer.price} · ${offer.rarity}`,
          votes: voteState.tallies[idx] ?? 0,
          disabled: run.currentRunMoney < offer.price,
        }
      }),
      skipCommand: '!done',
      skipLabel: 'Done',
      timeLeftMs: voteState.timeLeftMs,
      timeMaxMs: VOTE_DURATION_MS,
      paused: voteState.paused,
      resolved: voteState.resolved,
    }
  }
  useEffect(() => () => { if (snapshotRef) snapshotRef.current = null }, [snapshotRef])

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.title}>The Pantry</div>
        <div className={styles.subtitle}>Spend earnings on garnishes. Type <code>!1</code>, <code>!2</code>… to vote, or <code>!done</code> to leave.</div>
        <div className={styles.cashBadge}>${run.currentRunMoney}</div>
      </div>

      {menuTagCounts.size > 0 && (
        <div className={styles.menuTags}>
          <span className={styles.menuTagsLabel}>Your menu:</span>
          {TAG_ORDER.filter(t => menuTagCounts.has(t)).map(t => (
            <ArchetypeChip key={t} tag={t} count={menuTagCounts.get(t)!} />
          ))}
        </div>
      )}

      <div className={`${styles.timerBar} ${voteState.paused ? styles.timerBarPaused : ''}`}>
        <div className={styles.timerFill} style={{ width: `${timerPct}%` }} />
        {voteState.paused && <div className={styles.timerPausedLabel}>⏸ PAUSED</div>}
      </div>

      <div className={styles.offersGrid}>
        {offers.map((offer, idx) => (
          <OfferCard
            key={`${offer.garnishId}_${idx}`}
            offer={offer}
            offerIdx={idx}
            votes={voteState.tallies[idx] ?? 0}
            totalVotes={voteState.tallies.reduce((s, t) => s + t, 0)}
            cashAvailable={run.currentRunMoney}
            onClick={() => handleCardClick(idx)}
            disabled={voteState.resolved || run.currentRunMoney < offer.price}
          />
        ))}
      </div>

      <div className={styles.actions}>
        <button
          className={styles.pauseBtn}
          onClick={togglePause}
          disabled={voteState.resolved}
          title={voteState.paused ? 'Resume the vote timer' : 'Pause the vote timer for discussion'}
        >
          {voteState.paused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button
          className={styles.rerollBtn}
          onClick={handleReroll}
          disabled={!canAffordReroll || voteState.resolved}
        >
          Refresh (${rerollPrice})
        </button>
        <button className={styles.doneBtn} onClick={handleDone} disabled={voteState.resolved}>
          Done {voteState.doneVoters.length > 0 ? `(${voteState.doneVoters.length})` : ''}
        </button>
      </div>

      {!canAffordAny && !canAffordReroll && (
        <div className={styles.outOfFunds}>
          {offers.length === 0 ? 'Menu cleared — closing pantry…' : 'Out of cash — closing pantry…'}
        </div>
      )}
    </div>
  )
}

// ── OfferCard ──────────────────────────────────────────────────────────────

interface OfferCardProps {
  offer: ShopOffer
  offerIdx: number
  votes: number
  totalVotes: number
  cashAvailable: number
  onClick: () => void
  disabled: boolean
}

function OfferCard({ offer, offerIdx, votes, totalVotes, cashAvailable, onClick, disabled }: OfferCardProps) {
  const garnish = GARNISHES[offer.garnishId]
  if (!garnish) return null

  const unaffordable = cashAvailable < offer.price
  const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
  const tierClass =
    offer.rarity === 'legendary' ? styles.tierLegendary :
    offer.rarity === 'rare'      ? styles.tierRare :
                                   styles.tierCommon

  return (
    <button
      type="button"
      className={`${styles.card} ${tierClass} ${unaffordable ? styles.cardUnaffordable : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <div className={styles.tierRibbon}>{offer.rarity}</div>
      <span className={styles.cardKey}>!{offerIdx + 1}</span>
      <div className={styles.cardIcon}>{garnish.icon}</div>
      <div className={styles.cardName}>{garnish.name}</div>
      <div className={styles.cardDescription}>{garnish.description}</div>
      <div className={styles.cardPrice}>${offer.price}</div>
      <div className={styles.cardVoteBar}>
        <div className={styles.cardVoteFill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.cardVotes}>{votes} {votes === 1 ? 'vote' : 'votes'}{totalVotes > 0 ? ` · ${pct}%` : ''}</div>
    </button>
  )
}
