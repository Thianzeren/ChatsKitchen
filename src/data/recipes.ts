export interface RecipeStep {
  action: string
  target: string
  station: string
  duration: number
  burnAt?: number
  produces: string
  requires?: string
}

export interface Recipe {
  name: string
  emoji: string
  reward: number
  patience: number
  steps: RecipeStep[]
  plate: string[]
}

export interface StationDef {
  name: string
  emoji: string
  color: string
  actions: string[]
}

export const RECIPES: Record<string, Recipe> = {
  burger: {
    name: 'Burger', emoji: '\u{1F354}', reward: 50, patience: 75000,
    steps: [
      { action: 'chop', target: 'lettuce', station: 'cutting_board', duration: 7000, produces: 'chopped_lettuce' },
      { action: 'grill', target: 'patty', station: 'grill', duration: 9000, burnAt: 19000, produces: 'grilled_patty' },
      { action: 'toast', target: 'bun', station: 'oven', duration: 8000, burnAt: 18000, produces: 'toasted_bun' },
    ],
    plate: ['chopped_lettuce', 'grilled_patty', 'toasted_bun']
  },
  fries: {
    name: 'Fries', emoji: '\u{1F35F}', reward: 30, patience: 50000,
    steps: [
      { action: 'chop', target: 'potato', station: 'cutting_board', duration: 7000, produces: 'chopped_potato' },
      { action: 'fry', target: 'potato', station: 'fryer', duration: 9000, burnAt: 19000, produces: 'fried_potato', requires: 'chopped_potato' },
    ],
    plate: ['fried_potato']
  },
  pasta: {
    name: 'Pasta', emoji: '\u{1F35D}', reward: 60, patience: 90000,
    steps: [
      { action: 'boil', target: 'pasta', station: 'stove', duration: 10000, burnAt: 21000, produces: 'boiled_pasta' },
      { action: 'chop', target: 'tomato', station: 'cutting_board', duration: 7000, produces: 'chopped_tomato' },
      { action: 'grill', target: 'cheese', station: 'grill', duration: 7000, burnAt: 16000, produces: 'melted_cheese' },
    ],
    plate: ['boiled_pasta', 'chopped_tomato', 'melted_cheese']
  },
  salad: {
    name: 'Salad', emoji: '\u{1F957}', reward: 25, patience: 45000,
    steps: [
      { action: 'chop', target: 'lettuce', station: 'cutting_board', duration: 7000, produces: 'chopped_lettuce' },
      { action: 'chop', target: 'tomato', station: 'cutting_board', duration: 7000, produces: 'chopped_tomato' },
    ],
    plate: ['chopped_lettuce', 'chopped_tomato']
  },
  mushroom_soup: {
    name: 'Mushroom Soup', emoji: '\u{1F372}', reward: 35, patience: 50000,
    steps: [
      { action: 'chop', target: 'mushroom', station: 'cutting_board', duration: 7000, produces: 'chopped_mushroom' },
      { action: 'boil', target: 'mushroom', station: 'stove', duration: 10000, burnAt: 20000, produces: 'mushroom_soup', requires: 'chopped_mushroom' },
    ],
    plate: ['mushroom_soup']
  },
  fish_burger: {
    name: 'Fish Burger', emoji: '\u{1F354}', reward: 70, patience: 80000,
    steps: [
      { action: 'fry', target: 'fish', station: 'fryer', duration: 10000, burnAt: 20000, produces: 'fried_fish' },
      { action: 'chop', target: 'lettuce', station: 'cutting_board', duration: 7000, produces: 'chopped_lettuce' },
      { action: 'toast', target: 'bun', station: 'oven', duration: 7000, burnAt: 17000, produces: 'toasted_bun' },
    ],
    plate: ['fried_fish', 'chopped_lettuce', 'toasted_bun']
  }
}

export const STATION_DEFS: Record<string, StationDef> = {
  cutting_board: { name: 'Chopping Board', emoji: '\u{1F52A}', color: '#5aad5e', actions: ['chop'] },
  grill:         { name: 'Grill',         emoji: '\u{1F525}', color: '#e06840', actions: ['grill'] },
  fryer:         { name: 'Fryer',         emoji: '\u{1FAD5}', color: '#e8943a', actions: ['fry'] },
  stove:         { name: 'Stove',         emoji: '\u{2668}\u{FE0F}',  color: '#d94f4f', actions: ['boil'] },
  oven:          { name: 'Oven',          emoji: '\u{1F9F1}', color: '#a07862', actions: ['toast'] },
  plating:       { name: 'Plating',       emoji: '\u{1F37D}\u{FE0F}', color: '#b0a090', actions: ['plate'] },
}

export const INGREDIENT_EMOJI: Record<string, string> = {
  chopped_lettuce: '\u{1F96C}',
  grilled_patty: '\u{1F969}',
  toasted_bun: '\u{1F35E}',
  chopped_potato: '\u{1F954}',
  fried_potato: '\u{1F35F}',
  boiled_pasta: '\u{1F35D}',
  chopped_tomato: '\u{1F345}',
  melted_cheese: '\u{1F9C0}',
  fried_fish: '\u{1F41F}',
  chopped_mushroom: '\u{1F344}',
  mushroom_soup: '\u{1F372}',
}

export const BOT_NAMES = [
  'ChefChat42', 'SoupLord', 'BurgerBoss', 'PastaKing99', 'FryQueen',
  'TacoMaster', 'GrillGod', 'NoodleNinja', 'SaladSam', 'DishDash',
  'FlipperFred', 'CookieMonsta', 'SpicyMike', 'UmamiQueen', 'ChopChop77',
  'WokStar', 'RamenRanger', 'SizzleSis', 'PlateUp_Pro', 'OvenMitt'
]

export const NAME_COLORS = [
  '#e07050', '#e89050', '#d4a840', '#6aaa5e', '#5a9ab0',
  '#b0785a', '#c86080', '#d08838', '#7aaa80', '#aa8870'
]
