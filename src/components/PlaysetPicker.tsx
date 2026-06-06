import { useState, Fragment } from 'react'
import { PLAYSETS, type Playset, type Difficulty } from '../data/playsets.ts'
import { RECIPES } from '../data/recipes.ts'
import { orderStepsForDisplay } from '../data/recipeSteps.ts'
import { EVENT_DEFS } from '../data/kitchenEventDefs.ts'
import styles from './PlaysetPicker.module.css'

interface Props {
  onStart: (playset: Playset, difficulty: Difficulty) => void
  onCustomise: (playset: Playset | null) => void
  onBack: () => void
}

const VISIBLE = 3

export default function PlaysetPicker({ onStart, onCustomise, onBack }: Props) {
  const [carouselStart, setCarouselStart] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [pinned, setPinned] = useState(false)
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')

  const detailId = pinned ? selectedId : (hoveredId ?? selectedId)
  const detailPlayset = detailId ? PLAYSETS.find(p => p.id === detailId) ?? null : null

  function handleCardEnter(id: string) {
    if (!pinned) setHoveredId(id)
  }

  function handleCardLeave() {
    if (!pinned) setHoveredId(null)
  }

  function handleCardClick(id: string) {
    if (selectedId === id && pinned) {
      setPinned(false)
    } else {
      setSelectedId(id)
      setPinned(true)
      setHoveredId(null)
    }
  }

  const canShiftLeft = carouselStart > 0
  const canShiftRight = carouselStart < PLAYSETS.length - VISIBLE
  const visiblePlaysets = PLAYSETS.slice(carouselStart, carouselStart + VISIBLE)

  return (
    <div className={styles.screen}>
      {/* Top bar */}
      <div className={styles.topbar}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <h1 className={styles.title}>Pick Your Playset</h1>
        <div className={styles.difficultyToggle}>
          <button
            className={`${styles.diffBtn} ${styles.diffBtnNormal}${difficulty === 'normal' ? ` ${styles.active}` : ''}`}
            onClick={() => setDifficulty('normal')}
          >
            Normal
          </button>
          <button
            className={`${styles.diffBtn} ${styles.diffBtnHard}${difficulty === 'hard' ? ` ${styles.active}` : ''}`}
            onClick={() => setDifficulty('hard')}
          >
            Hard
          </button>
        </div>
      </div>

      {/* Carousel */}
      <div className={styles.carouselArea}>
        <button
          className={`${styles.navArrow}${!canShiftLeft ? ` ${styles.navArrowDisabled}` : ''}`}
          disabled={!canShiftLeft}
          onClick={() => setCarouselStart(s => s - 1)}
        >
          ‹
        </button>

        <div className={styles.cardsViewport}>
          {visiblePlaysets.map(ps => {
            const isSelected = ps.id === selectedId
            const isHovered = !pinned && ps.id === hoveredId
            const cardClass = [
              styles.card,
              isSelected && pinned ? styles.cardSelected : '',
              isHovered ? styles.cardHovered : '',
            ].filter(Boolean).join(' ')

            return (
              <div
                key={ps.id}
                className={cardClass}
                style={{ '--card-color': ps.themeColor } as React.CSSProperties}
                role="button"
                tabIndex={0}
                onMouseEnter={() => handleCardEnter(ps.id)}
                onMouseLeave={handleCardLeave}
                onClick={() => handleCardClick(ps.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(ps.id) } }}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitleRow}>
                    <span className={styles.cardFlag}>{ps.flag}</span>
                    <span className={styles.cardName}>{ps.name}</span>
                    {ps.tag && <span className={styles.cardTag}>{ps.tag}</span>}
                  </div>
                </div>

                <div className={styles.cardBody}>
                  {/* Recipes */}
                  <div>
                    <div className={`${styles.sectionLabel} ${styles.sectionLabelRecipes}`}>🍴 Recipes</div>
                    {ps.recipes.map(key => {
                      const recipe = RECIPES[key]
                      if (!recipe) return null
                      return (
                        <div key={key} className={styles.itemRow}>
                          <span className={styles.itemEmoji}>{recipe.emoji}</span>
                          <span className={styles.itemName}>{recipe.name}</span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Events */}
                  <div>
                    <div className={`${styles.sectionLabel} ${styles.sectionLabelEvents}`}>⚡ Events</div>
                    {ps.events.map(evType => {
                      const def = EVENT_DEFS.find(e => e.type === evType)
                      if (!def) return null
                      const isHazard = def.category !== 'opportunity'
                      return (
                        <div key={evType} className={styles.itemRow}>
                          <span className={styles.itemEmoji}>{def.emoji}</span>
                          <span className={styles.itemName}>{def.label}</span>
                          <span className={`${styles.evtBadge} ${isHazard ? styles.evtBadgeHazard : styles.evtBadgeOpportunity}`}>
                            {isHazard ? '⚠' : '✨'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <button
          className={`${styles.navArrow}${!canShiftRight ? ` ${styles.navArrowDisabled}` : ''}`}
          disabled={!canShiftRight}
          onClick={() => setCarouselStart(s => s + 1)}
        >
          ›
        </button>
      </div>

      {/* Bottom panel */}
      <div className={styles.bottomPanel}>
        <div className={styles.detailArea}>
          {detailPlayset ? (
            <DetailBreakdown playset={detailPlayset} />
          ) : (
            <div className={styles.detailPlaceholder}>Hover or select a playset to see the full breakdown</div>
          )}
        </div>

        <div className={styles.actionArea}>
          <button
            className={styles.cookBtn}
            disabled={!selectedId}
            onClick={() => {
              const ps = PLAYSETS.find(p => p.id === selectedId)
              if (ps) onStart(ps, difficulty)
            }}
          >
            🍳 Let's Cook!
          </button>
          <button className={styles.customiseBtn} onClick={() => onCustomise(PLAYSETS.find(p => p.id === selectedId) ?? null)}>
            ⚙ Customise My Own
          </button>
          {!selectedId && <div className={styles.hint}>Select a playset to start</div>}
        </div>
      </div>
    </div>
  )
}

function DetailBreakdown({ playset }: { playset: Playset }) {
  return (
    <div className={styles.breakdown}>
      <div className={styles.breakdownCol}>
        {playset.recipes.map(key => {
          const recipe = RECIPES[key]
          if (!recipe) return null
          return (
            <div key={key} className={styles.bdItem}>
              <span className={styles.bdEmoji}>{recipe.emoji}</span>
              <div className={styles.bdInfo}>
                <div className={styles.bdName}>
                  {recipe.name}
                  <span className={styles.bdReward}>${recipe.reward}</span>
                </div>
                <div className={styles.bdSteps}>
                  {orderStepsForDisplay(recipe.steps).map((step, i) => (
                    <Fragment key={i}>
                      {i > 0 && (
                        step.requires
                          ? <span className={styles.stepArrow}>→</span>
                          : <span className={styles.stepSep}>·</span>
                      )}
                      <span className={styles.stepChip}>{step.action} {step.target.replace(/_/g, ' ')}</span>
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className={styles.breakdownCol}>
        {playset.events.map(evType => {
          const def = EVENT_DEFS.find(e => e.type === evType)
          if (!def) return null
          const isHazard = def.category !== 'opportunity'
          return (
            <div key={evType} className={styles.bdItem}>
              <span className={styles.bdEmoji}>{def.emoji}</span>
              <div className={styles.bdInfo}>
                <div className={styles.bdName}>
                  {def.label}
                  <span className={`${styles.bdBadge} ${isHazard ? styles.bdBadgeHazard : styles.bdBadgeOpportunity}`}>
                    {isHazard ? '⚠ Hazard' : '✨ Opp.'}
                  </span>
                </div>
                <div className={styles.bdDesc}>{def.description}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
