export type Screen = 'menu' | 'localplay' | 'pvplobby' | 'adventurelobby' | 'adventurebriefing' | 'adventurepantryshop' | 'adventurepathpick' | 'adventurecuisinepick' | 'adventurebossbriefing' | 'options' | 'playsetpicker' | 'freeplaysetup' | 'countdown' | 'playing' | 'shiftend' | 'gameover' | 'adventureshiftpassed' | 'adventurerunend' | 'credits'

export type CuisineId = 'western' | 'chinese' | 'japanese' | 'korean' | 'sg' | 'japanese_bakery'

export type GarnishTier = 'common' | 'rare' | 'legendary'

export interface OwnedGarnish {
  garnishId: string
  acquiredOnShift: number
}

export interface ShopOffer {
  garnishId: string
  price: number
  rarity: GarnishTier
}

export interface PathCard {
  id: string
  label: string
  archetype: 'easy' | 'risk' | 'boss'
  goalDelta: number                       // multiplicative; -0.15 = 15% easier, +0.10 = 10% harder
  modifierIds: string[]                   // reserved for PR 3 mini-modifiers
  rewardOnPass?: { cashBonus?: number; freeGarnishTier?: GarnishTier; freeRecipe?: boolean }
  bossDebuffId?: string
  bossPayload?: { disabledStationId?: string }   // pre-rolled by the generator for deterministic display
}
export type TutorialDestination = 'menu' | 'playsetpicker' | 'freeplaysetup'

export interface ActiveEventOptions {
  kitchenEventsEnabled: boolean
  enabledKitchenEvents: EventType[]
  kitchenEventSpawnMin: number
  kitchenEventSpawnMax: number
  kitchenEventDuration: number
}

export function toActiveEventOptions(opts: ActiveEventOptions): ActiveEventOptions {
  const { kitchenEventsEnabled, enabledKitchenEvents, kitchenEventSpawnMin, kitchenEventSpawnMax, kitchenEventDuration } = opts
  return { kitchenEventsEnabled, enabledKitchenEvents, kitchenEventSpawnMin, kitchenEventSpawnMax, kitchenEventDuration }
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
  bonusPoints: number   // awarded for meaningful contributions (see scoring design)
}

export function calcPlayerScore(s: PlayerStats): number {
  return s.cooked + s.served + s.extinguished * 2 + s.cooled + s.eventParticipations * 2 - s.firesCaused + s.bonusPoints
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

export interface GameOptions {
  cookingSpeed: number
  orderSpeed: number
  orderSpawnRate: number
  shiftDuration: number
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
  recipes: string[]                  // 1..N recipe keys active for this shift
  goalMoney: number
  moneyEarned: number
  served: number
  lost: number
  passed: boolean
  chosenPathCardId?: string
  bossDebuffId?: string
  garnishesCollectedThisShift?: string[]
}

export interface AdventureRun {
  runSeed: string
  startCuisine: CuisineId
  currentShift: number                              // 1-based; shift being set up or played
  shiftResults: ShiftResult[]                       // completed shifts (appended after shiftend)
  currentRunMoney: number                           // bank — carries between shifts; spent in shop
  unlockedRecipes: string[]                         // grows via auto-unlock + shop
  currentRecipes: string[]                          // subset of unlockedRecipes active this shift
  currentGoal: number                               // money goal for the current shift
  participantCount: number                          // crew size — scales goals + garnish prices; refreshed each shift from the (future) Adventure lobby roster
  pendingPathCards?: [PathCard, PathCard]
  chosenPath?: PathCard
  pendingShopOffers?: ShopOffer[]
  ownedGarnishes: OwnedGarnish[]
  currentBossDebuff?: string
  accumulatedPlayerStats: Record<string, PlayerStats>
  runWon?: boolean                                  // set when shift 8 is cleared
}

export interface AdventureBestRun {
  furthestShift: number   // shift number of the last (failed) shift
  totalMoney: number      // sum of moneyEarned across all shifts
  wonRuns: number         // count of full 8-shift completions
  bestStartCuisine?: CuisineId
  bestEndedAt?: number    // timestamp
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
    shownIngredients?: string[]       // formatted display names (uppercased, verb stripped)
    shownIngredientKeys?: string[]    // parallel raw produces keys for emoji lookup
    missingIngredient?: string        // formatted display name
    missingIngredientKey?: string     // raw produces key for emoji lookup
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
  enabledRecipes: string[]
  stations: Record<string, Station>
  orders: Order[]
  preparedItems: string[]
  preparedItemSources: string[]    // parallel to preparedItems: username who cooked each item
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
  // Adventure-mode garnish/debuff knobs (undefined = neutral default)
  heatPerCookMultiplier?: number       // 1 default; <1 = less heat, >1 = more heat
  coolAmountBonus?: number             // 0 default; added to the rolled cool amount (40–60)
  flatTipPerOrder?: number             // 0 default; flat $ added to each served reward
  bossMoneyMultiplier?: number         // 1 default; Picky Critic boss = 0.75
  cooldownMultiplier?: number          // 1 default; Understaffed boss = 1.5
  choppingCookTimeMultiplier?: number  // 1 default; Precise Cuts = 0.6 (chop-station only); Sharp Knives overrides to 0
  orderPatienceBonus?: number          // ms added to each new order's patienceMax + patienceLeft (Friendly Faces)
  recentServes?: { dish: string; at: number }[]   // rolling log of recent serves; Combo Plate checks 3 distinct dishes in 30s
  // Periodic shift-timer effects (Tea Break, Recipe Roulette) — initialised lazily
  // on the first TICK after RESET so we don't need Date.now() in the reducer.
  activeBossDebuff?: string                        // mirrors path-card boss for TICK-side effects
  teaBreakNextAt?: number                          // ms timestamp; when now ≥ this, fire Tea Break
  patiencePausedUntil?: number                     // ms timestamp; while now < this, patience doesn't drain
  rouletteNextAt?: number                          // ms timestamp; when now ≥ this, rotate enabledRecipes
  // Triggered-garnish runtime state
  activeGarnishes?: string[]                  // garnish ids active for this shift
  firstOrderServedThisShift?: boolean         // First Bite, Big Tippers — flips after first SERVE
  overheatThreshold?: number                  // default 100; Glass Kitchen=60, Insulation=110
  teams?: Record<string, 'red' | 'blue'>
  redPreparedItems?: string[]
  bluePreparedItems?: string[]
  redPreparedItemSources?: string[]
  bluePreparedItemSources?: string[]
  redMoney?: number
  blueMoney?: number
  redServed?: number
  blueServed?: number
}
