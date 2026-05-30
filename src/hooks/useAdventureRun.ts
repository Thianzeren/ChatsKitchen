import { useState, useRef, useCallback, Dispatch, SetStateAction } from 'react'
import { GameOptions, AdventureRun, AdventureBestRun, ShiftResult, Screen, ActiveEventOptions, FinalStats } from '../state/types'
import { GameAction } from '../state/gameReducer'
import {
  getAdventureGoal, ADVENTURE_SHIFT_DURATION, makeRunSeed,
  ADVENTURE_TOTAL_SHIFTS, isBossShift,
} from '../data/adventureMode'
import {
  applyAllGarnishes, generateShopOffers, addOwnedGarnish,
} from '../data/adventureGarnishes'
import { generateRecipeOffers } from '../data/adventureRecipeDraft'
import { applyBossDebuff, pickBossForShift } from '../data/adventureBosses'

// ── localStorage migration ───────────────────────────────────────────────────

const BEST_RUN_KEY = 'chatsKitchen_adventureBestRun'

function loadAdventureBestRun(): AdventureBestRun | null {
  try {
    const saved = localStorage.getItem(BEST_RUN_KEY)
    if (!saved) return null
    const parsed = JSON.parse(saved) as Partial<AdventureBestRun>
    return {
      furthestShift: parsed.furthestShift ?? 0,
      totalMoney: parsed.totalMoney ?? 0,
      wonRuns: parsed.wonRuns ?? 0,
      bestEndedAt: parsed.bestEndedAt,
    }
  } catch { return null }
}

function persistAdventureBestRun(run: AdventureBestRun): void {
  try { localStorage.setItem(BEST_RUN_KEY, JSON.stringify(run)) } catch { /* ignore */ }
}

// ── Saved-run persistence (resume between sessions) ─────────────────────────
// We save the whole AdventureRun + lobby roster at shift boundaries (after a
// new briefing is set up). Mid-shift game state is not persisted — resuming
// always drops the player back into the upcoming shift's briefing.

const SAVED_RUN_KEY = 'chatsKitchen_savedAdventureRun'

export interface SavedAdventureRun {
  version: 2
  run: AdventureRun
  lobby: string[]
  savedAt: number
}

export function loadSavedAdventureRun(): SavedAdventureRun | null {
  try {
    const raw = localStorage.getItem(SAVED_RUN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SavedAdventureRun>
    if (parsed.version !== 2 || !parsed.run || !Array.isArray(parsed.lobby)) return null
    return parsed as SavedAdventureRun
  } catch { return null }
}

function persistSavedAdventureRun(run: AdventureRun, lobby: string[]): void {
  try {
    const payload: SavedAdventureRun = { version: 2, run, lobby, savedAt: Date.now() }
    localStorage.setItem(SAVED_RUN_KEY, JSON.stringify(payload))
  } catch { /* ignore */ }
}

function clearSavedAdventureRun(): void {
  try { localStorage.removeItem(SAVED_RUN_KEY) } catch { /* ignore */ }
}

// ── Shop reroll pricing ──────────────────────────────────────────────────────

const REROLL_BASE_PRICE = 25

// Reroll price scales with reroll count (doubles each time) and with crew size,
// keeping the cost-per-team-member roughly constant across solo vs big-chat runs.
function getRerollPrice(rerollCount: number, participantCount: number = 1): number {
  const crew = Math.max(1, participantCount)
  return REROLL_BASE_PRICE * Math.pow(2, rerollCount) * crew
}

// ── Per-shift reset composition ──────────────────────────────────────────────

// Compose the RESET action payload. Boss debuff applies first; garnishes layer
// on top so a Slow Burner garnish can partially counteract a Heatwave boss.
function buildShiftReset(
  run: AdventureRun,
  boss: { id: string; disabledStationId?: string } | undefined,
): Extract<GameAction, { type: 'RESET' }> {
  const bossDelta = boss?.id
    ? applyBossDebuff(boss.id, boss.disabledStationId)
    : { options: {}, state: {} as const }

  const baseOrderSpeed = bossDelta.options.orderSpeed ?? 1
  const baseOrderSpawn = bossDelta.options.orderSpawnRate ?? 1

  const delta = applyAllGarnishes(run.ownedGarnishes, {
    cookingSpeed: 1,
    orderSpeed: baseOrderSpeed,
    orderSpawnRate: baseOrderSpawn,
  }, run.currentShift)

  const heatMul = (delta.state.heatPerCookMultiplier ?? 1) * (bossDelta.state.heatPerCookMultiplier ?? 1)
  const coolBonus = (delta.state.coolAmountBonus ?? 0) + (bossDelta.state.coolAmountBonus ?? 0)

  const orderPatienceBonusCombined =
    (delta.state.orderPatienceBonus ?? 0) + (bossDelta.state.orderPatienceBonus ?? 0)

  return {
    type: 'RESET',
    shiftDuration: ADVENTURE_SHIFT_DURATION,
    cookingSpeed: delta.options.cookingSpeed ?? 1,
    orderSpeed: delta.options.orderSpeed ?? baseOrderSpeed,
    orderSpawnRate: delta.options.orderSpawnRate ?? baseOrderSpawn,
    enabledRecipes: run.currentRecipes,
    teams: undefined,
    participantCount: 0,
    heatPerCookMultiplier: heatMul === 1 ? undefined : heatMul,
    coolAmountBonus: coolBonus === 0 ? undefined : coolBonus,
    flatTipPerOrder: delta.state.flatTipPerOrder,
    choppingCookTimeMultiplier: delta.state.choppingCookTimeMultiplier,
    orderPatienceBonus: orderPatienceBonusCombined === 0 ? undefined : orderPatienceBonusCombined,
    overheatThreshold: delta.state.overheatThreshold,
    bossMoneyMultiplier: bossDelta.state.bossMoneyMultiplier,
    cooldownMultiplier: bossDelta.state.cooldownMultiplier,
    disabledStations: bossDelta.state.disabledStations,
    activeGarnishes: run.ownedGarnishes.map(g => g.garnishId),
    activeBossDebuff: boss?.id,
    lostOrderPenalty: bossDelta.state.lostOrderPenalty,
  }
}

const EVENTS_OFF: ActiveEventOptions = {
  kitchenEventsEnabled: false,
  enabledKitchenEvents: [],
  kitchenEventSpawnMin: 999,
  kitchenEventSpawnMax: 999,
  kitchenEventDuration: 12,
}

// Mid-run event mix: 2 hazards + 3 opportunities, calibrated for streamer pacing.
// Enabled from S3 onward.
const EVENTS_ADVENTURE: ActiveEventOptions = {
  kitchenEventsEnabled: true,
  enabledKitchenEvents: ['angry_chef', 'smoke_blast', 'mystery_recipe', 'dance', 'chefs_chant'],
  kitchenEventSpawnMin: 60,
  kitchenEventSpawnMax: 120,
  kitchenEventDuration: 18,
}

// Chaos Mode boss: same event set, but spawn cadence tightens to 20–40s.
const EVENTS_ADVENTURE_CHAOS: ActiveEventOptions = {
  ...EVENTS_ADVENTURE,
  kitchenEventSpawnMin: 20,
  kitchenEventSpawnMax: 40,
}

// Pick the right event config for a given shift + chosen path card.
function pickEventOptions(shift: number, bossId: string | undefined): ActiveEventOptions {
  if (shift < 3) return EVENTS_OFF
  if (bossId === 'chaos_mode') return EVENTS_ADVENTURE_CHAOS
  return EVENTS_ADVENTURE
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAdventureRun(
  dispatch: Dispatch<GameAction>,
  setScreen: (s: Screen) => void,
  setActiveEventOptions: Dispatch<SetStateAction<ActiveEventOptions | null>>,
  activeGameOptionsRef: { current: GameOptions | null },
  finalStatsRef: { current: FinalStats },
  adventureLobbyRef: { current: string[] | null },
) {
  const [adventureRun, setAdventureRun] = useState<AdventureRun | null>(null)
  const adventureRunRef = useRef<AdventureRun | null>(null)
  adventureRunRef.current = adventureRun

  const [adventureBestRun, setAdventureBestRun] = useState<AdventureBestRun | null>(loadAdventureBestRun)
  const [isNewBestAdventureRun, setIsNewBestAdventureRun] = useState(false)

  // Per-shop-visit reroll counter (resets each time the shop opens).
  const rerollCountRef = useRef(0)

  // ── startAdventure: begin a brand-new run ──────────────────────────────────

  // startAdventure: create a fresh run and open the opening recipe draft.
  const startAdventure = useCallback(() => {
    const roster = adventureLobbyRef.current ?? []
    const participantCount = Math.max(1, roster.length)
    const shift = 1
    const runSeed = makeRunSeed()
    const run: AdventureRun = {
      runSeed,
      currentShift: shift,
      shiftResults: [],
      currentRunMoney: 0,
      currentRecipes: [],
      currentGoal: getAdventureGoal(shift, participantCount),
      participantCount,
      ownedGarnishes: [],
      accumulatedPlayerStats: {},
      pendingRecipeOffers: generateRecipeOffers(runSeed, shift, []),
    }
    setAdventureRun(run)
    setIsNewBestAdventureRun(false)
    persistSavedAdventureRun(run, roster)
    setScreen('adventurerecipepick')
  }, [setScreen, adventureLobbyRef])

  // ── handleShiftEndDone: called when the shift timer runs out ───────────────

  const handleShiftEndDone = useCallback(() => {
    const run = adventureRunRef.current
    if (!run) { setScreen('gameover'); return }

    const fs = finalStatsRef.current
    const passed = fs.money >= run.currentGoal
    const result: ShiftResult = {
      shiftNumber: run.currentShift,
      recipes: run.currentRecipes,
      goalMoney: run.currentGoal,
      moneyEarned: fs.money,
      served: fs.served,
      lost: fs.lost,
      passed,
      bossDebuffId: run.currentBoss?.id,
    }
    const isFinalShift = run.currentShift >= ADVENTURE_TOTAL_SHIFTS
    const updatedRun: AdventureRun = {
      ...run,
      shiftResults: [...run.shiftResults, result],
      currentRunMoney: passed ? run.currentRunMoney + fs.money : run.currentRunMoney,
      runWon: passed && isFinalShift ? true : run.runWon,
    }

    if (!passed) {
      // Failed: persist best run and end the run. Clear any saved-run state
      // so the menu's Resume pill no longer surfaces this dead run.
      clearSavedAdventureRun()
      setAdventureRun(updatedRun)
      const totalMoney = updatedRun.shiftResults.reduce((sum, r) => sum + r.moneyEarned, 0)
      setAdventureBestRun(prev => {
        const better = !prev
          || updatedRun.currentShift > prev.furthestShift
          || (updatedRun.currentShift === prev.furthestShift && totalMoney > prev.totalMoney)
        if (better) {
          const best: AdventureBestRun = {
            furthestShift: updatedRun.currentShift,
            totalMoney,
            wonRuns: prev?.wonRuns ?? 0,
            bestEndedAt: Date.now(),
          }
          persistAdventureBestRun(best)
          setIsNewBestAdventureRun(true)
          return best
        }
        return prev
      })
      setScreen('adventurerunend')
      return
    }

    if (isFinalShift) {
      // Run won — record win and end on the run-end screen. Clear save: there's
      // nothing left to resume.
      clearSavedAdventureRun()
      setAdventureRun(updatedRun)
      const totalMoney = updatedRun.shiftResults.reduce((sum, r) => sum + r.moneyEarned, 0)
      setAdventureBestRun(prev => {
        const wonRuns = (prev?.wonRuns ?? 0) + 1
        const better = !prev
          || ADVENTURE_TOTAL_SHIFTS > prev.furthestShift
          || (ADVENTURE_TOTAL_SHIFTS === prev.furthestShift && totalMoney > prev.totalMoney)
        const best: AdventureBestRun = {
          furthestShift: better ? ADVENTURE_TOTAL_SHIFTS : (prev?.furthestShift ?? ADVENTURE_TOTAL_SHIFTS),
          totalMoney: better ? totalMoney : (prev?.totalMoney ?? totalMoney),
          wonRuns,
          bestEndedAt: Date.now(),
        }
        persistAdventureBestRun(best)
        setIsNewBestAdventureRun(better)
        return best
      })
      setScreen('adventurerunend')
      return
    }

    // Passed (and not the final shift) — go to the shift-passed screen.
    setAdventureRun(updatedRun)
    setScreen('adventureshiftpassed')
  }, [setScreen, finalStatsRef])

  // ── openRecipePick: from adventureshiftpassed → recipepick for the upcoming shift.
  const openRecipePick = useCallback(() => {
    setAdventureRun(prev => {
      if (!prev) return prev
      const nextShift = prev.currentShift + 1
      const offers = generateRecipeOffers(prev.runSeed, nextShift, prev.currentRecipes)
      return { ...prev, pendingRecipeOffers: offers }
    })
    setScreen('adventurerecipepick')
  }, [setScreen])

  // ── resolveRecipePick: shared add-or-skip resolution. The opening draft (no shifts
  // played yet) sets up shift 1 and routes to the briefing; between-shift picks
  // route to the Pantry shop.
  const resolveRecipePick = useCallback((addedRecipe: string | null) => {
    const isOpeningDraft = (adventureRunRef.current?.shiftResults.length ?? 0) === 0
    setAdventureRun(prev => {
      if (!prev) return prev
      const currentRecipes = addedRecipe ? [...prev.currentRecipes, addedRecipe] : prev.currentRecipes
      const updated: AdventureRun = { ...prev, currentRecipes, pendingRecipeOffers: undefined }
      if (isOpeningDraft) {
        dispatch(buildShiftReset(updated, updated.currentBoss))
        setActiveEventOptions(pickEventOptions(updated.currentShift, updated.currentBoss?.id))
        activeGameOptionsRef.current = null
        persistSavedAdventureRun(updated, adventureLobbyRef.current ?? [])
        return updated
      }
      // Between-shift pick → set up the Pantry shop offers for the upcoming shift.
      rerollCountRef.current = 0
      const offers = generateShopOffers(updated.runSeed, updated.ownedGarnishes, updated.currentShift + 1, updated.participantCount, 4)
      return { ...updated, pendingShopOffers: offers }
    })
    setScreen(isOpeningDraft ? 'adventurebriefing' : 'adventurepantryshop')
  }, [dispatch, setScreen, setActiveEventOptions, activeGameOptionsRef, adventureLobbyRef])

  const confirmRecipePick = useCallback((offerIdx: number) => {
    const offers = adventureRunRef.current?.pendingRecipeOffers
    resolveRecipePick(offers?.[offerIdx] ?? null)
  }, [resolveRecipePick])

  const skipRecipePick = useCallback(() => {
    resolveRecipePick(null)
  }, [resolveRecipePick])

  // ── purchaseGarnish: chat or click bought offer N (0-indexed) ──────────────

  const purchaseGarnish = useCallback((offerIdx: number) => {
    setAdventureRun(prev => {
      if (!prev || !prev.pendingShopOffers) return prev
      const offer = prev.pendingShopOffers[offerIdx]
      if (!offer) return prev
      if (prev.currentRunMoney < offer.price) return prev   // insufficient funds (UI should guard)

      const newOwned = addOwnedGarnish(prev.ownedGarnishes, offer.garnishId, prev.currentShift + 1)
      // No replenish — splice the bought offer out, the rest of the menu stays as-is.
      const newOffers = prev.pendingShopOffers.filter((_, i) => i !== offerIdx)
      return {
        ...prev,
        currentRunMoney: prev.currentRunMoney - offer.price,
        ownedGarnishes: newOwned,
        pendingShopOffers: newOffers,
      }
    })
  }, [])

  const rerollShopOffers = useCallback((): boolean => {
    let success = false
    setAdventureRun(prev => {
      if (!prev) return prev
      const price = getRerollPrice(rerollCountRef.current, prev.participantCount)
      if (prev.currentRunMoney < price) return prev
      rerollCountRef.current += 1
      success = true
      // Vary the seed per reroll so each reroll yields fresh offers (the initial
      // shop uses the plain runSeed; rerolls append the reroll index).
      const offers = generateShopOffers(`${prev.runSeed}::r${rerollCountRef.current}`, prev.ownedGarnishes, prev.currentShift + 1, prev.participantCount, 4)
      return {
        ...prev,
        currentRunMoney: prev.currentRunMoney - price,
        pendingShopOffers: offers,
      }
    })
    return success
  }, [])

  // ── closeShop: finalise garnishes, advance to next shift's briefing ─────────

  const closeShop = useCallback(() => {
    setAdventureRun(prev => {
      if (!prev) return prev
      const nextShift = prev.currentShift + 1

      const liveRoster = adventureLobbyRef.current
      const nextParticipantCount = liveRoster && liveRoster.length > 0
        ? liveRoster.length
        : prev.participantCount

      const currentGoal = getAdventureGoal(nextShift, nextParticipantCount)

      // Auto-assign a boss on boss shifts (seeded); clear it otherwise.
      const currentBoss = isBossShift(nextShift)
        ? pickBossForShift(prev.runSeed, nextShift, prev.currentRecipes)
        : undefined

      const updatedRun: AdventureRun = {
        ...prev,
        currentShift: nextShift,
        currentGoal,
        participantCount: nextParticipantCount,
        currentRunMoney: prev.currentRunMoney,
        currentBoss,
        pendingShopOffers: undefined,
      }

      dispatch(buildShiftReset(updatedRun, currentBoss))
      setActiveEventOptions(pickEventOptions(nextShift, currentBoss?.id))
      activeGameOptionsRef.current = null
      persistSavedAdventureRun(updatedRun, liveRoster ?? [])
      return updatedRun
    })
    setScreen('adventurebriefing')
  }, [dispatch, setScreen, setActiveEventOptions, activeGameOptionsRef, adventureLobbyRef])

  const resetAdventureBestRun = useCallback(() => {
    setAdventureBestRun(null)
  }, [])

  // ── hydrateAdventureRun: restore from a saved snapshot ─────────────────────
  // Caller is responsible for restoring the lobby roster (owned by useAdventureLobby).
  // This sets up the run state, dispatches RESET so the GameState matches the
  // briefing, and navigates to the briefing screen.
  const hydrateAdventureRun = useCallback((saved: SavedAdventureRun) => {
    setAdventureRun(saved.run)
    setIsNewBestAdventureRun(false)
    dispatch(buildShiftReset(saved.run, saved.run.currentBoss))
    setActiveEventOptions(pickEventOptions(saved.run.currentShift, saved.run.currentBoss?.id))
    activeGameOptionsRef.current = null
    setScreen('adventurebriefing')
  }, [dispatch, setScreen, setActiveEventOptions, activeGameOptionsRef])

  // ── resumeAdventureRun: re-enter the briefing after lobby management ───────
  // Recomputes participantCount + currentGoal from the live lobby roster and
  // re-dispatches RESET (idempotent on briefing — no in-flight cooking state
  // can exist here). Then navigates back to adventurebriefing.
  const resumeAdventureRun = useCallback(() => {
    setAdventureRun(prev => {
      if (!prev) return prev
      const liveRoster = adventureLobbyRef.current ?? []
      const nextParticipantCount = Math.max(1, liveRoster.length)
      const currentGoal = getAdventureGoal(prev.currentShift, nextParticipantCount)
      const updatedRun: AdventureRun = { ...prev, participantCount: nextParticipantCount, currentGoal }
      dispatch(buildShiftReset(updatedRun, prev.currentBoss))
      setActiveEventOptions(pickEventOptions(prev.currentShift, prev.currentBoss?.id))
      activeGameOptionsRef.current = null
      persistSavedAdventureRun(updatedRun, liveRoster)
      return updatedRun
    })
    setScreen('adventurebriefing')
  }, [dispatch, setScreen, setActiveEventOptions, activeGameOptionsRef, adventureLobbyRef])

  return {
    // State
    adventureRun, setAdventureRun, adventureRunRef,
    adventureBestRun, isNewBestAdventureRun,

    // Flow callbacks (lobby → recipe pick → briefing → playing → recipe pick → shop → next briefing)
    startAdventure,
    handleShiftEndDone,
    openRecipePick, confirmRecipePick, skipRecipePick,
    purchaseGarnish, rerollShopOffers, closeShop,
    resumeAdventureRun,
    hydrateAdventureRun,
    clearSavedAdventureRun,
    getRerollPrice: () => getRerollPrice(rerollCountRef.current, adventureRunRef.current?.participantCount ?? 1),

    resetAdventureBestRun,
  }
}
