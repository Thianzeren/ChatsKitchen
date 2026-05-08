import { Fragment, useState } from 'react'
import { AdventureRun, AdventureBestRun } from '../state/types'
import { RECIPES } from '../data/recipes'
import FoodIcon from './FoodIcon'
import { ADVENTURE_SHIFT_DURATION } from '../data/adventureMode'
import AdventureExitConfirm from './AdventureExitConfirm'
import { TwitchStatus } from '../hooks/useTwitchChat'
import TwitchStatusPill from './TwitchStatusPill'
import styles from './AdventureBriefing.module.css'

const SHIFT_MINUTES = Math.round(ADVENTURE_SHIFT_DURATION / 60_000)

interface Props {
  run: AdventureRun
  bestRun: AdventureBestRun | null
  onStart: () => void
  onMenu: () => void
  twitchStatus: TwitchStatus
  twitchChannel: string | null
}

export default function AdventureBriefing({ run, bestRun, onStart, onMenu, twitchStatus, twitchChannel }: Props) {
  const [confirmExit, setConfirmExit] = useState(false)

  const lastResult = run.shiftResults.length > 0
    ? run.shiftResults[run.shiftResults.length - 1]
    : null
  const isFirstShift = run.currentShift === 1

  return (
    <div className={styles.screen}>
      {/* ── LEFT ── */}
      <div className={styles.leftCol}>
        <h1 className={styles.shiftTitle}>Shift {run.currentShift}</h1>
        <div className={styles.goalLine}>Goal: ${run.currentGoal}</div>

        {isFirstShift && (
          <p className={styles.description}>
            Cook 3 random dishes each shift and hit the money goal to survive.
            Miss it, and the run ends. How far can you go?
          </p>
        )}

        {lastResult && (
          <div className={styles.prevResult}>
            Previous: ${lastResult.moneyEarned} / ${lastResult.goalMoney}
            {' · '}
            <span style={{ color: '#42a05e' }}>PASSED</span>
          </div>
        )}

        {bestRun && (
          <div className={styles.bestChip}>
            Best run: Shift {bestRun.furthestShift} · ${bestRun.totalMoney}
          </div>
        )}

        <div className={styles.buttons}>
          <button className={styles.startBtn} onClick={onStart}>START</button>
          <button className={styles.menuBtn} onClick={() => setConfirmExit(true)}>Main Menu</button>
          <TwitchStatusPill status={twitchStatus} channel={twitchChannel} />
        </div>
      </div>

      {/* ── RIGHT ── */}
      <div className={styles.rightCol}>
        <div className={styles.menuPanel}>
          <div className={styles.panelTitle}>This Shift's Menu</div>
          {run.currentRecipes.map((key, i) => {
            const recipe = RECIPES[key]
            if (!recipe) return null
            return (
              <div key={key} className={`${styles.recipeCard} ${i > 0 ? styles.recipeCardBorder : ''}`}>
                <div className={styles.recipeHeader}>
                  <FoodIcon icon={recipe.emoji} size={24} className={styles.recipeEmoji} />
                  <span className={styles.recipeName}>{recipe.name}</span>
                  <span className={styles.recipeReward}>${recipe.reward}</span>
                </div>
                <div className={styles.recipeSteps}>
                  {recipe.steps.map((step, si) => (
                    <Fragment key={si}>
                      {si > 0 && (
                        <span className={step.requires ? styles.stepArrow : styles.stepSeparator}>
                          {step.requires ? '→' : '·'}
                        </span>
                      )}
                      <code className={styles.stepCmd}>!{step.action} {step.target}</code>
                    </Fragment>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className={styles.paramsPanel}>
          <div className={styles.panelTitle}>Parameters</div>
          <div className={styles.paramRow}>
            <span className={styles.paramLabel}>Duration</span>
            <span className={styles.paramValue}>{SHIFT_MINUTES} min</span>
          </div>
          <div className={styles.paramRow}>
            <span className={styles.paramLabel}>Cooking Speed</span>
            <span className={styles.paramValue}>1×</span>
          </div>
          <div className={styles.paramRow}>
            <span className={styles.paramLabel}>Order Speed</span>
            <span className={styles.paramValue}>1×</span>
          </div>
          <div className={styles.paramRow}>
            <span className={styles.paramLabel}>Order Spawn Rate</span>
            <span className={styles.paramValue}>1×</span>
          </div>
        </div>
      </div>

      {confirmExit && (
        <AdventureExitConfirm
          onConfirm={onMenu}
          onCancel={() => setConfirmExit(false)}
        />
      )}
    </div>
  )
}
