import { useState, useRef, useCallback, Dispatch, SetStateAction } from 'react'
import { GameOptions, KitchenEvent, Screen, TutorialDestination, ActiveEventOptions } from '../state/types'
import { GameAction } from '../state/gameReducer'
import { TUTORIAL_STEPS, TUTORIAL_COOL_STEP, TUTORIAL_EXTINGUISH_STEP, TUTORIAL_EVENT_STEP } from '../data/tutorialData'

const TUTORIAL_MYSTERY_EVENT: KitchenEvent = {
  id: 'tutorial_mystery',
  category: 'opportunity',
  type: 'mystery_recipe',
  chosenCommand: 'EDCILS FEEB',
  progress: 33,
  threshold: 3,
  respondedUsers: ['viewer1'],
  timeLeft: 14000,
  initialTimeLeft: 20000,
  resolved: false,
  failed: false,
  payload: { anagramAnswer: 'SLICED BEEF' },
}

export function useTutorialState(
  dispatch: Dispatch<GameAction>,
  setScreen: (s: Screen) => void,
  setActiveEventOptions: Dispatch<SetStateAction<ActiveEventOptions | null>>,
  activeGameOptionsRef: { current: GameOptions | null },
  setChatOpen: (open: boolean) => void,
) {
  const [tutorialStep, setTutorialStep] = useState<number | null>(null)
  const [tutorialResetKey, setTutorialResetKey] = useState(0)
  const [tutorialEvent, setTutorialEvent] = useState<KitchenEvent | null>(null)
  const [tutorialEventResolved, setTutorialEventResolved] = useState(false)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [showTutorialPrompt, setShowTutorialPrompt] = useState(false)
  const [tutorialDestination, setTutorialDestination] = useState<TutorialDestination>('menu')
  const [hideTutorialPrompt, setHideTutorialPrompt] = useState(() => {
    try {
      return localStorage.getItem('chatsKitchen_hideTutorialPrompt') === 'true'
    } catch {
      return false
    }
  })

  const isTutorial = tutorialStep !== null
  const tutorialStepRef = useRef(tutorialStep)
  tutorialStepRef.current = tutorialStep

  const startTutorial = useCallback(() => {
    setActiveEventOptions(null)
    activeGameOptionsRef.current = null
    dispatch({
      type: 'RESET',
      shiftDuration: 600_000,
      cookingSpeed: 2,
      orderSpeed: 0.05,
      orderSpawnRate: 0.001,
      enabledRecipes: ['fries'],
    })
    setShowTutorialPrompt(false)
    setTutorialOpen(false)
    setTutorialStep(0)
    setTutorialResetKey(k => k + 1)
    setChatOpen(true)
    setScreen('playing')
  }, [dispatch, setScreen, setActiveEventOptions, activeGameOptionsRef, setChatOpen])

  const handleTutorialNext = useCallback(() => {
    // Dispatch step-entry side-effects before setTutorialStep so React 18
    // batches them into one render — prevents auto-advance race conditions.
    if (tutorialStep !== null) {
      const next = tutorialStep + 1
      if (next === TUTORIAL_COOL_STEP) {
        dispatch({ type: 'SET_STATION_HEAT', stationId: 'fryer', heat: 90 })
      } else if (next === TUTORIAL_EXTINGUISH_STEP) {
        dispatch({ type: 'OVERHEAT_STATION', stationId: 'fryer' })
      } else if (next === TUTORIAL_EVENT_STEP) {
        setTutorialEvent(TUTORIAL_MYSTERY_EVENT)
        setTutorialEventResolved(false)
      } else if (tutorialStep === TUTORIAL_EVENT_STEP) {
        setTutorialEvent(null)
        setTutorialEventResolved(false)
      }
    }
    setTutorialStep(s => (s !== null && s < TUTORIAL_STEPS.length - 1 ? s + 1 : s))
  }, [tutorialStep, dispatch])

  const handleTutorialBack = useCallback(() => {
    if (tutorialStep === null || tutorialStep <= 0) return
    const prev = tutorialStep - 1
    if (prev === TUTORIAL_COOL_STEP) {
      dispatch({ type: 'SET_STATION_HEAT', stationId: 'fryer', heat: 90 })
    } else if (prev === TUTORIAL_EXTINGUISH_STEP) {
      dispatch({ type: 'OVERHEAT_STATION', stationId: 'fryer' })
    } else if (prev === TUTORIAL_EVENT_STEP) {
      setTutorialEvent(TUTORIAL_MYSTERY_EVENT)
      setTutorialEventResolved(false)
    } else if (tutorialStep === TUTORIAL_EVENT_STEP) {
      setTutorialEvent(null)
      setTutorialEventResolved(false)
    }
    setTutorialStep(prev)
  }, [tutorialStep, dispatch])

  const handleTutorialComplete = useCallback(() => {
    setTutorialEvent(null)
    setTutorialEventResolved(false)
    setTutorialStep(null)
    setScreen('menu')
  }, [setScreen])

  const handleTutorialRepeat = useCallback(() => {
    startTutorial()
  }, [startTutorial])

  const handleTutorialEventCommand = useCallback((text: string) => {
    if (tutorialStepRef.current !== TUTORIAL_EVENT_STEP) return
    if (text.trim().toUpperCase() !== 'SLICED BEEF') return
    setTutorialEvent(ev => ev && !ev.resolved ? { ...ev, resolved: true, progress: 100 } : ev)
    setTimeout(() => setTutorialEventResolved(true), 1800)
  }, [])

  const handleMenuTutorial = useCallback(() => {
    setTutorialDestination('menu')
    setTutorialOpen(true)
    setShowTutorialPrompt(false)
  }, [])

  const tutorialGameOver = useCallback(() => {
    setActiveEventOptions(null)
    activeGameOptionsRef.current = null
    setTutorialStep(null)
    setScreen('menu')
  }, [setScreen, setActiveEventOptions, activeGameOptionsRef])

  const persistHideTutorialPrompt = useCallback((hide: boolean) => {
    setHideTutorialPrompt(hide)
    try {
      if (hide) localStorage.setItem('chatsKitchen_hideTutorialPrompt', 'true')
      else localStorage.removeItem('chatsKitchen_hideTutorialPrompt')
    } catch {
      // ignore storage failures
    }
  }, [])

  const resetTutorial = useCallback(() => {
    setTutorialOpen(false)
    setShowTutorialPrompt(false)
    setTutorialDestination('menu')
    persistHideTutorialPrompt(false)
  }, [persistHideTutorialPrompt])

  return {
    tutorialStep,
    setTutorialStep,
    tutorialResetKey,
    tutorialEvent,
    setTutorialEvent,
    tutorialEventResolved,
    setTutorialEventResolved,
    tutorialOpen,
    setTutorialOpen,
    showTutorialPrompt,
    setShowTutorialPrompt,
    tutorialDestination,
    setTutorialDestination,
    hideTutorialPrompt,
    isTutorial,
    tutorialStepRef,
    startTutorial,
    handleTutorialNext,
    handleTutorialBack,
    handleTutorialComplete,
    handleTutorialRepeat,
    handleTutorialEventCommand,
    handleMenuTutorial,
    tutorialGameOver,
    persistHideTutorialPrompt,
    resetTutorial,
  }
}
