import { GameState } from '../state/types'

export interface TutorialStep {
  title: string
  body: string
  highlight: 'none' | 'orders' | 'cutting_board' | 'fryer' | 'prepared' | 'kitchen'
  advanceMode: 'button' | 'auto'
  advanceCondition?: (state: GameState) => boolean
  commandHint?: string
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "Welcome to the Kitchen! 👨‍🍳",
    body: "Your Twitch chat is your crew — cook dishes and fill orders before time runs out. Today's lesson: Fries!\n\nNote: only the broadcaster's commands work during this tutorial.",
    highlight: 'none',
    advanceMode: 'button',
  },
  {
    title: "📋 Orders",
    body: "Active orders are on the left. Each has an order number and a patience bar — serve it before the bar empties or the order is lost.",
    highlight: 'orders',
    advanceMode: 'button',
  },
  {
    title: "Tonight's dish: Fries! 🍟",
    body: "Fries need two steps:\n① chop potato → adds it to the tray\n② fry potato → needs the chopped potato first\nThen serve.",
    highlight: 'orders',
    advanceMode: 'button',
  },
  {
    title: "🍳 Stations",
    body: "The centre panel is your kitchen. Chopping Board preps ingredients; Fryer cooks in oil. One station per player at a time.",
    highlight: 'kitchen',
    advanceMode: 'button',
  },
  {
    title: "Step 1 — Chop the potato 🔪",
    body: "Type the command into chat and press Enter.",
    highlight: 'cutting_board',
    advanceMode: 'auto',
    commandHint: 'chop potato',
    advanceCondition: (state) =>
      (state.stations['cutting_board']?.slots.some(s => s.target === 'potato') ?? false) ||
      state.preparedItems.includes('chopped_potato'),
  },
  {
    title: "Chopping in progress…",
    body: "Watch the bar fill. In real play, multiple players can prep different ingredients at once.",
    highlight: 'cutting_board',
    advanceMode: 'button',
  },
  {
    title: "🥘 Prepared Ingredients",
    body: "Finished ingredients land in the tray. The chopped potato is ready for the next step.",
    highlight: 'prepared',
    advanceMode: 'button',
  },
  {
    title: "Step 2 — Fry the potato 🫕",
    body: "→ means this step needs the prior ingredient in the tray first. Type into chat:",
    highlight: 'fryer',
    advanceMode: 'auto',
    commandHint: 'fry potato',
    advanceCondition: (state) =>
      (state.stations['fryer']?.slots.some(s => s.target === 'potato') ?? false) ||
      state.preparedItems.includes('fried_potato'),
  },
  {
    title: "Frying in progress…",
    body: "When done, the fried potato lands in the tray and the order is ready to serve.",
    highlight: 'fryer',
    advanceMode: 'button',
  },
  {
    title: "🍟 Serve the order!",
    body: "Ingredients are in the tray — serve the order:",
    highlight: 'orders',
    advanceMode: 'auto',
    commandHint: 'serve 1',
    advanceCondition: (state) =>
      state.orders.some(o => o.dish === 'fries' && o.served),
  },
  {
    title: "🌡️ Station Heat",
    body: "Cooking heats stations. Green = safe, yellow = warm, orange = cool soon. At 100% the station overheats — cooks are cancelled and it locks.",
    highlight: 'fryer',
    advanceMode: 'button',
  },
  {
    title: "❄️ Cool it down!",
    body: "Fryer is at 90% — cool it now before it overheats:",
    highlight: 'fryer',
    advanceMode: 'auto',
    commandHint: 'cool fryer',
    advanceCondition: (state) => (state.stations['fryer']?.heat ?? 100) < 90,
  },
  {
    title: "Station cooled! ✅",
    body: "Fryer dropped to 60% — border is now yellow. Cool regularly during busy shifts to stay safe.",
    highlight: 'fryer',
    advanceMode: 'button',
  },
  {
    title: "⚠️ What if it overheats?",
    body: "At 100% the station catches fire — active cooks are lost and it locks until extinguished. Let's see it happen.",
    highlight: 'fryer',
    advanceMode: 'button',
  },
  {
    title: "🔥 Station on fire!",
    body: "Fryer overheated — cooks cancelled and locked. Vote to extinguish:",
    highlight: 'fryer',
    advanceMode: 'auto',
    commandHint: 'extinguish fryer',
    advanceCondition: (state) => state.stations['fryer']?.overheated === false,
  },
  {
    title: "🎲 Kitchen Events",
    body: "Random events fire mid-shift — a challenge card appears and chat must respond together. Opportunities earn rewards; hazards cause penalties if ignored.",
    highlight: 'none',
    advanceMode: 'button',
  },
  {
    title: "🧩 Mystery Recipe",
    body: "Events look like this! Unscramble the anagram before the timer runs out.\n\nThe anagram is EDCILS FEEB — type the answer:",
    highlight: 'none',
    advanceMode: 'auto',
    commandHint: 'SLICED BEEF',
  },
  {
    title: "You're ready! 🎉",
    body: "You know the loop — cook, serve, manage heat, handle events. Your whole chat pitches in at once. Coordinate and earn big. Good luck, chef!",
    highlight: 'none',
    advanceMode: 'button',
  },
]

export const TUTORIAL_COOL_STEP        = TUTORIAL_STEPS.findIndex(s => s.title === "❄️ Cool it down!")
export const TUTORIAL_EXTINGUISH_STEP  = TUTORIAL_STEPS.findIndex(s => s.title === "🔥 Station on fire!")
export const TUTORIAL_EVENT_INTRO_STEP = TUTORIAL_STEPS.findIndex(s => s.title === "🎲 Kitchen Events")
export const TUTORIAL_EVENT_STEP       = TUTORIAL_STEPS.findIndex(s => s.title === "🧩 Mystery Recipe")
