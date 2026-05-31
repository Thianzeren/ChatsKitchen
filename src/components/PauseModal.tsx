import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AudioSettings } from '../state/types'
import { RECIPES } from '../data/recipes'
import FoodIcon from './FoodIcon'
import styles from './PauseModal.module.css'

interface PauseModalProps {
  enabledRecipes: string[]
  audioSettings: AudioSettings
  onAudioChange: (s: AudioSettings) => void
  chatOpen: boolean
  onChatToggle: () => void
  botsEnabled: boolean
  onBotsToggle: () => void
  onResume: () => void
  onExit: () => void
  onPlaysetPicker?: () => void
}

export default function PauseModal({
  enabledRecipes,
  audioSettings,
  onAudioChange,
  chatOpen,
  onChatToggle,
  botsEnabled,
  onBotsToggle,
  onResume,
  onExit,
  onPlaysetPicker,
}: PauseModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onResume()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onResume])

  return createPortal(
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        <button className={styles.closeBtn} onClick={onResume}>✕</button>
        {/* LEFT COLUMN */}
        <div className={styles.left}>
          <div className={styles.pausedHeader}>⏸ PAUSED</div>

          <button
            className={`${styles.toggle} ${!audioSettings.musicMuted ? styles.toggleOn : styles.toggleOff}`}
            onClick={() => onAudioChange({ ...audioSettings, musicMuted: !audioSettings.musicMuted })}
          >
            🎵 Music &nbsp; {audioSettings.musicMuted ? 'OFF' : 'ON'}
          </button>
          <button
            className={`${styles.toggle} ${!audioSettings.sfxMuted ? styles.toggleOn : styles.toggleOff}`}
            onClick={() => onAudioChange({ ...audioSettings, sfxMuted: !audioSettings.sfxMuted })}
          >
            🔊 SFX &nbsp; {audioSettings.sfxMuted ? 'OFF' : 'ON'}
          </button>
          <button
            className={`${styles.toggle} ${chatOpen ? styles.toggleOn : styles.toggleOff}`}
            onClick={onChatToggle}
          >
            💬 Chat &nbsp; {chatOpen ? 'ON' : 'OFF'}
          </button>
          <button
            className={`${styles.toggle} ${botsEnabled ? styles.toggleOn : styles.toggleOff}`}
            onClick={onBotsToggle}
          >
            🤖 Bots &nbsp; {botsEnabled ? 'ON' : 'OFF'}
          </button>

          <div className={styles.divider} />

          {onPlaysetPicker && (
            <button className={styles.exitBtn} onClick={onPlaysetPicker}>
              Change Playset
            </button>
          )}
          <button className={styles.exitBtn} onClick={onExit}>
            Exit to Menu
          </button>
          <button className={styles.resumeBtn} onClick={onResume}>
            ▶ Resume Game
          </button>
        </div>

        {/* RIGHT COLUMN */}
        <div className={styles.right}>
          <div className={styles.recipeLabel}>Active Recipes</div>
          {enabledRecipes.map(key => {
            const recipe = RECIPES[key]
            if (!recipe) return null
            return (
              <div key={key} className={styles.recipeCard}>
                <div className={styles.recipeName}><FoodIcon icon={recipe.emoji} size={18} /> {recipe.name}</div>
                <div className={styles.recipeSteps}>
                  {recipe.steps.map((step, i) => (
                    <span key={i}>
                      {step.action} {step.target}
                      {i < recipe.steps.length - 1
                        ? (recipe.steps[i + 1].requires ? ' → ' : ' + ')
                        : ''}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}
