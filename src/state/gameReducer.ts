import { GameState, Station, Order, ChatMessage, StationSlot, PlayerStats, StationCapacity } from './types'
import { RECIPES, STATION_DEFS } from '../data/recipes'

export type GameAction =
  | { type: 'TICK'; delta: number; now: number }
  | { type: 'COOK'; user: string; action: string; target: string; now: number }
  | { type: 'TAKE'; user: string; stationId: string }
  | { type: 'PLATE'; user: string; dishKey: string; now: number }
  | { type: 'SERVE'; user: string; orderId: number }
  | { type: 'EXTINGUISH'; user: string }
  | { type: 'SPAWN_ORDER'; now: number }
  | { type: 'ADD_CHAT'; username: string; text: string; msgType: ChatMessage['type'] }
  | { type: 'RESET'; shiftDuration: number; durationMultiplier: number; stationCapacity: StationCapacity }

export function createInitialState(
  shiftDuration = 120000,
  durationMultiplier = 1,
  stationCapacity: StationCapacity = { chopping: 3, cooking: 2, plating: 2 }
): GameState {
  const stations: Record<string, Station> = {}
  for (const id of Object.keys(STATION_DEFS)) {
    stations[id] = { id, slots: [], onFire: false }
  }

  return {
    money: 0,
    served: 0,
    lost: 0,
    timeLeft: shiftDuration,
    durationMultiplier,
    stationCapacity,
    stations,
    orders: [],
    preparedItems: [],
    platedDishes: [],
    nextOrderId: 1,
    userCooldowns: {},
    activeUsers: {},
    nextSlotId: 1,
    chatMessages: [],
    nextMessageId: 1,
    playerStats: {},
  }
}

function addMsg(state: GameState, username: string, text: string, msgType: ChatMessage['type'] = 'normal'): GameState {
  const msg: ChatMessage = { id: state.nextMessageId, username, text, type: msgType }
  const messages = [...state.chatMessages, msg].slice(-200)
  return { ...state, chatMessages: messages, nextMessageId: state.nextMessageId + 1 }
}

const EMPTY_STATS: PlayerStats = { cooked: 0, taken: 0, plated: 0, served: 0, moneyEarned: 0, extinguished: 0 }

function addStat(state: GameState, user: string, stat: keyof PlayerStats, amount: number): GameState {
  const prev = state.playerStats[user] || { ...EMPTY_STATS }
  return { ...state, playerStats: { ...state.playerStats, [user]: { ...prev, [stat]: prev[stat] + amount } } }
}

function getStationCapacity(stationId: string, capacity: StationCapacity): number {
  if (stationId === 'cutting_board') return capacity.chopping
  if (stationId === 'plating') return capacity.plating
  return capacity.cooking
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'RESET':
      return createInitialState(action.shiftDuration, action.durationMultiplier, action.stationCapacity)

    case 'ADD_CHAT':
      return addMsg(state, action.username, action.text, action.msgType)

    case 'EXTINGUISH': {
      const anyFire = Object.values(state.stations).some(s => s.onFire)
      if (!anyFire) return addMsg(state, 'KITCHEN', 'No fire to extinguish!', 'error')
      const newStations = { ...state.stations }
      const newActiveUsers = { ...state.activeUsers }
      for (const [id, station] of Object.entries(newStations)) {
        if (station.onFire) {
          // Remove all users from this station's slots
          for (const slot of station.slots) {
            delete newActiveUsers[slot.user]
          }
          newStations[id] = { ...station, slots: [], onFire: false }
        }
      }
      const withStat = addStat({ ...state, stations: newStations, activeUsers: newActiveUsers }, action.user, 'extinguished', 1)
      return addMsg(withStat, 'KITCHEN', `${action.user} put out the fire!`, 'success')
    }

    case 'TAKE': {
      const { stationId, user } = action
      const station = state.stations[stationId]
      if (!station) return addMsg(state, 'KITCHEN', 'Unknown station!', 'error')

      // Find user's own done slot first, then any done slot
      let slotIdx = station.slots.findIndex(s => s.state === 'done' && s.user === user)
      if (slotIdx === -1) slotIdx = station.slots.findIndex(s => s.state === 'done')
      if (slotIdx === -1) return addMsg(state, 'KITCHEN', 'Nothing ready to take there!', 'error')

      const slot = station.slots[slotIdx]
      const newSlots = station.slots.filter((_, i) => i !== slotIdx)
      const newStations = { ...state.stations, [stationId]: { ...station, slots: newSlots } }

      // Only free the slot's user if they have no remaining cooking slots anywhere
      const newActiveUsers = { ...state.activeUsers }
      const stillCooking = Object.values(newStations).some(
        s => s.slots.some(sl => sl.user === slot.user && sl.state === 'cooking')
      )
      if (!stillCooking) {
        delete newActiveUsers[slot.user]
      }

      const withStat = addStat(state, user, 'taken', 1)
      return addMsg(
        {
          ...withStat,
          preparedItems: [...withStat.preparedItems, slot.produces],
          stations: newStations,
          activeUsers: newActiveUsers,
        },
        'KITCHEN', `${user} took ${slot.produces.replace(/_/g, ' ')}!`, 'success'
      )
    }

    case 'PLATE': {
      const { dishKey, user, now } = action
      const recipe = RECIPES[dishKey]
      if (!recipe) return addMsg(state, 'KITCHEN', `Unknown dish: ${dishKey}`, 'error')

      // Cooldown check
      if (state.userCooldowns[user] && now - state.userCooldowns[user] < 1500) return state
      const withCooldown = { ...state, userCooldowns: { ...state.userCooldowns, [user]: now } }

      // Per-user busy check
      const alreadyBusy = withCooldown.activeUsers[user] || Object.values(withCooldown.stations).some(
        s => s.slots.some(slot => slot.state === 'cooking' && slot.user === user)
      )
      if (alreadyBusy) {
        return addMsg(withCooldown, 'KITCHEN', `${user} is already busy!`, 'error')
      }

      // Plating station capacity check
      const platingStation = withCooldown.stations['plating']
      const maxSlots = getStationCapacity('plating', state.stationCapacity)
      if (platingStation.slots.length >= maxSlots) {
        return addMsg(withCooldown, 'KITCHEN', 'Plating station is full! Try again later.', 'error')
      }

      // Check ingredients
      const needed = [...recipe.plate]
      const available = [...withCooldown.preparedItems]
      for (const item of needed) {
        const idx = available.indexOf(item)
        if (idx === -1) return addMsg(withCooldown, 'KITCHEN', `Missing ${item.replace(/_/g, ' ')} for ${recipe.name}!`, 'error')
        available.splice(idx, 1)
      }

      // Plating takes 3 seconds (scaled by speed multiplier)
      const plateDuration = 3000 / state.durationMultiplier

      const newSlot: StationSlot = {
        id: `slot_${withCooldown.nextSlotId}`,
        user,
        target: dishKey,
        produces: dishKey,
        cookStart: now,
        cookDuration: plateDuration,
        burnAt: Infinity,
        state: 'cooking',
      }

      const withStat = addStat(withCooldown, user, 'plated', 1)
      return addMsg(
        {
          ...withStat,
          preparedItems: available,
          stations: {
            ...withStat.stations,
            plating: { ...platingStation, slots: [...platingStation.slots, newSlot] },
          },
          activeUsers: { ...withStat.activeUsers, [user]: 'plating' },
          nextSlotId: withStat.nextSlotId + 1,
        },
        'KITCHEN', `${user} started plating ${recipe.emoji} ${recipe.name}!`, 'success'
      )
    }

    case 'SERVE': {
      const { user, orderId } = action
      const orderIdx = state.orders.findIndex(o => o.id === orderId && !o.served)
      if (orderIdx === -1) return addMsg(state, 'KITCHEN', `No pending order #${orderId}!`, 'error')

      const order = state.orders[orderIdx]
      const dishIdx = state.platedDishes.indexOf(order.dish)
      if (dishIdx === -1) return addMsg(state, 'KITCHEN', `No plated ${RECIPES[order.dish].name} ready!`, 'error')

      const newPlated = [...state.platedDishes]
      newPlated.splice(dishIdx, 1)
      const newOrders = state.orders.map((o, i) => i === orderIdx ? { ...o, served: true } : o)
      const timeBonus = Math.max(0, Math.floor((order.patienceLeft / order.patienceMax) * 30))
      const reward = RECIPES[order.dish].reward + timeBonus

      let withStats = addStat(state, user, 'served', 1)
      withStats = addStat(withStats, user, 'moneyEarned', reward)
      return addMsg(
        { ...withStats, platedDishes: newPlated, orders: newOrders, money: withStats.money + reward, served: withStats.served + 1 },
        'KITCHEN', `${user} served ${RECIPES[order.dish].emoji} ${RECIPES[order.dish].name}! +$${reward}`, 'success'
      )
    }

    case 'COOK': {
      const { user, action: cookAction, target, now } = action

      // Cooldown check
      if (state.userCooldowns[user] && now - state.userCooldowns[user] < 1500) return state
      const withCooldown = { ...state, userCooldowns: { ...state.userCooldowns, [user]: now } }

      // Per-user busy check (belt-and-suspenders: also scan station slots in case activeUsers is stale)
      const alreadyCooking = withCooldown.activeUsers[user] || Object.values(withCooldown.stations).some(
        s => s.slots.some(slot => slot.state === 'cooking' && slot.user === user)
      )
      if (alreadyCooking) {
        return addMsg(withCooldown, 'KITCHEN', `${user} is already busy!`, 'error')
      }

      const stationEntry = Object.entries(STATION_DEFS).find(([, def]) => def.actions.includes(cookAction))
      if (!stationEntry) return withCooldown

      const [stationId] = stationEntry
      const station = withCooldown.stations[stationId]

      if (station.onFire) return addMsg(withCooldown, 'KITCHEN', `The ${STATION_DEFS[stationId].name} is on fire! Type !extinguish first!`, 'error')

      // Station capacity check
      const maxSlots = getStationCapacity(stationId, state.stationCapacity)
      if (station.slots.length >= maxSlots) {
        return addMsg(withCooldown, 'KITCHEN', `The ${STATION_DEFS[stationId].name} is full! Try again later.`, 'error')
      }

      let matchedStep = null
      for (const recipe of Object.values(RECIPES)) {
        for (const step of recipe.steps) {
          if (step.action === cookAction && step.target === target) { matchedStep = step; break }
        }
        if (matchedStep) break
      }
      if (!matchedStep) return addMsg(withCooldown, 'KITCHEN', `Can't ${cookAction} ${(target || '').replace(/_/g, ' ')} there!`, 'error')

      const speed = state.durationMultiplier
      const newSlot: StationSlot = {
        id: `slot_${withCooldown.nextSlotId}`,
        user,
        target: matchedStep.target,
        produces: matchedStep.produces,
        cookStart: now,
        cookDuration: matchedStep.duration / speed,
        burnAt: matchedStep.burnAt ? matchedStep.burnAt / speed : Infinity,
        state: 'cooking',
      }

      const PAST_TENSE: Record<string, string> = { chop: 'chopped', grill: 'grilled', fry: 'fried', boil: 'boiled', toast: 'toasted' }

      if (matchedStep.duration === 0) {
        const withStat = addStat(withCooldown, user, 'cooked', 1)
        return addMsg(
          { ...withStat, preparedItems: [...withStat.preparedItems, matchedStep.produces] },
          'KITCHEN', `${user} ${PAST_TENSE[cookAction] || cookAction + 'ed'} ${target.replace(/_/g, ' ')}!`, 'success'
        )
      }

      const withStat = addStat(withCooldown, user, 'cooked', 1)
      return addMsg(
        {
          ...withStat,
          stations: {
            ...withStat.stations,
            [stationId]: { ...station, slots: [...station.slots, newSlot] }
          },
          activeUsers: { ...withStat.activeUsers, [user]: stationId },
          nextSlotId: withStat.nextSlotId + 1,
        },
        'KITCHEN', `${user} started ${cookAction}ing ${target.replace(/_/g, ' ')}!`, 'success'
      )
    }

    case 'SPAWN_ORDER': {
      const activeOrders = state.orders.filter(o => !o.served).length
      if (activeOrders >= 5) return state

      const dishKeys = Object.keys(RECIPES)
      const dish = dishKeys[Math.floor(Math.random() * dishKeys.length)]
      const recipe = RECIPES[dish]

      const scaledPatience = recipe.patience / state.durationMultiplier
      const order: Order = {
        id: state.nextOrderId,
        dish,
        served: false,
        patienceMax: scaledPatience,
        patienceLeft: scaledPatience,
        spawnTime: action.now,
      }
      return addMsg(
        { ...state, orders: [...state.orders, order], nextOrderId: state.nextOrderId + 1 },
        'CUSTOMER', `Order #${order.id}: ${recipe.emoji} ${recipe.name}!`, 'system'
      )
    }

    case 'TICK': {
      const { delta, now } = action
      const newStations = { ...state.stations }
      const newActiveUsers = { ...state.activeUsers }
      let messages = [...state.chatMessages]
      let nextMsgId = state.nextMessageId
      let platedDishes = [...state.platedDishes]

      // Update all station slots
      for (const [id, station] of Object.entries(newStations)) {
        if (station.slots.length === 0) continue

        let slotsChanged = false
        let fireStarted = false
        const updatedSlots: StationSlot[] = []

        for (const slot of station.slots) {
          const elapsed = now - slot.cookStart

          if (slot.state === 'cooking' && elapsed >= slot.cookDuration) {
            if (id === 'plating') {
              // Auto-complete: plating doesn't need !take
              delete newActiveUsers[slot.user]
              slotsChanged = true
              const recipe = RECIPES[slot.produces]
              platedDishes.push(slot.produces)
              messages.push({ id: nextMsgId++, username: 'KITCHEN', text: `${slot.user} finished plating ${recipe?.emoji || ''} ${recipe?.name || slot.produces}!`, type: 'success' })
            } else {
              updatedSlots.push({ ...slot, state: 'done' })
              delete newActiveUsers[slot.user]
              slotsChanged = true
            }
          } else if ((slot.state === 'cooking' || slot.state === 'done') && slot.burnAt > 0 && slot.burnAt < Infinity && elapsed >= slot.burnAt) {
            // This slot caught fire — don't add it to updatedSlots (destroyed)
            fireStarted = true
            slotsChanged = true
            delete newActiveUsers[slot.user]
            messages.push({ id: nextMsgId++, username: 'KITCHEN', text: `THE ${STATION_DEFS[id].name.toUpperCase()} IS ON FIRE! Type !extinguish!`, type: 'system' })
          } else {
            updatedSlots.push(slot)
          }
        }

        if (fireStarted) {
          // Fire destroys ALL slots on this station
          for (const slot of updatedSlots) {
            delete newActiveUsers[slot.user]
          }
          newStations[id] = { ...station, slots: [], onFire: true }
          slotsChanged = true
        } else if (slotsChanged) {
          newStations[id] = { ...station, slots: updatedSlots }
        }
      }

      // Update order patience + expire
      let orders = [...state.orders]
      let lost = state.lost
      orders = orders.map(order => {
        if (order.served) return order
        const newPatience = order.patienceLeft - delta
        if (newPatience <= 0) {
          lost++
          messages.push({ id: nextMsgId++, username: 'CUSTOMER', text: `Order #${order.id} expired! Lost a ${RECIPES[order.dish].emoji}!`, type: 'error' })
          return { ...order, served: true, patienceLeft: 0 }
        }
        return { ...order, patienceLeft: newPatience }
      })

      // Clean up old served orders
      orders = orders.filter(o => !o.served || (now - o.spawnTime < 2000))

      // Timer countdown
      const timeLeft = Math.max(0, state.timeLeft - delta)

      return { ...state, stations: newStations, activeUsers: newActiveUsers, orders, lost, timeLeft, platedDishes, chatMessages: messages.slice(-200), nextMessageId: nextMsgId }
    }

    default:
      return state
  }
}
