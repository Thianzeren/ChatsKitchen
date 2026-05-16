export type Screen = 'menu' | 'localplay' | 'pvplobby' | 'adventurebriefing' | 'options' | 'playsetpicker' | 'freeplaysetup' | 'countdown' | 'playing' | 'shiftend' | 'gameover' | 'adventureshiftpassed' | 'adventurerunend' | 'credits'
export type TutorialDestination = 'menu' | 'playsetpicker' | 'freeplaysetup'

export interface ActiveEventOptions {
  kitchenEventsEnabled: boolean
  enabledKitchenEvents: EventType[]
  kitchenEventSpawnMin: number
  kitchenEventSpawnMax: number
  kitchenEventDuration: number
}

export type SlotState = 'cooking'

export interface StationSlot {
  id: string
  user: string
  target: string
  produces: string
  elapsedMs: number
  cookDuration: number
  heatApplied: number
  heatPerCook: number   // total heat this slot contributes when fully cooked (10–20)
  state: SlotState
}

export interface Station {
  id: string
  slots: StationSlot[]
  heat: number
  overheated: boolean
  extinguishVotes: string[]
  lastCooledAt?: number
  lastCooledBy?: string
  lastExtinguishedAt?: number
  lastExtinguishedBy?: string[]
  lastCompletion?: { ingredient: string; at: number; by: string }
}

export interface Order {
  id: number
  dish: string
  served: boolean
  patienceMax: number
  patienceLeft: number
  spawnTime: number
  outcome?: 'served' | 'lost'
  completedAt?: number
  servedBy?: string
}

export interface ChatMessage {
  id: number
  username: string
  text: string
  type: 'normal' | 'system' | 'error' | 'success'
}

export interface PlayerStats {
  cooked: number
  served: number
  moneyEarned: number
  extinguished: number
  firesCaused: number
  cooled: number
  eventParticipations: number
}

export interface RoundRecord {
  money: number
  served: number
  lost: number
  playerCount: number
}

export interface FinalStats {
  money: number
  served: number
  lost: number
  playerStats: Record<string, PlayerStats>
  teams?: Record<string, 'red' | 'blue'>
  redMoney?: number
  blueMoney?: number
  redServed?: number
  blueServed?: number
}

export interface StationCapacity {
  chopping: number    // slots for cutting_board
  cooking: number     // slots per cooking station (grill, fryer, stove, oven)
}

export interface GameOptions {
  cookingSpeed: number
  orderSpeed: number
  orderSpawnRate: number
  shiftDuration: number
  stationCapacity: StationCapacity
  restrictSlots: boolean
  enabledRecipes: string[]
  allowShortformCommands: boolean
  autoRestart: boolean
  autoRestartDelay: number  // seconds
  kitchenEventsEnabled: boolean
  enabledKitchenEvents: EventType[]
  kitchenEventSpawnMin: number    // seconds
  kitchenEventSpawnMax: number    // seconds
  kitchenEventDuration: number    // seconds — applies to all timed events (hazard-penalty + opportunity)
}

export interface AudioSettings {
  masterVolume: number
  musicVolume: number
  sfxVolume: number
  musicMuted: boolean
  sfxMuted: boolean
  darkMode: boolean
  mobileFriendly: boolean
  trackEnabled: { menu: boolean; gameplay: boolean; gameover: boolean }
}

export interface RecipeSet {
  id: string
  name: string
  emoji: string
  flag: string
  description: string
  cuisine: string
  recipeKeys: string[]
}

export interface ShiftResult {
  shiftNumber: number
  recipes: string[]       // 3 recipe keys for this shift
  goalMoney: number
  moneyEarned: number
  served: number
  lost: number
  passed: boolean
}

export interface AdventureRun {
  currentShift: number                              // 1-based; shift being set up or played
  shiftResults: ShiftResult[]                       // completed shifts (appended after shiftend)
  currentRecipes: string[]                          // 3 recipe keys for the current shift
  currentGoal: number                               // money goal for the current shift
  accumulatedPlayerStats: Record<string, PlayerStats>
}

export interface AdventureBestRun {
  furthestShift: number   // shift number of the last (failed) shift
  totalMoney: number      // sum of moneyEarned across all shifts
}

export type EventType =
  | 'rat_invasion' | 'angry_chef'
  | 'power_trip' | 'smoke_blast' | 'glitched_orders'
  | 'chefs_chant' | 'mystery_recipe' | 'typing_frenzy' | 'dance'
  | 'inventory_audit' | 'complete_dish'

export type EventCategory = 'hazard-penalty' | 'hazard-immediate' | 'opportunity'

export interface KitchenEvent {
  id: string
  category: EventCategory
  type: EventType
  chosenCommand: string
  progress: number           // 0–100
  threshold: number          // ceil(playerCount × 0.8), min 1
  respondedUsers: string[]
  timeLeft: number | null     // null for hazard-immediate
  initialTimeLeft: number | null  // original duration at spawn, for bar % calculation
  resolved: boolean
  failed: boolean
  payload: {
    disabledStations?: string[]
    anagramAnswer?: string
    typingPhrase?: string
    danceSequence?: ('UP' | 'DOWN' | 'LEFT' | 'RIGHT')[]
    powerTripAnswer?: number
    // inventory_audit
    auditGrid?: string[]
    auditTarget?: string
    auditAnswer?: number
    // complete_dish
    shownIngredients?: string[]
    missingIngredient?: string
    dishName?: string
    dishEmoji?: string
  }
}

export interface GameState {
  money: number
  served: number
  lost: number
  timeLeft: number
  cookingSpeed: number
  orderSpeed: number
  orderSpawnRate: number
  stationCapacity: StationCapacity
  restrictSlots: boolean
  enabledRecipes: string[]
  stations: Record<string, Station>
  orders: Order[]
  preparedItems: string[]
  nextOrderId: number
  userCooldowns: Record<string, number>
  activeUsers: Record<string, string>
  nextSlotId: number
  chatMessages: ChatMessage[]
  nextMessageId: number
  playerStats: Record<string, PlayerStats>
  participantCount: number  // known at game start (roomPlayers.length for room mode, 0 = derive from playerStats)
  cookingSpeedModifier?: { multiplier: number; expiresAt: number }
  moneyMultiplier?: { multiplier: number; expiresAt: number }
  disabledStations?: string[]
  teams?: Record<string, 'red' | 'blue'>
  redPreparedItems?: string[]
  bluePreparedItems?: string[]
  redMoney?: number
  blueMoney?: number
  redServed?: number
  blueServed?: number
}
