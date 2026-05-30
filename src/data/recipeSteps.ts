import { RecipeStep } from './recipes'

// Order recipe steps for display so that the step producing an ingredient another
// step requires sits immediately before that consumer. This keeps the dependency
// arrow ("→") correct — the prerequisite is right before the arrow — and pushes
// independent steps to the front. Example (Kimchi Jjigae):
//   raw:     chop kimchi · chop tofu → simmer kimchi   (arrow after the wrong step)
//   ordered: chop tofu · chop kimchi → simmer kimchi   (prerequisite before arrow)
export function orderStepsForDisplay(steps: RecipeStep[]): RecipeStep[] {
  const producerOf = new Map<string, number>()
  steps.forEach((s, i) => { if (s.produces) producerOf.set(s.produces, i) })

  const requiredIngredients = new Set(
    steps.filter(s => s.requires).map(s => s.requires as string),
  )
  const isConsumedProducer = (s: RecipeStep) => requiredIngredients.has(s.produces)

  const emitted = new Array(steps.length).fill(false)
  const result: RecipeStep[] = []
  const emit = (i: number) => {
    if (emitted[i]) return
    const depIdx = steps[i].requires ? producerOf.get(steps[i].requires as string) : undefined
    if (depIdx !== undefined && depIdx !== i && !emitted[depIdx]) emit(depIdx) // producer first
    if (!emitted[i]) { emitted[i] = true; result.push(steps[i]) }
  }

  // Emit independent steps in original order; consumed producers are deferred so
  // they get pulled in immediately before their consumer.
  steps.forEach((s, i) => { if (!isConsumedProducer(s)) emit(i) })
  // Safety net: emit anything still unemitted.
  steps.forEach((_, i) => emit(i))

  return result
}
