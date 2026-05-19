import { useEffect, useState } from 'react'
import { AudioSettings, GameOptions } from '../state/types'
import styles from './OptionsScreen.module.css'

interface Props {
  options: GameOptions
  onChange: (options: GameOptions) => void
  audioSettings: AudioSettings
  onAudioChange: (settings: AudioSettings) => void
  onResetAll: () => void
  onBack: () => void
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      className={`${styles.toggle} ${on ? styles.toggleOn : ''}`}
      onClick={onToggle}
      aria-pressed={on}
    >
      <span className={styles.toggleThumb} />
    </button>
  )
}

export default function OptionsScreen({ options, onChange, audioSettings, onAudioChange, onResetAll, onBack }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [resetComplete, setResetComplete] = useState(false)

  useEffect(() => {
    if (!resetComplete) return
    const timeout = window.setTimeout(() => {
      setResetComplete(false)
      onBack()
    }, 1100)
    return () => window.clearTimeout(timeout)
  }, [resetComplete, onBack])

  const handleConfirmReset = () => {
    onResetAll()
    setConfirmOpen(false)
    setResetComplete(true)
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <h1 className={styles.title}>Options</h1>
      </div>

      <div className={styles.columns}>
        {/* LEFT: Audio */}
        <div className={styles.column}>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>🔊 Audio</span>
            </div>
            <div className={styles.sliderList}>
              <div className={styles.sliderRow}>
                <span className={styles.sliderLabel}>Master</span>
                <input
                  type="range" min={0} max={100}
                  value={Math.round(audioSettings.masterVolume * 100)}
                  onChange={e => onAudioChange({ ...audioSettings, masterVolume: Number(e.target.value) / 100 })}
                  className={styles.slider}
                  style={{ '--pct': `${Math.round(audioSettings.masterVolume * 100)}%` } as React.CSSProperties}
                />
                <span className={styles.sliderValue}>{Math.round(audioSettings.masterVolume * 100)}%</span>
                <div className={styles.toggleSpacer} />
              </div>

              <div className={styles.divider} />

              <div className={styles.sliderRow}>
                <span className={styles.sliderLabel}>Music</span>
                <input
                  type="range" min={0} max={100}
                  value={Math.round(audioSettings.musicVolume * 100)}
                  onChange={e => onAudioChange({ ...audioSettings, musicVolume: Number(e.target.value) / 100 })}
                  className={styles.slider}
                  style={{ '--pct': `${Math.round(audioSettings.musicVolume * 100)}%` } as React.CSSProperties}
                />
                <span className={styles.sliderValue}>{Math.round(audioSettings.musicVolume * 100)}%</span>
                <Toggle on={!audioSettings.musicMuted} onToggle={() => onAudioChange({ ...audioSettings, musicMuted: !audioSettings.musicMuted })} />
              </div>

              <div className={styles.sliderRow}>
                <span className={styles.sliderLabel}>SFX</span>
                <input
                  type="range" min={0} max={100}
                  value={Math.round(audioSettings.sfxVolume * 100)}
                  onChange={e => onAudioChange({ ...audioSettings, sfxVolume: Number(e.target.value) / 100 })}
                  className={styles.slider}
                  style={{ '--pct': `${Math.round(audioSettings.sfxVolume * 100)}%` } as React.CSSProperties}
                />
                <span className={styles.sliderValue}>{Math.round(audioSettings.sfxVolume * 100)}%</span>
                <Toggle on={!audioSettings.sfxMuted} onToggle={() => onAudioChange({ ...audioSettings, sfxMuted: !audioSettings.sfxMuted })} />
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>🎵 Music Tracks</span>
            </div>
            <div className={styles.trackList}>
              {([
                { key: 'menu' as const, label: 'Menu' },
                { key: 'gameplay' as const, label: 'Gameplay' },
                { key: 'gameover' as const, label: 'Game Over' },
              ]).map(({ key, label }) => {
                const enabled = audioSettings.trackEnabled[key]
                return (
                  <div key={key} className={styles.trackRow}>
                    <span className={styles.trackLabel}>{label}</span>
                    <Toggle
                      on={enabled}
                      onToggle={() => onAudioChange({ ...audioSettings, trackEnabled: { ...audioSettings.trackEnabled, [key]: !enabled } })}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: Appearance + Shortform */}
        <div className={styles.column}>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>🎨 Appearance</span>
            </div>
            <div className={styles.trackRow}>
              <span className={styles.trackLabel}>Dark Mode</span>
              <Toggle
                on={audioSettings.darkMode}
                onToggle={() => onAudioChange({ ...audioSettings, darkMode: !audioSettings.darkMode })}
              />
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>⌨️ Shortform Commands</span>
              <Toggle
                on={options.allowShortformCommands}
                onToggle={() => onChange({ ...options, allowShortformCommands: !options.allowShortformCommands })}
              />
            </div>
            <div className={`${styles.shortformGrid} ${!options.allowShortformCommands ? styles.shortformDimmed : ''}`}>
              {([
                ['c', 'chop'], ['g', 'grill'], ['f', 'fry'], ['b', 'boil'],
                ['t', 'toast'], ['r', 'roast'], ['sf', 'stirfry'], ['sm', 'steam'],
                ['si', 'simmer'], ['ck', 'cook'], ['mx', 'mix'], ['gr', 'grind'],
                ['kn', 'knead'], ['cl', 'cool'], ['s', 'serve'],
              ] as [string, string][]).map(([alias, cmd]) => (
                <div key={alias} className={styles.shortformEntry}>
                  <span className={styles.shortformAlias}>!{alias}</span>
                  <span className={styles.shortformArrow}>→</span>
                  <span className={styles.shortformCmd}>{cmd}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.resetSection}>
        <button className={styles.resetBtn} onClick={() => setConfirmOpen(true)}>
          Reset Everything to Default
        </button>
        <div className={styles.resetHint}>
          Clears free play settings, audio, high scores, and tutorial preferences.
        </div>
      </div>

      {confirmOpen && (
        <div className={styles.overlay}>
          <div className={styles.dialog}>
            <div className={styles.dialogTitle}>Reset Everything?</div>
            <div className={styles.dialogText}>
              This will clear your audio preferences, free play settings, high scores, and tutorial flags.
            </div>
            <div className={styles.dialogActions}>
              <button className={styles.dialogCancelBtn} onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button className={styles.dialogConfirmBtn} onClick={handleConfirmReset}>Yes, Reset</button>
            </div>
          </div>
        </div>
      )}

      {resetComplete && (
        <div className={styles.overlay}>
          <div className={`${styles.dialog} ${styles.successDialog}`}>
            <div className={styles.dialogTitle}>Everything Reset</div>
            <div className={styles.dialogText}>Defaults restored. Taking you back to the main menu.</div>
          </div>
        </div>
      )}
    </div>
  )
}
