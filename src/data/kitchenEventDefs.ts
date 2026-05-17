import { EventCategory, EventType } from '../state/types'
import { RECIPES, INGREDIENT_EMOJI } from './recipes'

// Tunable constants
export const EVENT_SPAWN_MIN_MS = 30_000
export const EVENT_SPAWN_MAX_MS = 60_000
export const RESOLVE_THRESHOLD_RATIO = 0.6
export const ANGRY_CHEF_DEBUFF_MULTIPLIER = 0.7
export const ANGRY_CHEF_DEBUFF_DURATION_MS = 15_000
export const CHEFS_CHANT_BOOST_MULTIPLIER = 1.5
export const CHEFS_CHANT_BOOST_DURATION_MS = 20_000
export const TYPING_FRENZY_MULTIPLIER = 1.5
export const TYPING_FRENZY_DURATION_MS = 20_000
export const DANCE_PATIENCE_BONUS_MS = 15_000
export const RAT_INVASION_ITEMS_STOLEN = 3
export const MYSTERY_RECIPE_ITEMS_REWARDED = 3
export const EVENT_DURATION_MS = 12_000  // default duration for all timed events; overridden by kitchenEventDuration in GameOptions

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

// Generates a random maths equation. Answer is always a positive integer.
// Add/subtract: 3 numbers; multiply/divide: 2 numbers.
export function makePowerTripEquation(): { display: string; answer: number } {
  const type = Math.floor(Math.random() * 3)

  if (type === 1) {
    const a = randInt(2, 12)
    const b = randInt(2, 12)
    return { display: `${a} × ${b} = ?`, answer: a * b }
  }

  if (type === 2) {
    const divisor = randInt(2, 9)
    const quotient = randInt(2, 12)
    return { display: `${divisor * quotient} ÷ ${divisor} = ?`, answer: quotient }
  }

  // Add / subtract with 3 numbers — retry until answer is positive
  let display: string, answer: number
  do {
    const a = randInt(20, 60)
    const b = randInt(5, 25)
    const c = randInt(5, 25)
    const op1 = Math.random() < 0.6 ? '+' : '-'
    const op2 = Math.random() < 0.6 ? '+' : '-'
    answer = a + (op1 === '+' ? b : -b) + (op2 === '+' ? c : -c)
    display = `${a} ${op1} ${b} ${op2} ${c} = ?`
  } while (answer <= 0)
  return { display, answer }
}

const FRENZY_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*+='
const FRENZY_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

// Generates a random 10 char gibberish string. First char is always
// alphanumeric so Twitch doesn't interpret it as a command prefix.
export function makeTypingFrenzyPhrase(): string {
  const len = 10
  let result = FRENZY_ALPHA[Math.floor(Math.random() * FRENZY_ALPHA.length)]
  for (let i = 1; i < len; i++) {
    result += FRENZY_CHARS[Math.floor(Math.random() * FRENZY_CHARS.length)]
  }
  return result
}

export interface EventDef {
  type: EventType
  category: EventCategory
  emoji: string
  label: string
  description: string
  commandPool: string[]
  failDescription?: string
  rewardDescription?: string
  color: string    // accent for time bar fill and header gradient end
  cmdColor: string // darker shade for command box and header gradient start
  audio: {
    ambient: string
    success: string
    fail?: string
  }
}

export const EVENT_DEFS: EventDef[] = [
  {
    type: 'rat_invasion',
    category: 'hazard-penalty',
    emoji: '🐀',
    label: 'Rat Invasion',
    description: 'Rats swarm the kitchen. Chat must shout them out before they steal from the prep tray.',
    commandPool: ['SHOO SHOO SHOO', 'CHASE CHASE CHASE', 'BEGONE BEGONE BEGONE'],
    failDescription: 'Fail: lose prepped ingredients',
    color: '#a0603a',
    cmdColor: '#7a4020',
    audio: { ambient: 'event-rat-ambient', success: 'event-success', fail: 'event-fail' },
  },
  {
    type: 'angry_chef',
    category: 'hazard-penalty',
    emoji: '👨‍🍳',
    label: 'Angry Chef',
    description: 'The head chef snaps. Chat must apologise before the timer runs out.',
    commandPool: ['SORRY CHEF', 'APOLOGIES CHEF', 'MY BAD CHEF'],
    failDescription: 'Fail: cooking speed debuff for 15s',
    color: '#e05020',
    cmdColor: '#c0390a',
    audio: { ambient: 'event-angry-chef-ambient', success: 'event-success', fail: 'event-fail' },
  },
  {
    type: 'power_trip',
    category: 'hazard-immediate',
    emoji: '🔌',
    label: 'Power Trip',
    description: 'The power goes out. Stations go offline until chat solves a maths equation.',
    commandPool: [],
    failDescription: 'Stations offline until resolved',
    color: '#2a5acc',
    cmdColor: '#1a3a8a',
    audio: { ambient: 'event-power-trip-ambient', success: 'event-success' },
  },
  {
    type: 'smoke_blast',
    category: 'hazard-immediate',
    emoji: '💨',
    label: 'Smoke Blast',
    description: 'Smoke floods the kitchen. Chat must clear it by typing together fast.',
    commandPool: ['CLEAR', 'VENTILATE', 'BLOW'],
    failDescription: 'Kitchen obscured until resolved',
    color: '#888888',
    cmdColor: '#555555',
    audio: { ambient: 'event-smoke-blast-ambient', success: 'event-success' },
  },
  {
    type: 'glitched_orders',
    category: 'hazard-immediate',
    emoji: '📦',
    label: 'Glitched POS',
    description: 'Order tickets are scrambled. Chat must debug the system to restore them.',
    commandPool: ['RESTART', 'DEBUG', 'PATCH'],
    failDescription: 'Orders scrambled until resolved',
    color: '#7a30cc',
    cmdColor: '#4a1a7a',
    audio: { ambient: 'event-glitch-ambient', success: 'event-success' },
  },
  {
    type: 'chefs_chant',
    category: 'opportunity',
    emoji: '📢',
    label: "Chef's Chant",
    description: 'Time to rally the brigade! Chat chants together to fire up the kitchen.',
    commandPool: ['YES CHEF', 'AYE CHEF', 'OF COURSE CHEF'],
    rewardDescription: 'Reward: cooking speed boost for 20s',
    color: '#c09020',
    cmdColor: '#8a6000',
    audio: { ambient: 'event-chant-ambient', success: 'event-success', fail: 'event-fail' },
  },
  {
    type: 'mystery_recipe',
    category: 'opportunity',
    emoji: '🧩',
    label: 'Mystery Recipe',
    description: 'A scrambled recipe name appears. Chat must unscramble it to claim the reward.',
    commandPool: [],
    rewardDescription: 'Reward: 3 free prepped ingredients',
    color: '#5030a0',
    cmdColor: '#2a1a6a',
    audio: { ambient: 'event-mystery-ambient', success: 'event-success', fail: 'event-fail' },
  },
  {
    type: 'typing_frenzy',
    category: 'opportunity',
    emoji: '📶',
    label: 'Wifi Password',
    description: 'The wifi password flashes on screen — chat races to type it exactly (case sensitive!).',
    commandPool: [],
    rewardDescription: 'Reward: money multiplier ×1.5 for 20s',
    color: '#88cc00',
    cmdColor: '#4a7800',
    audio: { ambient: 'event-frenzy-ambient', success: 'event-success', fail: 'event-fail' },
  },
  {
    type: 'dance',
    category: 'opportunity',
    emoji: '🕺',
    label: 'Dance',
    description: 'A Simon Says sequence of dance moves — chat memorises and types them in order.',
    commandPool: ['UP', 'DOWN', 'LEFT', 'RIGHT'],
    rewardDescription: 'Reward: all orders +15s patience',
    color: '#cc30aa',
    cmdColor: '#7a1a6a',
    audio: { ambient: 'event-dance-ambient', success: 'event-success', fail: 'event-fail' },
  },
  {
    type: 'inventory_audit',
    category: 'hazard-penalty',
    emoji: '🧮',
    label: 'Inventory Audit',
    description: 'A health inspector arrives! Count the highlighted ingredient in the grid.',
    commandPool: [],
    failDescription: 'Fail: inspector confiscates prepped ingredients',
    color: '#b06020',
    cmdColor: '#7a3a00',
    audio: { ambient: 'event-angry-chef-ambient', success: 'event-success', fail: 'event-fail' },
  },
  {
    type: 'complete_dish',
    category: 'opportunity',
    emoji: '🍽️',
    label: 'Complete the Dish',
    description: 'All but one ingredient is shown — type the missing one to complete the recipe.',
    commandPool: [],
    rewardDescription: 'Reward: add missing ingredient',
    color: '#20a060',
    cmdColor: '#0a6030',
    audio: { ambient: 'event-mystery-ambient', success: 'event-success', fail: 'event-fail' },
  },
]

// Returns all unique step target values from the given recipe keys.
// Falls back to all recipes if the list is empty.
export function getIngredientTargets(enabledRecipes: string[]): string[] {
  const keys = enabledRecipes.length > 0 ? enabledRecipes : Object.keys(RECIPES)
  const targets = new Set<string>()
  for (const key of keys) {
    const recipe = RECIPES[key]
    if (!recipe) continue
    for (const step of recipe.steps) targets.add(step.target)
  }
  return [...targets]
}

// Returns all unique step produces values from the given recipe keys.
export function getProducesValues(enabledRecipes: string[]): string[] {
  const keys = enabledRecipes.length > 0 ? enabledRecipes : Object.keys(RECIPES)
  const produces = new Set<string>()
  for (const key of keys) {
    const recipe = RECIPES[key]
    if (!recipe) continue
    for (const step of recipe.steps) produces.add(step.produces)
  }
  return [...produces]
}

const DANCE_DIRS = ['UP', 'DOWN', 'LEFT', 'RIGHT'] as const
export type DanceDir = typeof DANCE_DIRS[number]

export function makeDanceSequence(): DanceDir[] {
  return Array.from({ length: 4 }, () => DANCE_DIRS[Math.floor(Math.random() * DANCE_DIRS.length)])
}

// Produces a simple character-shuffle anagram of the input string.
// Guaranteed to differ from the original (retries up to 10 times).
export function makeAnagram(word: string): string {
  const chars = word.toUpperCase().split('')
  for (let attempt = 0; attempt < 10; attempt++) {
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]]
    }
    const result = chars.join('')
    if (result !== word.toUpperCase()) return result
  }
  return chars.join('')
}

// Builds a 4×4 emoji grid for Inventory Audit. Returns null if not enough variety.
export function makeAuditGrid(enabledRecipes: string[]): { grid: string[]; target: string; answer: number } | null {
  const keys = enabledRecipes.length > 0 ? enabledRecipes : Object.keys(RECIPES)

  const emojiPool: string[] = []
  for (const key of keys) {
    const recipe = RECIPES[key]
    if (!recipe) continue
    for (const item of recipe.plate) {
      const emoji = INGREDIENT_EMOJI[item]
      if (emoji && !emojiPool.includes(emoji)) emojiPool.push(emoji)
    }
  }

  if (emojiPool.length < 3) return null

  const shuffledPool = [...emojiPool].sort(() => Math.random() - 0.5)
  const selected = shuffledPool.slice(0, Math.min(4, shuffledPool.length))
  const target = selected[0]
  const answer = 3 + Math.floor(Math.random() * 8)  // 3–10

  const slots = Array.from({ length: 16 }, (_, i) => i).sort(() => Math.random() - 0.5)
  const targetSlots = new Set(slots.slice(0, answer))
  const nonTarget = selected.slice(1)

  let fillIdx = 0
  const grid = Array.from({ length: 16 }, (_, i) =>
    targetSlots.has(i) ? target : nonTarget[fillIdx++ % nonTarget.length]
  )

  return { grid, target, answer }
}

// Strips cooking-verb prefix and trailing descriptor suffix from a plate produces key,
// leaving just the core ingredient noun (e.g. toasted_bread → bread, matcha_mix → matcha).
const COOKING_VERBS = new Set(['boiled','chopped','cooked','fried','grilled','ground','kneaded','mixed','roasted','simmered','sliced','steamed','toasted'])
const TRAILING_DESCRIPTORS = new Set(['sauce','paste','spread','dip','mix','block'])

function stripPlateIngredient(key: string): string {
  if (key.startsWith('stir_fried_')) return key.slice('stir_fried_'.length).replace(/_/g, ' ')
  const parts = key.split('_')
  let inner = COOKING_VERBS.has(parts[0]) ? parts.slice(1) : parts
  if (inner.length > 1 && TRAILING_DESCRIPTORS.has(inner[inner.length - 1])) inner = inner.slice(0, -1)
  return inner.join(' ')
}

// Picks a qualifying recipe and selects which ingredient to hide for Complete the Dish.
// Returns null if no enabled recipe has 2+ plate items.
export function pickCompleteTheDish(enabledRecipes: string[]): {
  dishName: string; dishEmoji: string
  shownIngredients: string[]; shownIngredientKeys: string[]
  missingIngredient: string; missingIngredientKey: string
} | null {
  const fmt = (s: string) => stripPlateIngredient(s).toUpperCase()
  const keys = (enabledRecipes.length > 0 ? enabledRecipes : Object.keys(RECIPES))
    .filter(key => { const r = RECIPES[key]; return r && r.plate.length >= 2 })

  if (keys.length === 0) return null

  const key = keys[Math.floor(Math.random() * keys.length)]
  const recipe = RECIPES[key]
  const shuffled = [...recipe.plate].sort(() => Math.random() - 0.5)
  const shownKeys = shuffled.slice(0, shuffled.length - 1)
  const missingKey = shuffled[shuffled.length - 1]

  return {
    dishName: recipe.name,
    dishEmoji: recipe.emoji,
    shownIngredients: shownKeys.map(fmt),
    shownIngredientKeys: shownKeys,
    missingIngredient: fmt(missingKey),
    missingIngredientKey: missingKey,
  }
}

// Stable character scramble seeded by a number (for glitched order tickets).
// Same seed → same result across renders.
export function seededScramble(text: string, seed: number): string {
  const chars = text.split('')
  let s = seed
  for (let i = chars.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(s) % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}
