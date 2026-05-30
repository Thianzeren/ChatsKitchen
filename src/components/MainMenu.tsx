import { useState } from 'react'
import { TwitchStatus } from '../hooks/useTwitchChat'
import styles from './MainMenu.module.css'

interface Props {
  onPlay: () => void
  onPvp: () => void
  onAdventure: () => void
  onOptions: () => void
  onFeedback: () => void
  onCredits: () => void
  onTutorial: () => void
  onStartTutorial: () => void
  onLocalPlay: () => void
  savedRunPreview: { shift: number; totalShifts: number } | null
  onResumeSavedRun: () => void
  twitchChannel: string | null
  twitchStatus: TwitchStatus
  twitchError: string | undefined
  onTwitchConnect: (channel: string) => void
  onTwitchDisconnect: () => void
}

export default function MainMenu({ onPlay, onPvp, onAdventure, onOptions, onFeedback, onCredits, onTutorial, onStartTutorial, onLocalPlay, savedRunPreview, onResumeSavedRun, twitchChannel, twitchStatus, twitchError, onTwitchConnect, onTwitchDisconnect }: Props) {
  const [twitchInput, setTwitchInput] = useState(twitchChannel || '')
  const isConnected = twitchStatus === 'connected'
  const isConnecting = twitchStatus === 'connecting'
  const isDisconnected = twitchStatus === 'disconnected'

  const handleConnect = () => {
    if (!twitchInput.trim()) return
    onTwitchConnect(twitchInput.trim())
  }

  return (
    <div className={styles.screen}>

      {/* ── BODY ── */}
      <div className={styles.body}>

        {/* ── LEFT PANEL ── */}
        <div className={styles.leftCol}>

          {/* ── BANNER ── */}
          <div className={styles.banner}>
            <div className={styles.bannerTitle}>Let Chat Cook</div>
            <div className={styles.bannerTagline}>⚔&nbsp;&nbsp;Dungeon Kitchen &nbsp;·&nbsp; Twitch Chat Restaurant Game</div>
          </div>

          <div className={styles.steps}>
            <div className={styles.sectionLabel}>How to play</div>

            <div className={styles.step}>
              <div className={styles.stepNum}>1</div>
              <div className={styles.stepContent}>
                <div className={styles.stepTitle}>Connect to your Twitch channel</div>
                <div className={styles.stepDesc}>Your chat becomes the kitchen crew</div>
              </div>
            </div>

            <div className={styles.step}>
              <div className={styles.stepNum}>2</div>
              <div className={styles.stepContent}>
                <div className={styles.stepTitle}>Type commands from the recipe</div>
                <div className={styles.stepDesc}>e.g. chop lettuce · grill patty · serve 1</div>
              </div>
            </div>

            <div className={styles.step}>
              <div className={styles.stepNum}>3</div>
              <div className={styles.stepContent}>
                <div className={styles.stepTitle}>Serve orders before time's up</div>
                <div className={styles.stepDesc}>Earn money, climb the leaderboard</div>
              </div>
            </div>

            <div className={styles.step}>
              <div className={styles.stepNum}>4</div>
              <div className={styles.stepContent}>
                <div className={styles.stepTitle}>Best played in full screen</div>
                <div className={styles.stepDesc}>Press F11 to go full screen</div>
              </div>
            </div>
          </div>

          <div className={styles.divider} />

          <div className={styles.streamerSection}>
            <p className={styles.streamerDesc}>
              Enable <strong>Auto-Restart</strong> in Free Play to loop rounds automatically.
              Mods can control the session live from chat:
            </p>
            <div className={styles.cheatsheet}>
              <span className={styles.csCmd}>!start</span>
              <span className={styles.csDesc}>begin next round</span>
              <span className={styles.csCmd}>!exit</span>
              <span className={styles.csDesc}>end the current round</span>
              <span className={styles.csCmd}>!onAutoRestart</span>
              <span className={styles.csDesc}>enable auto-restart</span>
              <span className={styles.csCmd}>!offAutoRestart</span>
              <span className={styles.csDesc}>disable auto-restart</span>
            </div>
          </div>

          <div className={styles.divider} />

          <div className={styles.leftFooter}>
            created by THIANzeren &nbsp;·&nbsp; work in progress
          </div>

        </div>

        {/* ── RIGHT PANEL ── */}
        <div className={styles.rightCol}>

          {/* Twitch Connect Card */}
          <div className={`${styles.twitchCard} ${isDisconnected ? styles.twitchCardDisconnected : ''}`}>
            <div className={styles.twitchLabel}>TWITCH CONNECT</div>
            <div className={styles.twitchForm}>
              <input
                className={styles.twitchInput}
                value={twitchInput}
                onChange={e => setTwitchInput(e.target.value)}
                placeholder="channel name"
                disabled={isConnecting || isConnected}
                onKeyDown={e => e.key === 'Enter' && handleConnect()}
              />
              {isConnected ? (
                <button className={styles.twitchDisconnectBtn} onClick={onTwitchDisconnect}>
                  Disconnect
                </button>
              ) : (
                <button
                  className={styles.twitchConnectBtn}
                  onClick={handleConnect}
                  disabled={isConnecting || !twitchInput.trim()}
                >
                  {isConnecting ? '...' : 'Connect'}
                </button>
              )}
            </div>
            {isConnected && twitchChannel && (
              <div className={styles.twitchStatus}>
                <span className={styles.twitchDot} />
                Welcome <span className={styles.twitchChannel}>{twitchChannel}</span> and your community!
              </div>
            )}
            {!isConnected && twitchStatus === 'error' && (
              <div className={`${styles.twitchStatus} ${styles.twitchStatusWarning}`}>
                <span className={`${styles.twitchDot} ${styles.twitchDotWarning}`} />
                {twitchError || 'Connection failed'}
              </div>
            )}
            {isDisconnected && (
              <div className={styles.twitchStatusDisconnected}>
                <span className={styles.twitchDotDisconnected} />
                Not connected — enter your channel to play with chat
              </div>
            )}
          </div>

          {/* Game modes */}
          <div className={styles.modes}>

            <div className={styles.modeBottomRow}>
              <button className={styles.modeTutorial} onClick={onStartTutorial}>Tutorial</button>
              <button className={styles.modeHowToPlay} onClick={onTutorial}>How To Play</button>
            </div>

            <div className={styles.modePlayRow}>
              <button className={styles.modeFreePlay} onClick={onPlay}>
                <div>
                  <div className={styles.fpName}>Free Play</div>
                  <div className={styles.fpDesc}>Pick recipes, set duration &amp; difficulty</div>
                </div>
                <div className={styles.fpArrow}>▶</div>
              </button>

              <button className={styles.modeLocalPlay} onClick={onLocalPlay}>
                <div>
                  <div className={styles.lpName}>Local Play</div>
                  <div className={styles.lpDesc}>Phone controllers, no Twitch needed</div>
                </div>
                <div className={styles.lpArrow}>→</div>
              </button>
            </div>

            <div className={styles.modeRow}>
              <button className={styles.modeAdventures} onClick={onAdventure}>
                <div>
                  <div className={styles.lvName}>Adventure</div>
                  <div className={styles.lvDesc}>Roguelike runs — how many shifts can you survive?</div>
                </div>
                <div className={styles.lvArrow}>→</div>
              </button>

              <button className={styles.modePvp} onClick={onPvp}>
                <div>
                  <div className={styles.lvName}>PvP</div>
                  <div className={styles.lvDesc}>Two teams compete — most money wins!</div>
                </div>
                <div className={styles.lvArrow}>⚔️</div>
              </button>
            </div>

            {savedRunPreview && (
              <button
                type="button"
                className={styles.resumeRunPill}
                onClick={onResumeSavedRun}
                title="Resume your saved Adventure run"
              >
                <span className={styles.resumeRunIcon}>📂</span>
                <span className={styles.resumeRunBody}>
                  <span className={styles.resumeRunLabel}>Resume Adventure</span>
                  <span className={styles.resumeRunMeta}>
                    Shift {savedRunPreview.shift} / {savedRunPreview.totalShifts}
                  </span>
                </span>
                <span className={styles.resumeRunArrow}>→</span>
              </button>
            )}

            <div className={styles.modeBottomRow}>
              <button className={styles.modeOptions} onClick={onOptions}>Options</button>
              <button className={styles.modeOptions} onClick={onFeedback}>Feedback</button>
              <button className={styles.modeOptions} onClick={onCredits}>Credits</button>
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}
