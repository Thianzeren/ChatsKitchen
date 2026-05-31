import styles from './ModeHub.module.css'

interface Props {
  connectionLabel: string            // e.g. "Twitch: mychannel" / "Local Play" / "Solo"
  roomCode: string | null            // non-null only in Local Play
  roomPlayerCount: number            // connected room players
  onShowRoom: () => void             // re-open the room panel (Local Play only)
  onFreePlay: () => void
  onAdventure: () => void
  onPvp: () => void
  savedRunPreview: { shift: number; totalShifts: number } | null
  onResumeSavedRun: () => void
  onChangeConnection: () => void
}

export default function ModeHub({
  connectionLabel, roomCode, roomPlayerCount, onShowRoom,
  onFreePlay, onAdventure, onPvp,
  savedRunPreview, onResumeSavedRun, onChangeConnection,
}: Props) {
  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.changeBtn} onClick={onChangeConnection}>← Change connection</button>
        <div className={styles.connBadge}>{connectionLabel}</div>
      </div>

      {roomCode && (
        <button className={styles.roomWidget} onClick={onShowRoom}>
          <span className={styles.roomCode}>Room {roomCode}</span>
          <span className={styles.roomPlayers}>{roomPlayerCount} player{roomPlayerCount !== 1 ? 's' : ''}</span>
          <span className={styles.roomQr}>Show QR →</span>
        </button>
      )}

      <h1 className={styles.title}>Choose a mode</h1>

      <div className={styles.modes}>
        <button className={styles.modeFreePlay} onClick={onFreePlay}>
          <div className={styles.modeName}>Free Play</div>
          <div className={styles.modeDesc}>Pick recipes, set duration &amp; difficulty</div>
        </button>
        <button className={styles.modeAdventure} onClick={onAdventure}>
          <div className={styles.modeName}>Adventure</div>
          <div className={styles.modeDesc}>Roguelike runs — how many shifts can you survive?</div>
        </button>
        <button className={styles.modePvp} onClick={onPvp}>
          <div className={styles.modeName}>PvP</div>
          <div className={styles.modeDesc}>Two teams compete — most money wins!</div>
        </button>
      </div>

      {savedRunPreview && (
        <button type="button" className={styles.resumeRunPill} onClick={onResumeSavedRun} title="Resume your saved Adventure run">
          <span className={styles.resumeRunIcon}>📂</span>
          <span className={styles.resumeRunBody}>
            <span className={styles.resumeRunLabel}>Resume Adventure</span>
            <span className={styles.resumeRunMeta}>Shift {savedRunPreview.shift} / {savedRunPreview.totalShifts}</span>
          </span>
          <span className={styles.resumeRunArrow}>→</span>
        </button>
      )}
    </div>
  )
}
