import { Fragment, useState } from 'react'
import { AdventureRun, AdventureBestRun } from '../state/types'
import { RECIPES, STATION_DEFS } from '../data/recipes'
import FoodIcon from './FoodIcon'
import { ADVENTURE_SHIFT_DURATION, isBossShift, ADVENTURE_TOTAL_SHIFTS } from '../data/adventureMode'
import { GARNISHES, applyAllGarnishes } from '../data/adventureGarnishes'
import { BOSSES, BossId } from '../data/adventureBosses'
import AdventureExitConfirm from './AdventureExitConfirm'
import AdventureProgressDots from './AdventureProgressDots'
import { TwitchStatus } from '../hooks/useTwitchChat'
import TwitchStatusPill from './TwitchStatusPill'
import styles from './AdventureBriefing.module.css'

interface Props {
  run: AdventureRun
  bestRun: AdventureBestRun | null
  onStart: () => void
  onMenu: () => void
  onManageLobby: () => void
  twitchStatus: TwitchStatus
  twitchChannel: string | null
}

function formatMultiplier(value: number): string {
  return `${value.toFixed(2).replace(/\.?0+$/, '')}×`
}

export default function AdventureBriefing({ run, bestRun, onStart, onMenu, onManageLobby, twitchStatus, twitchChannel }: Props) {
  const [confirmExit, setConfirmExit] = useState(false)

  const lastResult = run.shiftResults.length > 0
    ? run.shiftResults[run.shiftResults.length - 1]
    : null
  const isFirstShift = run.currentShift === 1
  const isBoss = isBossShift(run.currentShift)
  const chosenBoss = run.chosenPath?.bossDebuffId
    ? BOSSES[run.chosenPath.bossDebuffId as BossId]
    : null
  const bossDisabledStation = run.chosenPath?.bossPayload?.disabledStationId
    ? STATION_DEFS[run.chosenPath.bossPayload.disabledStationId]?.name
    : null

  // Effective options for this shift (with all owned garnishes applied).
  const effective = applyAllGarnishes(run.ownedGarnishes, {
    cookingSpeed: 1,
    orderSpeed: 1,
    orderSpawnRate: 1,
  })
  const shiftDurationMs = ADVENTURE_SHIFT_DURATION
  const shiftMins = Math.floor(shiftDurationMs / 60_000)
  const shiftSecs = Math.round((shiftDurationMs % 60_000) / 1000)
  const shiftDurationLabel = shiftSecs === 0
    ? `${shiftMins} min`
    : `${shiftMins}:${String(shiftSecs).padStart(2, '0')}`
  const cookingSpeed = effective.options.cookingSpeed ?? 1
  const orderSpeed = effective.options.orderSpeed ?? 1
  const orderSpawnRate = effective.options.orderSpawnRate ?? 1

  // Garnish chips: list owned garnishes.
  const ownedGarnishes = run.ownedGarnishes
    .map(p => GARNISHES[p.garnishId])
    .filter((g): g is NonNullable<typeof g> => Boolean(g))

  return (
    <div className={styles.screen}>
      {/* ── LEFT ── */}
      <div className={styles.leftCol}>
        <h1 className={styles.shiftTitle}>
          Shift {run.currentShift}
          <span className={styles.shiftTotal}> / {ADVENTURE_TOTAL_SHIFTS}</span>
        </h1>

        <AdventureProgressDots currentShift={run.currentShift} />

        {isBoss && !chosenBoss && <div className={styles.bossTag}>BOSS SHIFT</div>}
        <div className={styles.goalLine}>Goal: ${run.currentGoal}</div>

        {chosenBoss && (
          <div className={styles.bossPanel}>
            <div className={styles.bossPanelHeader}>⚠ BOSS SHIFT</div>
            <div className={styles.bossPanelBody}>
              <span className={styles.bossPanelIcon}>{chosenBoss.icon}</span>
              <div className={styles.bossPanelText}>
                <div className={styles.bossPanelName}>{chosenBoss.name}</div>
                <div className={styles.bossPanelDesc}>{chosenBoss.description}</div>
                {bossDisabledStation && (
                  <div className={styles.bossPanelExtra}>📋 Closed: <strong>{bossDisabledStation}</strong></div>
                )}
              </div>
            </div>
          </div>
        )}

        {isFirstShift ? (
          <p className={styles.description}>
            8 shifts. Earn enough to hit each goal — keep your earnings to buy
            garnishes between shifts. Miss a goal and the run ends.
          </p>
        ) : (
          <div className={styles.cashBadge}>Run bank: <span>${run.currentRunMoney}</span></div>
        )}

        {lastResult && (
          <div className={styles.prevResult}>
            Previous: ${lastResult.moneyEarned} / ${lastResult.goalMoney}
            {' · '}
            <span style={{ color: '#42a05e' }}>PASSED</span>
          </div>
        )}

        {bestRun && bestRun.furthestShift > 0 && (
          <div className={styles.bestChip}>
            Best run: Shift {bestRun.furthestShift} · ${bestRun.totalMoney}
            {bestRun.wonRuns > 0 ? ` · ${bestRun.wonRuns} won` : ''}
          </div>
        )}

        <div className={styles.buttons}>
          <button className={styles.startBtn} onClick={onStart}>START</button>
          <button className={styles.lobbyBtn} onClick={onManageLobby}>👥 Manage Lobby</button>
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

        {ownedGarnishes.length > 0 && (
          <div className={styles.garnishesPanel}>
            <div className={styles.panelTitle}>Active Garnishes</div>
            <div className={styles.garnishChips}>
              {ownedGarnishes.map(garnish => (
                <span
                  key={garnish.id}
                  className={`${styles.garnishChip} ${styles[`tier_${garnish.tier}`]}`}
                  title={garnish.description}
                >
                  <span className={styles.garnishChipIcon}>{garnish.icon}</span>
                  {garnish.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className={styles.paramsPanel}>
          <div className={styles.panelTitle}>Parameters</div>
          <div className={styles.paramRow}>
            <span className={styles.paramLabel}>Duration</span>
            <span className={styles.paramValue}>{shiftDurationLabel}</span>
          </div>
          <div className={styles.paramRow}>
            <span className={styles.paramLabel}>Cooking Speed</span>
            <span className={styles.paramValue}>{formatMultiplier(cookingSpeed)}</span>
          </div>
          <div className={styles.paramRow}>
            <span className={styles.paramLabel}>Order Patience</span>
            <span className={styles.paramValue}>{formatMultiplier(1 / orderSpeed)}</span>
          </div>
          <div className={styles.paramRow}>
            <span className={styles.paramLabel}>Order Spawn Rate</span>
            <span className={styles.paramValue}>{formatMultiplier(orderSpawnRate)}</span>
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
