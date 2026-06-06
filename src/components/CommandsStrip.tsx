import { RECIPES } from '../data/recipes'
import { orderStepsForDisplay } from '../data/recipeSteps'
import styles from './CommandsStrip.module.css'

interface Props {
  stationIds: string[]
  enabledRecipes: string[]
}

export default function CommandsStrip({ enabledRecipes }: Props) {
  return (
    <div className={styles.strip}>
      {enabledRecipes.map(key => {
        const recipe = RECIPES[key]
        if (!recipe) return null
        return (
          <span key={key} className={styles.pill}>
            <span className={styles.pillEmoji}>{recipe.emoji}</span>
            {orderStepsForDisplay(recipe.steps).map((step, i) => (
              <span key={i} className={styles.pillStep}>
                {i > 0 && (
                  <span className={step.requires ? styles.pillArrow : styles.pillSep}>
                    {step.requires ? '→' : '·'}
                  </span>
                )}
                <span className={styles.pillCmd}>{step.action}</span>
                <span className={styles.pillArg}> {step.target.replace(/_/g, ' ')}</span>
              </span>
            ))}
          </span>
        )
      })}
      <span className={`${styles.pill} ${styles.utilityPill}`}>
        <span className={styles.pillCmd}>serve</span>
        <span className={styles.pillArg}> [#]</span>
        <span className={styles.pillSep}>·</span>
        <span className={styles.pillCmd}>cool</span>
        <span className={styles.pillArg}> [station]</span>
        <span className={styles.pillSep}>·</span>
        <span className={styles.pillCmd}>extinguish</span>
        <span className={styles.pillArg}> [station]</span>
      </span>
    </div>
  )
}
