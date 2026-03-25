export type SlotState = 'cooking' | 'done'

export interface StationSlot {
  id: string
  user: string
  target: string
  produces: string
  cookStart: number
  cookDuration: number
  burnAt: number
  state: SlotState
}

export interface Station {
  id: string
  slots: StationSlot[]
  onFire: boolean
}

export interface Order {
  id: number
  dish: string
  served: boolean
  patienceMax: number
  patienceLeft: number
  spawnTime: number
}

export interface ChatMessage {
  id: number
  username: string
  text: string
  type: 'normal' | 'system' | 'error' | 'success'
}

export interface PlayerStats {
  cooked: number
  taken: number
  plated: number
  served: number
  moneyEarned: number
  extinguished: number
}

export interface StationCapacity {
  chopping: number    // slots for cutting_board
  cooking: number     // slots per cooking station (grill, fryer, stove, oven)
  plating: number     // slots for plating station
}

export interface GameOptions {
  durationMultiplier: number
  shiftDuration: number
  stationCapacity: StationCapacity
}

export interface GameState {
  money: number
  served: number
  lost: number
  timeLeft: number
  durationMultiplier: number
  stationCapacity: StationCapacity
  stations: Record<string, Station>
  orders: Order[]
  preparedItems: string[]
  platedDishes: string[]
  nextOrderId: number
  userCooldowns: Record<string, number>
  activeUsers: Record<string, string>
  nextSlotId: number
  chatMessages: ChatMessage[]
  nextMessageId: number
  playerStats: Record<string, PlayerStats>
}
