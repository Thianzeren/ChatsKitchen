import { RECIPES } from '../data/recipes'
import { orderStepsForDisplay } from '../data/recipeSteps'
import FoodIcon from './FoodIcon'
import styles from './TutorialModal.module.css'

interface Props {
  onClose: () => void
  onStartCooking: () => void
}

export default function TutorialModal({ onClose, onStartCooking }: Props) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}>Quick Guide</div>
            <h2 className={styles.title}>How To Play</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close tutorial">
            {'\u2715'}
          </button>
        </div>

        <div className={styles.scrollArea}>
          <div className={styles.content}>
            <section className={`${styles.section} ${styles.quickPlaySection}`}>
              <h3>Quick Play</h3>
              <p className={styles.quickPlaySubtitle}>
                Work with your chat to cook dishes and serve orders before time runs out.
              </p>
              <div className={styles.quickPlaySteps}>
                <div className={styles.quickStep}>
                  <div className={styles.quickStepNum}>1</div>
                  <div className={styles.quickStepBody}>
                    <strong>Read the order</strong>
                    <span>Check the order number and required ingredients on the left.</span>
                  </div>
                </div>
                <div className={styles.quickStepArrow}>▶</div>
                <div className={styles.quickStep}>
                  <div className={styles.quickStepNum}>2</div>
                  <div className={styles.quickStepBody}>
                    <strong>Cook in chat</strong>
                    <span>Type <code>chop lettuce</code>, <code>grill patty</code>, etc. One station per player — done ingredients land in the tray.</span>
                  </div>
                </div>
                <div className={styles.quickStepArrow}>▶</div>
                <div className={styles.quickStep}>
                  <div className={styles.quickStepNum}>3</div>
                  <div className={styles.quickStepBody}>
                    <strong>Serve the order</strong>
                    <span>When ingredients are ready, type <code>serve [#]</code> to complete it and earn money.</span>
                  </div>
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <h3>Round Details</h3>
              <ul className={styles.list}>
                <li>Each order has a <strong>patience bar</strong> that depletes in real time — when it empties, the order expires and counts as a loss.</li>
                <li>Serve quickly to earn a <strong>time bonus of up to +$30</strong> — the more patience remaining, the bigger the bonus.</li>
              </ul>
            </section>

            <section className={styles.section}>
              <h3>Commands</h3>
              <div className={styles.commandGrid}>
                <span><code>chop [ingredient]</code><span className={styles.cmdStation}>Chopping Board</span><span className={styles.cmdAlias}>c</span></span>
                <span><code>grill [ingredient]</code><span className={styles.cmdStation}>Grill</span><span className={styles.cmdAlias}>g</span></span>
                <span><code>fry [ingredient]</code><span className={styles.cmdStation}>Fryer</span><span className={styles.cmdAlias}>f</span></span>
                <span><code>boil [ingredient]</code><span className={styles.cmdStation}>Stove</span><span className={styles.cmdAlias}>b</span></span>
                <span><code>stirfry [ingredient]</code><span className={styles.cmdStation}>Wok</span><span className={styles.cmdAlias}>sf</span></span>
                <span><code>steam [ingredient]</code><span className={styles.cmdStation}>Steamer</span><span className={styles.cmdAlias}>sm</span></span>
                <span><code>simmer [ingredient]</code><span className={styles.cmdStation}>Stone Pot</span><span className={styles.cmdAlias}>si</span></span>
                <span><code>cook [ingredient]</code><span className={styles.cmdStation}>Rice Pot</span><span className={styles.cmdAlias}>ck</span></span>
                <span><code>toast [ingredient]</code><span className={styles.cmdStation}>Oven</span><span className={styles.cmdAlias}>t</span></span>
                <span><code>roast [ingredient]</code><span className={styles.cmdStation}>Oven</span><span className={styles.cmdAlias}>r</span></span>
                <span><code>mix [ingredient]</code><span className={styles.cmdStation}>Mixing Bowl</span><span className={styles.cmdAlias}>mx</span></span>
                <span><code>grind [ingredient]</code><span className={styles.cmdStation}>Grinder</span><span className={styles.cmdAlias}>gr</span></span>
                <span><code>knead [ingredient]</code><span className={styles.cmdStation}>Knead Board</span><span className={styles.cmdAlias}>kn</span></span>
                <span><code>cool [station]</code><span className={styles.cmdStation}>any station</span><span className={styles.cmdAlias}>cl</span></span>
                <span><code>serve [order#]</code><span className={styles.cmdStation}></span><span className={styles.cmdAlias}>s</span></span>
                <span><code>extinguish [station]</code><span className={styles.cmdStation}>any station</span></span>
              </div>
              <p className={styles.note}>Each player can only work one station at a time. The <code>!</code> prefix is optional — commands work with or without it. Shortforms only work when <strong>Shortform Commands</strong> is enabled in Options.</p>
            </section>

            <section className={styles.section}>
              <h3>Recipes</h3>
              <div className={styles.recipeCardGrid}>
                {Object.values(RECIPES).map(recipe => (
                  <div key={recipe.name} className={styles.recipeCard}>
                    <div className={styles.recipeCardHeader}>
                      <span className={styles.recipeCardName}><FoodIcon icon={recipe.emoji} size={18} /> {recipe.name}</span>
                      <span className={styles.recipeCardReward}>${recipe.reward}</span>
                    </div>
                    <div className={styles.recipeCardSteps}>
                      {orderStepsForDisplay(recipe.steps).map((step, i, ordered) => (
                        <span key={i} className={styles.recipeStep}>
                          <code>{step.action} {step.target}</code>
                          {i < ordered.length - 1 && <span className={styles.recipeArrow}>{ordered[i + 1].requires ? '→' : '+'}</span>}
                        </span>
                      ))}
                    </div>
                    <div className={styles.recipeCardServe}>then <code>serve [#]</code></div>
                  </div>
                ))}
              </div>
              <p className={styles.note}><code>+</code> steps can be done in any order. <code>→</code> steps need the prior ingredient in the tray first (e.g. chop potato before frying it).</p>
              <p className={styles.note} style={{ marginTop: 6 }}>Which recipes are in play depends on the <strong>Recipe Set</strong> selected in settings.</p>
            </section>

            <section className={styles.section}>
              <h3>Kitchen Events</h3>
              <p>
                When Kitchen Events are enabled, random events fire mid-round. A card appears on screen with a command or phrase — the whole chat must type it together to respond before the timer runs out.
              </p>
              <ul className={styles.list}>
                <li><strong>Opportunities</strong> (e.g. Chef's Chant, Mystery Recipe) — resolve them for a bonus like faster cooking or free ingredients.</li>
                <li><strong>Hazards</strong> (e.g. Angry Chef, Smoke Blast) — respond to reduce the penalty; ignore them and you'll suffer the full effect.</li>
                <li>Events need a minimum number of participants to resolve — coordinate your chat to hit the threshold in time.</li>
              </ul>
            </section>

            <section className={styles.section}>
              <h3>Tips</h3>
              <ul className={styles.list}>
                <li><strong>Heat hazard:</strong> stations heat up gradually while cooking. Type <code>cool [station]</code> (e.g. <code>cool grill</code>) to reduce heat before it maxes out. At 100% the station overheats — <code>extinguish [station]</code> requires 50% of active players to vote and restore it.</li>
                <li>Multiple players can cook different stations simultaneously — coordinate to prepare all ingredients in parallel.</li>
                <li>Connect to Twitch before playing if you want your community to join in.</li>
                <li>Open the in-game <strong>Commands &amp; Recipes</strong> panel anytime for a quick reference.</li>
              </ul>
            </section>

            <section className={styles.section}>
              <h3>Streamer Controls</h3>
              <p className={styles.note}>
                In <strong>Free Play</strong>, enable <strong>Auto-Restart</strong> under More Options to automatically loop rounds — set the countdown delay (10–300 s) and the game over screen will start a new round on its own.
              </p>
              <p className={styles.note} style={{ marginTop: 8 }}>
                Moderators and the broadcaster can also control the session from chat at any time:
              </p>
              <div className={styles.commandGrid}>
                <span><code>!start</code></span>
                <span><code>!exit</code></span>
                <span><code>!onAutoRestart</code></span>
                <span><code>!offAutoRestart</code></span>
              </div>
              <p className={styles.note}>
                <code>!start</code> skips the countdown and begins the next round immediately. <code>!exit</code> ends the current round and goes to the results screen. The <code>!onAutoRestart</code> / <code>!offAutoRestart</code> commands work both mid-game and on the game over screen.
              </p>
            </section>
          </div>

          <div className={styles.footer}>
            <button className={styles.doneBtn} onClick={onStartCooking}>Start Cooking!</button>
          </div>
        </div>
      </div>
    </div>
  )
}
