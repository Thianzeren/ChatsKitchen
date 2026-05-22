import { useState, useRef, useCallback, Dispatch, SetStateAction } from 'react'
import { GameOptions, AdventureRun, AdventureBestRun, ShiftResult, Screen, ActiveEventOptions, FinalStats, CuisineId, PathCard } from '../state/types'
import { GameAction } from '../state/gameReducer'
import {
  getAdventureGoal, ADVENTURE_SHIFT_DURATION,
  pickStartingRecipe, pickAutoUnlockRecipe, pickRandomCuisine, makeRunSeed,
  getAutoUnlockedRecipeCount,
  ADVENTURE_TOTAL_SHIFTS,
} from '../data/adventureMode'
import {
  applyAllGarnishes, generateShopOffers, addOwnedGarnish,
} from '../data/adventureGarnishes'
import { generatePathPair } from '../data/adventurePathCards'
import { applyBossDebuff } from '../data/adventureBosses'

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

// Compose the RESET action payload. Boss debuff applies first; garnishes layer
// on top so a Slow Burner garnish can partially counteract a Heatwave boss.
function buildShiftReset(
  run: AdventureRun,
  pathCard: PathCard | undefined,
): Extract<GameAction, { type: 'RESET' }> {
  const boss = pathCard?.bossDebuffId
    ? applyBossDebuff(pathCard)
    : { options: {}, state: {} as const }

  // Boss option adjustments fold into the baseline before garnishes stack on top.
  const baseOrderSpeed = boss.options.orderSpeed ?? 1
  const baseOrderSpawn = boss.options.orderSpawnRate ?? 1

  const delta = applyAllGarnishes(run.ownedGarnishes, {
    cookingSpeed: 1,
    orderSpeed: baseOrderSpeed,
    orderSpawnRate: baseOrderSpawn,
  }, run.currentShift)

  // Heat / cool: boss multiplier × garnish multiplier; boss bonus + garnish bonus.
  const heatMul = (delta.state.heatPerCookMultiplier ?? 1) * (boss.state.heatPerCookMultiplier ?? 1)
  const coolBonus = (delta.state.coolAmountBonus ?? 0) + (boss.state.coolAmountBonus ?? 0)

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
    orderPatienceBonus: delta.state.orderPatienceBonus,
    overheatThreshold: delta.state.overheatThreshold,
    bossMoneyMultiplier: boss.state.bossMoneyMultiplier,
    cooldownMultiplier: boss.state.cooldownMultiplier,
    disabledStations: boss.state.disabledStations,
    activeGarnishes: run.ownedGarnishes.map(g => g.garnishId),
    activeBossDebuff: pathCard?.bossDebuffId,
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
    // Shift 1 has no path-card pick yet — pass undefined for a neutral RESET.
    setActiveEventOptions(pickEventOptions(shift, undefined))
    activeGameOptionsRef.current = null
    dispatch(buildShiftReset(run, undefined))
    setScreen('adventurebriefing')
  }, [dispatch, setScreen, setActiveEventOptions, activeGameOptionsRef, adventureLobbyRef])

  // ── handleShiftEndDone: called when the shift timer runs out ───────────────

  const handleShiftEndDone = useCallback(() => {
    const run = adventureRunRef.current
    if (!run) { setScreen('gameover'); return }

    const fs = finalStatsRef.current
    const passed = fs.money >= run.currentGoal
    // Path-card cash bonus: awarded only if the shift passes. Cleared after.
    const cashBonus = passed ? (run.chosenPath?.rewardOnPass?.cashBonus ?? 0) : 0
    const result: ShiftResult = {
      shiftNumber: run.currentShift,
      recipes: run.currentRecipes,
      goalMoney: run.currentGoal,
      moneyEarned: fs.money,
      served: fs.served,
      lost: fs.lost,
      passed,
      chosenPathCardId: run.chosenPath?.id,
      bossDebuffId: run.chosenPath?.bossDebuffId,
      cashBonusEarned: cashBonus > 0 ? cashBonus : undefined,
    }
    const isFinalShift = run.currentShift >= ADVENTURE_TOTAL_SHIFTS
    const updatedRun: AdventureRun = {
      ...run,
      shiftResults: [...run.shiftResults, result],
      currentRunMoney: passed ? run.currentRunMoney + fs.money + cashBonus : run.currentRunMoney,
      chosenPath: undefined,   // consumed; the next path-pick generates fresh cards
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

  // ── openPathPick: from adventureshiftpassed → pathpick ─────────────────────

  const openPathPick = useCallback(() => {
    setAdventureRun(prev => {
      if (!prev) return prev
      const nextShift = prev.currentShift + 1
      const pair = generatePathPair(prev.runSeed, nextShift, prev.unlockedRecipes)
      return { ...prev, pendingPathCards: pair, chosenPath: undefined }
    })
    setScreen('adventurepathpick')
  }, [setScreen])

  // ── confirmPathCard: vote or click resolved the path; open shop next ───────

  const confirmPathCard = useCallback((cardIdx: number) => {
    setAdventureRun(prev => {
      if (!prev || !prev.pendingPathCards) return prev
      const chosen = prev.pendingPathCards[cardIdx]
      if (!chosen) return prev
      rerollCountRef.current = 0
      const offers = generateShopOffers(prev.ownedGarnishes, prev.currentShift + 1, prev.participantCount, 4)
      return {
        ...prev,
        chosenPath: chosen,
        pendingPathCards: undefined,
        pendingShopOffers: offers,
      }
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

      // Apply the chosen path card's goal delta to the next shift's goal.
      const baseGoal = getAdventureGoal(nextShift, nextParticipantCount)
      const goalDelta = prev.chosenPath?.goalDelta ?? 0
      const adjustedGoal = Math.round(baseGoal * (1 + goalDelta) / 5) * 5

      // Veteran's Tip garnish: +$15 to the bank at the start of every shift after S1.
      const veteransTipActive = prev.ownedGarnishes.some(g => g.garnishId === 'veterans_tip')
      const veteransTipBonus = veteransTipActive && nextShift > 1 ? 15 * Math.max(1, nextParticipantCount) : 0

      const updatedRun: AdventureRun = {
        ...prev,
        currentShift: nextShift,
        unlockedRecipes: newUnlocked,
        currentRecipes,
        currentGoal: adjustedGoal,
        participantCount: nextParticipantCount,
        currentRunMoney: prev.currentRunMoney + veteransTipBonus,
        pendingShopOffers: undefined,
      }

      // Dispatch the new shift's RESET using the updated run.
      // Pass the chosen path card so its boss debuff (if any) is applied.
      dispatch(buildShiftReset(updatedRun, prev.chosenPath))
      // Events kick in from S3 onward; Chaos Mode boss tightens the cadence to 20–40s.
      setActiveEventOptions(pickEventOptions(nextShift, prev.chosenPath?.bossDebuffId))
      activeGameOptionsRef.current = null
      return updatedRun
    })
    setScreen('adventurebriefing')
  }, [dispatch, setScreen, setActiveEventOptions, activeGameOptionsRef, adventureLobbyRef])

  const resetAdventureBestRun = useCallback(() => {
    setAdventureBestRun(null)
  }, [])

  // ── resumeAdventureRun: re-enter the briefing after lobby management ───────
  // Recomputes participantCount + currentGoal from the live lobby roster and
  // re-dispatches RESET (idempotent on briefing — no in-flight cooking state
  // can exist here). Then navigates back to adventurebriefing.
  const resumeAdventureRun = useCallback(() => {
    setAdventureRun(prev => {
      if (!prev) return prev
      const liveRoster = adventureLobbyRef.current ?? []
      const nextParticipantCount = Math.max(1, liveRoster.length)

      const baseGoal = getAdventureGoal(prev.currentShift, nextParticipantCount)
      const goalDelta = prev.chosenPath?.goalDelta ?? 0
      const adjustedGoal = Math.round(baseGoal * (1 + goalDelta) / 5) * 5

      const updatedRun: AdventureRun = {
        ...prev,
        participantCount: nextParticipantCount,
        currentGoal: adjustedGoal,
      }

      dispatch(buildShiftReset(updatedRun, prev.chosenPath))
      setActiveEventOptions(pickEventOptions(prev.currentShift, prev.chosenPath?.bossDebuffId))
      activeGameOptionsRef.current = null
      return updatedRun
    })
    setScreen('adventurebriefing')
  }, [dispatch, setScreen, setActiveEventOptions, activeGameOptionsRef, adventureLobbyRef])

  return {
    // State
    adventureRun, setAdventureRun, adventureRunRef,
    adventureBestRun, isNewBestAdventureRun,

    // Flow callbacks (lobby → cuisine → briefing → playing → path → shop → next briefing)
    startAdventure,
    handleShiftEndDone,
    openPathPick, confirmPathCard,
    purchaseGarnish, rerollShopOffers, closeShop,
    resumeAdventureRun,
    getRerollPrice: () => getRerollPrice(rerollCountRef.current, adventureRunRef.current?.participantCount ?? 1),

    resetAdventureBestRun,
  }
}
