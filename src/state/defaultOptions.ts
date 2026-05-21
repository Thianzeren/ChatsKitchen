import { GameOptions, EventType } from './types'

export const DEFAULT_GAME_OPTIONS: GameOptions = {
  cookingSpeed: 1,
  orderSpeed: 1,
  orderSpawnRate: 1,
  shiftDuration: 180000,
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
