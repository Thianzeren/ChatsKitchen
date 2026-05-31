import { useState } from 'react'
import { NAME_COLORS, hashStr } from '../data/recipes'
import { TwitchStatus } from '../hooks/useTwitchChat'
import TwitchStatusPill from './TwitchStatusPill'
import styles from './AdventureLobby.module.css'

interface Props {
  roster: string[]
  onKick: (username: string) => void
  onClear: () => void
  onStart: () => void
  onBack: () => void
  onShowIntro: () => void
  /** When set, the lobby is being visited mid-run; affects button labels & nav. */
  activeShift?: number
  twitchStatus: TwitchStatus
  twitchChannel: string | null
}

export default function AdventureLobby({
  roster, onKick, onClear, onStart, onBack, onShowIntro, activeShift,
  twitchStatus, twitchChannel,
}: Props) {
  const [confirmClear, setConfirmClear] = useState(false)
  const playerCount = roster.length
  const canStart = playerCount >= 1
  const isMidRun = activeShift !== undefined

  return (
    <div className={styles.screen}>
      <button type="button" className={styles.backBtn} onClick={onBack}>← Back</button>
      <button
        type="button"
        className={styles.helpBtn}
        onClick={onShowIntro}
        title="How does Adventure mode work?"
        aria-label="How does Adventure mode work?"
      >?</button>

      {/* ── LEFT ── */}
      <div className={styles.leftCol}>
        <h1 className={styles.title}>
          {isMidRun ? 'Manage the Crew' : 'Adventure Lobby'}
        </h1>
        <div className={styles.subtitle}>
          {isMidRun
            ? <>Run paused on <strong>Shift {activeShift}</strong>. Add or remove chefs, then resume.</>
            : 'Your chat becomes the kitchen crew. Bigger crews face bigger goals — but earn more along the way.'}
        </div>

        <div className={styles.howTo}>
          <div className={styles.howToRow}>
            <code className={styles.cmd}>!join</code>
            <span>join the kitchen</span>
          </div>
          <div className={styles.howToRow}>
            <code className={styles.cmd}>!leave</code>
            <span>leave (you can always re-join)</span>
          </div>
          <div className={styles.howToRow}>
            <code className={styles.cmd}>!kick @name</code>
            <span className={styles.modOnly}>mod / broadcaster only</span>
          </div>
          <div className={styles.howToRow}>
            <code className={styles.cmd}>!start</code>
            <span className={styles.modOnly}>mod / broadcaster only</span>
          </div>
        </div>

        <div className={styles.headcount}>
          <span className={styles.headcountValue}>{playerCount}</span>
          <span className={styles.headcountLabel}>{playerCount === 1 ? 'chef ready' : 'chefs ready'}</span>
        </div>

        <div className={styles.buttons}>
          <button
            className={styles.startBtn}
            onClick={onStart}
            disabled={!canStart}
          >
            {isMidRun ? `RESUME · SHIFT ${activeShift} →` : 'START RUN →'}
          </button>
          <TwitchStatusPill status={twitchStatus} channel={twitchChannel} />
        </div>
      </div>

      {/* ── RIGHT ── */}
      <div className={styles.rightCol}>
        <div className={styles.rosterPanel}>
          <div className={styles.rosterHeader}>
            <div className={styles.rosterTitle}>The Crew</div>
            {roster.length > 0 && (
              <button
                className={styles.clearBtn}
                onClick={() => setConfirmClear(true)}
                title="Remove every chef from the lobby"
              >Clear</button>
            )}
          </div>

          {roster.length === 0 ? (
            <div className={styles.empty}>
              No chefs yet — waiting for <code>!join</code>…
            </div>
          ) : (
            <div className={styles.rosterGrid}>
              {roster.map(username => {
                const color = NAME_COLORS[Math.abs(hashStr(username)) % NAME_COLORS.length]
                return (
                  <div key={username} className={styles.crewCard}>
                    <span className={styles.crewName} style={{ color }}>{username}</span>
                    <button
                      className={styles.kickBtn}
                      onClick={() => onKick(username)}
                      title={`Remove ${username} from the lobby`}
                    >✕</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {confirmClear && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmClear(false)}>
          <div className={styles.confirmCard} onClick={e => e.stopPropagation()}>
            <div className={styles.confirmTitle}>Clear the lobby?</div>
            <div className={styles.confirmBody}>This removes every chef. They can re-join with <code>!join</code>.</div>
            <div className={styles.confirmButtons}>
              <button
                className={styles.confirmCancel}
                onClick={() => setConfirmClear(false)}
              >Cancel</button>
              <button
                className={styles.confirmConfirm}
                onClick={() => { onClear(); setConfirmClear(false) }}
              >Clear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
