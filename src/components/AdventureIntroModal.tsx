import styles from './AdventureIntroModal.module.css'

interface Props {
  onClose: () => void
}

export default function AdventureIntroModal({ onClose }: Props) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}>Roguelike Run</div>
            <h2 className={styles.title}>Adventure Mode</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close intro">
            {'✕'}
          </button>
        </div>

        <div className={styles.scrollArea}>
          <p className={styles.blurb}>
            An 8-shift run where chat builds up a kitchen across the night. Draft dishes to grow
            your menu, survive each shift's goal, and shop for garnishes between shifts.
            <strong> Miss any goal and the run ends.</strong>
          </p>

          <div className={styles.flow}>
            <div className={styles.step}>
              <div className={styles.stepIcon}>👥</div>
              <div className={styles.stepBody}>
                <strong>Lobby</strong>
                <span>Viewers (and you!) type <code>!join</code> to enlist. Goals + Pantry prices scale with crew size.</span>
              </div>
            </div>
            <div className={styles.step}>
              <div className={styles.stepIcon}>🍱</div>
              <div className={styles.stepBody}>
                <strong>Draft Recipes</strong>
                <span>Chat votes <code>!1</code>–<code>!3</code> to add a dish from across all cuisines. The run opens with one mandatory pick; between every shift you add one more (or <code>!skip</code>). Orders come from your whole menu.</span>
              </div>
            </div>
            <div className={styles.step}>
              <div className={styles.stepIcon}>🌶️</div>
              <div className={styles.stepBody}>
                <strong>Pantry Shop</strong>
                <span>Spend earnings on garnishes — <code>!1</code>–<code>!4</code> to buy, <code>!done</code> to leave. Each garnish can only be bought once.</span>
              </div>
            </div>
            <div className={styles.step}>
              <div className={styles.stepIcon}>👹</div>
              <div className={styles.stepBody}>
                <strong>Boss Shifts</strong>
                <span>Shifts <strong>4</strong> and <strong>8</strong> throw an auto-assigned boss debuff at you, previewed on the briefing. Clear shift 8 to win the run.</span>
              </div>
            </div>
          </div>

          <p className={styles.note}>
            Garnishes are tier-graded (<span className={styles.tierCommon}>common</span> · <span className={styles.tierRare}>rare</span> · <span className={styles.tierLegendary}>legendary</span>) and stay active for the rest of the run. Mods can use <code>!kick @name</code> in the lobby and the host can pause any vote.
          </p>
        </div>

        <div className={styles.footer}>
          <button className={styles.doneBtn} onClick={onClose}>Got it — let's cook!</button>
        </div>
      </div>
    </div>
  )
}
