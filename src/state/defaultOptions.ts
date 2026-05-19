import { GameOptions, EventType } from './types'

export const DEFAULT_GAME_OPTIONS: GameOptions = {
  cookingSpeed: 1,
  orderSpeed: 1,
  orderSpawnRate: 1,
  shiftDuration: 180000,
  stationCapacity: { chopping: 3, cooking: 2 },
  restrictSlots: false,
  enabledRecipes: ['burger', 'fish_burger', 'salad', 'roasted_veggies'],
  allowShortformCommands: false,
  autoRestart: false,
  autoRestartDelay: 60,
  kitchenEventsEnabled: true,
  enabledKitchenEvents: ['angry_chef', 'smoke_blast', 'mystery_recipe', 'dance'] as EventType[],
  kitchenEventSpawnMin: 30,
  kitchenEventSpawnMax: 60,
  kitchenEventDuration: 12,
}
