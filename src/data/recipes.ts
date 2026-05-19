export interface RecipeStep {
  action: string
  target: string
  station: string
  duration: number
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

import { RecipeSet } from '../state/types'

export const RECIPES: Record<string, Recipe> = {
  burger: {
    name: 'Burger', emoji: '\u{1F354}', reward: 65, patience: 80000,
    steps: [
      { action: 'chop',  target: 'lettuce', station: 'cutting_board', duration: 7000, produces: 'chopped_lettuce' },
      { action: 'grill', target: 'patty',   station: 'grill',         duration: 9000, produces: 'grilled_patty' },
      { action: 'toast', target: 'bun',     station: 'oven',          duration: 7000, produces: 'toasted_bun' },
    ],
    plate: ['chopped_lettuce', 'grilled_patty', 'toasted_bun']
  },
  fries: {
    name: 'Fries', emoji: '\u{1F35F}', reward: 40, patience: 55000,
    steps: [
      { action: 'chop', target: 'potato', station: 'cutting_board', duration: 7000, produces: 'chopped_potato' },
      { action: 'fry',  target: 'potato', station: 'fryer',         duration: 9000, produces: 'fried_potato', requires: 'chopped_potato' },
    ],
    plate: ['fried_potato']
  },
  pasta: {
    name: 'Hot Dog', emoji: '\u{1F32D}', reward: 45, patience: 55000,
    steps: [
      { action: 'grill', target: 'sausage', station: 'grill',         duration: 8000, produces: 'grilled_sausage' },
      { action: 'chop',  target: 'onion',   station: 'cutting_board', duration: 6000, produces: 'chopped_onion' },
      { action: 'toast', target: 'bun',     station: 'oven',          duration: 7000, produces: 'toasted_bun' },
    ],
    plate: ['grilled_sausage', 'chopped_onion', 'toasted_bun']
  },
  salad: {
    name: 'Caesar Salad', emoji: '\u{1F957}', reward: 35, patience: 50000,
    steps: [
      { action: 'chop',  target: 'lettuce', station: 'cutting_board', duration: 7000, produces: 'chopped_lettuce' },
      { action: 'chop',  target: 'tomato',  station: 'cutting_board', duration: 7000, produces: 'chopped_tomato' },
      { action: 'toast', target: 'crouton', station: 'oven',          duration: 6000, produces: 'toasted_crouton' },
    ],
    plate: ['chopped_lettuce', 'chopped_tomato', 'toasted_crouton']
  },
  mushroom_soup: {
    name: 'Grilled Cheese Sandwich', emoji: '🥪', reward: 40, patience: 55000,
    steps: [
      { action: 'grill', target: 'cheese', station: 'grill', duration: 7000, produces: 'grilled_cheese' },
      { action: 'toast', target: 'bread',  station: 'oven',  duration: 6000, produces: 'toasted_bread' },
    ],
    plate: ['grilled_cheese', 'toasted_bread']
  },
  fish_burger: {
    name: 'Fish & Chips', emoji: '\u{1F41F}', reward: 60, patience: 75000,
    steps: [
      { action: 'fry',  target: 'fish',   station: 'fryer',         duration: 10000, produces: 'fried_fish' },
      { action: 'chop', target: 'potato', station: 'cutting_board', duration: 7000,  produces: 'chopped_potato' },
      { action: 'fry',  target: 'potato', station: 'fryer',         duration: 9000,  produces: 'fried_potato', requires: 'chopped_potato' },
    ],
    plate: ['fried_fish', 'fried_potato']
  },
  roasted_veggies: {
    name: 'Roasted Veggies', emoji: '\u{1FAD1}', reward: 55, patience: 75000,
    steps: [
      { action: 'chop',  target: 'tomato', station: 'cutting_board', duration: 7000,  produces: 'chopped_tomato' },
      { action: 'chop',  target: 'pepper', station: 'cutting_board', duration: 7000,  produces: 'chopped_pepper' },
      { action: 'roast', target: 'pepper', station: 'oven',          duration: 10000, produces: 'roasted_pepper', requires: 'chopped_pepper' },
    ],
    plate: ['roasted_pepper', 'chopped_tomato']
  },

  // ── Chinese Kitchen ───────────────────────────────────────────────────────

  fried_rice: {
    name: 'Fried Rice', emoji: '\u{1F373}', reward: 55, patience: 75000,
    steps: [
      { action: 'cook',    target: 'rice', station: 'rice_pot', duration: 10000, produces: 'cooked_rice' },
      { action: 'stirfry', target: 'egg',  station: 'wok',      duration: 6000,  produces: 'stir_fried_egg' },
      { action: 'stirfry', target: 'rice', station: 'wok',      duration: 8000,  produces: 'stir_fried_rice', requires: 'cooked_rice' },
    ],
    plate: ['stir_fried_rice', 'stir_fried_egg']
  },
  stir_fried_pork: {
    name: 'Stir-Fried Pork', emoji: '\u{1F35B}', reward: 65, patience: 80000,
    steps: [
      { action: 'chop',    target: 'pork',         station: 'cutting_board', duration: 7000, produces: 'sliced_pork' },
      { action: 'chop',    target: 'spring_onion', station: 'cutting_board', duration: 6000, produces: 'sliced_spring_onion' },
      { action: 'stirfry', target: 'pork',         station: 'wok',           duration: 9000, produces: 'stir_fried_pork', requires: 'sliced_pork' },
    ],
    plate: ['stir_fried_pork', 'sliced_spring_onion']
  },
  steamed_tofu: {
    name: 'Steamed Tofu', emoji: '\u{1F9C8}', reward: 45, patience: 65000,
    steps: [
      { action: 'chop',  target: 'tofu',        station: 'cutting_board', duration: 6000, produces: 'sliced_tofu' },
      { action: 'chop',  target: 'spring_onion', station: 'cutting_board', duration: 6000, produces: 'sliced_spring_onion' },
      { action: 'steam', target: 'tofu',         station: 'steamer',       duration: 9000, produces: 'steamed_tofu_block', requires: 'sliced_tofu' },
    ],
    plate: ['steamed_tofu_block', 'sliced_spring_onion']
  },
  steamed_buns: {
    name: 'Steamed Buns', emoji: '\u{1F95F}', reward: 55, patience: 70000,
    steps: [
      { action: 'chop',  target: 'cabbage', station: 'cutting_board', duration: 6000,  produces: 'sliced_cabbage' },
      { action: 'steam', target: 'bun',     station: 'steamer',       duration: 11000, produces: 'steamed_bun' },
    ],
    plate: ['steamed_bun', 'sliced_cabbage']
  },

  // ── Korean Kitchen ────────────────────────────────────────────────────────

  bulgogi: {
    name: 'Bulgogi', emoji: '\u{1F969}', reward: 70, patience: 85000,
    steps: [
      { action: 'chop',  target: 'beef',        station: 'cutting_board', duration: 7000,  produces: 'sliced_beef' },
      { action: 'chop',  target: 'spring_onion', station: 'cutting_board', duration: 6000,  produces: 'sliced_spring_onion' },
      { action: 'grill', target: 'beef',         station: 'grill',         duration: 10000, produces: 'grilled_beef', requires: 'sliced_beef' },
    ],
    plate: ['grilled_beef', 'sliced_spring_onion']
  },
  kimchi_jjigae: {
    name: 'Kimchi Jjigae', emoji: '🥘', reward: 65, patience: 80000,
    steps: [
      { action: 'chop',   target: 'kimchi', station: 'cutting_board', duration: 6000,  produces: 'sliced_kimchi' },
      { action: 'chop',   target: 'tofu',   station: 'cutting_board', duration: 6000,  produces: 'sliced_tofu' },
      { action: 'simmer', target: 'kimchi', station: 'stone_pot',     duration: 11000, produces: 'simmered_kimchi', requires: 'sliced_kimchi' },
    ],
    plate: ['simmered_kimchi', 'sliced_tofu']
  },
  korean_fried_chicken: {
    name: 'Korean Fried Chicken', emoji: '\u{1F357}', reward: 75, patience: 85000,
    steps: [
      { action: 'chop', target: 'chicken',   station: 'cutting_board', duration: 7000,  produces: 'sliced_chicken' },
      { action: 'fry',  target: 'chicken',   station: 'fryer',         duration: 10000, produces: 'fried_chicken', requires: 'sliced_chicken' },
      { action: 'mix',  target: 'gochujang', station: 'mixing_bowl',   duration: 5000,  produces: 'gochujang_sauce' },
    ],
    plate: ['fried_chicken', 'gochujang_sauce']
  },
  tteokbokki: {
    name: 'Tteokbokki', emoji: '\u{1F336}\u{FE0F}', reward: 65, patience: 80000,
    steps: [
      { action: 'chop', target: 'tteok',     station: 'cutting_board', duration: 5000,  produces: 'sliced_tteok' },
      { action: 'mix',  target: 'gochujang', station: 'mixing_bowl',   duration: 5000,  produces: 'gochujang_sauce' },
      { action: 'boil', target: 'tteok',     station: 'stove',         duration: 9000,  produces: 'boiled_tteok', requires: 'sliced_tteok' },
    ],
    plate: ['boiled_tteok', 'gochujang_sauce']
  },

  // ── Japanese Kitchen ──────────────────────────────────────────────────────

  sushi_roll: {
    name: 'Sushi Roll', emoji: '\u{1F363}', reward: 70, patience: 85000,
    steps: [
      { action: 'cook', target: 'rice',   station: 'rice_pot',      duration: 10000, produces: 'cooked_rice' },
      { action: 'chop', target: 'tuna',   station: 'cutting_board', duration: 7000,  produces: 'sliced_tuna' },
      { action: 'toast', target: 'nori',  station: 'oven',          duration: 5000,  produces: 'toasted_nori' },
    ],
    plate: ['cooked_rice', 'sliced_tuna', 'toasted_nori']
  },
  tempura: {
    name: 'Tempura', emoji: '\u{1F364}', reward: 65, patience: 80000,
    steps: [
      { action: 'chop', target: 'shrimp', station: 'cutting_board', duration: 6000, produces: 'sliced_shrimp' },
      { action: 'fry',  target: 'shrimp', station: 'fryer',         duration: 9000, produces: 'fried_shrimp', requires: 'sliced_shrimp' },
    ],
    plate: ['fried_shrimp']
  },
  chawanmushi: {
    name: 'Chawanmushi', emoji: '\u{1F95A}', reward: 55, patience: 70000,
    steps: [
      { action: 'chop',  target: 'egg',    station: 'cutting_board', duration: 5000,  produces: 'sliced_egg' },
      { action: 'steam', target: 'egg',    station: 'steamer',       duration: 10000, produces: 'steamed_egg', requires: 'sliced_egg' },
      { action: 'chop',  target: 'shrimp', station: 'cutting_board', duration: 6000,  produces: 'sliced_shrimp' },
    ],
    plate: ['steamed_egg', 'sliced_shrimp']
  },
  salmon_donburi: {
    name: 'Salmon Donburi', emoji: '\u{1F371}', reward: 75, patience: 90000,
    steps: [
      { action: 'cook', target: 'rice',   station: 'rice_pot',      duration: 10000, produces: 'cooked_rice' },
      { action: 'chop', target: 'salmon', station: 'cutting_board', duration: 7000,  produces: 'sliced_salmon' },
      { action: 'chop', target: 'nori',   station: 'cutting_board', duration: 5000,  produces: 'sliced_nori' },
    ],
    plate: ['cooked_rice', 'sliced_salmon', 'sliced_nori']
  },

  // ── Japanese Bakery ───────────────────────────────────────────────────────

  shio_pan: {
    name: 'Shio Pan', emoji: '\u{1F950}', reward: 50, patience: 65000,
    steps: [
      { action: 'knead', target: 'dough', station: 'knead_board', duration: 7000, produces: 'kneaded_dough' },
      { action: 'toast', target: 'dough', station: 'oven',        duration: 9000, produces: 'toasted_dough', requires: 'kneaded_dough' },
    ],
    plate: ['toasted_dough']
  },
  melon_pan: {
    name: 'Melon Pan', emoji: '\u{1F36A}', reward: 65, patience: 75000,
    steps: [
      { action: 'knead', target: 'dough',    station: 'knead_board', duration: 7000,  produces: 'kneaded_dough' },
      { action: 'mix',   target: 'topping',  station: 'mixing_bowl', duration: 6000,  produces: 'mixed_topping' },
      { action: 'toast', target: 'dough',    station: 'oven',        duration: 10000, produces: 'toasted_dough', requires: 'kneaded_dough' },
    ],
    plate: ['toasted_dough', 'mixed_topping']
  },
  pour_over_coffee: {
    name: 'Pour-Over Coffee', emoji: '\u{2615}', reward: 45, patience: 55000,
    steps: [
      { action: 'grind', target: 'beans', station: 'grinder', duration: 5000, produces: 'ground_coffee' },
      { action: 'boil',  target: 'water', station: 'stove',   duration: 6000, produces: 'hot_water' },
    ],
    plate: ['ground_coffee', 'hot_water']
  },
  matcha_latte: {
    name: 'Matcha Latte', emoji: '\u{1F375}', reward: 55, patience: 60000,
    steps: [
      { action: 'mix',   target: 'matcha', station: 'mixing_bowl', duration: 6000, produces: 'matcha_mix' },
      { action: 'steam', target: 'milk',   station: 'steamer',     duration: 6000, produces: 'steamed_milk' },
    ],
    plate: ['matcha_mix', 'steamed_milk']
  },

  // ── Singapore Hawker Breakfast ────────────────────────────────────────────

  kaya_toast: {
    name: 'Kaya Toast', emoji: '\u{1F35E}', reward: 40, patience: 55000,
    steps: [
      { action: 'toast', target: 'bread', station: 'oven',         duration: 5000, produces: 'toasted_bread' },
      { action: 'mix',   target: 'kaya',  station: 'mixing_bowl',  duration: 5000, produces: 'kaya_spread' },
    ],
    plate: ['toasted_bread', 'kaya_spread']
  },
  economic_bee_hoon: {
    name: 'Economic Bee Hoon', emoji: '\u{1F35C}', reward: 65, patience: 80000,
    steps: [
      { action: 'fry',    target: 'chicken_wing', station: 'fryer', duration: 7000, produces: 'fried_chicken_wing' },
      { action: 'stirfry', target: 'bee_hoon',    station: 'wok',   duration: 9000, produces: 'fried_bee_hoon' },
      { action: 'stirfry', target: 'cabbage',     station: 'wok',   duration: 6000, produces: 'stir_fried_cabbage' },
      { action: 'fry',    target: 'egg',          station: 'fryer', duration: 5000, produces: 'fried_egg' },
    ],
    plate: ['fried_chicken_wing', 'fried_bee_hoon', 'stir_fried_cabbage', 'fried_egg']
  },
  roti_prata: {
    name: 'Roti Prata', emoji: '\u{1FAD3}', reward: 55, patience: 70000,
    steps: [
      { action: 'knead', target: 'prata', station: 'knead_board', duration: 7000, produces: 'kneaded_prata' },
      { action: 'grill', target: 'prata', station: 'grill',       duration: 8000, produces: 'roti_prata', requires: 'kneaded_prata' },
      { action: 'boil',  target: 'curry', station: 'stove',       duration: 5000, produces: 'curry_dip' },
    ],
    plate: ['roti_prata', 'curry_dip']
  },
  nasi_lemak: {
    name: 'Nasi Lemak', emoji: '\u{1F371}', reward: 75, patience: 85000,
    steps: [
      { action: 'cook', target: 'rice',      station: 'rice_pot',    duration: 9000, produces: 'cooked_rice' },
      { action: 'mix',  target: 'sambal',    station: 'mixing_bowl', duration: 6000, produces: 'sambal_paste' },
      { action: 'fry',  target: 'anchovies', station: 'fryer',       duration: 6000, produces: 'fried_anchovies' },
      { action: 'fry',  target: 'egg',       station: 'fryer',       duration: 5000, produces: 'fried_egg' },
    ],
    plate: ['cooked_rice', 'sambal_paste', 'fried_anchovies', 'fried_egg']
  },
}

export const STATION_DEFS: Record<string, StationDef> = {
  cutting_board: { name: 'Chopping Board', emoji: '\u{1F52A}', color: '#5aad5e', actions: ['chop'] },
  grill:         { name: 'Grill',         emoji: '\u{1F525}', color: '#e06840', actions: ['grill'] },
  fryer:         { name: 'Fryer',         emoji: '\u{1FAD5}', color: '#e8943a', actions: ['fry'] },
  stove:         { name: 'Stove',         emoji: '\u{2668}\u{FE0F}',  color: '#d94f4f', actions: ['boil'] },
  oven:          { name: 'Oven',          emoji: '\u{1F9F1}', color: '#a07862', actions: ['toast', 'roast'] },
  wok:           { name: 'Wok',           emoji: '🍳', color: '#c85a20', actions: ['stirfry'] },
  steamer:       { name: 'Steamer',       emoji: '\u{1FAD5}', color: '#5a9ab0', actions: ['steam'] },
  stone_pot:     { name: 'Stone Pot',     emoji: '\u{1F372}', color: '#7a5a3a', actions: ['simmer'] },
  rice_pot:      { name: 'Rice Pot',      emoji: '\u{1F35A}', color: '#a08060', actions: ['cook'] },
  mixing_bowl:   { name: 'Mixing Bowl',   emoji: '\u{1F963}', color: '#c08060', actions: ['mix'] },
  grinder:       { name: 'Grinder',       emoji: '\u{2615}',  color: '#6b4f3a', actions: ['grind'] },
  knead_board:   { name: 'Knead Board',   emoji: '\u{1FAD3}', color: '#d4a860', actions: ['knead'] },
}

export const HEAT_EXEMPT_STATIONS = new Set([
  'cutting_board', 'mixing_bowl', 'grinder', 'knead_board',
])

export function getEnabledStations(enabledRecipes: string[]): string[] {
  const needed = new Set<string>()
  for (const key of enabledRecipes) {
    const recipe = RECIPES[key]
    if (recipe) {
      for (const step of recipe.steps) {
        needed.add(step.station)
      }
    }
  }
  return Object.keys(STATION_DEFS).filter(id => needed.has(id))
}

export const INGREDIENT_EMOJI: Record<string, string> = {
  // Western Classics
  chopped_lettuce:     '\u{1F96C}',
  grilled_patty:       '\u{1F969}',
  toasted_bun:         '\u{1F35E}',
  chopped_potato:      '\u{1F954}',
  fried_potato:        '\u{1F35F}',
  grilled_sausage:     '\u{1F32D}',
  chopped_onion:       '\u{1F9C5}',
  chopped_tomato:      '\u{1F345}',
  toasted_crouton:     '\u{1FAD3}',
  grilled_cheese:      '\u{1F9C0}',
  toasted_bread:       '\u{1F35E}',
  fried_fish:          '\u{1F41F}',
  chopped_pepper:      '\u{1FAD1}',
  roasted_pepper:      '\u{1F336}\u{FE0F}',

  // Shared across cuisines
  cooked_rice:         '\u{1F35A}',
  sliced_spring_onion: '\u{1F33F}',
  sliced_tofu:         '\u{1F9C8}',
  sliced_zucchini:     '\u{1FAD1}',
  sliced_beef:         '\u{1F969}',
  sliced_shrimp:       '\u{1F990}',

  // Chinese
  stir_fried_rice:     '\u{1F373}',
  stir_fried_egg:      '\u{1F373}',
  sliced_pork:         '\u{1F969}',
  sliced_cabbage:      '\u{1F96C}',
  stir_fried_pork:            '🍖',
  steamed_tofu_block:  '\u{1F9C8}',
  steamed_bun:         '\u{1F95F}',

  // Korean
  grilled_beef:        '\u{1F969}',
  sliced_kimchi:       '\u{1F336}\u{FE0F}',
  simmered_kimchi:     '\u{1F372}',
  sliced_chicken:      '\u{1F357}',
  fried_chicken:       '\u{1F357}',
  gochujang_sauce:     '\u{1F336}\u{FE0F}',
  sliced_tteok:        '\u{1F361}',
  boiled_tteok:        '\u{1F362}',

  // Japanese
  sliced_tuna:         '\u{1F41F}',
  sliced_salmon:       '\u{1F421}',
  sliced_nori:         '\u{1F33F}',
  toasted_nori:        '\u{1F33F}',
  fried_shrimp:        '\u{1F364}',
  sliced_egg:          '\u{1F95A}',
  steamed_egg:         '\u{1F95A}',

  // Japanese Bakery
  kneaded_dough:       '\u{1FAD3}',
  toasted_dough:       '\u{1F950}',
  mixed_topping:       '\u{1F36A}',
  ground_coffee:       '\u{1FAD8}',
  hot_water:           '\u{1FAD7}',
  matcha_mix:          '\u{1F375}',
  steamed_milk:        '\u{1F95B}',

  // Singapore Hawker Breakfast
  kaya_spread:             '\u{1F36F}',
  fried_bee_hoon:          '\u{1F35C}',
  stir_fried_cabbage:      '\u{1F96C}',
  fried_egg:               '\u{1F373}',
  chicken_wing:            '\u{1F357}',
  fried_chicken_wing:      '\u{1F357}',
  kneaded_prata:           '\u{1FAD3}',
  roti_prata:              '\u{1FAD3}',
  curry_dip:               '\u{1F35B}',
  sambal_paste:            '\u{1F336}\u{FE0F}',
  fried_anchovies:         '\u{1F41F}',
}

export const RECIPE_SETS: RecipeSet[] = [
  {
    id: 'western_classics',
    name: 'Western Classics',
    emoji: '\u{1F354}',
    flag: '\u{1F1FA}\u{1F1F8}',
    description: 'Burgers, fries, pasta and grilled favourites',
    cuisine: 'Western',
    recipeKeys: ['burger', 'fish_burger', 'salad', 'roasted_veggies'],
  },
  {
    id: 'chinese',
    name: 'Chinese Kitchen',
    emoji: '\u{1F962}',
    flag: '\u{1F1E8}\u{1F1F3}',
    description: 'Wok-fired dishes, steamed delicacies and fragrant rice',
    cuisine: 'Chinese',
    recipeKeys: ['fried_rice', 'stir_fried_pork', 'steamed_tofu', 'steamed_buns'],
  },
  {
    id: 'korean',
    name: 'Korean Kitchen',
    emoji: '\u{1F372}',
    flag: '\u{1F1F0}\u{1F1F7}',
    description: 'Grilled meats, spicy stews and hearty rice bowls',
    cuisine: 'Korean',
    recipeKeys: ['bulgogi', 'kimchi_jjigae', 'korean_fried_chicken', 'tteokbokki'],
  },
  {
    id: 'japanese',
    name: 'Japanese Kitchen',
    emoji: '\u{1F363}',
    flag: '\u{1F1EF}\u{1F1F5}',
    description: 'Fresh sushi, crispy tempura and delicate steamed dishes',
    cuisine: 'Japanese',
    recipeKeys: ['sushi_roll', 'tempura', 'chawanmushi', 'salmon_donburi'],
  },
  {
    id: 'japanese_bakery',
    name: 'Japanese Bakery',
    emoji: '\u{1F35E}',
    flag: '\u{1F1EF}\u{1F1F5}',
    description: 'Freshly baked goods and artisan drinks from a cozy Japanese bakery',
    cuisine: 'Japanese',
    recipeKeys: ['shio_pan', 'melon_pan', 'pour_over_coffee', 'matcha_latte'],
  },
  {
    id: 'sg_hawker',
    name: 'SG Hawker Breakfast',
    emoji: '\u{1F35C}',
    flag: '\u{1F1F8}\u{1F1EC}',
    description: 'Kopi-shop classics and hawker favourites from a Singapore breakfast stall',
    cuisine: 'Singaporean',
    recipeKeys: ['kaya_toast', 'economic_bee_hoon', 'roti_prata', 'nasi_lemak'],
  },
]

export const BOT_NAMES = [
  'ChefChat42', 'SoupLord', 'BurgerBoss', 'PastaKing99', 'FryQueen',
  'TacoMaster', 'GrillGod', 'NoodleNinja', 'SaladSam', 'DishDash',
  'FlipperFred', 'CookieMonsta', 'SpicyMike', 'UmamiQueen', 'ChopChop77',
  'WokStar', 'RamenRanger', 'SizzleSis', 'PlateUp_Pro', 'OvenMitt'
]

export function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return h
}

export const NAME_COLORS = [
  '#e07050', '#e89050', '#d4a840', '#6aaa5e', '#5a9ab0',
  '#b0785a', '#c86080', '#d08838', '#7aaa80', '#aa8870'
]
