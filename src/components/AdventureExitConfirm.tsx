import styles from './AdventureExitConfirm.module.css'

interface Props {
  onConfirm: () => void
  onCancel: () => void
}

export default function AdventureExitConfirm({ onConfirm, onCancel }: Props) {
  return (
    <div className={styles.backdrop} onClick={onCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.title}>Pause Run?</h2>
        <p className={styles.warning}>
          Your run will be <strong>saved automatically</strong>. Pick it up anytime from the
          <strong> Resume Adventure</strong> pill on the Main Menu.
        </p>
        <div className={styles.buttons}>
          <button className={styles.cancelBtn} onClick={onCancel}>Keep Playing</button>
          <button className={styles.confirmBtn} onClick={onConfirm}>Save &amp; Exit</button>
        </div>
      </div>
    </div>
  )
}
