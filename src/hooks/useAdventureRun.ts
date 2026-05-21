import { useState, useRef, useCallback, Dispatch, SetStateAction } from 'react'
import { GameOptions, AdventureRun, AdventureBestRun, ShiftResult, Screen, ActiveEventOptions, FinalStats, CuisineId, PathCard } from '../state/types'
import { GameAction } from '../state/gameReducer'
import {
  getAdventureGoal, getAdventureShiftDuration,
  pickStartingRecipe, pickAutoUnlockRecipe, pickRandomCuisine, makeRunSeed,
  getAutoUnlockedRecipeCount,
  ADVENTURE_TOTAL_SHIFTS,
  mergePlayerStats,
} from '../data/adventureMode'
import {
  applyAllGarnishes, generateShopOffers, getGarnish, getGarnishPrice, addOwnedGarnish,
} from '../data/adventureGarnishes'

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
      bestStartCuisine: parsed.bestStartCuisine,
      bestEndedAt: parsed.bestEndedAt,
    }
  } catch { return null }
}

function persistAdventureBestRun(run: AdventureBestRun): void {
  try { localStorage.setItem(BEST_RUN_KEY, JSON.stringify(run)) } catch { /* ignore */ }
}

// ── Shop reroll pricing ──────────────────────────────────────────────────────

const REROLL_BASE_PRICE = 100

// Reroll price scales with reroll count (doubles each time) and with crew size,
// keeping the cost-per-team-member roughly constant across solo vs big-chat runs.
function getRerollPrice(rerollCount: number, participantCount: number = 1): number {
  const crew = Math.max(1, participantCount)
  return REROLL_BASE_PRICE * Math.pow(2, rerollCount) * crew
}

// ── Per-shift reset composition ──────────────────────────────────────────────

// Compose the RESET action payload from the run's current state.
// Applies (in order): default options → path-card modifiers → boss debuff → owned garnishes.
function buildShiftReset(
  run: AdventureRun,
  pathCard: PathCard | undefined,
  bossDebuffId: string | undefined,
): Extract<GameAction, { type: 'RESET' }> {
  // Start from the per-shift baseline.
  const baseCookingSpeed = 1
  const baseOrderSpeed = 1
  const baseOrderSpawn = 1
  const shiftDuration = getAdventureShiftDuration()

  // (PR-2/3) path-card / boss adjustments will mutate these; for PR-1 they're no-ops.
  void pathCard
  void bossDebuffId

  // Apply owned garnishes on top of the baseline.
  const delta = applyAllGarnishes(run.ownedGarnishes, {
    cookingSpeed: baseCookingSpeed,
    orderSpeed: baseOrderSpeed,
    orderSpawnRate: baseOrderSpawn,
  }, run.currentShift)

  return {
    type: 'RESET',
    shiftDuration,
    cookingSpeed: delta.options.cookingSpeed ?? baseCookingSpeed,
    orderSpeed: delta.options.orderSpeed ?? baseOrderSpeed,
    orderSpawnRate: delta.options.orderSpawnRate ?? baseOrderSpawn,
    enabledRecipes: run.currentRecipes,
    teams: undefined,
    participantCount: 0,
    heatPerCookMultiplier: delta.state.heatPerCookMultiplier,
    coolAmountBonus: delta.state.coolAmountBonus,
    flatTipPerOrder: delta.state.flatTipPerOrder,
    freeExtinguishes: delta.state.freeExtinguishes,
    recipePriceModifier: delta.state.recipePriceModifier,
    eventThresholdMultiplier: delta.state.eventThresholdMultiplier,
    activeGarnishes: run.ownedGarnishes.map(g => g.garnishId),
  }
}

const EVENTS_OFF: ActiveEventOptions = {
  kitchenEventsEnabled: false,
  enabledKitchenEvents: [],
  kitchenEventSpawnMin: 999,
  kitchenEventSpawnMax: 999,
  kitchenEventDuration: 12,
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

  const startAdventure = useCallback((cuisine?: CuisineId) => {
    // PR-2: the cuisine is picked via chat vote on the cuisinepick screen and
    // passed in here. If no cuisine was supplied (e.g. legacy callers), fall back
    // to a random one so the run still starts.
    const startCuisine: CuisineId = cuisine ?? pickRandomCuisine()
    const startingRecipe = pickStartingRecipe(startCuisine)
    const shift = 1
    const unlockedRecipes = [startingRecipe]
    const currentRecipes = unlockedRecipes.slice(0, getAutoUnlockedRecipeCount(shift))

    // participantCount is read from the live Adventure lobby roster at run start.
    // If the lobby was never opened (e.g. legacy entry from gameover Play Again), we
    // fall back to 1 so the run can still proceed.
    const roster = adventureLobbyRef.current ?? []
    const participantCount = Math.max(1, roster.length)

    const run: AdventureRun = {
      runSeed: makeRunSeed(),
      startCuisine,
      currentShift: shift,
      shiftResults: [],
      currentRunMoney: 0,
      unlockedRecipes,
      currentRecipes,
      currentGoal: getAdventureGoal(shift, participantCount),
      participantCount,
      ownedGarnishes: [],
      accumulatedPlayerStats: {},
    }

    setAdventureRun(run)
    setIsNewBestAdventureRun(false)
    setActiveEventOptions(EVENTS_OFF)
    activeGameOptionsRef.current = null
    dispatch(buildShiftReset(run, undefined, undefined))
    setScreen('adventurebriefing')
  }, [dispatch, setScreen, setActiveEventOptions, activeGameOptionsRef, adventureLobbyRef])

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
    }
    const isFinalShift = run.currentShift >= ADVENTURE_TOTAL_SHIFTS
    const updatedRun: AdventureRun = {
      ...run,
      shiftResults: [...run.shiftResults, result],
      currentRunMoney: passed ? run.currentRunMoney + fs.money : run.currentRunMoney,
      runWon: passed && isFinalShift ? true : run.runWon,
    }

    if (!passed) {
      // Failed: persist best run and end the run.
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
            bestStartCuisine: updatedRun.startCuisine,
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
      // Run won — record win and end on the run-end screen.
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
          bestStartCuisine: better ? updatedRun.startCuisine : prev?.bestStartCuisine,
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

  // ── openPantryShop: from adventureshiftpassed → pantry ─────────────────────

  const openPantryShop = useCallback(() => {
    setAdventureRun(prev => {
      if (!prev) return prev
      rerollCountRef.current = 0
      const offers = generateShopOffers(prev.ownedGarnishes, prev.currentShift + 1, prev.participantCount, 4)
      return { ...prev, pendingShopOffers: offers }
    })
    setScreen('adventurepantryshop')
  }, [setScreen])

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
      const offers = generateShopOffers(prev.ownedGarnishes, prev.currentShift + 1, prev.participantCount, 4)
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

      // Auto-unlock a new recipe from the starting cuisine on shifts 2 and 3.
      let newUnlocked = prev.unlockedRecipes
      if (newUnlocked.length < getAutoUnlockedRecipeCount(nextShift)) {
        const newRecipe = pickAutoUnlockRecipe({ ...prev, currentShift: nextShift })
        if (newRecipe) newUnlocked = [...newUnlocked, newRecipe]
      }

      // PR-1: use the first N unlocked recipes (up to 3). PR-2 will let path cards
      // and shop unlocks influence which recipes are active each shift.
      const targetCount = Math.min(3, Math.max(getAutoUnlockedRecipeCount(nextShift), newUnlocked.length))
      const currentRecipes = newUnlocked.slice(0, targetCount)

      // Recompute participantCount from the live Adventure lobby roster so mid-run
      // !leave / !kick changes apply at the next shift boundary. If the lobby was
      // cleared (e.g. legacy run with no lobby), hold the previous count.
      const liveRoster = adventureLobbyRef.current
      const nextParticipantCount = liveRoster && liveRoster.length > 0
        ? liveRoster.length
        : prev.participantCount

      const updatedRun: AdventureRun = {
        ...prev,
        currentShift: nextShift,
        unlockedRecipes: newUnlocked,
        currentRecipes,
        currentGoal: getAdventureGoal(nextShift, nextParticipantCount),
        participantCount: nextParticipantCount,
        pendingShopOffers: undefined,
      }

      // Dispatch the new shift's RESET using the updated run.
      dispatch(buildShiftReset(updatedRun, undefined, undefined))
      // PR-2: events kick in from S3 onward via path-card modifiers.
      // PR-1: keep events off for the whole run.
      setActiveEventOptions(EVENTS_OFF)
      activeGameOptionsRef.current = null
      return updatedRun
    })
    setScreen('adventurebriefing')
  }, [dispatch, setScreen, setActiveEventOptions, activeGameOptionsRef, adventureLobbyRef])

  // ── handleGameOverStatsMerge: called from App.tsx after each shift ─────────
  // Wraps the existing mergePlayerStats logic in a stable hook callback so
  // App.tsx doesn't need to reach into mergePlayerStats itself for Adventure.

  // ── resetAdventureBestRun ─────────────────────────────────────────────────

  const resetAdventureBestRun = useCallback(() => {
    setAdventureBestRun(null)
  }, [])

  // ── Back-compat alias kept for App.tsx import; routes to openPantryShop ────

  const handleShiftPassedNext = openPantryShop

  return {
    // State
    adventureRun, setAdventureRun, adventureRunRef,
    adventureBestRun, isNewBestAdventureRun, setIsNewBestAdventureRun,

    // PR-1 flow callbacks
    startAdventure,
    handleShiftEndDone,
    openPantryShop, handleShiftPassedNext,
    purchaseGarnish, rerollShopOffers, closeShop,
    getRerollPrice: () => getRerollPrice(rerollCountRef.current, adventureRunRef.current?.participantCount ?? 1),

    // Lookup helpers (used by shop UI)
    getGarnishMeta: getGarnish,
    getOfferPrice: getGarnishPrice,

    // Misc
    resetAdventureBestRun,
    mergePlayerStats,
  }
}
