import { useReducer, useCallback, useState, useEffect, useRef } from 'react'
import { useTutorialState } from './hooks/useTutorialState'
import { usePvpLobby } from './hooks/usePvpLobby'
import { useAdventureRun } from './hooks/useAdventureRun'
import { useGameSession } from './hooks/useGameSession'
import { gameReducer, createInitialState } from './state/gameReducer'
import { parseCommand } from './state/commandProcessor'
import { AudioSettings, GameOptions, Screen, TutorialDestination, ActiveEventOptions } from './state/types'
import { computeStarThresholds } from './data/starThresholds'
import { useGameLoop } from './hooks/useGameLoop'
import { useBotSimulation } from './hooks/useBotSimulation'
import { useTwitchChat } from './hooks/useTwitchChat'
import { useRoomHost } from './hooks/useRoomHost'
import { gameStateToSnapshot } from './state/snapshot'
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
import { TUTORIAL_STEPS } from './data/tutorialData'
import FeedbackModal from './components/FeedbackModal'
import { useKitchenEvents } from './hooks/useKitchenEvents'
import CreditsScreen from './components/CreditsScreen'
import Toast from './components/Toast'
import PlaysetPicker from './components/PlaysetPicker'
import { DIFFICULTY_PRESETS, type Playset, type Difficulty } from './data/playsets'
import { mergePlayerStats } from './data/adventureMode'
import GameplayScreen from './components/GameplayScreen'
import { DEFAULT_GAME_OPTIONS } from './state/defaultOptions'

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 1,
  musicVolume: 0.5,
  sfxVolume: 0.5,
  musicMuted: false,
  sfxMuted: false,
  darkMode: true,
  mobileFriendly: false,
  trackEnabled: { menu: false, gameplay: true, gameover: true }
}


export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [activeEventOptions, setActiveEventOptions] = useState<ActiveEventOptions | null>(null)
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
      const saved = localStorage.getItem('chatsKitchen_audioSettings')
      return saved ? { ...DEFAULT_AUDIO_SETTINGS, ...JSON.parse(saved) } : DEFAULT_AUDIO_SETTINGS
    } catch {
      return DEFAULT_AUDIO_SETTINGS
    }
  })
  const stateRef = useRef(state)
  stateRef.current = state
  const activeGameOptionsRef = useRef<GameOptions | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [autoRestartSignal, setAutoRestartSignal] = useState(0)
  const screenRef = useRef<Screen>('menu')
  const gameOptionsRef = useRef(gameOptions)
  const [showNoTwitchPrompt, setShowNoTwitchPrompt] = useState(false)
  const pendingActionRef = useRef<(() => void) | null>(null)
  const [chatMode, setChatMode] = useState<'local' | 'twitch' | 'room'>('local')
  const [roomPlayers, setRoomPlayers] = useState<Array<{ id: string; nickname: string }>>([])
  const chatModeRef = useRef(chatMode)
  chatModeRef.current = chatMode

  const {
    finalStats, setFinalStats, finalStatsRef,
    starThresholds, setStarThresholds,
    freePlayHighScore, setFreePlayHighScore,
    isNewHighScore, setIsNewHighScore,
    freePlayHistory, setFreePlayHistory,
    resetSession,
  } = useGameSession()

  const {
    adventureRun, setAdventureRun, adventureRunRef, adventureBestRun,
    isNewBestAdventureRun, startAdventure,
    handleShiftPassedNext, handleShiftEndDone, resetAdventureBestRun,
  } = useAdventureRun(dispatch, setScreen, setActiveEventOptions, activeGameOptionsRef, finalStatsRef)

  // Keep refs in sync so stable callbacks can read current values
  screenRef.current = screen
  gameOptionsRef.current = gameOptions

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(message)
    toastTimerRef.current = setTimeout(() => setToast(null), 2500)
  }, [])

  const { pvpLobby, setPvpLobby, pvpLobbyRef, startPvp, startPvpGame, balanceLobby, handleLobbyMetaCommand, handleLobbyJoin } = usePvpLobby(setScreen, showToast)

  const tutorial = useTutorialState(dispatch, setScreen, setActiveEventOptions, activeGameOptionsRef, setChatOpen)
  const {
    tutorialStep, setTutorialStep, tutorialResetKey, tutorialEvent, tutorialEventResolved,
    tutorialOpen, setTutorialOpen, showTutorialPrompt, setShowTutorialPrompt,
    tutorialDestination, setTutorialDestination, hideTutorialPrompt, isTutorial,
    startTutorial, handleTutorialNext, handleTutorialBack,
    handleTutorialComplete, handleTutorialRepeat, handleTutorialEventCommand,
    handleMenuTutorial, tutorialGameOver, persistHideTutorialPrompt, resetTutorial,
  } = tutorial

  const startFreePlay = useCallback(() => {
    setActiveEventOptions(null)
    activeGameOptionsRef.current = null
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
    setStarThresholds(null)
    if (chatModeRef.current === 'room') roomRef.current.lockJoins()
    setScreen('countdown')
  }, [gameOptions, pvpLobbyRef, setAdventureRun, setStarThresholds])

  const startFromPlayset = useCallback((playset: Playset, difficulty: Difficulty) => {
    const preset = DIFFICULTY_PRESETS[difficulty]
    const eventOpts = {
      kitchenEventsEnabled: true,
      enabledKitchenEvents: playset.events,
      kitchenEventSpawnMin: 60,
      kitchenEventSpawnMax: 120,
      kitchenEventDuration: 30, // 30s gives players more time to respond than the 12s default
    }
    setActiveEventOptions(eventOpts)
    activeGameOptionsRef.current = {
      ...DEFAULT_GAME_OPTIONS,
      shiftDuration:  preset.shiftDuration,
      cookingSpeed:   1.0,
      orderSpeed:     preset.orderSpeed,
      orderSpawnRate: preset.orderSpawnRate,
      enabledRecipes: playset.recipes,
      ...eventOpts,
    }
    setAdventureRun(null)
    dispatch({
      type: 'RESET',
      shiftDuration:   preset.shiftDuration,
      cookingSpeed:    1.0,
      orderSpeed:      preset.orderSpeed,
      orderSpawnRate:  preset.orderSpawnRate,
      stationCapacity: DEFAULT_GAME_OPTIONS.stationCapacity,
      restrictSlots:   false,
      enabledRecipes:  playset.recipes,
      teams: {},
    })
    setStarThresholds(null)
    if (chatModeRef.current === 'room') roomRef.current.lockJoins()
    setScreen('countdown')
  }, [setAdventureRun, setStarThresholds])



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
    if (destination === 'playsetpicker') {
      checkTwitch(() => setScreen('playsetpicker'))
      return
    }
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
  }, [continueFromTutorial, tutorialDestination, setShowTutorialPrompt])

  const disableTutorialPrompt = useCallback(() => {
    persistHideTutorialPrompt(true)
    setShowTutorialPrompt(false)
    continueFromTutorial(tutorialDestination)
  }, [continueFromTutorial, tutorialDestination, persistHideTutorialPrompt, setShowTutorialPrompt])

  const handleMenuPlay = useCallback((destination: TutorialDestination) => {
    if (!hideTutorialPrompt) {
      setTutorialDestination(destination)
      setShowTutorialPrompt(true)
      return
    }
    continueFromTutorial(destination)
  }, [continueFromTutorial, hideTutorialPrompt, setTutorialDestination, setShowTutorialPrompt])

  const handleTutorialStartCooking = useCallback(() => {
    setTutorialOpen(false)
    continueFromTutorial(tutorialDestination)
  }, [continueFromTutorial, tutorialDestination, setTutorialOpen])

  const handleCommand = useCallback((user: string, text: string) => {
    const teams = stateRef.current.teams
    if (teams && !teams[user]) return  // PvP: only registered team members can act
    const action = parseCommand(user, text, gameOptions.allowShortformCommands)
    if (action) dispatch(action)
  }, [gameOptions.allowShortformCommands])

  const effectiveEventOptions = activeEventOptions ?? gameOptions
  const { activeEvent, handleEventCommand } = useKitchenEvents(
    state,
    dispatch,
    screen === 'playing' && !isTutorial && effectiveEventOptions.kitchenEventsEnabled,
    paused,
    effectiveEventOptions.enabledKitchenEvents,
    effectiveEventOptions.kitchenEventSpawnMin * 1000,
    effectiveEventOptions.kitchenEventSpawnMax * 1000,
    effectiveEventOptions.kitchenEventDuration * 1000,
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
    setActiveEventOptions(null)
    const s = stateRef.current
    setFinalStats({
      money: s.money,
      served: s.served,
      lost: s.lost,
      playerStats: s.playerStats,
      teams: s.teams,
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
      // Compute star thresholds from actual player count (non-PvP free play only)
      if (!s.teams || Object.keys(s.teams).length === 0) {
        const playerCount = Object.keys(s.playerStats).length
        const optionsForThresholds = activeGameOptionsRef.current ?? gameOptionsRef.current
        activeGameOptionsRef.current = null
        setStarThresholds(computeStarThresholds(optionsForThresholds, Math.max(1, playerCount)))
      } else {
        setStarThresholds(null)
      }
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
        const updated = [{ money: s.money, served: s.served, lost: s.lost, playerCount: Object.keys(s.playerStats).length }, ...prev].slice(0, 5)
        try { localStorage.setItem('chatsKitchen_freePlayHistory', JSON.stringify(updated)) } catch { /* ignore */ }
        return updated
      })
    }
    if (chatModeRef.current === 'room') roomRef.current.unlockJoins()
    setScreen('shiftend')
  }, [adventureRunRef, setAdventureRun, setFinalStats, setStarThresholds, setFreePlayHighScore, setIsNewHighScore, setFreePlayHistory])


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
  }, [startFreePlay, handleGameOptionsChange, handleGameOver, showToast, adventureRunRef])

  const isTutorialRef = useRef(isTutorial)
  isTutorialRef.current = isTutorial

  const handleTwitchMessage = useCallback((user: string, text: string, isMod: boolean) => {
    dispatch({ type: 'ADD_CHAT', username: user, text, msgType: 'normal' })
    // PvP lobby: intercept !red / !blue / !join / !leave and lobby mod commands
    if (screenRef.current === 'pvplobby') {
      if (handleLobbyJoin(user, text.trim().toLowerCase())) return
      handleLobbyMetaCommand(user, text, isMod)
      return
    }
    handleEventCommand(user, text)
    handleTutorialEventCommand(text)
    handleMetaCommand(user, text, isMod)
    if (!isTutorialRef.current) handleCommand(user, text)
  }, [handleCommand, handleEventCommand, handleTutorialEventCommand, handleMetaCommand, handleLobbyMetaCommand, handleLobbyJoin])

  const effectiveTwitchChannel = chatMode === 'twitch' ? twitchChannel : null
  const twitchChat = useTwitchChat(effectiveTwitchChannel, handleTwitchMessage)

  const room = useRoomHost({
    enabled: chatMode === 'room',
    onPlayerCommand: (nickname, command) => handleTwitchMessage(nickname, command, false),
    onPlayerJoined: (id, nickname) => setRoomPlayers(prev => [...prev, { id, nickname }]),
    onPlayerLeft: (id) => setRoomPlayers(prev => prev.filter(p => p.id !== id)),
  })
  const roomRef = useRef(room)
  roomRef.current = room

  const handleChatSend = useCallback((text: string) => {
    dispatch({ type: 'ADD_CHAT', username: 'You', text, msgType: 'normal' })
    if (screenRef.current === 'pvplobby') {
      if (handleLobbyJoin('You', text.trim().toLowerCase())) return
      handleLobbyMetaCommand('You', text, true)
      return
    }
    handleEventCommand('You', text)
    handleTutorialEventCommand(text)
    handleMetaCommand('You', text, true)
    handleCommand('You', text)
  }, [handleCommand, handleEventCommand, handleTutorialEventCommand, handleMetaCommand, handleLobbyMetaCommand, handleLobbyJoin])


  useEffect(() => {
    document.documentElement.setAttribute('data-theme', audioSettings.darkMode ? 'dark' : 'light')
  }, [audioSettings.darkMode])

  useEffect(() => {
    document.documentElement.setAttribute('data-mobile', audioSettings.mobileFriendly ? 'true' : 'false')
  }, [audioSettings.mobileFriendly])

  const handleAudioChange = useCallback((settings: AudioSettings) => {
    setAudioSettings(settings)
    localStorage.setItem('chatsKitchen_audioSettings', JSON.stringify(settings))
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
    resetAdventureBestRun()
    resetSession()
    handleTwitchChannelChange(null)
    resetTutorial()

    try {
      localStorage.setItem('chatsKitchen_audioSettings', JSON.stringify(DEFAULT_AUDIO_SETTINGS))
      localStorage.removeItem('chatsKitchen_adventureBestRun')
      localStorage.removeItem('chatsKitchen_gameOptions')
      localStorage.removeItem('chatsKitchen_hideTutorialPrompt')
      localStorage.removeItem('chatsKitchen_preparedItemsShowNames')
      localStorage.removeItem('chatsKitchen_diningRoomSimpleTickets')
      localStorage.removeItem('chatsKitchen_kitchenShowCommands')
    } catch {
      // Ignore storage failures and keep the in-memory reset behavior.
    }
  }, [handleTwitchChannelChange, resetTutorial, resetAdventureBestRun, resetSession])

  useEffect(() => {
    if (chatMode !== 'room') return
    const interval = setInterval(() => {
      const currentScreen = screenRef.current
      const phase: 'lobby' | 'playing' | 'gameover' =
        currentScreen === 'playing' ? 'playing'
        : (currentScreen === 'shiftend' || currentScreen === 'gameover') ? 'gameover'
        : 'lobby'
      roomRef.current.sendSnapshot(gameStateToSnapshot(stateRef.current, phase))
    }, 300)
    return () => clearInterval(interval)
  }, [chatMode])

  useEffect(() => {
    if (chatMode !== 'room') setRoomPlayers([])
  }, [chatMode])

  const isPlaying = screen === 'playing'
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
        onPlay={() => handleMenuPlay('playsetpicker')}
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
        roomCode={chatMode === 'room' ? room.code : null}
        roomConnected={room.connected}
        roomPlayers={chatMode === 'room' ? roomPlayers : []}
        onHostRoom={() => { setChatMode('room'); setRoomPlayers([]) }}
        onLeaveRoom={() => setChatMode('local')}
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
        onBalance={balanceLobby}
        onKick={username => setPvpLobby(prev => {
          if (!prev) return prev
          return {
            red: prev.red.filter(u => u !== username),
            blue: prev.blue.filter(u => u !== username),
          }
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
  } else if (screen === 'playsetpicker') {
    content = (
      <PlaysetPicker
        onStart={startFromPlayset}
        onCustomise={() => setScreen('freeplaysetup')}
        onBack={() => setScreen('menu')}
      />
    )
  } else if (screen === 'freeplaysetup') {
    content = <FreePlaySetup options={gameOptions} onChange={handleGameOptionsChange} onStart={startFreePlay} onBack={() => setScreen(pvpLobby ? 'pvplobby' : 'playsetpicker')} twitchStatus={twitchChat.status} twitchChannel={twitchChannel} roundHistory={freePlayHistory} />
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
        starThresholds={starThresholds ?? undefined}
        autoRestart={gameOptions.autoRestart}
        autoRestartDelay={gameOptions.autoRestartDelay}
        autoRestartSignal={autoRestartSignal}
        teams={finalStats.teams}
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
        onPvpLobby={finalStats.redMoney !== undefined ? () => setScreen('pvplobby') : undefined}
        onEnableAutoRestart={() => handleGameOptionsChange({ ...gameOptionsRef.current, autoRestart: true })}
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
      <GameplayScreen
        state={state}
        paused={paused}
        chatOpen={chatOpen}
        botsEnabled={botsEnabled}
        audioSettings={audioSettings}
        activeEvent={activeEvent}
        tutorialEvent={tutorialEvent}
        tutorialStep={tutorialStep}
        tutorialHighlight={tutorialHighlight}
        tutorialEventResolved={tutorialEventResolved}
        isTutorial={isTutorial}
        twitchStatus={twitchChat.status}
        twitchChannel={twitchChannel}
        onChatSend={handleChatSend}
        onChatOpen={setChatOpen}
        onPause={setPaused}
        onAudioChange={handleAudioChange}
        onExit={() => { setPaused(false); setTutorialStep(null); setScreen('menu') }}
        onPlaysetPicker={!adventureRun && !isTutorial ? () => { setPaused(false); setScreen('playsetpicker') } : undefined}
        onRecipeSelect={!adventureRun && !isTutorial ? () => { setPaused(false); setScreen('freeplaysetup') } : undefined}
        onTutorialNext={handleTutorialNext}
        onTutorialBack={handleTutorialBack}
        onTutorialSkip={handleTutorialComplete}
        onTutorialRepeat={handleTutorialRepeat}
        onBotsToggle={() => setBotsEnabled(b => !b)}
      />
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
