import { useReducer, useCallback, useState, useEffect, useRef } from 'react'
import { gameReducer, createInitialState } from './state/gameReducer'
import { parseCommand } from './state/commandProcessor'
import { AudioSettings, GameOptions, LevelProgress, PlayerStats } from './state/types'
import { useGameLoop } from './hooks/useGameLoop'
import { useBotSimulation } from './hooks/useBotSimulation'
import { useTwitchChat } from './hooks/useTwitchChat'
import { useGameAudio } from './audio/useGameAudio'
import { useViewportScale } from './hooks/useViewportScale'
import MainMenu from './components/MainMenu'
import FreePlaySetup from './components/FreePlaySetup'
import OptionsScreen from './components/OptionsScreen'
import Countdown from './components/Countdown'
import ShiftEnd from './components/ShiftEnd'
import GameOver from './components/GameOver'
import LevelSelect from './components/LevelSelect'
import TutorialModal from './components/TutorialModal'
import TutorialPrompt from './components/TutorialPrompt'
import PauseModal from './components/PauseModal'
import Toast from './components/Toast'
import { getLevelConfig, getStarRating } from './data/levels'
import Kitchen from './components/Kitchen'
import OrdersBar from './components/DiningRoom'
import ChatPanel from './components/ChatPanel'
import BottomBar from './components/BottomBar'
import styles from './App.module.css'

type Screen = 'menu' | 'levelselect' | 'options' | 'freeplaysetup' | 'countdown' | 'playing' | 'shiftend' | 'gameover'
type TutorialDestination = 'menu' | 'freeplaysetup' | 'levelselect'

const DEFAULT_GAME_OPTIONS: GameOptions = {
  cookingSpeed: 1,
  orderSpeed: 1,
  orderSpawnRate: 1,
  shiftDuration: 180000,
  stationCapacity: { chopping: 3, cooking: 2 },
  restrictSlots: false,
  enabledRecipes: ['burger', 'fish_burger', 'mushroom_soup', 'roasted_veggies'],
  allowShortformCommands: true,
  autoRestart: false,
  autoRestartDelay: 60,
}

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 1,
  musicVolume: 0.5,
  sfxVolume: 0.5,
  musicMuted: false,
  sfxMuted: false,
  darkMode: true,
  trackEnabled: { menu: false, gameplay: true, gameover: true }
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
  const [finalStats, setFinalStats] = useState<{ money: number; served: number; lost: number; playerStats: Record<string, PlayerStats> }>({ money: 0, served: 0, lost: 0, playerStats: {} })
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
  const currentLevelRef = useRef<number | null>(null)
  const [currentLevel, setCurrentLevel] = useState<number | null>(null)
  const [levelProgress, setLevelProgress] = useState<LevelProgress>(() => {
    try {
      const saved = localStorage.getItem('chatsKitchen_levelProgress')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  const [hideTutorialPrompt, setHideTutorialPrompt] = useState(() => {
    try {
      return localStorage.getItem('chatsKitchen_hideTutorialPrompt') === 'true'
    } catch {
      return false
    }
  })
  const [showTutorialPrompt, setShowTutorialPrompt] = useState(false)
  const [tutorialDestination, setTutorialDestination] = useState<TutorialDestination>('menu')

  // Keep refs in sync so stable callbacks can read current values
  screenRef.current = screen
  gameOptionsRef.current = gameOptions
  currentLevelRef.current = currentLevel

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(message)
    toastTimerRef.current = setTimeout(() => setToast(null), 2500)
  }, [])

  const startFreePlay = useCallback(() => {
    setCurrentLevel(null)
    dispatch({ type: 'RESET', shiftDuration: gameOptions.shiftDuration, cookingSpeed: gameOptions.cookingSpeed, orderSpeed: gameOptions.orderSpeed, orderSpawnRate: gameOptions.orderSpawnRate, stationCapacity: gameOptions.stationCapacity, restrictSlots: gameOptions.restrictSlots, enabledRecipes: gameOptions.enabledRecipes })
    setScreen('countdown')
  }, [gameOptions])

  const continueFromTutorial = useCallback((destination: TutorialDestination) => {
    if (destination === 'freeplaysetup') {
      setScreen('freeplaysetup')
      return
    }

    if (destination === 'levelselect') {
      setScreen('levelselect')
      return
    }

    setScreen('menu')
  }, [])

  const openTutorial = useCallback((destination: TutorialDestination) => {
    setShowTutorialPrompt(false)
    setTutorialDestination(destination)
    setTutorialOpen(true)
  }, [])

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

  const handleCommand = useCallback((user: string, text: string) => {
    const action = parseCommand(user, text, gameOptions.allowShortformCommands)
    if (action) dispatch(action)
  }, [gameOptions.allowShortformCommands])

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
    setFinalStats({ money: s.money, served: s.served, lost: s.lost, playerStats: s.playerStats })
    if (currentLevel != null) {
      const stars = getStarRating(currentLevel, s.money)
      if (stars > (levelProgress[currentLevel] || 0)) {
        const updated = { ...levelProgress, [currentLevel]: stars }
        setLevelProgress(updated)
        localStorage.setItem('chatsKitchen_levelProgress', JSON.stringify(updated))
      }
      setIsNewHighScore(false)
    } else {
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
    }
    setScreen('shiftend')
  }, [currentLevel, levelProgress])

  const handleMetaCommand = useCallback((user: string, text: string, isMod: boolean) => {
    if (!isMod) return
    const cmd = text.trim().toLowerCase()
    const s = screenRef.current

    if (cmd === '!start' && s === 'gameover' && currentLevelRef.current == null) {
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

  const handleTwitchMessage = useCallback((user: string, text: string, isMod: boolean) => {
    dispatch({ type: 'ADD_CHAT', username: user, text, msgType: 'normal' })
    handleMetaCommand(user, text, isMod)
    handleCommand(user, text)
  }, [handleCommand, handleMetaCommand])

  const twitchChat = useTwitchChat(twitchChannel, handleTwitchMessage)
  const handleChatSend = useCallback((text: string) => {
    dispatch({ type: 'ADD_CHAT', username: 'You', text, msgType: 'normal' })
    handleMetaCommand('You', text, true)
    handleCommand('You', text)
  }, [handleCommand, handleMetaCommand])

  const handleShiftEndDone = useCallback(() => setScreen('gameover'), [])

  const startLevel = useCallback((level: number) => {
    const config = getLevelConfig(level)
    setCurrentLevel(level)
    dispatch({ type: 'RESET', shiftDuration: config.shiftDuration, cookingSpeed: config.cookingSpeed, orderSpeed: config.orderSpeed, orderSpawnRate: gameOptions.orderSpawnRate, stationCapacity: gameOptions.stationCapacity, restrictSlots: gameOptions.restrictSlots, enabledRecipes: gameOptions.enabledRecipes })
    setScreen('countdown')
  }, [gameOptions.stationCapacity])

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
    setLevelProgress({})
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
      localStorage.removeItem('chatsKitchen_levelProgress')
      localStorage.removeItem('chatsKitchen_freePlayHighScore')
      localStorage.removeItem('chatsKitchen_freePlayHistory')
      localStorage.removeItem('chatsKitchen_gameOptions')
      localStorage.removeItem('chatsKitchen_hideTutorialPrompt')
    } catch {
      // Ignore storage failures and keep the in-memory reset behavior.
    }
  }, [handleTwitchChannelChange])

  const isPlaying = screen === 'playing'
  useGameLoop(state, dispatch, isPlaying ? handleGameOver : undefined, paused)
  useBotSimulation(state, dispatch, handleCommand, isPlaying && botsEnabled)
  useGameAudio(screen, state, audioSettings)
  useViewportScale()

  let content

  if (screen === 'menu') {
    content = (
      <MainMenu
        onPlay={() => handleMenuPlay('freeplaysetup')}
        onLevels={() => handleMenuPlay('levelselect')}
        onOptions={() => setScreen('options')}
        onTutorial={handleMenuTutorial}
        twitchChannel={twitchChannel}
        twitchStatus={twitchChat.status}
        twitchError={twitchChat.error}
        onTwitchConnect={(ch) => setTwitchChannel(ch)}
        onTwitchDisconnect={() => setTwitchChannel(null)}
      />
    )
  } else if (screen === 'levelselect') {
    content = (
      <LevelSelect
        progress={levelProgress}
        onSelectLevel={startLevel}
        onBack={() => setScreen('menu')}
        twitchChannel={twitchChannel}
        twitchConnected={twitchChat.status === 'connected'}
      />
    )
  } else if (screen === 'options') {
    content = <OptionsScreen options={gameOptions} onChange={handleGameOptionsChange} audioSettings={audioSettings} onAudioChange={handleAudioChange} onResetAll={handleResetAll} onBack={() => setScreen('menu')} />
  } else if (screen === 'freeplaysetup') {
    content = <FreePlaySetup options={gameOptions} onChange={handleGameOptionsChange} onStart={startFreePlay} onBack={() => setScreen('menu')} />
  } else if (screen === 'countdown') {
    content = <Countdown onDone={() => setScreen('playing')} />
  } else if (screen === 'shiftend') {
    content = (
      <ShiftEnd
        money={finalStats.money}
        served={finalStats.served}
        lost={finalStats.lost}
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
        level={currentLevel}
        highScore={currentLevel == null ? freePlayHighScore : undefined}
        isNewHighScore={currentLevel == null ? isNewHighScore : false}
        roundHistory={currentLevel == null ? freePlayHistory : undefined}
        autoRestart={currentLevel == null && gameOptions.autoRestart}
        autoRestartDelay={gameOptions.autoRestartDelay}
        autoRestartSignal={autoRestartSignal}
        onPlayAgain={currentLevel != null ? () => startLevel(currentLevel) : startFreePlay}
        onNextLevel={currentLevel != null && currentLevel < 10 ? () => startLevel(currentLevel + 1) : undefined}
        onMenu={() => setScreen('menu')}
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
          <OrdersBar state={state} />
          <Kitchen state={state} />
          {chatOpen && (
            <ChatPanel
              messages={state.chatMessages}
              onSend={handleChatSend}
              onClose={() => setChatOpen(false)}
            />
          )}
        </div>
        <BottomBar money={state.money} served={state.served} lost={state.lost} />
        <div className={`${styles.settingsWrapper} ${chatOpen ? styles.settingsWrapperChatOpen : ''}`}>
          <button className={styles.settingsBtn} onClick={() => setPaused(true)}>⚙️</button>
        </div>
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
            onExit={() => { setPaused(false); setScreen('menu') }}
          />
        )}
      </div>
    )
  }

  return (
    <>
      {content}
      {toast && <Toast message={toast} />}
      {showTutorialPrompt && screen === 'menu' && !tutorialOpen && (
        <TutorialPrompt
          onYes={() => openTutorial(tutorialDestination)}
          onNo={dismissTutorialPrompt}
          onDontShowAgain={disableTutorialPrompt}
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
