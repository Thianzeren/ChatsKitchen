import { useState, useRef, useCallback, Dispatch, SetStateAction } from 'react'
import { GameOptions, AdventureRun, AdventureBestRun, ShiftResult, Screen, ActiveEventOptions, FinalStats } from '../state/types'
import { GameAction } from '../state/gameReducer'
import { DEFAULT_GAME_OPTIONS } from '../state/defaultOptions'
import { ADVENTURE_SHIFT_DURATION, getAdventureGoal, pickAdventureRecipes } from '../data/adventureMode'

function dispatchAdventureReset(dispatch: Dispatch<GameAction>, recipes: string[]) {
  dispatch({
    type: 'RESET',
    shiftDuration: ADVENTURE_SHIFT_DURATION,
    cookingSpeed: 1,
    orderSpeed: 1,
    orderSpawnRate: 1,
    stationCapacity: DEFAULT_GAME_OPTIONS.stationCapacity,
    restrictSlots: false,
    enabledRecipes: recipes,
  })
}

export function useAdventureRun(
  dispatch: Dispatch<GameAction>,
  setScreen: (s: Screen) => void,
  setActiveEventOptions: Dispatch<SetStateAction<ActiveEventOptions | null>>,
  activeGameOptionsRef: { current: GameOptions | null },
  finalStatsRef: { current: FinalStats },
) {
  const [adventureRun, setAdventureRun] = useState<AdventureRun | null>(null)
  const adventureRunRef = useRef<AdventureRun | null>(null)
  adventureRunRef.current = adventureRun

  const [adventureBestRun, setAdventureBestRun] = useState<AdventureBestRun | null>(() => {
    try {
      const saved = localStorage.getItem('chatsKitchen_adventureBestRun')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [isNewBestAdventureRun, setIsNewBestAdventureRun] = useState(false)

  const startAdventure = useCallback(() => {
    setActiveEventOptions(null)
    activeGameOptionsRef.current = null
    setIsNewBestAdventureRun(false)
    const recipes = pickAdventureRecipes()
    const shift = 1
    const run: AdventureRun = {
      currentShift: shift,
      shiftResults: [],
      currentRecipes: recipes,
      currentGoal: getAdventureGoal(shift),
      accumulatedPlayerStats: {},
    }
    setAdventureRun(run)
    dispatchAdventureReset(dispatch, recipes)
    setScreen('adventurebriefing')
  }, [dispatch, setScreen, setActiveEventOptions, activeGameOptionsRef])

  const handleShiftPassedNext = useCallback(() => {
    const run = adventureRunRef.current
    if (!run) return
    const nextShift = run.currentShift + 1
    const nextRecipes = pickAdventureRecipes()
    setAdventureRun({
      ...run,
      currentShift: nextShift,
      currentRecipes: nextRecipes,
      currentGoal: getAdventureGoal(nextShift),
    })
    dispatchAdventureReset(dispatch, nextRecipes)
    setScreen('adventurebriefing')
  }, [dispatch, setScreen])

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
    const updatedRun: AdventureRun = {
      ...run,
      shiftResults: [...run.shiftResults, result],
    }

    if (passed) {
      setAdventureRun(updatedRun)
      setScreen('adventureshiftpassed')
    } else {
      setAdventureRun(updatedRun)
      const totalMoney = updatedRun.shiftResults.reduce((sum, r) => sum + r.moneyEarned, 0)
      setAdventureBestRun(prev => {
        const isNew = !prev
          || updatedRun.currentShift > prev.furthestShift
          || (updatedRun.currentShift === prev.furthestShift && totalMoney > prev.totalMoney)
        if (isNew) {
          const best: AdventureBestRun = { furthestShift: updatedRun.currentShift, totalMoney }
          try { localStorage.setItem('chatsKitchen_adventureBestRun', JSON.stringify(best)) } catch { /* ignore */ }
          setIsNewBestAdventureRun(true)
          return best
        }
        return prev
      })
      setScreen('adventurerunend')
    }
  }, [setScreen, finalStatsRef])

  const resetAdventureBestRun = useCallback(() => {
    setAdventureBestRun(null)
  }, [])

  return {
    adventureRun,
    setAdventureRun,
    adventureRunRef,
    adventureBestRun,
    isNewBestAdventureRun,
    setIsNewBestAdventureRun,
    startAdventure,
    handleShiftPassedNext,
    handleShiftEndDone,
    resetAdventureBestRun,
  }
}
