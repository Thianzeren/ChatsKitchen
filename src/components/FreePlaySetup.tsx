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

const ALL_RECIPE_KEYS = [
  ...RECIPE_SETS.flatMap(s => s.recipeKeys).filter(k => RECIPES[k]),
  ...ORPHAN_RECIPE_KEYS,
]

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
const DURATION_MAX = 540000

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

type Tab = 'recipes' | 'events' | 'advanced'

export default function FreePlaySetup({ options, onChange, onStart, onBack, twitchStatus, twitchChannel }: Props) {
  const [tab, setTab] = useState<Tab>('recipes')
  const [startWarning, setStartWarning] = useState(false)
  const [detailRecipe, setDetailRecipe] = useState<string | null>(
    options.enabledRecipes[0] ?? null
  )
  const [detailEvent, setDetailEvent] = useState<string | null>(null)

  const renderDetailContent = () => {
    if (tab === 'recipes') {
      const recipe = detailRecipe ? RECIPES[detailRecipe] : null
      if (!recipe) {
        return <div className={styles.detailEmpty}>Select a recipe to see its steps</div>
      }
      return (
        <>
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
        </>
      )
    }

    if (tab === 'events') {
      const def = detailEvent ? EVENT_DEFS.find(d => d.type === detailEvent) : null
      if (!def) {
        return <div className={styles.detailEmpty}>Select an event to see details</div>
      }
      const isHazard = def.category === 'hazard-penalty' || def.category === 'hazard-immediate'
      return (
        <>
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
        </>
      )
    }

    return null
  }

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
        onMouseEnter={() => setDetailRecipe(key)}
      >
        <FoodIcon icon={recipe.emoji} size={20} className={styles.recipeEmoji} />
        <span className={styles.recipeName}>{recipe.name}</span>
      </button>
    )
  }

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
        onMouseEnter={() => setDetailEvent(def.type)}
      >
        <span className={`${styles.eventBtnCheck} ${on ? styles.eventBtnCheckOn : ''}`}>✓</span>
        <span className={styles.eventBtnEmoji}>{def.emoji}</span>
        <span className={styles.eventBtnName}>{def.label}</span>
      </button>
    )
  }

  return (
    <div className={styles.screen}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>← Playsets</button>
        <h1 className={styles.title}>Customise Your Shift</h1>
        <TwitchStatusPill status={twitchStatus} channel={twitchChannel} />
      </div>

      {/* ── Tab bar ── */}
      <div className={styles.tabBar}>
        {(['recipes', 'events', 'advanced'] as const).map(t => (
          <button
            key={t}
            className={`${styles.tabBtn} ${tab === t ? styles.tabBtnActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'recipes' ? '🍽️ Recipes' : t === 'events' ? '⚡ Events' : '⚙️ Advanced'}
          </button>
        ))}
      </div>

      {/* ── Tab body ── */}
      <div className={styles.tabBody}>

        {/* ── Recipes tab ── */}
        {tab === 'recipes' && (
          <div className={styles.splitPane}>
            <div className={styles.mainPane}>

              {/* Slim toolbar */}
              <div className={styles.recipeToolbar}>
                <span className={styles.recipeCount}>{options.enabledRecipes.length} selected</span>
                <div className={styles.toolbarActions}>
                  <button className={styles.actionBtn} onClick={() => onChange({ ...options, enabledRecipes: [] })}>Remove All</button>
                  <button className={styles.actionBtn} onClick={() => onChange({ ...options, enabledRecipes: ALL_RECIPE_KEYS })}>Select All</button>
                  <button
                    className={`${styles.actionBtn} ${styles.actionBtnRandom}`}
                    onClick={() => {
                      const shuffled = [...ALL_RECIPE_KEYS].sort(() => Math.random() - 0.5)
                      onChange({ ...options, enabledRecipes: shuffled.slice(0, 3) })
                    }}
                  >Random 3</button>
                  <button className={styles.actionBtn} onClick={() => onChange({ ...options, enabledRecipes: DEFAULT_GAME_OPTIONS.enabledRecipes })}>Defaults</button>
                </div>
              </div>

              {/* Flat recipe grid */}
              <div className={styles.recipeScroll}>
                <div className={styles.recipeGrid}>
                  {ALL_RECIPE_KEYS.map(renderRecipeBtn)}
                </div>
                <div className={styles.hint}>Only selected recipes will appear as orders</div>
              </div>

            </div>

            <div className={styles.detailPane}>
              {renderDetailContent()}
            </div>
          </div>
        )}

        {/* ── Events tab ── */}
        {tab === 'events' && (
          <div className={`${styles.splitPane} ${!options.kitchenEventsEnabled ? styles.splitPaneSingle : ''}`}>
            <div className={styles.mainPane}>

              <div className={styles.eventHeader}>
                <button
                  className={`${styles.eventsToggle} ${options.kitchenEventsEnabled ? styles.eventsToggleOn : ''}`}
                  onClick={() => {
                    const turningOn = !options.kitchenEventsEnabled
                    const nextEvents = turningOn && options.enabledKitchenEvents.length === 0
                      ? EVENT_DEFS.map(d => d.type)
                      : options.enabledKitchenEvents
                    onChange({ ...options, kitchenEventsEnabled: turningOn, enabledKitchenEvents: nextEvents })
                  }}
                >
                  {options.kitchenEventsEnabled ? 'Events ON' : 'Events OFF'}
                </button>
                {options.kitchenEventsEnabled && (
                  <div className={styles.toolbarActions}>
                    <button className={styles.actionBtn} onClick={() => onChange({ ...options, enabledKitchenEvents: [] })}>Remove All</button>
                    <button className={styles.actionBtn} onClick={() => onChange({ ...options, enabledKitchenEvents: EVENT_DEFS.map(d => d.type) })}>Select All</button>
                    <button
                      className={`${styles.actionBtn} ${styles.actionBtnRandom}`}
                      onClick={() => {
                        const hazards = EVENT_DEFS.filter(d => d.category === 'hazard-penalty' || d.category === 'hazard-immediate')
                        const opps = EVENT_DEFS.filter(d => d.category === 'opportunity')
                        const h = hazards[Math.floor(Math.random() * hazards.length)]
                        const o = opps[Math.floor(Math.random() * opps.length)]
                        onChange({ ...options, enabledKitchenEvents: [h.type, o.type] })
                      }}
                    >Random 2</button>
                    <button className={styles.actionBtn} onClick={() => onChange({ ...options, enabledKitchenEvents: DEFAULT_GAME_OPTIONS.enabledKitchenEvents })}>Defaults</button>
                  </div>
                )}
              </div>

              {options.kitchenEventsEnabled ? (
                <div className={styles.eventScroll}>
                  <div className={styles.eventCategoryRow}>⚠ Hazards</div>
                  <div className={styles.eventBtnGrid}>
                    {EVENT_DEFS.filter(d => d.category === 'hazard-penalty' || d.category === 'hazard-immediate').map(renderEventBtn)}
                  </div>
                  <div className={styles.eventCategoryRow}>✨ Opportunities</div>
                  <div className={styles.eventBtnGrid}>
                    {EVENT_DEFS.filter(d => d.category === 'opportunity').map(renderEventBtn)}
                  </div>
                </div>
              ) : (
                <div className={styles.eventsOffState}>
                  <span className={styles.eventsOffEmoji}>🍳</span>
                  <p className={styles.eventsOffText}>Kitchen Events are disabled.</p>
                  <p className={styles.eventsOffHint}>Toggle ON to configure which events can spawn during your shift.</p>
                </div>
              )}

            </div>

            {options.kitchenEventsEnabled && (
              <div className={styles.detailPane}>
                {renderDetailContent()}
              </div>
            )}
          </div>
        )}

        {/* ── Advanced tab ── */}
        {tab === 'advanced' && (
          <div className={styles.advancedPane}>

            <div className={styles.advancedHeader}>
              <button
                className={styles.actionBtn}
                onClick={() => onChange({
                  ...options,
                  cookingSpeed:         DEFAULT_GAME_OPTIONS.cookingSpeed,
                  orderSpeed:           DEFAULT_GAME_OPTIONS.orderSpeed,
                  orderSpawnRate:       DEFAULT_GAME_OPTIONS.orderSpawnRate,
                  shiftDuration:        DEFAULT_GAME_OPTIONS.shiftDuration,
                  restrictSlots:        DEFAULT_GAME_OPTIONS.restrictSlots,
                  stationCapacity:      { ...DEFAULT_GAME_OPTIONS.stationCapacity },
                  autoRestart:          DEFAULT_GAME_OPTIONS.autoRestart,
                  autoRestartDelay:     DEFAULT_GAME_OPTIONS.autoRestartDelay,
                  kitchenEventDuration: DEFAULT_GAME_OPTIONS.kitchenEventDuration,
                  kitchenEventSpawnMin: DEFAULT_GAME_OPTIONS.kitchenEventSpawnMin,
                  kitchenEventSpawnMax: DEFAULT_GAME_OPTIONS.kitchenEventSpawnMax,
                })}
              >Reset to Defaults</button>
            </div>

            <div className={styles.advancedCols}>
              <div className={styles.advancedCol}>

              <div className={styles.advancedRow}>
                <div className={styles.advancedRowLabel}>⏱ Duration</div>
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

              <div className={styles.advancedRow}>
                <div className={styles.advancedRowLabel}>⚡ Cooking Speed</div>
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

              <div className={styles.advancedRow}>
                <div className={styles.advancedRowLabel}>📋 Order Urgency</div>
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

              <div className={styles.advancedRow}>
                <div className={styles.advancedRowLabel}>🌊 Order Frequency</div>
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

              </div>
              <div className={styles.advancedCol}>

              <div className={styles.advancedRow}>
                <div className={styles.advancedRowLabel}>🍳 Kitchen Events</div>
                <div className={styles.advancedSubRow}>
                  <span className={styles.advancedSubLabel}>Event duration</span>
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
                <div className={styles.advancedSubRow}>
                  <span className={styles.advancedSubLabel}>Spawn MIN</span>
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
                <div className={styles.advancedSubRow}>
                  <span className={styles.advancedSubLabel}>Spawn MAX</span>
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

              <div className={styles.advancedRow}>
                <div className={styles.advancedRowLabel}>🔧 Station Slots</div>
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

              <div className={styles.advancedRow}>
                <div className={styles.advancedRowLabel}>🔄 Auto-Restart</div>
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
            </div>
          </div>
        )}

      </div>

      {/* ── Footer ── */}
      <div className={styles.footer}>
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
          ▶ Start Shift
        </button>
      </div>

    </div>
  )
}
