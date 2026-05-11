import { useState } from 'react'
import { INGREDIENT_EMOJI, RECIPES } from '../data/recipes'
import FoodIcon from './FoodIcon'
import styles from './PreparedItems.module.css'

interface Props {
  items: string[]
  enabledRecipes: string[]
  isHighlighted?: boolean
  // PvP additions — all optional; undefined = solo mode
  pvpMode?: boolean
  redItems?: string[]
  blueItems?: string[]
  redMoney?: number
  blueMoney?: number
}

export default function PreparedItems({ items, enabledRecipes, isHighlighted, pvpMode, redItems, blueItems, redMoney, blueMoney }: Props) {
  const [showNames, setShowNames] = useState(() => {
    const stored = localStorage.getItem('chatsKitchen_preparedItemsShowNames')
    return stored === null ? true : stored === 'true'
  })

  const toggleShowNames = () => setShowNames(s => {
    const next = !s
    localStorage.setItem('chatsKitchen_preparedItemsShowNames', String(next))
    return next
  })

  const allowedIngredients = new Set(
    enabledRecipes.flatMap(key => RECIPES[key]?.steps.map(s => s.produces) ?? [])
  )
  const visibleIngredients = Object.keys(INGREDIENT_EMOJI).filter(i => allowedIngredients.has(i))

  const counts: Record<string, number> = {}
  for (const item of items) {
    counts[item] = (counts[item] || 0) + 1
  }

  const stockedIngredients = visibleIngredients.filter(item => (counts[item] || 0) > 0)

  function renderTray(item: string, pool: string[], team: 'red' | 'blue') {
    const count = pool.filter(i => i === item).length
    const filled = count > 0
    const filledClass = team === 'red' ? styles.trayFilledRed : styles.trayFilledBlue
    return (
      <div key={item} className={`${styles.tray} ${filled ? filledClass : styles.trayEmpty}`}>
        <FoodIcon icon={INGREDIENT_EMOJI[item] || '?'} size={22} className={styles.emoji} />
        {showNames && <span className={styles.name}>{item.replace(/_/g, ' ')}</span>}
        <span className={styles.count}>×{count}</span>
      </div>
    )
  }

  if (pvpMode && redItems !== undefined && blueItems !== undefined) {
    return (
      <div className={`${styles.prep} ${isHighlighted ? styles.highlighted : ''}`}>
        <div className={styles.pvpHeader}>
          <button className={styles.toggle} onClick={toggleShowNames}>
            {showNames ? 'Hide names' : 'Show names'}
          </button>
        </div>
        <div className={styles.pvpRow}>
          <div className={styles.pvpHalf}>
            <div className={styles.pvpTeamHeader}>
              <span className={styles.pvpLabelRed}>🔴 Red</span>
              <span className={styles.pvpScore}>${(redMoney ?? 0).toLocaleString()}</span>
            </div>
            <div className={`${styles.items} ${showNames ? styles.itemsWithNames : styles.itemsCompact}`}>
              {visibleIngredients.map(item => renderTray(item, redItems, 'red'))}
            </div>
          </div>
          <div className={styles.pvpDivider} />
          <div className={styles.pvpHalf}>
            <div className={styles.pvpTeamHeader}>
              <span className={styles.pvpLabelBlue}>🔵 Blue</span>
              <span className={styles.pvpScore}>${(blueMoney ?? 0).toLocaleString()}</span>
            </div>
            <div className={`${styles.items} ${showNames ? styles.itemsWithNames : styles.itemsCompact}`}>
              {visibleIngredients.map(item => renderTray(item, blueItems, 'blue'))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.prep} ${isHighlighted ? styles.highlighted : ''}`}>
      <div className={styles.header}>
        <div className={styles.sectionTitle}>🥘 Prepped Ingredients</div>
        <button className={styles.toggle} onClick={toggleShowNames}>
          {showNames ? 'Hide names' : 'Show names'}
        </button>
      </div>
      {stockedIngredients.length === 0 ? (
        <div className={styles.emptyHint}>Nothing prepped yet — start cooking!</div>
      ) : (
        <div className={`${styles.items} ${showNames ? styles.itemsWithNames : styles.itemsCompact}`}>
          {stockedIngredients.map(item => {
            const count = counts[item] || 0
            const filled = count > 0
            return (
              <div key={item} className={`${styles.tray} ${filled ? styles.trayFilled : styles.trayEmpty}`}>
                <FoodIcon icon={INGREDIENT_EMOJI[item] || '?'} size={22} className={styles.emoji} />
                {showNames && <span className={styles.name}>{item.replace(/_/g, ' ')}</span>}
                <span className={styles.count}>×{count}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
