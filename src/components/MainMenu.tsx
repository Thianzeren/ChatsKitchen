import styles from './MainMenu.module.css'

interface Props {
  onPlay: () => void
  onOptions: () => void
  onTwitch: () => void
  onYouTube: () => void
}

export default function MainMenu({ onPlay, onOptions, onTwitch, onYouTube }: Props) {
  return (
    <div className={styles.menu}>
      <h1 className={styles.title}>🍳 Let Chat Cook 🔪</h1>
      <p className={styles.subtitle}>A Livestream Chat Restaurant Game</p>
      <div className={styles.buttons}>
        <button className={`${styles.btn} ${styles.btnPlay}`} onClick={onPlay}>
          Play
        </button>
        <button className={`${styles.btn} ${styles.btnTwitch}`} onClick={onTwitch}>
          Connect to Twitch
        </button>
        <button className={`${styles.btn} ${styles.btnYouTube}`} onClick={onYouTube}>
          Connect to YouTube
        </button>
        <button className={`${styles.btn} ${styles.btnOptions}`} onClick={onOptions}>
          Options
        </button>
      </div>
    </div>
  )
}
