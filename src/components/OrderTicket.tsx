import { Order } from '../state/types'
import { RECIPES, INGREDIENT_EMOJI } from '../data/recipes'
import { seededScramble } from '../data/kitchenEventDefs'
import FoodIcon from './FoodIcon'
import styles from './OrderTicket.module.css'

interface Props {
  order: Order
  orderNumber: number
  simple?: boolean
  isGlitched?: boolean
}

const STRIP_PREFIX = /^(chopped|grilled|fried|boiled|roasted|toasted|sliced|steamed|wok|simmered|cooked)_/
const GLITCH_EMOJIS = ['🌀', '❓', '⚡', '🔀', '💢']

export default function OrderTicket({ order, orderNumber, simple = false, isGlitched = false }: Props) {
  const recipe = RECIPES[order.dish]
  const urgency = order.patienceLeft / order.patienceMax
  const barColor = urgency < 0.25 ? '#d94f4f' : urgency < 0.5 ? '#e07030' : '#42a05e'
  const urgencyClass = urgency < 0.25 ? styles.critical : urgency < 0.5 ? styles.warning : styles.normal

  const glitchEmoji = GLITCH_EMOJIS[order.id % GLITCH_EMOJIS.length]
  const glitchName = isGlitched ? seededScramble(recipe.name, order.id) : recipe.name
  const glitchEmoji2 = isGlitched ? glitchEmoji : recipe.emoji
  const glitchDelay = `${(order.id % 5) * 0.18}s`
  const displayItem = (item: string) => item.replace(STRIP_PREFIX, '').replace(/_/g, ' ')
  const glitchedPlate = isGlitched
    ? recipe.plate.map((item, i) => seededScramble(displayItem(item), order.id + i + 1))
    : recipe.plate.map(displayItem)

  const isServed = order.outcome === 'served'
  const isLost = order.outcome === 'lost'
  const actualReward = Math.round(recipe.reward + Math.max(0, Math.floor((order.patienceLeft / order.patienceMax) * 30)))
  const outcomeClass = isServed ? styles.ticketServed : isLost ? styles.ticketLost : ''

  if (simple) {
    return (
      <div className={styles.ticketWrapper}>
        <div className={`${styles.ticketSimple} ${urgencyClass} ${outcomeClass} ${isGlitched ? styles.glitched : ''}`}>
          <div className={styles.simpleRow}>
            <span
              className={`${styles.orderNumSimple} ${isGlitched ? styles.glitchWobbleNum : ''}`}
              style={isGlitched ? { animationDelay: glitchDelay } : undefined}
            >#{orderNumber}</span>
            <span
              className={isGlitched ? styles.glitchSpinEmoji : undefined}
              style={isGlitched ? { animationDelay: glitchDelay } : undefined}
            >
              <FoodIcon icon={glitchEmoji2} size={24} />
            </span>
            <div className={styles.simpleIngredients}>
              {recipe.plate.map((item, i) => (
                <div key={i} className={styles.simpleIngredientTile}>
                  <FoodIcon icon={INGREDIENT_EMOJI[item] || '?'} size={32} />
                </div>
              ))}
            </div>
          </div>
          <div className={styles.patienceBg}>
            <div className={styles.patienceFill} style={{ width: `${urgency * 100}%`, backgroundColor: barColor }} />
          </div>
          {isLost && <div className={styles.fireOverlay} />}
        </div>
        {isServed && (
          <div className={styles.moneyFloat}>
            +${actualReward}
            {order.servedBy && <span className={styles.moneyFloatPlayer}>{order.servedBy}</span>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={styles.ticketWrapper}>
      <div className={`${styles.ticket} ${urgencyClass} ${outcomeClass} ${isGlitched ? styles.glitched : ''}`}>
        <div className={styles.header}>
          <span
            className={`${styles.orderNum} ${isGlitched ? styles.glitchWobbleNum : ''}`}
            style={isGlitched ? { animationDelay: glitchDelay } : undefined}
          >#{orderNumber}</span>
          <span
            className={`${styles.dishEmoji} ${isGlitched ? styles.glitchSpinEmoji : ''}`}
            style={isGlitched ? { animationDelay: glitchDelay } : undefined}
          >
            <FoodIcon icon={glitchEmoji2} size={22} />
          </span>
          <span className={styles.dishName}>{glitchName}</span>
        </div>
        <div className={styles.body}>
          <div className={styles.ingredients}>
            {recipe.plate.map((item, i) => (
              <div key={i} className={styles.ingredientTile}>
                <FoodIcon icon={INGREDIENT_EMOJI[item] || '?'} size={32} className={styles.ingredientEmoji} />
                <span className={styles.ingredientName}>
                  {glitchedPlate[i]}
                </span>
              </div>
            ))}
          </div>
          <div className={styles.patienceBg}>
            <div
              className={styles.patienceFill}
              style={{ width: `${urgency * 100}%`, backgroundColor: barColor }}
            />
          </div>
        </div>
        {isLost && <div className={styles.fireOverlay} />}
      </div>
      {isServed && (
        <div className={styles.moneyFloat}>
          +${actualReward}
          {order.servedBy && <span className={styles.moneyFloatPlayer}>{order.servedBy}</span>}
        </div>
      )}
    </div>
  )
}
