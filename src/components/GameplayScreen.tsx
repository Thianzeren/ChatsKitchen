import { AudioSettings, GameState, KitchenEvent } from '../state/types'
import { TwitchStatus } from '../hooks/useTwitchChat'
import { TUTORIAL_EVENT_INTRO_STEP, TUTORIAL_EVENT_STEP } from '../data/tutorialData'
import OrdersBar from './DiningRoom'
import Kitchen from './Kitchen'
import ChatPanel from './ChatPanel'
import BottomBar from './BottomBar'
import SmokeOverlay from './SmokeOverlay'
import EventCardOverlay from './EventCardOverlay'
import PauseModal from './PauseModal'
import TutorialOverlay from './TutorialOverlay'
import styles from './GameplayScreen.module.css'

interface Props {
  state: GameState
  paused: boolean
  chatOpen: boolean
  botsEnabled: boolean
  audioSettings: AudioSettings
  activeEvent: KitchenEvent | null
  tutorialEvent: KitchenEvent | null
  tutorialStep: number | null
  tutorialHighlight: string | null
  tutorialEventResolved: boolean
  isTutorial: boolean
  twitchStatus: TwitchStatus
  twitchChannel: string | null
  onChatSend: (text: string) => void
  onChatOpen: (open: boolean) => void
  onPause: (paused: boolean) => void
  onAudioChange: (s: AudioSettings) => void
  onExit: () => void
  onPlaysetPicker: (() => void) | undefined
  onOpenLobby: (() => void) | undefined
  onTutorialNext: () => void
  onTutorialBack: () => void
  onTutorialSkip: () => void
  onTutorialRepeat: () => void
  onBotsToggle: () => void
}

export default function GameplayScreen({
  state,
  paused,
  chatOpen,
  botsEnabled,
  audioSettings,
  activeEvent,
  tutorialEvent,
  tutorialStep,
  tutorialHighlight,
  tutorialEventResolved,
  isTutorial,
  twitchStatus,
  twitchChannel,
  onChatSend,
  onChatOpen,
  onPause,
  onAudioChange,
  onExit,
  onPlaysetPicker,
  onOpenLobby,
  onTutorialNext,
  onTutorialBack,
  onTutorialSkip,
  onTutorialRepeat,
  onBotsToggle,
}: Props) {
  const displayEvent = tutorialEvent ?? activeEvent

  return (
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
            onSend={onChatSend}
            onClose={() => onChatOpen(false)}
            teams={state.teams}
          />
        )}
      </div>
      <BottomBar
        money={state.money}
        served={state.served}
        lost={state.lost}
        twitchStatus={twitchStatus}
        twitchChannel={twitchChannel}
      />
      <div className={`${styles.settingsWrapper} ${chatOpen ? styles.settingsWrapperChatOpen : ''}`}>
        <button className={styles.settingsBtn} onClick={() => onPause(true)}>⚙️</button>
      </div>
      {activeEvent?.type === 'smoke_blast' && !activeEvent.resolved && !activeEvent.failed && (
        <SmokeOverlay progress={activeEvent.progress} />
      )}
      <EventCardOverlay activeEvent={displayEvent} />
      {paused && (
        <PauseModal
          enabledRecipes={state.enabledRecipes}
          audioSettings={audioSettings}
          onAudioChange={onAudioChange}
          chatOpen={chatOpen}
          onChatToggle={() => onChatOpen(!chatOpen)}
          botsEnabled={botsEnabled}
          onBotsToggle={onBotsToggle}
          onResume={() => onPause(false)}
          onExit={onExit}
          onPlaysetPicker={onPlaysetPicker}
          onOpenLobby={onOpenLobby}
        />
      )}
      {isTutorial && tutorialStep !== null && (
        <TutorialOverlay
          stepIndex={tutorialStep}
          state={state}
          onNext={onTutorialNext}
          onBack={onTutorialBack}
          onSkip={onTutorialSkip}
          onRepeat={onTutorialRepeat}
          shiftLeft={tutorialStep === TUTORIAL_EVENT_INTRO_STEP || tutorialStep === TUTORIAL_EVENT_STEP}
          advanceReady={tutorialEventResolved}
        />
      )}
    </div>
  )
}

