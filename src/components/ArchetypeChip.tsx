import { RecipeTag, TAG_META } from '../data/recipeProfile'
import styles from './ArchetypeChip.module.css'

interface Props {
  tag: RecipeTag
  count?: number
}

export default function ArchetypeChip({ tag, count }: Props) {
  const meta = TAG_META[tag]
  return (
    <span
      className={styles.chip}
      style={{ color: meta.color, borderColor: meta.color }}
      title={meta.label}
    >
      <span className={styles.icon}>{meta.icon}</span>
      <span>{meta.label}</span>
      {count !== undefined && <span className={styles.count}>×{count}</span>}
    </span>
  )
}
