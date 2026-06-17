import { useReducer, useCallback, useState, useEffect, useRef } from 'react'
import { useTutorialState } from './hooks/useTutorialState'
import { usePvpLobby } from './hooks/usePvpLobby'
import { useAdventureLobby } from './hooks/useAdventureLobby'
import { useAdventureRun, loadSavedAdventureRun, SavedAdventureRun } from './hooks/useAdventureRun'
import { useGameSession } from './hooks/useGameSession'
import { gameReducer, createInitialState } from './state/gameReducer'
import { parseCommand } from './state/commandProcessor'
import { AudioSettings, GameOptions, Screen, ActiveEventOptions, toActiveEventOptions } from './state/types'
import { computeStarThresholds } from './data/starThresholds'
import { useGameLoop } from './hooks/useGameLoop'
import { useBotSimulation } from './hooks/useBotSimulation'
import { useTwitchChat } from './hooks/useTwitchChat'
import { useRoomHost } from './hooks/useRoomHost'
import { gameStateToSnapshot, pvpLobbySnapshot, pvpLobbyPerPlayer, adventureVoteSnapshot } from './state/snapshot'
import type { VoteSnapshot } from './shared/protocol'
import { classifyRoomCommand } from './state/roomCommandRouting'
import { countActivePlayers } from './state/participants'
import { storage } from './state/storage'
import { unassignedPool, mergeAdventureRoster } from './state/roomRoster'
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
import AdventureRecipePick from './components/AdventureRecipePick'
import AdventureIntroModal from './components/AdventureIntroModal'
import AdventureLobby from './components/AdventureLobby'
import AdventurePantryShop from './components/AdventurePantryShop'
import AdventureRunEnd from './components/AdventureRunEnd'
import AdventureShiftPassed from './components/AdventureShiftPassed'
import TutorialModal from './components/TutorialModal'
import { TUTORIAL_STEPS } from './data/tutorialData'
import FeedbackModal from './components/FeedbackModal'
import { useKitchenEvents } from './hooks/useKitchenEvents'
import CreditsScreen from './components/CreditsScreen'
import Toast from './components/Toast'
import PlaysetPicker from './components/PlaysetPicker'
import { DIFFICULTY_PRESETS, type Playset, type Difficulty } from './data/playsets'
import { mergePlayerStats, ADVENTURE_TOTAL_SHIFTS } from './data/adventureMode'
import GameplayScreen from './components/GameplayScreen'
import ModeHub from './components/ModeHub'
import RoomQRModal from './components/RoomQRModal'
import { DEFAULT_GAME_OPTIONS } from './state/defaultOptions'

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
  const [activeEventOptions, setActiveEventOptions] = useState<ActiveEventOptions | null>(null)
  const [gameOptions, setGameOptions] = useState<GameOptions>(() =>
    ({ ...DEFAULT_GAME_OPTIONS, ...storage.getJSON<Partial<GameOptions>>('chatsKitchen_gameOptions', {}) })
  )
  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    createInitialState(gameOptions.shiftDuration, gameOptions.cookingSpeed, gameOptions.orderSpeed, gameOptions.orderSpawnRate)
  )
  const [botsEnabled, setBotsEnabled] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [paused, setPaused] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [twitchChannel, setTwitchChannel] = useState<string | null>(() => storage.get('chatsKitchen_twitchChannel'))
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() =>
    ({ ...DEFAULT_AUDIO_SETTINGS, ...storage.getJSON<Partial<AudioSettings>>('chatsKitchen_audioSettings', {}) })
  )
  const stateRef = useRef(state)
  stateRef.current = state
  const lastSnapshotStateRef = useRef<object | null>(null)
  const lastSnapshotPhaseRef = useRef<string | null>(null)
  const activeGameOptionsRef = useRef<GameOptions | null>(null)
  const lastPlayedOptionsRef = useRef<GameOptions | null>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [autoRestartSignal, setAutoRestartSignal] = useState(0)
  const screenRef = useRef<Screen>('menu')
  const gameOptionsRef = useRef(gameOptions)
  const [adventureIntroOpen, setAdventureIntroOpen] = useState(false)
  const [roomQrOpen, setRoomQrOpen] = useState(false)
  // Jackbox-style co-play: a Local Play room is always live (its QR is shown on
  // the menu); Twitch chat, when a channel is connected, plays alongside it.
  // chatMode stays 'room' for the whole session — there is no connection switch.
  const [chatMode] = useState<'local' | 'twitch' | 'room'>('room')
  const [roomPlayers, setRoomPlayers] = useState<Array<{ id: string; nickname: string; disconnected?: boolean }>>([])
  const chatModeRef = useRef(chatMode)
  chatModeRef.current = chatMode
  const roomPlayersRef = useRef(roomPlayers)
  roomPlayersRef.current = roomPlayers

  const {
    finalStats, setFinalStats, finalStatsRef,
    starThresholds, setStarThresholds,
    freePlayHighScore, setFreePlayHighScore,
    isNewHighScore, setIsNewHighScore,
    freePlayHistory, setFreePlayHistory,
    resetSession,
  } = useGameSession()

  // Keep refs in sync so stable callbacks can read current values
  screenRef.current = screen
  gameOptionsRef.current = gameOptions

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(message)
    toastTimerRef.current = setTimeout(() => setToast(null), 2500)
  }, [])

  const {
    adventureLobby, setAdventureLobby, adventureLobbyRef,
    openAdventureLobby, clearAdventureLobby, kickPlayer: kickAdventurePlayer,
    handleLobbyJoin: handleAdventureLobbyJoin,
    handleLobbyMetaCommand: handleAdventureLobbyMetaCommand,
  } = useAdventureLobby(setScreen, showToast)

  const {
    adventureRun, setAdventureRun, adventureRunRef, adventureBestRun,
    isNewBestAdventureRun, startAdventure,
    handleShiftEndDone, resetAdventureBestRun,
    openRecipePick, confirmRecipePick, skipRecipePick, purchaseGarnish, rerollShopOffers, closeShop, getRerollPrice,
    resumeAdventureRun, hydrateAdventureRun, clearSavedAdventureRun,
  } = useAdventureRun(dispatch, setScreen, setActiveEventOptions, activeGameOptionsRef, finalStatsRef, adventureLobbyRef)

  // Saved-run preview for the Main Menu's Resume pill. Loaded once on mount;
  // refreshed locally whenever the user resumes or clears the save. The Resume
  // pill renders from this; the live `adventureRun` state is only populated
  // after the user opts in.
  const [savedRunPreview, setSavedRunPreview] = useState<SavedAdventureRun | null>(() => loadSavedAdventureRun())

  // Vote-screen chat interception: the active vote-driven screen (e.g. PantryShop)
  // registers its registerVote handler here so chat messages routing can find it.
  const adventureVoteRef = useRef<((user: string, text: string) => boolean) | null>(null)
  // The active vote-driven screen also publishes its live VoteSnapshot here so the
  // room snapshot loop can push voting UI to phones (otherwise they sit on the
  // "waiting for host" lobby and can't vote). Cleared when the screen unmounts.
  const adventureVoteSnapshotRef = useRef<VoteSnapshot | null>(null)

  const { pvpLobby, setPvpLobby, pvpLobbyRef, startPvp, startPvpGame, balanceLobby, handleLobbyMetaCommand, handleLobbyJoin } = usePvpLobby(setScreen, showToast)

  const tutorial = useTutorialState(dispatch, setScreen, setActiveEventOptions, activeGameOptionsRef, setChatOpen)
  const {
    tutorialStep, setTutorialStep, tutorialResetKey, tutorialEvent, tutorialEventResolved,
    tutorialOpen, setTutorialOpen, isTutorial,
    startTutorial, handleTutorialNext, handleTutorialBack,
    handleTutorialComplete, handleTutorialRepeat, handleTutorialEventCommand,
    tutorialGameOver, resetTutorial,
  } = tutorial

  // Shared round kickoff: clear any Adventure run, RESET the reducer with the
  // given options + team map, snapshot the room headcount, lock joins, and run
  // the countdown. Both Free Play and the playset picker funnel through here.
  type RoundOptions = Pick<GameOptions, 'shiftDuration' | 'cookingSpeed' | 'orderSpeed' | 'orderSpawnRate' | 'enabledRecipes'>
  const beginRound = useCallback((opts: RoundOptions, teams: Record<string, 'red' | 'blue'>) => {
    setAdventureRun(null)
    dispatch({
      type: 'RESET',
      shiftDuration: opts.shiftDuration,
      cookingSpeed: opts.cookingSpeed,
      orderSpeed: opts.orderSpeed,
      orderSpawnRate: opts.orderSpawnRate,
      enabledRecipes: opts.enabledRecipes,
      teams,
      participantCount: chatModeRef.current === 'room' ? roomPlayersRef.current.filter(p => !p.disconnected).length : 0,
    })
    setStarThresholds(null)
    if (chatModeRef.current === 'room') roomRef.current.lockJoins()
    setScreen('countdown')
  }, [setAdventureRun, setStarThresholds])

  const startFreePlay = useCallback((replay = false) => {
    const replayOpts = replay ? lastPlayedOptionsRef.current : null
    const opts = replayOpts ?? gameOptions
    if (!replay) lastPlayedOptionsRef.current = gameOptions

    setActiveEventOptions(replayOpts ? toActiveEventOptions(replayOpts) : null)
    activeGameOptionsRef.current = replayOpts

    const teams: Record<string, 'red' | 'blue'> = pvpLobbyRef.current
      ? Object.fromEntries([
          ...pvpLobbyRef.current.red.map(u => [u, 'red' as const]),
          ...pvpLobbyRef.current.blue.map(u => [u, 'blue' as const]),
        ])
      : {}
    beginRound(opts, teams)
  }, [gameOptions, pvpLobbyRef, beginRound])

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
    const playsetGameOptions: GameOptions = {
      ...DEFAULT_GAME_OPTIONS,
      shiftDuration:  preset.shiftDuration,
      cookingSpeed:   1.0,
      orderSpeed:     preset.orderSpeed,
      orderSpawnRate: preset.orderSpawnRate,
      enabledRecipes: playset.recipes,
      ...eventOpts,
    }
    activeGameOptionsRef.current = playsetGameOptions
    lastPlayedOptionsRef.current = playsetGameOptions
    beginRound(playsetGameOptions, {})
  }, [beginRound])



  // !start from the lobby (or the on-screen Start button) either starts a new
  // run (opening recipe draft) or resumes an existing one if the host had stepped
  // back to the lobby mid-run via the briefing's "Manage Lobby" button.
  const handleAdventureLobbyStart = useCallback(() => {
    // No empty-roster guard: the host plays as an uncounted admin via the
    // in-game chatbox, so a solo run (0 joined chefs) is allowed.
    if (adventureRunRef.current) {
      resumeAdventureRun()
      return
    }
    startAdventure()
  }, [adventureRunRef, resumeAdventureRun, startAdventure])

  // Briefing → lobby (preserves the active run; lobby's "Resume" button calls
  // resumeAdventureRun to return).
  const handleManageLobby = useCallback(() => {
    setScreen('adventurelobby')
  }, [setScreen])

  // Main Menu "Resume Adventure" pill → restore the saved run and jump to its briefing.
  const handleResumeSavedRun = useCallback(() => {
    const saved = savedRunPreview
    if (!saved) return
    setAdventureLobby(saved.lobby)
    hydrateAdventureRun(saved)
  }, [savedRunPreview, setAdventureLobby, hydrateAdventureRun])

  // "Play Again" from the run-end screen reopens the lobby so the host can adjust the roster.
  const handleAdventurePlayAgain = useCallback(() => {
    setAdventureRun(null)
    openAdventureLobby()
  }, [openAdventureLobby, setAdventureRun])

  const handleTutorialStartCooking = useCallback(() => {
    setTutorialOpen(false)
    setScreen('menu')
  }, [setTutorialOpen])

  const handleCommand = useCallback((user: string, text: string) => {
    if (pausedRef.current) return
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
    storage.setJSON('chatsKitchen_gameOptions', options)
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
        const playerCount = Math.max(s.participantCount, countActivePlayers(s.playerStats), 1)
        const optionsForThresholds = activeGameOptionsRef.current ?? gameOptionsRef.current
        activeGameOptionsRef.current = null
        setStarThresholds(computeStarThresholds(optionsForThresholds, playerCount))
      } else {
        setStarThresholds(null)
      }
      // Free Play: existing high-score + history logic (unchanged)
      setFreePlayHighScore(prev => {
        if (s.money > prev) {
          storage.set('chatsKitchen_freePlayHighScore', String(s.money))
          setIsNewHighScore(true)
          return s.money
        }
        setIsNewHighScore(false)
        return prev
      })
      setFreePlayHistory(prev => {
        const updated = [{ money: s.money, served: s.served, lost: s.lost, playerCount: Object.keys(s.playerStats).length }, ...prev].slice(0, 5)
        storage.setJSON('chatsKitchen_freePlayHistory', updated)
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

  // Single command pipeline shared by all three input sources — Twitch chat, phone
  // controllers, and the local chatbox. Screen-based intercepts run first (PvP /
  // Adventure lobby joins, mod commands, choice votes); anything left falls through
  // to the game reducer. `forceDuringTutorial` is the one intentional asymmetry
  // (CLAUDE.md pitfall #13): the local host may practise commands mid-tutorial,
  // while Twitch/phone input stays gated.
  const routeChatCommand = useCallback((user: string, text: string, isMod: boolean, forceDuringTutorial: boolean) => {
    dispatch({ type: 'ADD_CHAT', username: user, text, msgType: 'normal' })
    const lower = text.trim().toLowerCase()

    switch (classifyRoomCommand(screenRef.current)) {
      case 'pvpLobby':
        if (handleLobbyJoin(user, lower)) return
        handleLobbyMetaCommand(user, text, isMod)
        return
      case 'adventureLobby':
        if (handleAdventureLobbyJoin(user, lower)) return
        if (handleAdventureLobbyMetaCommand(user, text, isMod) === 'start') handleAdventureLobbyStart()
        return
      case 'adventureVote':
        if (adventureVoteRef.current?.(user, text)) return
        break // not a vote command — fall through to the game pipeline
      case 'game':
        break
    }

    // Mid-run roster upkeep: !leave / !kick adjust the crew (applied at the next
    // shift boundary in closeShop); the command also falls through to the game.
    if (adventureRunRef.current) {
      handleAdventureLobbyJoin(user, lower)
      handleAdventureLobbyMetaCommand(user, text, isMod)
    }

    handleEventCommand(user, text)
    handleTutorialEventCommand(text)
    handleMetaCommand(user, text, isMod)
    if (forceDuringTutorial || !isTutorialRef.current) handleCommand(user, text)
  }, [handleCommand, handleEventCommand, handleTutorialEventCommand, handleMetaCommand, handleLobbyMetaCommand, handleLobbyJoin, handleAdventureLobbyJoin, handleAdventureLobbyMetaCommand, handleAdventureLobbyStart, adventureRunRef])

  // Twitch co-play: chat drives the game through the same routing as everyone else.
  const handleTwitchMessage = useCallback(
    (user: string, text: string, isMod: boolean) => routeChatCommand(user, text, isMod, false),
    [routeChatCommand],
  )

  // Keep Twitch connected regardless of chatMode so streamers can still see chat while using Local Play
  const effectiveTwitchChannel = twitchChannel
  const twitchChat = useTwitchChat(effectiveTwitchChannel, handleTwitchMessage)

  const room = useRoomHost({
    enabled: chatMode === 'room',
    // Phone players are never mods; they drive the game through the shared pipeline.
    onPlayerCommand: (nickname, command) => routeChatCommand(nickname, command, false, false),
    onPlayerJoined: (id, nickname, isReconnect) => setRoomPlayers(prev =>
      isReconnect
        ? prev.map(p => p.id === id ? { ...p, disconnected: false } : p)
        : [...prev, { id, nickname }]
    ),
    onPlayerDisconnected: (id) => setRoomPlayers(prev => prev.map(p => p.id === id ? { ...p, disconnected: true } : p)),
    onPlayerLeft: (id) => setRoomPlayers(prev => prev.filter(p => p.id !== id)),
  })
  const roomRef = useRef(room)
  roomRef.current = room

  // Menu "Play" → mode hub. The room is already live (always-on), so there is
  // no connection step; players join via QR or Twitch from the menu.
  const goToHub = useCallback(() => setScreen('modehub'), [])

  // Mode hub buttons
  const hubFreePlay  = useCallback(() => setScreen('playsetpicker'), [])
  const hubAdventure = useCallback(() => openAdventureLobby(), [openAdventureLobby])
  const hubPvp       = useCallback(() => startPvp(), [startPvp])

  // Local chatbox: the host acts as the broadcaster (always mod) and may practise
  // commands during the tutorial (forceDuringTutorial = true).
  const handleChatSend = useCallback(
    (text: string) => routeChatCommand('You', text, true, true),
    [routeChatCommand],
  )


  useEffect(() => {
    document.documentElement.setAttribute('data-theme', audioSettings.darkMode ? 'dark' : 'light')
  }, [audioSettings.darkMode])

  // Refresh the saved-run preview whenever the user lands on the menu, so the
  // Resume pill reflects the latest persisted state (e.g. cleared on run end,
  // refreshed after starting a new run).
  useEffect(() => {
    if (screen === 'menu') {
      setSavedRunPreview(loadSavedAdventureRun())
    }
  }, [screen])

  // Auto-open the Adventure intro the first time the user lands on the lobby.
  // Returning visitors (or those who already dismissed) won't see it.
  useEffect(() => {
    if (screen !== 'adventurelobby') return
    if (storage.get('chatsKitchen_adventureIntroSeen') !== 'true') setAdventureIntroOpen(true)
  }, [screen])

  const closeAdventureIntro = useCallback(() => {
    setAdventureIntroOpen(false)
    storage.set('chatsKitchen_adventureIntroSeen', 'true')
  }, [])

  const handleAudioChange = useCallback((settings: AudioSettings) => {
    setAudioSettings(settings)
    storage.setJSON('chatsKitchen_audioSettings', settings)
  }, [])

  const handleTwitchChannelChange = useCallback((ch: string | null) => {
    setTwitchChannel(ch)
    if (ch) storage.set('chatsKitchen_twitchChannel', ch)
    else storage.remove('chatsKitchen_twitchChannel')
  }, [])

  const handleResetAll = useCallback(() => {
    setGameOptions(DEFAULT_GAME_OPTIONS)
    setAudioSettings(DEFAULT_AUDIO_SETTINGS)
    resetAdventureBestRun()
    resetSession()
    handleTwitchChannelChange(null)
    resetTutorial()
    setAdventureIntroOpen(false)
    clearSavedAdventureRun()
    setSavedRunPreview(null)

    storage.setJSON('chatsKitchen_audioSettings', DEFAULT_AUDIO_SETTINGS)
    for (const key of [
      'chatsKitchen_adventureBestRun', 'chatsKitchen_gameOptions', 'chatsKitchen_hideTutorialPrompt',
      'chatsKitchen_adventureIntroSeen', 'chatsKitchen_savedAdventureRun', 'chatsKitchen_preparedItemsShowNames',
      'chatsKitchen_diningRoomSimpleTickets', 'chatsKitchen_kitchenShowCommands',
    ]) storage.remove(key)
  }, [handleTwitchChannelChange, resetTutorial, resetAdventureBestRun, resetSession, clearSavedAdventureRun])

  useEffect(() => {
    if (chatMode !== 'room') return
    const interval = setInterval(() => {
      const currentScreen = screenRef.current
      if (currentScreen === 'pvplobby') {
        // Always re-send (team assignments change without GameState changing).
        roomRef.current.sendSnapshot(
          pvpLobbySnapshot(),
          pvpLobbyPerPlayer(roomPlayersRef.current, pvpLobbyRef.current?.red ?? [], pvpLobbyRef.current?.blue ?? []),
        )
        return
      }
      if (currentScreen === 'adventurerecipepick' || currentScreen === 'adventurepantryshop') {
        // Always re-send: tallies and the timer change without GameState changing.
        const vote = adventureVoteSnapshotRef.current
        if (vote) roomRef.current.sendSnapshot(adventureVoteSnapshot(vote))
        return
      }
      const phase: 'lobby' | 'playing' | 'gameover' =
        currentScreen === 'playing' ? 'playing'
        : (currentScreen === 'shiftend' || currentScreen === 'gameover') ? 'gameover'
        : 'lobby'
      const s = stateRef.current
      if (s === lastSnapshotStateRef.current && phase === lastSnapshotPhaseRef.current) return
      lastSnapshotStateRef.current = s
      lastSnapshotPhaseRef.current = phase
      roomRef.current.sendSnapshot(gameStateToSnapshot(s, phase))
    }, 300)
    return () => clearInterval(interval)
  }, [chatMode, pvpLobbyRef])

  useEffect(() => {
    if (chatMode !== 'room') setRoomPlayers([])
  }, [chatMode])

  // In Local Play, connected phones are mirrored into the Adventure roster — but
  // Twitch is co-play, so viewers who joined via !join must NOT be clobbered by
  // the phone mirror. mergeAdventureRoster keeps Twitch members + connected phones
  // and drops disconnected phones. The local host ("You") is an uncounted admin and
  // is never part of the roster (they play via the in-game chatbox).
  useEffect(() => {
    if (chatMode !== 'room') return
    if (adventureLobby == null) return // adventure not active
    const next = mergeAdventureRoster(adventureLobby, roomPlayers)
    const sameLength = adventureLobby.length === next.length
    const same = sameLength && adventureLobby.every((u, i) => u === next[i])
    if (!same) setAdventureLobby(next)
  }, [chatMode, roomPlayers, adventureLobby, setAdventureLobby])

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
        onPlay={goToHub}
        onTutorial={startTutorial}
        onOptions={() => setScreen('options')}
        onFeedback={() => setShowFeedback(true)}
        onCredits={() => setScreen('credits')}
        twitchChannel={twitchChannel}
        twitchStatus={twitchChat.status}
        twitchError={twitchChat.error}
        onTwitchConnect={(ch) => setTwitchChannel(ch)}
        onTwitchDisconnect={() => setTwitchChannel(null)}
        roomCode={room.code}
        roomPlayers={roomPlayers}
      />
    )
  } else if (screen === 'modehub') {
    const connectionLabel = twitchChannel ? `Twitch · ${twitchChannel}` : 'Local Play'
    content = (
      <ModeHub
        connectionLabel={connectionLabel}
        roomCode={room.code}
        roomPlayerCount={roomPlayers.filter(p => !p.disconnected).length}
        onShowRoom={() => { roomRef.current.unlockJoins(); setRoomQrOpen(true) }}
        onFreePlay={hubFreePlay}
        onAdventure={hubAdventure}
        onPvp={hubPvp}
        savedRunPreview={savedRunPreview ? { shift: savedRunPreview.run.currentShift, totalShifts: ADVENTURE_TOTAL_SHIFTS } : null}
        onResumeSavedRun={handleResumeSavedRun}
        onBack={() => setScreen('menu')}
      />
    )
  } else if (screen === 'pvplobby') {
    const pool = chatMode === 'room'
      ? unassignedPool(roomPlayers, pvpLobby?.red ?? [], pvpLobby?.blue ?? [])
      : []
    content = (
      <PvPLobby
        red={pvpLobby?.red ?? []}
        blue={pvpLobby?.blue ?? []}
        unassigned={pool}
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
        onBack={() => { setPvpLobby(null); setScreen('modehub') }}
        onNext={startPvpGame}
      />
    )
  } else if (screen === 'adventurelobby') {
    content = (
      <AdventureLobby
        roster={adventureLobby ?? []}
        onKick={kickAdventurePlayer}
        onClear={() => setAdventureLobby([])}
        onStart={handleAdventureLobbyStart}
        onBack={adventureRun
          ? () => setScreen('adventurebriefing')
          : () => { clearAdventureLobby(); setScreen('modehub') }}
        onShowIntro={() => setAdventureIntroOpen(true)}
        activeShift={adventureRun?.currentShift}
        twitchStatus={twitchChat.status}
        twitchChannel={twitchChannel}
      />
    )
  } else if (screen === 'adventurerecipepick' && adventureRun?.pendingRecipeOffers) {
    content = (
      <AdventureRecipePick
        offers={adventureRun.pendingRecipeOffers}
        currentRecipes={adventureRun.currentRecipes}
        shiftNumber={adventureRun.shiftResults.length === 0 ? 1 : adventureRun.currentShift + 1}
        rosterSize={adventureLobby?.length ?? adventureRun.participantCount}
        allowSkip={adventureRun.shiftResults.length > 0}
        onConfirm={confirmRecipePick}
        onSkip={skipRecipePick}
        voteRef={adventureVoteRef}
        snapshotRef={adventureVoteSnapshotRef}
      />
    )
  } else if (screen === 'adventurebriefing') {
    content = (
      <AdventureBriefing
        run={adventureRun!}
        bestRun={adventureBestRun}
        onStart={() => setScreen('countdown')}
        onMenu={() => { setAdventureRun(null); clearAdventureLobby(); setScreen('menu') }}
        onManageLobby={handleManageLobby}
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
        onCustomise={(playset) => {
          if (playset) {
            handleGameOptionsChange({
              ...gameOptions,
              enabledRecipes: playset.recipes,
              enabledKitchenEvents: playset.events,
              kitchenEventsEnabled: playset.events.length > 0,
            })
          }
          setScreen('freeplaysetup')
        }}
        onBack={() => setScreen('modehub')}
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
        onPlayAgain={() => startFreePlay(true)}
        onNextLevel={undefined}
        onMenu={() => { setPvpLobby(null); setScreen('menu') }}
        onChangePlayset={!adventureRun ? () => setScreen('playsetpicker') : undefined}
        onOpenLobby={chatMode === 'room' && !adventureRun ? () => { roomRef.current.unlockJoins(); setRoomQrOpen(true) } : undefined}
        onPvpLobby={finalStats.redMoney !== undefined ? () => setScreen('pvplobby') : undefined}
        onSetAutoRestart={(enabled) => handleGameOptionsChange({ ...gameOptionsRef.current, autoRestart: enabled })}
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
        onNext={openRecipePick}
        onMenu={() => { setAdventureRun(null); clearAdventureLobby(); setScreen('menu') }}
      />
    )
  } else if (screen === 'adventurepantryshop') {
    content = (
      <AdventurePantryShop
        run={adventureRun!}
        onPurchase={purchaseGarnish}
        onReroll={rerollShopOffers}
        onClose={closeShop}
        voteRef={adventureVoteRef}
        snapshotRef={adventureVoteSnapshotRef}
        rerollPrice={getRerollPrice()}
      />
    )
  } else if (screen === 'adventurerunend') {
    content = (
      <AdventureRunEnd
        run={adventureRun!}
        bestRun={adventureBestRun}
        isNewBestRun={isNewBestAdventureRun}
        onPlayAgain={handleAdventurePlayAgain}
        onMenu={() => { setAdventureRun(null); clearAdventureLobby(); setScreen('menu') }}
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
      {roomQrOpen && (
        <RoomQRModal
          code={room.code}
          players={roomPlayers}
          onClose={() => setRoomQrOpen(false)}
        />
      )}
      {tutorialOpen && (
        <TutorialModal
          onClose={() => setTutorialOpen(false)}
          onStartCooking={handleTutorialStartCooking}
        />
      )}
      {adventureIntroOpen && screen === 'adventurelobby' && (
        <AdventureIntroModal onClose={closeAdventureIntro} />
      )}
    </>
  )
}
