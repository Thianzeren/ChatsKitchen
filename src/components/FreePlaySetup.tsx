import { useState } from 'react'
import { GameOptions, RoundRecord } from '../state/types'
import { RECIPES, RECIPE_SETS, STATION_DEFS } from '../data/recipes'
import { EVENT_DEFS } from '../data/kitchenEventDefs'
import { TwitchStatus } from '../hooks/useTwitchChat'
import { DEFAULT_GAME_OPTIONS } from '../state/defaultOptions'
import FoodIcon from './FoodIcon'
import TwitchStatusPill from './TwitchStatusPill'
import styles from './FreePlaySetup.module.css'

function fmtIngredient(s: string) {
  return s.replace(/_/g, ' ')
}

const ORPHAN_RECIPE_KEYS = Object.keys(RECIPES).filter(
  k => !new Set(RECIPE_SETS.flatMap(s => s.recipeKeys)).has(k)
)

interface Props {
  options: GameOptions
  onChange: (options: GameOptions) => void
  onStart: () => void
  onBack: () => void
  twitchStatus: TwitchStatus
  twitchChannel: string | null
  roundHistory?: RoundRecord[]
}

const DURATION_MIN = 60000
const DURATION_MAX = 540000  // 9 min = 3× the 3 min default

const SPEED_MIN = 0.25
const SPEED_MAX = 3
const SPEED_STEP = 0.25

const formatSpeed = (v: number) => parseFloat(v.toFixed(2)).toString()
const parseSpeed = (s: string) => { const n = parseFloat(s); return isNaN(n) ? null : n }

interface SliderFieldProps {
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  parse: (s: string) => number | null
  onChange: (v: number) => void
  suffix?: string
}

function SliderField({ value, min, max, step, format, parse, onChange, suffix }: SliderFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (raw: string) => {
    const parsed = parse(raw)
    if (parsed !== null && parsed >= min && parsed <= max) {
      onChange(parsed)
    }
    setDraft(null)
  }

  return (
    <div className={styles.sliderField}>
      <input
        type="range"
        className={styles.slider}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => {
          setDraft(null)
          onChange(Number(e.target.value))
        }}
      />
      <div className={styles.inputWrap}>
        <input
          type="text"
          className={styles.numInput}
          value={draft !== null ? draft : format(value)}
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commit((e.target as HTMLInputElement).value)
          }}
        />
        {suffix && <span className={styles.inputSuffix}>{suffix}</span>}
      </div>
    </div>
  )
}

export default function FreePlaySetup({ options, onChange, onStart, onBack, twitchStatus, twitchChannel }: Props) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [startWarning, setStartWarning] = useState(false)
  // Live hover — clears on mouseLeave, used only for moreSection visibility logic
  const [hoveredRecipe, setHoveredRecipe] = useState<string | null>(null)
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null)
  // Sticky detail — only set on mouseEnter, never cleared on mouseLeave so the
  // user can scroll the detail panel without the content disappearing
  const [detailRecipe, setDetailRecipe] = useState<string | null>(null)
  const [detailEvent, setDetailEvent] = useState<string | null>(null)

  return (
    <div className={styles.screen}>
      <div className={styles.leftCol}>
        <div className={styles.topRow}>
          <button className={styles.backBtn} onClick={onBack}>{'\u{2190}'} Back</button>
          <TwitchStatusPill status={twitchStatus} channel={twitchChannel} />
        </div>
        <h1 className={styles.title}>Customize Your Shift</h1>

        <div className={styles.card}>
          <div className={styles.cardLabel}>⏱ Duration</div>
          <SliderField
            value={options.shiftDuration}
            min={DURATION_MIN}
            max={DURATION_MAX}
            step={DURATION_MIN}
            format={v => String(v / 60000)}
            parse={s => { const n = parseInt(s, 10); return isNaN(n) ? null : n * 60000 }}
            onChange={v => onChange({ ...options, shiftDuration: v })}
            suffix="min"
          />
        </div>

        <div className={styles.moreToggleRow}>
          <button
            className={styles.moreToggle}
            onClick={() => setMoreOpen(o => {
              if (!o) { setDetailRecipe(null); setDetailEvent(null) }
              return !o
            })}
          >
            {moreOpen ? '▲' : '▼'} More Options
          </button>
          {moreOpen && (
            <button
              className={styles.actionBtn}
              onClick={() => onChange({
                ...options,
                cookingSpeed:           DEFAULT_GAME_OPTIONS.cookingSpeed,
                orderSpeed:             DEFAULT_GAME_OPTIONS.orderSpeed,
                orderSpawnRate:         DEFAULT_GAME_OPTIONS.orderSpawnRate,
                shiftDuration:          DEFAULT_GAME_OPTIONS.shiftDuration,
                restrictSlots:          DEFAULT_GAME_OPTIONS.restrictSlots,
                stationCapacity:        { ...DEFAULT_GAME_OPTIONS.stationCapacity },
                autoRestart:            DEFAULT_GAME_OPTIONS.autoRestart,
                autoRestartDelay:       DEFAULT_GAME_OPTIONS.autoRestartDelay,
                kitchenEventDuration:   DEFAULT_GAME_OPTIONS.kitchenEventDuration,
                kitchenEventSpawnMin:   DEFAULT_GAME_OPTIONS.kitchenEventSpawnMin,
                kitchenEventSpawnMax:   DEFAULT_GAME_OPTIONS.kitchenEventSpawnMax,
              })}
            >Defaults</button>
          )}
        </div>

        {moreOpen && !hoveredRecipe && !hoveredEvent && (
          <div className={styles.moreSection}>
            <div className={styles.moreRow}>
              <div className={styles.moreLabel}>⚡ Cooking Speed</div>
              <SliderField
                value={options.cookingSpeed}
                min={SPEED_MIN}
                max={SPEED_MAX}
                step={SPEED_STEP}
                format={formatSpeed}
                parse={parseSpeed}
                onChange={v => onChange({ ...options, cookingSpeed: v })}
                suffix="x"
              />
              <div className={styles.hint}>Higher = faster cooking</div>
            </div>

            <div className={styles.moreRow}>
              <div className={styles.moreLabel}>📋 Order Urgency</div>
              <SliderField
                value={options.orderSpeed}
                min={SPEED_MIN}
                max={SPEED_MAX}
                step={SPEED_STEP}
                format={formatSpeed}
                parse={parseSpeed}
                onChange={v => onChange({ ...options, orderSpeed: v })}
                suffix="x"
              />
              <div className={styles.hint}>Higher = less time to fulfill orders</div>
            </div>

            <div className={styles.moreRow}>
              <div className={styles.moreLabel}>🌊 Order Frequency</div>
              <SliderField
                value={options.orderSpawnRate}
                min={SPEED_MIN}
                max={SPEED_MAX}
                step={SPEED_STEP}
                format={formatSpeed}
                parse={parseSpeed}
                onChange={v => onChange({ ...options, orderSpawnRate: v })}
                suffix="x"
              />
              <div className={styles.hint}>Higher = orders arrive more frequently</div>
            </div>

            <div className={styles.moreRow}>
                <div className={styles.moreLabel}>🍳 Kitchen Events</div>
                <div className={styles.hint}>Event duration (countdown timer length)</div>
                <div className={styles.slotsRow}>
                  <SliderField
                    value={options.kitchenEventDuration}
                    min={5}
                    max={60}
                    step={5}
                    format={v => String(v)}
                    parse={s => { const n = parseInt(s, 10); return isNaN(n) ? null : n }}
                    onChange={v => onChange({ ...options, kitchenEventDuration: v })}
                    suffix="s"
                  />
                </div>
                <div className={styles.hint}>Event frequency (seconds between spawns)</div>
                <div className={styles.slotsRow}>
                  <span className={styles.freqLabel}>MIN</span>
                  <SliderField
                    value={options.kitchenEventSpawnMin}
                    min={5}
                    max={300}
                    step={5}
                    format={v => String(v)}
                    parse={s => { const n = parseInt(s, 10); return isNaN(n) ? null : n }}
                    onChange={v => onChange({ ...options, kitchenEventSpawnMin: v })}
                    suffix="s"
                  />
                </div>
                <div className={styles.slotsRow}>
                  <span className={styles.freqLabel}>MAX</span>
                  <SliderField
                    value={options.kitchenEventSpawnMax}
                    min={5}
                    max={300}
                    step={5}
                    format={v => String(v)}
                    parse={s => { const n = parseInt(s, 10); return isNaN(n) ? null : n }}
                    onChange={v => onChange({ ...options, kitchenEventSpawnMax: v })}
                    suffix="s"
                  />
                </div>
                {options.kitchenEventSpawnMin >= options.kitchenEventSpawnMax && (
                  <div className={styles.hint} style={{ color: '#e07030' }}>
                    ⚠ Min ≥ Max — fixed interval of {options.kitchenEventSpawnMin}s will be used
                  </div>
                )}
              </div>

            <div className={styles.moreRow}>
              <div className={styles.moreLabel}>🔧 Station Slots</div>
              <div className={styles.slotsRow}>
                <span className={styles.slotsLabel}>Restrict Slots</span>
                <button
                  className={`${styles.toggleBtn} ${options.restrictSlots ? styles.toggleBtnOn : ''}`}
                  onClick={() => onChange({ ...options, restrictSlots: !options.restrictSlots })}
                >
                  {options.restrictSlots ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className={`${styles.capacityGrid} ${!options.restrictSlots ? styles.dimmed : ''}`}>
                {([
                  { key: 'chopping' as const, label: '🔪 Chopping' },
                  { key: 'cooking' as const, label: '🍳 Cooking' },
                ]).map(({ key, label }) => (
                  <div key={key} className={styles.capacityRow}>
                    <span className={styles.capacityLabel}>{label}</span>
                    <div className={styles.capacityControl}>
                      <button
                        className={styles.capacityBtn}
                        onClick={() => onChange({
                          ...options,
                          stationCapacity: { ...options.stationCapacity, [key]: Math.max(1, options.stationCapacity[key] - 1) }
                        })}
                      >-</button>
                      <span className={styles.capacityValue}>{options.stationCapacity[key]}</span>
                      <button
                        className={styles.capacityBtn}
                        onClick={() => onChange({
                          ...options,
                          stationCapacity: { ...options.stationCapacity, [key]: Math.min(8, options.stationCapacity[key] + 1) }
                        })}
                      >+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.hint}>
                {options.restrictSlots
                  ? 'Slots per station type (cooking applies to each: grill, fryer, stove, oven)'
                  : 'Slot restrictions are off — stations have unlimited slots'}
              </div>
            </div>

            <div className={styles.moreRow}>
              <div className={styles.moreLabel}>🔄 Auto-Restart</div>
              <div className={styles.slotsRow}>
                <span className={styles.slotsLabel}>Restart after round ends</span>
                <button
                  className={`${styles.toggleBtn} ${options.autoRestart ? styles.toggleBtnOn : ''}`}
                  onClick={() => onChange({ ...options, autoRestart: !options.autoRestart })}
                >
                  {options.autoRestart ? 'ON' : 'OFF'}
                </button>
              </div>
              {options.autoRestart && (
                <SliderField
                  value={options.autoRestartDelay}
                  min={10}
                  max={300}
                  step={10}
                  format={v => String(v)}
                  parse={s => { const n = parseInt(s, 10); return isNaN(n) ? null : n }}
                  onChange={v => onChange({ ...options, autoRestartDelay: v })}
                  suffix="s"
                />
              )}
              <div className={styles.hint}>
                {options.autoRestart
                  ? 'Automatically starts a new round after the countdown on the game over screen'
                  : 'Game over screen will wait for manual input'}
              </div>
            </div>

          </div>
        )}

        {/* ── Shared detail panel — hidden when More Options is open and nothing is pinned/hovered ── */}
        {(!moreOpen || hoveredRecipe || hoveredEvent) && (() => {
          if (detailRecipe) {
            const recipe = RECIPES[detailRecipe]
            if (!recipe) return null
            return (
              <div className={styles.detailPanel}>
                <div className={styles.detailTitle}>
                  <FoodIcon icon={recipe.emoji} size={24} />
                  <span className={styles.recipeDetailName}>{recipe.name}</span>
                  <span className={styles.recipeDetailReward}>${recipe.reward}</span>
                </div>
                <div className={styles.recipeDetailSteps}>
                  {recipe.steps.map((step, i) => {
                    const station = STATION_DEFS[step.station]
                    return (
                      <div key={i} className={styles.recipeDetailStep}>
                        <span className={styles.stepNum}>{i + 1}.</span>
                        {step.requires && (
                          <span className={styles.stepRequires}>needs {fmtIngredient(step.requires)} →</span>
                        )}
                        <span className={styles.stepStation}>{station?.emoji}</span>
                        <code className={styles.stepCmd}>{step.action} {fmtIngredient(step.target)}</code>
                        <span className={styles.stepArrow}>→</span>
                        <span className={styles.stepProduces}>{fmtIngredient(step.produces)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          }

          if (detailEvent) {
            const def = EVENT_DEFS.find(d => d.type === detailEvent)
            if (!def) return null
            const isHazard = def.category === 'hazard-penalty' || def.category === 'hazard-immediate'
            return (
              <div className={styles.detailPanel}>
                <div className={styles.detailTitle}>
                  <span>{def.emoji}</span>
                  <span>{def.label}</span>
                </div>
                <span className={`${styles.detailBadge} ${isHazard ? styles.detailBadgeHazard : styles.detailBadgeOpportunity}`}>
                  {isHazard ? '⚠ Hazard' : '✨ Opportunity'}
                </span>
                <div className={styles.detailDesc}>{def.description}</div>
                {def.failDescription && (
                  <div className={`${styles.detailConsequence} ${styles.detailConsequenceFail}`}>
                    ✗ {def.failDescription}
                  </div>
                )}
                {def.rewardDescription && (
                  <div className={`${styles.detailConsequence} ${styles.detailConsequenceReward}`}>
                    ✓ {def.rewardDescription}
                  </div>
                )}
              </div>
            )
          }

          return (
            <div className={styles.detailPanel}>
              <div className={styles.detailEmpty}>Hover a recipe or event to see details</div>
            </div>
          )
        })()}
      </div>

      <div className={styles.rightCol}>
        <div className={styles.rightColInner}>

          {/* ── Recipes section ── */}
          <div className={styles.recipesSection}>
            <div className={styles.cardLabel} style={{ padding: '16px 16px 0 16px', paddingBottom: 4 }}>🍽️ Recipes</div>

            {/* ── Selected panel ── */}
            <div className={styles.selectedPanel} style={{ margin: '0 16px 9px 16px' }}>
              <div className={styles.selectedHeader}>
                <span className={styles.selectedLabel}>Selected ({options.enabledRecipes.length})</span>
                <div className={styles.selectedActions}>
                  <button
                    className={styles.actionBtn}
                    onClick={() => onChange({ ...options, enabledRecipes: [] })}
                  >Remove All</button>
                  <button
                    className={styles.actionBtn}
                    onClick={() => onChange({ ...options, enabledRecipes: Object.keys(RECIPES) })}
                  >Select All</button>
                  <button
                    className={`${styles.actionBtn} ${styles.actionBtnRandom}`}
                    onClick={() => {
                      const all = Object.keys(RECIPES)
                      const shuffled = [...all].sort(() => Math.random() - 0.5)
                      onChange({ ...options, enabledRecipes: shuffled.slice(0, 3) })
                    }}
                  >Random 3</button>
                  <button
                    className={styles.actionBtn}
                    onClick={() => onChange({ ...options, enabledRecipes: DEFAULT_GAME_OPTIONS.enabledRecipes })}
                  >Defaults</button>
                </div>
              </div>
              <div className={styles.selectedChips}>
                {options.enabledRecipes.length === 0 ? (
                  <span className={styles.selectedEmpty}>No recipes selected</span>
                ) : (
                  options.enabledRecipes.map(key => {
                    const recipe = RECIPES[key]
                    if (!recipe) return null
                    return (
                      <div key={key} className={styles.selectedChip}>
                        <FoodIcon icon={recipe.emoji} size={16} />
                        <span className={styles.selectedChipName}>{recipe.name}</span>
                        <button
                          className={styles.selectedChipRemove}
                          onClick={() => onChange({ ...options, enabledRecipes: options.enabledRecipes.filter(r => r !== key) })}
                        >×</button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className={styles.recipeScroll} style={{ padding: '0 16px 12px 16px' }}>
            {(() => {
              const orphanKeys = ORPHAN_RECIPE_KEYS

              const renderRecipeBtn = (key: string) => {
                const recipe = RECIPES[key]
                if (!recipe) return null
                const isEnabled = options.enabledRecipes.includes(key)
                return (
                  <button
                    key={key}
                    className={`${styles.recipeBtn} ${isEnabled ? styles.active : ''}`}
                    onClick={() => {
                      const next = isEnabled
                        ? options.enabledRecipes.filter(r => r !== key)
                        : [...options.enabledRecipes, key]
                      onChange({ ...options, enabledRecipes: next })
                    }}
                    onMouseEnter={() => { setHoveredRecipe(key); setHoveredEvent(null); setDetailRecipe(key); setDetailEvent(null) }}
                    onMouseLeave={() => setHoveredRecipe(null)}
                  >
                    <FoodIcon icon={recipe.emoji} size={22} className={styles.recipeEmoji} />
                    <span className={styles.recipeName}>{recipe.name}</span>
                    <span className={styles.recipeReward}>${recipe.reward}</span>
                  </button>
                )
              }

              const renderSection = (label: string, flag: string | null, keys: string[]) => {
                const validKeys = keys.filter(k => RECIPES[k])
                if (validKeys.length === 0) return null
                const enabledCount = validKeys.filter(k => options.enabledRecipes.includes(k)).length
                const allOn = enabledCount === validKeys.length
                const toggleAll = () => {
                  if (allOn) {
                    const next = options.enabledRecipes.filter(k => !validKeys.includes(k))
                    onChange({ ...options, enabledRecipes: next })
                  } else {
                    const next = [...new Set([...options.enabledRecipes, ...validKeys])]
                    onChange({ ...options, enabledRecipes: next })
                  }
                }
                return (
                  <div key={label} className={styles.setSection}>
                    <div className={styles.setSectionHeader}>
                      <span className={styles.setSectionLabel}>
                        {flag && <span className={styles.setSectionFlag}>{flag}</span>}
                        {label}
                      </span>
                      <button
                        className={`${styles.setSectionToggle} ${allOn ? styles.setSectionToggleOn : ''}`}
                        onClick={toggleAll}
                      >
                        {allOn ? '✓ All' : `${enabledCount}/${validKeys.length}`}
                      </button>
                    </div>
                    <div className={styles.recipeGrid}>
                      {validKeys.map(renderRecipeBtn)}
                    </div>
                  </div>
                )
              }

              return (
                <>
                  {RECIPE_SETS.map(set => renderSection(set.name, set.flag, set.recipeKeys))}
                  {renderSection('Others', null, orphanKeys)}
                </>
              )
            })()}

            <div className={styles.hint}>Only selected recipes will appear as orders</div>
            </div>
          </div>

          {/* ── Kitchen Events section ── */}
          <div className={styles.eventSection}>
            <div className={styles.eventSectionHeader}>
              <div className={styles.cardLabel} style={{ marginBottom: 0 }}>🍳 Kitchen Events</div>
              <div className={styles.eventSectionActions}>
                <button
                  className={`${styles.toggleBtn} ${options.kitchenEventsEnabled ? styles.toggleBtnOn : ''}`}
                  onClick={() => {
                    const turningOn = !options.kitchenEventsEnabled
                    const nextEvents = turningOn && options.enabledKitchenEvents.length === 0
                      ? EVENT_DEFS.map(d => d.type)
                      : options.enabledKitchenEvents
                    onChange({ ...options, kitchenEventsEnabled: turningOn, enabledKitchenEvents: nextEvents })
                  }}
                >
                  {options.kitchenEventsEnabled ? 'ON' : 'OFF'}
                </button>
                <button
                  className={styles.actionBtn}
                  onClick={() => onChange({
                    ...options,
                    kitchenEventsEnabled:   DEFAULT_GAME_OPTIONS.kitchenEventsEnabled,
                    enabledKitchenEvents:   DEFAULT_GAME_OPTIONS.enabledKitchenEvents,
                  })}
                >Defaults</button>
              </div>
            </div>

            {options.kitchenEventsEnabled && (() => {
              const hazards = EVENT_DEFS.filter(d =>
                d.category === 'hazard-penalty' || d.category === 'hazard-immediate'
              )
              const opportunities = EVENT_DEFS.filter(d => d.category === 'opportunity')

              const renderEventBtn = (def: typeof EVENT_DEFS[number]) => {
                const on = options.enabledKitchenEvents.includes(def.type)
                return (
                  <button
                    key={def.type}
                    className={`${styles.eventBtn} ${on ? styles.eventBtnOn : ''}`}
                    onClick={() => {
                      const next = on
                        ? options.enabledKitchenEvents.filter(t => t !== def.type)
                        : [...options.enabledKitchenEvents, def.type]
                      onChange({ ...options, enabledKitchenEvents: next })
                    }}
                    onMouseEnter={() => { setHoveredEvent(def.type); setHoveredRecipe(null); setDetailEvent(def.type); setDetailRecipe(null) }}
                    onMouseLeave={() => setHoveredEvent(null)}
                  >
                    <span className={`${styles.eventBtnCheck} ${on ? styles.eventBtnCheckOn : ''}`}>✓</span>
                    <span className={styles.eventBtnEmoji}>{def.emoji}</span>
                    <span className={styles.eventBtnName}>{def.label}</span>
                  </button>
                )
              }

              return (
                <div className={styles.eventScroll}>
                  <div className={styles.eventCategoryRow}>⚠ Hazards</div>
                  <div className={styles.eventBtnGrid}>
                    {hazards.map(renderEventBtn)}
                  </div>
                  <div className={styles.eventCategoryRow}>✨ Opportunities</div>
                  <div className={styles.eventBtnGrid}>
                    {opportunities.map(renderEventBtn)}
                  </div>
                </div>
              )
            })()}

            {!options.kitchenEventsEnabled && (
              <div className={styles.hint}>Enable to configure event types and frequency</div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className={styles.footer} style={{ padding: '0 0 8px 0' }}>
            <div className={styles.startWarning} style={{ visibility: startWarning ? 'visible' : 'hidden' }}>
              Select at least one recipe to start.
            </div>
            <button
              className={styles.startBtn}
              onClick={() => {
                if (options.enabledRecipes.length === 0) {
                  setStartWarning(true)
                } else {
                  setStartWarning(false)
                  onStart()
                }
              }}
            >
              ▶ Start Shift!
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
