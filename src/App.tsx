import { useReducer, useCallback, useState, useEffect, useRef } from 'react'
import { gameReducer, createInitialState } from './state/gameReducer'
import { parseCommand } from './state/commandProcessor'
import { AudioSettings, GameOptions, PlayerStats, AdventureRun, AdventureBestRun, ShiftResult, KitchenEvent } from './state/types'
import { useGameLoop } from './hooks/useGameLoop'
import { useBotSimulation } from './hooks/useBotSimulation'
import { useTwitchChat } from './hooks/useTwitchChat'
import { useGameAudio } from './audio/useGameAudio'
import { useViewportScale } from './hooks/useViewportScale'
import MainMenu from './components/MainMenu'
import PvPLobby from './components/PvPLobby'
import FreePlaySetup from './components/FreePlaySetup'
import OptionsScreen from './components/OptionsScreen'
import Countdown from './components/Countdown'
import ShiftEnd from './components/ShiftEnd'
import GameOver from './components/GameOver'
import AdventureBriefing from './components/AdventureBriefing'
import AdventureRunEnd from './components/AdventureRunEnd'
import AdventureShiftPassed from './components/AdventureShiftPassed'
import TutorialModal from './components/TutorialModal'
import TutorialPrompt from './components/TutorialPrompt'
import NoTwitchPrompt from './components/NoTwitchPrompt'
import TutorialOverlay from './components/TutorialOverlay'
import { TUTORIAL_STEPS } from './data/tutorialData'
import PauseModal from './components/PauseModal'
import FeedbackModal from './components/FeedbackModal'
import { useKitchenEvents } from './hooks/useKitchenEvents'
import EventCardOverlay from './components/EventCardOverlay'
import SmokeOverlay from './components/SmokeOverlay'
import CreditsScreen from './components/CreditsScreen'
import Toast from './components/Toast'
import { submitGameStats } from './utils/submitStats'
import {
  ADVENTURE_SHIFT_DURATION, getAdventureGoal, pickAdventureRecipes, mergePlayerStats,
} from './data/adventureMode'
import Kitchen from './components/Kitchen'
import OrdersBar from './components/DiningRoom'
import ChatPanel from './components/ChatPanel'
import BottomBar from './components/BottomBar'
import { DEFAULT_GAME_OPTIONS } from './state/defaultOptions'
import styles from './App.module.css'

type Screen = 'menu' | 'pvplobby' | 'adventurebriefing' | 'options' | 'freeplaysetup' | 'countdown' | 'playing' | 'shiftend' | 'gameover' | 'adventureshiftpassed' | 'adventurerunend' | 'credits'
type TutorialDestination = 'menu' | 'freeplaysetup'


const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 1,
  musicVolume: 0.5,
  sfxVolume: 0.5,
  musicMuted: false,
  sfxMuted: false,
  darkMode: true,
  trackEnabled: { menu: false, gameplay: true, gameover: true }
}

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

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [gameOptions, setGameOptions] = useState<GameOptions>(() => {
    try {
      const saved = localStorage.getItem('chatsKitchen_gameOptions')
      if (!saved) return DEFAULT_GAME_OPTIONS
      const parsed = JSON.parse(saved) as Partial<GameOptions>
      return {
        ...DEFAULT_GAME_OPTIONS,
        ...parsed,
        stationCapacity: { ...DEFAULT_GAME_OPTIONS.stationCapacity, ...(parsed.stationCapacity ?? {}) }
      }
    } catch {
      return DEFAULT_GAME_OPTIONS
    }
  })
  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    createInitialState(gameOptions.shiftDuration, gameOptions.cookingSpeed, gameOptions.orderSpeed, gameOptions.orderSpawnRate, gameOptions.stationCapacity)
  )
  const [botsEnabled, setBotsEnabled] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [paused, setPaused] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [twitchChannel, setTwitchChannel] = useState<string | null>(() => {
    try {
      return localStorage.getItem('chatsKitchen_twitchChannel')
    } catch {
      return null
    }
  })
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => {
    try {
      const saved = localStorage.getItem('audioSettings')
      return saved ? { ...DEFAULT_AUDIO_SETTINGS, ...JSON.parse(saved) } : DEFAULT_AUDIO_SETTINGS
    } catch {
      return DEFAULT_AUDIO_SETTINGS
    }
  })
  const [finalStats, setFinalStats] = useState<{
    money: number
    served: number
    lost: number
    playerStats: Record<string, PlayerStats>
    redMoney?: number
    blueMoney?: number
    redServed?: number
    blueServed?: number
  }>({ money: 0, served: 0, lost: 0, playerStats: {} })
  const [freePlayHighScore, setFreePlayHighScore] = useState<number>(() => {
    try { return parseInt(localStorage.getItem('chatsKitchen_freePlayHighScore') || '0', 10) } catch { return 0 }
  })
  const [isNewHighScore, setIsNewHighScore] = useState(false)
  const [freePlayHistory, setFreePlayHistory] = useState<{ money: number; served: number; lost: number }[]>(() => {
    try {
      const saved = localStorage.getItem('chatsKitchen_freePlayHistory')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const stateRef = useRef(state)
  stateRef.current = state
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [autoRestartSignal, setAutoRestartSignal] = useState(0)
  const screenRef = useRef<Screen>('menu')
  const gameOptionsRef = useRef(gameOptions)
  const twitchConnectedRef = useRef(false)
  const twitchChannelRef = useRef<string | null>(null)
  const [adventureRun, setAdventureRun]   = useState<AdventureRun | null>(null)
  const adventureRunRef                   = useRef<AdventureRun | null>(null)
  const [pvpLobby, setPvpLobby] = useState<{ red: string[], blue: string[] } | null>(null)
  const pvpLobbyRef = useRef<{ red: string[], blue: string[] } | null>(null)
  pvpLobbyRef.current = pvpLobby
  const [adventureBestRun, setAdventureBestRun] = useState<AdventureBestRun | null>(() => {
    try {
      const saved = localStorage.getItem('chatsKitchen_adventureBestRun')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [isNewBestAdventureRun, setIsNewBestAdventureRun] = useState(false)
  const [hideTutorialPrompt, setHideTutorialPrompt] = useState(() => {
    try {
      return localStorage.getItem('chatsKitchen_hideTutorialPrompt') === 'true'
    } catch {
      return false
    }
  })
  const [showTutorialPrompt, setShowTutorialPrompt] = useState(false)
  const [tutorialDestination, setTutorialDestination] = useState<TutorialDestination>('menu')
  const [showNoTwitchPrompt, setShowNoTwitchPrompt] = useState(false)
  const pendingActionRef = useRef<(() => void) | null>(null)
  const [tutorialStep, setTutorialStep] = useState<number | null>(null)
  const [tutorialResetKey, setTutorialResetKey] = useState(0)
  const [tutorialEvent, setTutorialEvent] = useState<KitchenEvent | null>(null)
  const [tutorialEventResolved, setTutorialEventResolved] = useState(false)
  const isTutorial = tutorialStep !== null
  const tutorialStepRef = useRef(tutorialStep)
  tutorialStepRef.current = tutorialStep

  // Keep refs in sync so stable callbacks can read current values
  screenRef.current = screen
  gameOptionsRef.current = gameOptions
  adventureRunRef.current = adventureRun

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(message)
    toastTimerRef.current = setTimeout(() => setToast(null), 2500)
  }, [])

  const startFreePlay = useCallback(() => {
    setAdventureRun(null)
    const teams: Record<string, 'red' | 'blue'> = pvpLobbyRef.current
      ? Object.fromEntries([
          ...pvpLobbyRef.current.red.map(u => [u, 'red' as const]),
          ...pvpLobbyRef.current.blue.map(u => [u, 'blue' as const]),
        ])
      : {}
    dispatch({
      type: 'RESET',
      shiftDuration: gameOptions.shiftDuration,
      cookingSpeed: gameOptions.cookingSpeed,
      orderSpeed: gameOptions.orderSpeed,
      orderSpawnRate: gameOptions.orderSpawnRate,
      stationCapacity: gameOptions.stationCapacity,
      restrictSlots: gameOptions.restrictSlots,
      enabledRecipes: gameOptions.enabledRecipes,
      teams,
    })
    setScreen('countdown')
  }, [gameOptions])

  const startPvp = useCallback(() => {
    setPvpLobby({ red: [], blue: [] })
    setScreen('pvplobby')
  }, [])

  const startPvpGame = useCallback(() => {
    setScreen('freeplaysetup')
  }, [])

  const startAdventure = useCallback(() => {
    setIsNewBestAdventureRun(false)
    const recipes = pickAdventureRecipes()
    const shift   = 1
    const run: AdventureRun = {
      currentShift: shift,
      shiftResults: [],
      currentRecipes: recipes,
      currentGoal: getAdventureGoal(shift),
      accumulatedPlayerStats: {},
    }
    setAdventureRun(run)
    dispatch({
      type: 'RESET',
      shiftDuration: ADVENTURE_SHIFT_DURATION,
      cookingSpeed: 1, orderSpeed: 1, orderSpawnRate: 1,
      stationCapacity: DEFAULT_GAME_OPTIONS.stationCapacity,
      restrictSlots: false,
      enabledRecipes: recipes,
    })
    setScreen('adventurebriefing')
  }, [])

  const checkTwitch = useCallback((action: () => void) => {
    if (!twitchChannel) {
      pendingActionRef.current = action
      setShowNoTwitchPrompt(true)
      return
    }
    action()
  }, [twitchChannel])

  const confirmNoTwitch = useCallback(() => {
    setShowNoTwitchPrompt(false)
    const action = pendingActionRef.current
    pendingActionRef.current = null
    action?.()
  }, [])

  const cancelNoTwitch = useCallback(() => {
    setShowNoTwitchPrompt(false)
    pendingActionRef.current = null
  }, [])

  const continueFromTutorial = useCallback((destination: TutorialDestination) => {
    if (destination === 'freeplaysetup') {
      checkTwitch(() => setScreen('freeplaysetup'))
      return
    }

    setScreen('menu')
  }, [checkTwitch])

  const handleMenuAdventure = useCallback(() => {
    checkTwitch(startAdventure)
  }, [checkTwitch, startAdventure])

  const handleMenuPvp = useCallback(() => {
    checkTwitch(startPvp)
  }, [checkTwitch, startPvp])

  const dismissTutorialPrompt = useCallback(() => {
    setShowTutorialPrompt(false)
    continueFromTutorial(tutorialDestination)
  }, [continueFromTutorial, tutorialDestination])

  const disableTutorialPrompt = useCallback(() => {
    setHideTutorialPrompt(true)
    try {
      localStorage.setItem('chatsKitchen_hideTutorialPrompt', 'true')
    } catch {
      // Ignore storage failures; in-memory flag is already set above.
    }
    setShowTutorialPrompt(false)
    continueFromTutorial(tutorialDestination)
  }, [continueFromTutorial, tutorialDestination])

  const handleMenuTutorial = useCallback(() => {
    setTutorialDestination('menu')
    setTutorialOpen(true)
    setShowTutorialPrompt(false)
  }, [])

  const handleMenuPlay = useCallback((destination: TutorialDestination) => {
    if (!hideTutorialPrompt) {
      setTutorialDestination(destination)
      setShowTutorialPrompt(true)
      return
    }

    continueFromTutorial(destination)
  }, [continueFromTutorial, hideTutorialPrompt])

  const handleTutorialStartCooking = useCallback(() => {
    setTutorialOpen(false)
    continueFromTutorial(tutorialDestination)
  }, [continueFromTutorial, tutorialDestination])

  const startTutorial = useCallback(() => {
    dispatch({
      type: 'RESET',
      shiftDuration: 600_000,
      cookingSpeed: 2,
      orderSpeed: 0.05,
      orderSpawnRate: 0.001,
      stationCapacity: { chopping: 3, cooking: 2 },
      restrictSlots: false,
      enabledRecipes: ['fries'],
    })
    setShowTutorialPrompt(false)
    setTutorialOpen(false)
    setTutorialStep(0)
    setTutorialResetKey(k => k + 1)
    setChatOpen(true)
    setScreen('playing')
  }, [dispatch])

  const TUTORIAL_COOL_STEP = TUTORIAL_STEPS.findIndex(s => s.title === "❄️ Cool it down!")
  const TUTORIAL_EXTINGUISH_STEP = TUTORIAL_STEPS.findIndex(s => s.title === "🔥 Station on fire!")
  const TUTORIAL_EVENT_INTRO_STEP = TUTORIAL_STEPS.findIndex(s => s.title === "🎲 Kitchen Events")
  const TUTORIAL_EVENT_STEP = TUTORIAL_STEPS.findIndex(s => s.title === "🧩 Mystery Recipe")

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
  }, [tutorialStep, dispatch, TUTORIAL_COOL_STEP, TUTORIAL_EXTINGUISH_STEP, TUTORIAL_EVENT_STEP])

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
  }, [tutorialStep, dispatch, TUTORIAL_COOL_STEP, TUTORIAL_EXTINGUISH_STEP, TUTORIAL_EVENT_STEP])

  const handleTutorialComplete = useCallback(() => {
    setTutorialEvent(null)
    setTutorialEventResolved(false)
    setTutorialStep(null)
    setScreen('menu')
  }, [])

  const handleTutorialRepeat = useCallback(() => {
    startTutorial()
  }, [startTutorial])

  const handleCommand = useCallback((user: string, text: string) => {
    const action = parseCommand(user, text, gameOptions.allowShortformCommands)
    if (action) dispatch(action)
  }, [gameOptions.allowShortformCommands])

  const handleTutorialEventCommand = useCallback((text: string) => {
    if (tutorialStepRef.current !== TUTORIAL_EVENT_STEP) return
    if (text.trim().toUpperCase() !== 'SLICED BEEF') return
    setTutorialEvent(ev => ev && !ev.resolved ? { ...ev, resolved: true, progress: 100 } : ev)
    setTimeout(() => setTutorialEventResolved(true), 1800)
  }, [TUTORIAL_EVENT_STEP])

  const { activeEvent, handleEventCommand } = useKitchenEvents(
    state,
    dispatch,
    screen === 'playing' && !isTutorial && gameOptions.kitchenEventsEnabled,
    paused,
    gameOptions.enabledKitchenEvents,
    gameOptions.kitchenEventSpawnMin * 1000,
    gameOptions.kitchenEventSpawnMax * 1000,
    gameOptions.kitchenEventDuration * 1000,
  )

  const handleGameOptionsChange = useCallback((options: GameOptions) => {
    setGameOptions(options)
    try {
      localStorage.setItem('chatsKitchen_gameOptions', JSON.stringify(options))
    } catch {
      // Ignore storage failures; in-memory state is already updated above.
    }
  }, [])

  const handleGameOver = useCallback(() => {
    const s = stateRef.current
    setFinalStats({
      money: s.money,
      served: s.served,
      lost: s.lost,
      playerStats: s.playerStats,
      redMoney: s.redMoney,
      blueMoney: s.blueMoney,
      redServed: s.redServed,
      blueServed: s.blueServed,
    })

    if (adventureRunRef.current) {
      setAdventureRun(prev => prev
        ? { ...prev, accumulatedPlayerStats: mergePlayerStats(prev.accumulatedPlayerStats, s.playerStats) }
        : prev)
    } else {
      // Free Play: existing high-score + history logic (unchanged)
      setFreePlayHighScore(prev => {
        if (s.money > prev) {
          try { localStorage.setItem('chatsKitchen_freePlayHighScore', String(s.money)) } catch { /* ignore */ }
          setIsNewHighScore(true)
          return s.money
        }
        setIsNewHighScore(false)
        return prev
      })
      setFreePlayHistory(prev => {
        const updated = [{ money: s.money, served: s.served, lost: s.lost }, ...prev].slice(0, 5)
        try { localStorage.setItem('chatsKitchen_freePlayHistory', JSON.stringify(updated)) } catch { /* ignore */ }
        return updated
      })
      // Submit to global stats if connected to Twitch
      if (twitchConnectedRef.current && twitchChannelRef.current) {
        submitGameStats(
          twitchChannelRef.current,
          { money: s.money, served: s.served, lost: s.lost },
          s.playerStats,
          () => showToast('⏱ Stats cooldown — try again in 3 min')
        )
      }
    }
    setScreen('shiftend')
  }, [showToast])

  const handleLobbyMetaCommand = useCallback((_user: string, text: string, isMod: boolean) => {
    if (!isMod) return
    const cmd = text.trim().toLowerCase()

    if (cmd === '!balance') {
      setPvpLobby(prev => {
        if (!prev) return prev
        const all = [...prev.red, ...prev.blue].sort(() => Math.random() - 0.5)
        return {
          red: all.filter((_, i) => i % 2 === 0),
          blue: all.filter((_, i) => i % 2 !== 0),
        }
      })
      showToast(`⚖️ Teams balanced`)
      return
    }

    const moveMatch = cmd.match(/^!move\s+(red|blue)\s+@?(\S+)$/)
    if (moveMatch) {
      const team = moveMatch[1] as 'red' | 'blue'
      const target = moveMatch[2]
      const other: 'red' | 'blue' = team === 'red' ? 'blue' : 'red'
      const lobby = pvpLobbyRef.current
      if (!lobby || (!lobby.red.includes(target) && !lobby.blue.includes(target))) {
        showToast(`❌ ${target} not found`)
        return
      }
      setPvpLobby(prev => {
        if (!prev) return prev
        return {
          ...prev,
          [team]: prev[team].includes(target) ? prev[team] : [...prev[team], target],
          [other]: prev[other].filter(u => u !== target),
        }
      })
      showToast(`↔️ ${target} → ${team}`)
    }
  }, [showToast])

  const handleMetaCommand = useCallback((user: string, text: string, isMod: boolean) => {
    if (!isMod) return
    const cmd = text.trim().toLowerCase()
    const s = screenRef.current

    if (cmd === '!start' && s === 'gameover' && adventureRunRef.current == null) {
      startFreePlay()
      showToast(`▶ Starting now (${user})`)
      return
    }
    if (cmd === '!onautorestart' && (s === 'gameover' || s === 'playing')) {
      handleGameOptionsChange({ ...gameOptionsRef.current, autoRestart: true })
      setAutoRestartSignal(n => n + 1)
      showToast(`🔄 Auto-restart ON (${user})`)
      return
    }
    if (cmd === '!offautorestart' && (s === 'gameover' || s === 'playing')) {
      handleGameOptionsChange({ ...gameOptionsRef.current, autoRestart: false })
      showToast(`🔄 Auto-restart OFF (${user})`)
      return
    }
    if (cmd === '!exit' && s === 'playing') {
      handleGameOver()
      showToast(`🚪 Round ended by ${user}`)
    }
  }, [startFreePlay, handleGameOptionsChange, handleGameOver, showToast])

  const isTutorialRef = useRef(isTutorial)
  isTutorialRef.current = isTutorial

  const handleTwitchMessage = useCallback((user: string, text: string, isMod: boolean) => {
    dispatch({ type: 'ADD_CHAT', username: user, text, msgType: 'normal' })
    // PvP lobby: intercept !red / !blue and lobby mod commands
    if (screenRef.current === 'pvplobby') {
      const cmd = text.trim().toLowerCase()
      if (cmd === '!red' || cmd === '!blue') {
        const team = cmd === '!red' ? 'red' : 'blue'
        const other: 'red' | 'blue' = team === 'red' ? 'blue' : 'red'
        setPvpLobby(prev => {
          if (!prev) return prev
          return {
            ...prev,
            [team]: prev[team].includes(user) ? prev[team] : [...prev[team], user],
            [other]: prev[other].filter(u => u !== user),
          }
        })
        return
      }
      if (cmd === '!join') {
        setPvpLobby(prev => {
          if (!prev) return prev
          if (prev.red.includes(user) || prev.blue.includes(user)) return prev
          const team = prev.red.length <= prev.blue.length ? 'red' : 'blue'
          return { ...prev, [team]: [...prev[team], user] }
        })
        return
      }
      handleLobbyMetaCommand(user, text, isMod)
      return
    }
    handleEventCommand(user, text)
    handleTutorialEventCommand(text)
    handleMetaCommand(user, text, isMod)
    if (!isTutorialRef.current) handleCommand(user, text)
  }, [handleCommand, handleEventCommand, handleTutorialEventCommand, handleMetaCommand, handleLobbyMetaCommand])

  const twitchChat = useTwitchChat(twitchChannel, handleTwitchMessage)
  twitchConnectedRef.current = twitchChat.status === 'connected'
  twitchChannelRef.current = twitchChannel

  const handleChatSend = useCallback((text: string) => {
    dispatch({ type: 'ADD_CHAT', username: 'You', text, msgType: 'normal' })
    if (screenRef.current === 'pvplobby') {
      const cmd = text.trim().toLowerCase()
      if (cmd === '!red' || cmd === '!blue') {
        const team = cmd === '!red' ? 'red' : 'blue'
        const other: 'red' | 'blue' = team === 'red' ? 'blue' : 'red'
        setPvpLobby(prev => {
          if (!prev) return prev
          return {
            ...prev,
            [team]: prev[team].includes('You') ? prev[team] : [...prev[team], 'You'],
            [other]: prev[other].filter(u => u !== 'You'),
          }
        })
        return
      }
      if (cmd === '!join') {
        setPvpLobby(prev => {
          if (!prev) return prev
          if (prev.red.includes('You') || prev.blue.includes('You')) return prev
          const team = prev.red.length <= prev.blue.length ? 'red' : 'blue'
          return { ...prev, [team]: [...prev[team], 'You'] }
        })
        return
      }
      handleLobbyMetaCommand('You', text, true)
      return
    }
    handleEventCommand('You', text)
    handleTutorialEventCommand(text)
    handleMetaCommand('You', text, true)
    handleCommand('You', text)
  }, [handleCommand, handleEventCommand, handleTutorialEventCommand, handleMetaCommand, handleLobbyMetaCommand])

  const handleShiftEndDone = useCallback(() => {
    const run = adventureRunRef.current
    if (!run) { setScreen('gameover'); return }

    const passed = finalStats.money >= run.currentGoal
    const result: ShiftResult = {
      shiftNumber: run.currentShift,
      recipes:     run.currentRecipes,
      goalMoney:   run.currentGoal,
      moneyEarned: finalStats.money,
      served:      finalStats.served,
      lost:        finalStats.lost,
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
  }, [finalStats])

  const handleShiftPassedNext = useCallback(() => {
    const run = adventureRunRef.current
    if (!run) return
    const nextShift   = run.currentShift + 1
    const nextRecipes = pickAdventureRecipes()
    setAdventureRun({
      ...run,
      currentShift:   nextShift,
      currentRecipes: nextRecipes,
      currentGoal:    getAdventureGoal(nextShift),
    })
    dispatch({
      type: 'RESET',
      shiftDuration: ADVENTURE_SHIFT_DURATION,
      cookingSpeed: 1, orderSpeed: 1, orderSpawnRate: 1,
      stationCapacity: DEFAULT_GAME_OPTIONS.stationCapacity,
      restrictSlots: false,
      enabledRecipes: nextRecipes,
    })
    setScreen('adventurebriefing')
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', audioSettings.darkMode ? 'dark' : 'light')
  }, [audioSettings.darkMode])

  const handleAudioChange = useCallback((settings: AudioSettings) => {
    setAudioSettings(settings)
    localStorage.setItem('audioSettings', JSON.stringify(settings))
  }, [])

  const handleTwitchChannelChange = useCallback((ch: string | null) => {
    setTwitchChannel(ch)
    try {
      if (ch) localStorage.setItem('chatsKitchen_twitchChannel', ch)
      else localStorage.removeItem('chatsKitchen_twitchChannel')
    } catch {
      // Ignore storage failures; in-memory state is already updated above.
    }
  }, [])

  const handleResetAll = useCallback(() => {
    setGameOptions(DEFAULT_GAME_OPTIONS)
    setAudioSettings(DEFAULT_AUDIO_SETTINGS)
    setAdventureBestRun(null)
    setFreePlayHighScore(0)
    setIsNewHighScore(false)
    setFreePlayHistory([])
    handleTwitchChannelChange(null)
    setHideTutorialPrompt(false)
    setShowTutorialPrompt(false)
    setTutorialDestination('menu')
    setTutorialOpen(false)

    try {
      localStorage.setItem('audioSettings', JSON.stringify(DEFAULT_AUDIO_SETTINGS))
      localStorage.removeItem('chatsKitchen_adventureBestRun')
      localStorage.removeItem('chatsKitchen_freePlayHighScore')
      localStorage.removeItem('chatsKitchen_freePlayHistory')
      localStorage.removeItem('chatsKitchen_gameOptions')
      localStorage.removeItem('chatsKitchen_hideTutorialPrompt')
      localStorage.removeItem('preparedItems.showNames')
      localStorage.removeItem('diningRoom.simpleTickets')
      localStorage.removeItem('kitchen.showCommands')
    } catch {
      // Ignore storage failures and keep the in-memory reset behavior.
    }
  }, [handleTwitchChannelChange])

  const isPlaying = screen === 'playing'
  const tutorialGameOver = useCallback(() => {
    setTutorialStep(null)
    setScreen('menu')
  }, [])
  useGameLoop(state, dispatch, isPlaying ? (isTutorial ? tutorialGameOver : handleGameOver) : undefined, paused, tutorialResetKey)
  useBotSimulation(state, dispatch, handleCommand, isPlaying && botsEnabled)

  useGameAudio(screen, state, audioSettings)
  useViewportScale()

  let content

  const tutorialHighlight = isTutorial && tutorialStep !== null
    ? TUTORIAL_STEPS[tutorialStep].highlight
    : null

  if (screen === 'menu') {
    content = (
      <MainMenu
        onPlay={() => handleMenuPlay('freeplaysetup')}
        onPvp={handleMenuPvp}
        onAdventure={handleMenuAdventure}
        onOptions={() => setScreen('options')}
        onFeedback={() => setShowFeedback(true)}
        onCredits={() => setScreen('credits')}
        onTutorial={handleMenuTutorial}
        onStartTutorial={startTutorial}
        twitchChannel={twitchChannel}
        twitchStatus={twitchChat.status}
        twitchError={twitchChat.error}
        onTwitchConnect={(ch) => setTwitchChannel(ch)}
        onTwitchDisconnect={() => setTwitchChannel(null)}
      />
    )
  } else if (screen === 'pvplobby') {
    content = (
      <PvPLobby
        red={pvpLobby?.red ?? []}
        blue={pvpLobby?.blue ?? []}
        onMovePlayer={(username, team) => setPvpLobby(prev => {
          if (!prev) return prev
          const other: 'red' | 'blue' = team === 'red' ? 'blue' : 'red'
          return {
            ...prev,
            [team]: prev[team].includes(username) ? prev[team] : [...prev[team], username],
            [other]: prev[other].filter(u => u !== username),
          }
        })}
        onBalance={() => setPvpLobby(prev => {
          if (!prev) return prev
          const all = [...prev.red, ...prev.blue].sort(() => Math.random() - 0.5)
          return { red: all.filter((_, i) => i % 2 === 0), blue: all.filter((_, i) => i % 2 !== 0) }
        })}
        onClear={() => setPvpLobby(prev => prev ? { red: [], blue: [] } : prev)}
        onBack={() => { setPvpLobby(null); setScreen('menu') }}
        onNext={startPvpGame}
      />
    )
  } else if (screen === 'adventurebriefing') {
    content = (
      <AdventureBriefing
        run={adventureRun!}
        bestRun={adventureBestRun}
        onStart={() => setScreen('countdown')}
        onMenu={() => { setAdventureRun(null); setScreen('menu') }}
        twitchStatus={twitchChat.status}
        twitchChannel={twitchChannel}
      />
    )
  } else if (screen === 'options') {
    content = <OptionsScreen options={gameOptions} onChange={handleGameOptionsChange} audioSettings={audioSettings} onAudioChange={handleAudioChange} onResetAll={handleResetAll} onBack={() => setScreen('menu')} />
  } else if (screen === 'credits') {
    content = <CreditsScreen onBack={() => setScreen('menu')} />
  } else if (screen === 'freeplaysetup') {
    content = <FreePlaySetup options={gameOptions} onChange={handleGameOptionsChange} onStart={startFreePlay} onBack={() => setScreen(pvpLobby ? 'pvplobby' : 'menu')} twitchStatus={twitchChat.status} twitchChannel={twitchChannel} />
  } else if (screen === 'countdown') {
    content = <Countdown onDone={() => setScreen('playing')} />
  } else if (screen === 'shiftend') {
    content = (
      <ShiftEnd
        money={finalStats.money}
        served={finalStats.served}
        lost={finalStats.lost}
        goalMoney={adventureRun?.currentGoal}
        shiftNumber={adventureRun?.currentShift}
        onDone={handleShiftEndDone}
      />
    )
  } else if (screen === 'gameover') {
    content = (
      <GameOver
        money={finalStats.money}
        served={finalStats.served}
        lost={finalStats.lost}
        playerStats={finalStats.playerStats}
        level={null}
        highScore={freePlayHighScore}
        isNewHighScore={isNewHighScore}
        roundHistory={freePlayHistory}
        autoRestart={gameOptions.autoRestart}
        autoRestartDelay={gameOptions.autoRestartDelay}
        autoRestartSignal={autoRestartSignal}
        pvpResult={finalStats.redMoney !== undefined ? {
          redMoney: finalStats.redMoney,
          blueMoney: finalStats.blueMoney ?? 0,
          redServed: finalStats.redServed ?? 0,
          blueServed: finalStats.blueServed ?? 0,
        } : undefined}
        onPlayAgain={startFreePlay}
        onNextLevel={undefined}
        onMenu={() => { setPvpLobby(null); setScreen('menu') }}
        onRecipeSelect={() => setScreen('freeplaysetup')}
      />
    )
  } else if (screen === 'adventureshiftpassed') {
    content = (
      <AdventureShiftPassed
        shiftNumber={adventureRun!.currentShift}
        money={finalStats.money}
        goalMoney={adventureRun!.currentGoal}
        served={finalStats.served}
        lost={finalStats.lost}
        playerStats={finalStats.playerStats}
        onNext={handleShiftPassedNext}
        onMenu={() => { setAdventureRun(null); setScreen('menu') }}
      />
    )
  } else if (screen === 'adventurerunend') {
    content = (
      <AdventureRunEnd
        run={adventureRun!}
        bestRun={adventureBestRun}
        isNewBestRun={isNewBestAdventureRun}
        onPlayAgain={startAdventure}
        onMenu={() => { setAdventureRun(null); setScreen('menu') }}
      />
    )
  } else {
    content = (
      <div className={styles.layout}>
        {state.timeLeft <= 10000 && state.timeLeft > 0 && (
          <div key={Math.ceil(state.timeLeft / 1000)} className={styles.countdownOverlay}>
            {Math.ceil(state.timeLeft / 1000)}
          </div>
        )}
        <div className={styles.body}>
          <OrdersBar
            state={state}
            isHighlighted={tutorialHighlight === 'orders'}
            isGlitched={activeEvent?.type === 'glitched_orders' && !activeEvent.resolved && !activeEvent.failed}
          />
          <Kitchen state={state} tutorialHighlight={tutorialHighlight} />
          {chatOpen && (
            <ChatPanel
              messages={state.chatMessages}
              onSend={handleChatSend}
              onClose={() => setChatOpen(false)}
              teams={state.teams}
            />
          )}
        </div>
        <BottomBar money={state.money} served={state.served} lost={state.lost} twitchStatus={twitchChat.status} twitchChannel={twitchChannel} />
        <div className={`${styles.settingsWrapper} ${chatOpen ? styles.settingsWrapperChatOpen : ''}`}>
          <button className={styles.settingsBtn} onClick={() => setPaused(true)}>⚙️</button>
        </div>
        {activeEvent?.type === 'smoke_blast' && !activeEvent.resolved && !activeEvent.failed && (
          <SmokeOverlay progress={activeEvent.progress} />
        )}
        <EventCardOverlay activeEvent={tutorialEvent ?? activeEvent} />
        {paused && (
          <PauseModal
            gameOptions={gameOptions}
            audioSettings={audioSettings}
            onAudioChange={handleAudioChange}
            chatOpen={chatOpen}
            onChatToggle={() => setChatOpen(o => !o)}
            botsEnabled={botsEnabled}
            onBotsToggle={() => setBotsEnabled(b => !b)}
            onResume={() => setPaused(false)}
            onExit={() => { setPaused(false); setTutorialStep(null); setScreen('menu') }}
            onRecipeSelect={!adventureRun && !isTutorial ? () => { setPaused(false); setScreen('freeplaysetup') } : undefined}
          />
        )}
        {isTutorial && tutorialStep !== null && (
          <TutorialOverlay
            stepIndex={tutorialStep}
            state={state}
            onNext={handleTutorialNext}
            onBack={handleTutorialBack}
            onSkip={handleTutorialComplete}
            onRepeat={handleTutorialRepeat}
            shiftLeft={tutorialStep === TUTORIAL_EVENT_INTRO_STEP || tutorialStep === TUTORIAL_EVENT_STEP}
            advanceReady={tutorialEventResolved}
          />
        )}
      </div>
    )
  }

  return (
    <>
      {content}
      {toast && <Toast message={toast} />}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
      {showTutorialPrompt && screen === 'menu' && !tutorialOpen && (
        <TutorialPrompt
          onStartTutorial={startTutorial}
          onNo={dismissTutorialPrompt}
          onDontShowAgain={disableTutorialPrompt}
        />
      )}
      {showNoTwitchPrompt && screen === 'menu' && !tutorialOpen && !showTutorialPrompt && (
        <NoTwitchPrompt
          onContinue={confirmNoTwitch}
          onBack={cancelNoTwitch}
        />
      )}
      {tutorialOpen && (
        <TutorialModal
          onClose={() => setTutorialOpen(false)}
          onStartCooking={handleTutorialStartCooking}
        />
      )}
    </>
  )
}
