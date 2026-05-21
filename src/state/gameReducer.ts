import { GameState, Station, Order, ChatMessage, StationSlot, PlayerStats } from './types'
import { RECIPES, STATION_DEFS, HEAT_EXEMPT_STATIONS } from '../data/recipes'
import { pickMiseEnPlaceIngredients } from '../data/adventureGarnishes'

export const HEAT_PER_COOK = 20   // kept for reference; actual value is random 10–20 per slot
export const COOL_AMOUNT   = 50   // midpoint reference only — actual value rolled randomly 40–60 on each use

export type GameAction =
  | { type: 'TICK'; delta: number; now: number }
  | { type: 'COOK'; user: string; action: string; target: string; now: number }
  | { type: 'SERVE'; user: string; orderId: number }
  | { type: 'EXTINGUISH'; user: string; stationId: string }
  | { type: 'COOL'; user: string; stationId: string }
  | { type: 'SPAWN_ORDER'; now: number }
  | { type: 'ADD_CHAT'; username: string; text: string; msgType: ChatMessage['type'] }
  | {
      type: 'RESET'
      shiftDuration: number
      cookingSpeed: number
      orderSpeed: number
      orderSpawnRate: number
      enabledRecipes: string[]
      teams?: Record<string, 'red' | 'blue'>
      participantCount?: number
      // Adventure-mode garnish/debuff knobs (optional; left undefined = default)
      heatPerCookMultiplier?: number
      coolAmountBonus?: number
      flatTipPerOrder?: number
      freeExtinguishes?: number
      recipePriceModifier?: Record<string, number>
      eventThresholdMultiplier?: number
      bossMoneyMultiplier?: number
      cooldownMultiplier?: number
      disabledStations?: string[]
      activeGarnishes?: string[]
    }
  | { type: 'SET_STATION_HEAT'; stationId: string; heat: number }
  | { type: 'OVERHEAT_STATION'; stationId: string }
  | { type: 'REMOVE_PREPARED_ITEMS'; count: number; message?: string }
  | { type: 'SET_COOKING_SPEED_MODIFIER'; multiplier: number; expiresAt: number }
  | { type: 'DISABLE_STATIONS'; stationIds: string[] }
  | { type: 'ENABLE_STATIONS'; stationIds: string[] }
  | { type: 'ADD_MONEY_MULTIPLIER'; multiplier: number; expiresAt: number }
  | { type: 'ADD_PREPARED_ITEMS'; items: string[]; message?: string }
  | { type: 'EXTEND_ORDER_PATIENCE'; ms: number }
  | { type: 'RECORD_EVENT_PARTICIPATION'; user: string }

export function createInitialState(
  shiftDuration = 120000,
  cookingSpeed = 1,
  orderSpeed = 1,
  orderSpawnRate = 1,
  enabledRecipes: string[] = Object.keys(RECIPES),
  teams: Record<string, 'red' | 'blue'> = {},
  participantCount = 0
): GameState {
  const stations: Record<string, Station> = {}
  for (const id of Object.keys(STATION_DEFS)) {
    stations[id] = { id, slots: [], heat: 0, overheated: false, extinguishVotes: [] }
  }

  const pvp = Object.keys(teams).length > 0
  return {
    money: 0,
    served: 0,
    lost: 0,
    timeLeft: shiftDuration,
    cookingSpeed,
    orderSpeed,
    orderSpawnRate,
    enabledRecipes,
    stations,
    orders: [],
    preparedItems: [],
    preparedItemSources: [],
    nextOrderId: 1,
    userCooldowns: {},
    activeUsers: {},
    nextSlotId: 1,
    chatMessages: [],
    nextMessageId: 1,
    playerStats: {},
    participantCount,
    disabledStations: undefined,
    cookingSpeedModifier: undefined,
    moneyMultiplier: undefined,
    teams: pvp ? teams : undefined,
    redPreparedItems: pvp ? [] : undefined,
    bluePreparedItems: pvp ? [] : undefined,
    redPreparedItemSources: pvp ? [] : undefined,
    bluePreparedItemSources: pvp ? [] : undefined,
    redMoney: pvp ? 0 : undefined,
    blueMoney: pvp ? 0 : undefined,
    redServed: pvp ? 0 : undefined,
    blueServed: pvp ? 0 : undefined,
  }
}

function addMsg(state: GameState, username: string, text: string, msgType: ChatMessage['type'] = 'normal'): GameState {
  const msg: ChatMessage = { id: state.nextMessageId, username, text, type: msgType }
  const messages = [...state.chatMessages, msg].slice(-200)
  return { ...state, chatMessages: messages, nextMessageId: state.nextMessageId + 1 }
}

const EMPTY_STATS: PlayerStats = { cooked: 0, served: 0, moneyEarned: 0, extinguished: 0, firesCaused: 0, cooled: 0, eventParticipations: 0, bonusPoints: 0 }

function addStat(state: GameState, user: string, stat: keyof PlayerStats, amount: number): GameState {
  const prev = state.playerStats[user] || { ...EMPTY_STATS }
  return { ...state, playerStats: { ...state.playerStats, [user]: { ...prev, [stat]: prev[stat] + amount } } }
}

const PAST_TENSE: Record<string, string> = {
  chop: 'chopped', grill: 'grilled', fry: 'fried', boil: 'boiled', toast: 'toasted',
  roast: 'roasted', stirfry: 'stir-fried', steam: 'steamed', simmer: 'simmered',
  cook: 'cooked', mix: 'mixed', grind: 'ground', knead: 'kneaded',
}

function isUserBusy(state: GameState, user: string): boolean {
  return Boolean(state.activeUsers[user]) || Object.values(state.stations).some(
    station => station.slots.some(slot => slot.state === 'cooking' && slot.user === user)
  )
}

function teamPrepItems(state: GameState, user: string): string[] {
  if (!state.teams) return state.preparedItems
  const team = state.teams[user]
  if (team === 'red') return state.redPreparedItems ?? []
  if (team === 'blue') return state.bluePreparedItems ?? []
  return []
}

function setTeamPrepItems(state: GameState, user: string, items: string[]): GameState {
  if (!state.teams) return { ...state, preparedItems: items }
  const team = state.teams[user]
  if (team === 'red') return { ...state, redPreparedItems: items }
  if (team === 'blue') return { ...state, bluePreparedItems: items }
  return state
}

function teamPrepSources(state: GameState, user: string): string[] {
  if (!state.teams) return state.preparedItemSources
  const team = state.teams[user]
  if (team === 'red') return state.redPreparedItemSources ?? []
  if (team === 'blue') return state.bluePreparedItemSources ?? []
  return []
}

function setTeamPrepSources(state: GameState, user: string, sources: string[]): GameState {
  if (!state.teams) return { ...state, preparedItemSources: sources }
  const team = state.teams[user]
  if (team === 'red') return { ...state, redPreparedItemSources: sources }
  if (team === 'blue') return { ...state, bluePreparedItemSources: sources }
  return state
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'RESET': {
      const base = createInitialState(action.shiftDuration, action.cookingSpeed, action.orderSpeed, action.orderSpawnRate, action.enabledRecipes, action.teams ?? {}, action.participantCount ?? 0)
      const active = action.activeGarnishes ?? []

      // Mise en Place: seed 5 random prepped ingredients from the enabled recipes.
      let preparedItems = base.preparedItems
      let preparedItemSources = base.preparedItemSources
      if (active.includes('mise_en_place')) {
        const seeded = pickMiseEnPlaceIngredients(action.enabledRecipes, RECIPES, 5)
        preparedItems = [...preparedItems, ...seeded]
        preparedItemSources = [...preparedItemSources, ...seeded.map(() => '')]
      }

      return {
        ...base,
        preparedItems,
        preparedItemSources,
        heatPerCookMultiplier: action.heatPerCookMultiplier,
        coolAmountBonus: action.coolAmountBonus,
        flatTipPerOrder: action.flatTipPerOrder,
        freeExtinguishes: action.freeExtinguishes,
        recipePriceModifier: action.recipePriceModifier,
        eventThresholdMultiplier: action.eventThresholdMultiplier,
        bossMoneyMultiplier: action.bossMoneyMultiplier,
        cooldownMultiplier: action.cooldownMultiplier,
        disabledStations: action.disabledStations && action.disabledStations.length > 0
          ? action.disabledStations
          : undefined,
        activeGarnishes: active.length > 0 ? active : undefined,
        firstOrderServedThisShift: false,
      }
    }

    case 'ADD_CHAT':
      return addMsg(state, action.username, action.text, action.msgType)

    case 'EXTINGUISH': {
      const { user, stationId } = action
      const station = state.stations[stationId]
      if (!station) return addMsg(state, 'KITCHEN', 'Unknown station!', 'error')
      if (!station.overheated) return addMsg(state, 'KITCHEN', `No overheat on the ${STATION_DEFS[stationId]?.name ?? stationId}!`, 'error')
      if (station.extinguishVotes.includes(user)) return addMsg(state, 'KITCHEN', `${user} already voted to extinguish!`, 'error')

      const newVotes = [...station.extinguishVotes, user]
      // playerStats resets to {} on every RESET (new round) — reflects current-round participants only
      let needed: number
      if (state.teams) {
        const redSize = Object.values(state.teams).filter(t => t === 'red').length
        const blueSize = Object.values(state.teams).filter(t => t === 'blue').length
        needed = Math.max(1, Math.ceil(Math.max(redSize, blueSize) * 0.5))
      } else {
        const totalPlayers = Math.max(state.participantCount, Object.keys(state.playerStats).length, 1)
        needed = Math.max(1, Math.ceil(totalPlayers * 0.5))
      }
      let withStat = addStat(state, user, 'extinguished', 1)

      if (newVotes.length >= needed) {
        // extinguish base stat (×2 in calcScore) already rewards coordination — no extra bonus needed
        const newStations = {
          ...withStat.stations,
          [stationId]: { ...station, slots: [], heat: 0, overheated: false, extinguishVotes: [], lastExtinguishedAt: Date.now(), lastExtinguishedBy: newVotes },
        }
        return addMsg({ ...withStat, stations: newStations }, 'KITCHEN',
          `🧯 ${STATION_DEFS[stationId].name} extinguished! Station restored.`, 'success')
      } else {
        const newStations = {
          ...withStat.stations,
          [stationId]: { ...station, extinguishVotes: newVotes },
        }
        return addMsg({ ...withStat, stations: newStations }, 'KITCHEN',
          `${user} voted to extinguish ${STATION_DEFS[stationId].name} (${newVotes.length}/${needed})`, 'system')
      }
    }

    case 'COOL': {
      const { user, stationId } = action
      const station = state.stations[stationId]
      if (!station) return addMsg(state, 'KITCHEN', 'Unknown station!', 'error')
      if (HEAT_EXEMPT_STATIONS.has(stationId)) return addMsg(state, 'KITCHEN', `The ${STATION_DEFS[stationId].name} doesn't overheat!`, 'error')
      if (station.overheated) return addMsg(state, 'KITCHEN', `${STATION_DEFS[stationId].name} is overheated — extinguish it first!`, 'error')
      if (station.heat === 0) return addMsg(state, 'KITCHEN', `${STATION_DEFS[stationId].name} is already cool.`, 'error')
      if (isUserBusy(state, user)) return addMsg(state, 'KITCHEN', `${user} is busy cooking and can't cool right now!`, 'error')

      const cooldown = state.userCooldowns[user] ?? 0
      const coolCooldownMs = 1500 * (state.cooldownMultiplier ?? 1)
      if (Date.now() - cooldown < coolCooldownMs) return addMsg(state, 'KITCHEN', `${user} is on cooldown!`, 'error')

      const coolAmount = (40 + (state.coolAmountBonus ?? 0)) + Math.floor(Math.random() * 21)  // 40–60 + bonus
      const newHeat = Math.max(0, station.heat - coolAmount)
      const newStations = { ...state.stations, [stationId]: { ...station, heat: newHeat, lastCooledAt: Date.now(), lastCooledBy: user } }
      const withCooldown = { ...state, stations: newStations, userCooldowns: { ...state.userCooldowns, [user]: Date.now() } }
      let withStat = addStat(withCooldown, user, 'cooled', 1)
      // Bonus for proactive monitoring: cooling a notably hot station (≥60%) prevents overheats
      if (station.heat >= 60) withStat = addStat(withStat, user, 'bonusPoints', 1)
      return addMsg(withStat, 'KITCHEN', `${user} cooled the ${STATION_DEFS[stationId].name}! Heat: ${newHeat}%`, 'success')
    }

    case 'SERVE': {
      const { user, orderId } = action
      if (isUserBusy(state, user)) {
        return addMsg(state, 'KITCHEN', `${user} is busy cooking at a station and can't serve right now!`, 'error')
      }

      const orderIdx = state.orders.findIndex(o => o.id === orderId && !o.served)
      if (orderIdx === -1) return addMsg(state, 'KITCHEN', `No pending order #${orderId}!`, 'error')

      const order = state.orders[orderIdx]
      const recipe = RECIPES[order.dish]

      if (state.teams && !state.teams[user]) {
        return addMsg(state, 'KITCHEN', `${user} is not on a team!`, 'error')
      }

      // Check preparedItems has all required ingredients (team-aware)
      const needed = [...recipe.plate]
      const available = [...teamPrepItems(state, user)]
      const sourcesPool = [...teamPrepSources(state, user)]
      const cookerBonuses: Record<string, number> = {}
      for (const item of needed) {
        const idx = available.indexOf(item)
        if (idx === -1) return addMsg(state, 'KITCHEN', `Missing ${item.replace(/_/g, ' ')} for ${recipe.name}!`, 'error')
        available.splice(idx, 1)
        const cooker = sourcesPool.splice(idx, 1)[0] ?? ''
        // Bonus for cooking an ingredient that ends up in a real served order
        if (cooker) cookerBonuses[cooker] = (cookerBonuses[cooker] ?? 0) + 2
      }

      const newOrders = state.orders.map((o, i) =>
        i === orderIdx ? { ...o, served: true, outcome: 'served' as const, completedAt: Date.now(), servedBy: user } : o
      )
      const timeBonus = Math.max(0, Math.floor((order.patienceLeft / order.patienceMax) * 30))
      const baseReward = recipe.reward + timeBonus
      const recipeMul = state.recipePriceModifier?.[order.dish] ?? 1
      const bossMoneyMul = state.bossMoneyMultiplier ?? 1
      let multiplier = (state.moneyMultiplier?.multiplier ?? 1) * recipeMul * bossMoneyMul

      // ── Triggered garnish multipliers (multiplicative with each other) ──
      const active = state.activeGarnishes ?? []
      const isFirstOrder = !state.firstOrderServedThisShift
      if (isFirstOrder && active.includes('first_bite')) {
        multiplier *= 3
      }
      const elapsedSinceSpawn = Date.now() - order.spawnTime
      if (active.includes('speed_demon') && elapsedSinceSpawn < 20_000) {
        multiplier *= 1.25
      }

      const tip = state.flatTipPerOrder ?? 0
      const reward = Math.round(baseReward * multiplier) + tip

      let withStats = addStat(state, user, 'served', 1)
      withStats = addStat(withStats, user, 'moneyEarned', reward)
      // Cooking contribution bonuses to each player whose ingredient was used
      for (const [cooker, bonus] of Object.entries(cookerBonuses)) {
        withStats = addStat(withStats, cooker, 'bonusPoints', bonus)
      }

      let afterPool = setTeamPrepItems(withStats, user, available)
      afterPool = setTeamPrepSources(afterPool, user, sourcesPool)

      if (state.teams) {
        const isRed = state.teams[user] === 'red'
        afterPool = isRed
          ? { ...afterPool, redMoney: (afterPool.redMoney ?? 0) + reward, redServed: (afterPool.redServed ?? 0) + 1 }
          : { ...afterPool, blueMoney: (afterPool.blueMoney ?? 0) + reward, blueServed: (afterPool.blueServed ?? 0) + 1 }
      }

      return addMsg(
        {
          ...afterPool,
          orders: newOrders,
          money: afterPool.money + reward,
          served: afterPool.served + 1,
          firstOrderServedThisShift: true,
        },
        'KITCHEN', `${user} served ${recipe.emoji} ${recipe.name}! +$${reward}`, 'success'
      )
    }

    case 'COOK': {
      const { user, action: cookAction, target, now } = action

      // Cooldown check
      const cookCooldownMs = 1500 * (state.cooldownMultiplier ?? 1)
      if (state.userCooldowns[user] && now - state.userCooldowns[user] < cookCooldownMs) return state
      const withCooldown = { ...state, userCooldowns: { ...state.userCooldowns, [user]: now } }

      // Per-user busy check (belt-and-suspenders: also scan station slots in case activeUsers is stale)
      if (isUserBusy(withCooldown, user)) {
        return addMsg(withCooldown, 'KITCHEN', `${user} is already busy!`, 'error')
      }

      const stationEntry = Object.entries(STATION_DEFS).find(([, def]) => def.actions.includes(cookAction))
      if (!stationEntry) return withCooldown

      const [stationId] = stationEntry
      const station = withCooldown.stations[stationId]

      // Overheated check
      if (station.overheated) {
        return addMsg(withCooldown, 'KITCHEN', `The ${STATION_DEFS[stationId].name} is overheated! Extinguish it first.`, 'error')
      }

      // Disabled station check (Kitchen Events — Power Trip)
      if ((state.disabledStations ?? []).includes(stationId)) {
        return addMsg(withCooldown, 'KITCHEN', `The ${STATION_DEFS[stationId].name} is offline! Help restore power!`, 'error')
      }

let matchedStep = null
      for (const recipe of Object.values(RECIPES)) {
        for (const step of recipe.steps) {
          if (step.action === cookAction && step.target === target) { matchedStep = step; break }
        }
        if (matchedStep) break
      }
      if (!matchedStep) return addMsg(withCooldown, 'KITCHEN', `Can't ${cookAction} ${(target || '').replace(/_/g, ' ')} there!`, 'error')

      // ── Triggered garnish: Sharp Knives → chopping becomes instant ──
      let effectiveDuration = matchedStep.duration
      if (cookAction === 'chop' && (state.activeGarnishes ?? []).includes('sharp_knives')) {
        effectiveDuration = 0
      }

      // Check ingredient prerequisite
      let afterRequire = withCooldown
      if (matchedStep.requires) {
        const teamItems = teamPrepItems(afterRequire, user)
        const idx = teamItems.indexOf(matchedStep.requires)
        if (idx === -1) {
          return addMsg(afterRequire, 'KITCHEN', `Need ${matchedStep.requires.replace(/_/g, ' ')} first!`, 'error')
        }
        const newItems = [...teamItems]
        newItems.splice(idx, 1)
        afterRequire = setTeamPrepItems(afterRequire, user, newItems)
      }

      const speed = state.cookingSpeed
      const newSlot: StationSlot = {
        id: `slot_${afterRequire.nextSlotId}`,
        user,
        target: matchedStep.target,
        produces: matchedStep.produces,
        elapsedMs: 0,
        cookDuration: effectiveDuration / (speed * (state.cookingSpeedModifier?.multiplier ?? 1)),
        heatApplied: 0,
        heatPerCook: (10 + Math.floor(Math.random() * 11)) * (state.heatPerCookMultiplier ?? 1),  // 10–20 × multiplier
        state: 'cooking',
      }

      if (effectiveDuration === 0) {
        const withStat = addStat(afterRequire, user, 'cooked', 1)
        const instantItems = [...teamPrepItems(withStat, user), matchedStep.produces]
        const instantSources = [...teamPrepSources(withStat, user), user]
        const withItems = setTeamPrepItems(withStat, user, instantItems)
        return addMsg(
          setTeamPrepSources(withItems, user, instantSources),
          'KITCHEN', `${user} ${PAST_TENSE[cookAction] || cookAction + 'ed'} ${target.replace(/_/g, ' ')}!`, 'success'
        )
      }

      const withStat = addStat(afterRequire, user, 'cooked', 1)
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
      const playerCount = Object.keys(state.playerStats).length
      const maxOrders = Math.min(15, 5 + Math.floor(playerCount / 8))
      const activeOrders = state.orders.filter(o => !o.served).length
      if (activeOrders >= maxOrders) return state

      const dishKeys = state.enabledRecipes.length > 0 ? state.enabledRecipes : Object.keys(RECIPES)
      const dish = dishKeys[Math.floor(Math.random() * dishKeys.length)]
      const recipe = RECIPES[dish]

      const patience = recipe.patience / state.orderSpeed

      const order: Order = {
        id: state.nextOrderId,
        dish,
        served: false,
        patienceMax: patience,
        patienceLeft: patience,
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
      const messages = [...state.chatMessages]
      let nextMsgId = state.nextMessageId
      const newPreparedItems = [...state.preparedItems]
      const newPreparedItemSources = [...state.preparedItemSources]
      const newRedPreparedItems = [...(state.redPreparedItems ?? [])]
      const newBluePreparedItems = [...(state.bluePreparedItems ?? [])]
      const newRedPreparedItemSources = state.teams ? [...(state.redPreparedItemSources ?? [])] : []
      const newBluePreparedItemSources = state.teams ? [...(state.bluePreparedItemSources ?? [])] : []
      let newPlayerStats = { ...state.playerStats }
      let bloodhoundMoney = 0
      // Update all station slots
      for (const [id, station] of Object.entries(newStations)) {
        if (station.overheated || station.slots.length === 0) continue

        const updatedSlots: StationSlot[] = []
        let currentHeat = newStations[id].heat

        for (const slot of station.slots) {
          const elapsed = slot.elapsedMs + delta

          // Step A: Apply incremental heat delta (chopping board is exempt)
          let newHeatApplied = slot.heatApplied
          if (!HEAT_EXEMPT_STATIONS.has(id) && slot.state === 'cooking') {
            const progress = Math.min(1, elapsed / slot.cookDuration)
            const expectedHeat = progress * slot.heatPerCook
            const heatDelta = expectedHeat - slot.heatApplied
            if (heatDelta > 0) {
              currentHeat += heatDelta
              newHeatApplied = expectedHeat
            }
          }
          const updatedSlot: StationSlot = { ...slot, elapsedMs: elapsed, heatApplied: newHeatApplied }

          // Step B: Check overheat
          if (currentHeat >= 100) {
            // Penalise every player cooking at this station, not just the one whose slot tipped it over
            for (const s of station.slots) {
              const statSnap = addStat({ ...state, playerStats: newPlayerStats }, s.user, 'firesCaused', 1)
              newPlayerStats = statSnap.playerStats
            }
            // Free all users assigned to all slots on this station
            for (const s of newStations[id].slots) delete newActiveUsers[s.user]
            newStations[id] = { ...newStations[id], slots: [], heat: 100, overheated: true, extinguishVotes: [] }
            messages.push({
              id: nextMsgId++,
              username: 'KITCHEN',
              text: `🔥 ${STATION_DEFS[id].name} OVERHEATED! Type extinguish ${id} to restore it!`,
              type: 'system',
            })
            // Bloodhound garnish: +$40 per overheat
            if ((state.activeGarnishes ?? []).includes('bloodhound')) {
              bloodhoundMoney += 40
              messages.push({
                id: nextMsgId++,
                username: 'KITCHEN',
                text: `🩸 Bloodhound earned $40 from the overheat!`,
                type: 'success',
              })
            }
            break // station is locked, skip remaining slots
          }

          // Step C: Check completion (no heat addition — already applied incrementally)
          if (slot.state === 'cooking' && elapsed >= slot.cookDuration) {
            if (state.teams) {
              const team = state.teams[slot.user]
              if (team === 'red') { newRedPreparedItems.push(slot.produces); newRedPreparedItemSources.push(slot.user) }
              else if (team === 'blue') { newBluePreparedItems.push(slot.produces); newBluePreparedItemSources.push(slot.user) }
              // else: unregistered player in PvP — item dropped
            } else {
              newPreparedItems.push(slot.produces)
              newPreparedItemSources.push(slot.user)
            }
            delete newActiveUsers[slot.user]
            messages.push({
              id: nextMsgId++,
              username: 'KITCHEN',
              text: `${slot.user} finished ${slot.target.replace(/_/g, ' ')}!`,
              type: 'success',
            })
            newStations[id] = { ...newStations[id], lastCompletion: { ingredient: slot.produces, at: now, by: slot.user } }
            // slot NOT pushed — removed (auto-collected)
          } else {
            updatedSlots.push(updatedSlot)
          }
        }

        if (!newStations[id].overheated) {
          newStations[id] = { ...newStations[id], heat: currentHeat, slots: updatedSlots }
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
          return { ...order, served: true, patienceLeft: 0, outcome: 'lost' as const, completedAt: now }
        }
        return { ...order, patienceLeft: newPatience }
      })

      // Clean up old served orders
      orders = orders.filter(o => !o.served || (o.completedAt !== undefined && now - o.completedAt < 1500))

      // Timer countdown
      const timeLeft = Math.max(0, state.timeLeft - delta)

      // Expire timed modifiers
      const cookingSpeedModifier = state.cookingSpeedModifier && now < state.cookingSpeedModifier.expiresAt
        ? state.cookingSpeedModifier : undefined
      const moneyMultiplier = state.moneyMultiplier && now < state.moneyMultiplier.expiresAt
        ? state.moneyMultiplier : undefined

      return {
        ...state,
        stations: newStations,
        activeUsers: newActiveUsers,
        preparedItems: newPreparedItems,
        preparedItemSources: newPreparedItemSources,
        redPreparedItems: state.teams ? newRedPreparedItems : state.redPreparedItems,
        bluePreparedItems: state.teams ? newBluePreparedItems : state.bluePreparedItems,
        redPreparedItemSources: state.teams ? newRedPreparedItemSources : state.redPreparedItemSources,
        bluePreparedItemSources: state.teams ? newBluePreparedItemSources : state.bluePreparedItemSources,
        playerStats: newPlayerStats,
        orders,
        lost,
        timeLeft,
        chatMessages: messages.slice(-200),
        nextMessageId: nextMsgId,
        cookingSpeedModifier,
        moneyMultiplier,
        money: state.money + bloodhoundMoney,
      }
    }

    case 'SET_STATION_HEAT': {
      const { stationId, heat } = action
      const station = state.stations[stationId]
      if (!station) return state
      return { ...state, stations: { ...state.stations, [stationId]: { ...station, heat: Math.max(0, Math.min(100, heat)) } } }
    }

    case 'OVERHEAT_STATION': {
      const station = state.stations[action.stationId]
      if (!station) return state
      // Fire Insurance garnish: auto-resolve overheat once per shift
      if ((state.freeExtinguishes ?? 0) > 0) {
        const newStations = { ...state.stations, [action.stationId]: { ...station, slots: [], heat: 0, overheated: false, extinguishVotes: [] } }
        return addMsg(
          { ...state, stations: newStations, freeExtinguishes: (state.freeExtinguishes ?? 0) - 1 },
          'KITCHEN', `🧯 Fire Insurance saved the ${STATION_DEFS[action.stationId]?.name}!`, 'success'
        )
      }
      return { ...state, stations: { ...state.stations, [action.stationId]: { ...station, slots: [], heat: 100, overheated: true, extinguishVotes: [] } } }
    }

    case 'REMOVE_PREPARED_ITEMS': {
      const count = Math.min(action.count, state.preparedItems.length)
      if (count === 0) return state
      const items = [...state.preparedItems]
      const sources = [...state.preparedItemSources]
      for (let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * items.length)
        items.splice(idx, 1)
        sources.splice(idx, 1)
      }
      const msg = action.message ?? `🐀 Rats stole ${count} prepared ingredient(s)!`
      return addMsg({ ...state, preparedItems: items, preparedItemSources: sources }, 'KITCHEN', msg, 'error')
    }

    case 'SET_COOKING_SPEED_MODIFIER':
      return { ...state, cookingSpeedModifier: { multiplier: action.multiplier, expiresAt: action.expiresAt } }

    case 'DISABLE_STATIONS': {
      const current = state.disabledStations ?? []
      const merged = [...new Set([...current, ...action.stationIds])]
      return { ...state, disabledStations: merged }
    }

    case 'ENABLE_STATIONS': {
      const current = state.disabledStations ?? []
      const remaining = current.filter(id => !action.stationIds.includes(id))
      return { ...state, disabledStations: remaining.length > 0 ? remaining : undefined }
    }

    case 'ADD_MONEY_MULTIPLIER':
      return { ...state, moneyMultiplier: { multiplier: action.multiplier, expiresAt: action.expiresAt } }

    case 'ADD_PREPARED_ITEMS': {
      const msg = action.message ?? `🧩 Mystery solved! ${action.items.length} ingredients added to the tray!`
      return addMsg(
        {
          ...state,
          preparedItems: [...state.preparedItems, ...action.items],
          preparedItemSources: [...state.preparedItemSources, ...action.items.map(() => '')],
        },
        'KITCHEN', msg, 'success'
      )
    }

    case 'EXTEND_ORDER_PATIENCE': {
      const updatedOrders = state.orders.map(o =>
        o.served ? o : { ...o, patienceLeft: Math.min(o.patienceMax, o.patienceLeft + action.ms) }
      )
      return addMsg({ ...state, orders: updatedOrders }, 'KITCHEN', `🕺 Dance worked! All orders got extra time!`, 'success')
    }

    case 'RECORD_EVENT_PARTICIPATION':
      return addStat(state, action.user, 'eventParticipations', 1)

    default:
      return state
  }
}
