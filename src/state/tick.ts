// The 100ms game tick, as a sequence of named steps. Steps share a working
// draft (fresh copies made per tick), so the reducer stays pure from outside.
import type { ChatMessage, GameState, Order, PlayerStats, PreparedPools, Station, StationSlot } from './types'
import { RECIPES, STATION_DEFS, HEAT_EXEMPT_STATIONS, getEnabledStations } from '../data/recipes'
import { addItems, poolIdFor } from './preparedPools'
import { bumpStat } from './stateHelpers'

// Letting an order expire forfeits this fraction of its reward from the bank — a small
// opportunity cost so ignoring pricey orders to cherry-pick cheap ones actually costs money.
export const LOST_ORDER_PENALTY_FRACTION = 0.2

const ROULETTE_INTERVAL_MS = 45_000
const BLOODHOUND_REWARD = 12
const DOPPELGANGER_CHANCE = 0.2
const RESOLVED_ORDER_LINGER_MS = 1500

interface ChatLog {
  push(username: string, text: string, type: ChatMessage['type']): void
  result(): Pick<GameState, 'chatMessages' | 'nextMessageId'>
}

function createChatLog(state: GameState): ChatLog {
  const messages = [...state.chatMessages]
  let nextId = state.nextMessageId
  return {
    push(username, text, type) { messages.push({ id: nextId++, username, text, type }) },
    result: () => ({ chatMessages: messages.slice(-200), nextMessageId: nextId }),
  }
}

interface TickDraft {
  stations: Record<string, Station>
  activeUsers: Record<string, string>
  pools: PreparedPools
  playerStats: Record<string, PlayerStats>
  log: ChatLog
}

export function tickReducer(state: GameState, delta: number, now: number): GameState {
  const draft: TickDraft = {
    stations: { ...state.stations },
    activeUsers: { ...state.activeUsers },
    pools: { ...state.preparedPools },
    playerStats: { ...state.playerStats },
    log: createChatLog(state),
  }

  const roulette = rotateRecipeRoulette(state, draft, now)
  const bloodhoundMoney = advanceStations(state, draft, delta, now)
  const expiry = advanceOrders(state, draft, delta, now)

  return {
    ...state,
    stations: draft.stations,
    activeUsers: draft.activeUsers,
    preparedPools: draft.pools,
    playerStats: draft.playerStats,
    ...draft.log.result(),
    orders: expiry.orders,
    lost: expiry.lost,
    timeLeft: Math.max(0, state.timeLeft - delta),
    ...expireModifiers(state, now),
    money: Math.max(0, state.money + bloodhoundMoney - expiry.penalty),
    // Lost orders aren't team-tagged, so PvP charges BOTH teams equally.
    redMoney: state.teams && state.redMoney !== undefined ? Math.max(0, state.redMoney - expiry.penalty) : state.redMoney,
    blueMoney: state.teams && state.blueMoney !== undefined ? Math.max(0, state.blueMoney - expiry.penalty) : state.blueMoney,
    enabledRecipes: roulette.enabledRecipes,
    rouletteNextAt: roulette.rouletteNextAt,
  }
}

/** Recipe Roulette boss: every 45s, swap one active recipe for a random inactive one. */
function rotateRecipeRoulette(state: GameState, draft: TickDraft, now: number): Pick<GameState, 'enabledRecipes' | 'rouletteNextAt'> {
  let rouletteNextAt = state.rouletteNextAt
  // Lazy-init on the first TICK that sees the effect (keeps Date.now() out of RESET).
  if (state.activeBossDebuff === 'recipe_roulette' && !rouletteNextAt) rouletteNextAt = now + ROULETTE_INTERVAL_MS
  if (!rouletteNextAt || now < rouletteNextAt) return { enabledRecipes: state.enabledRecipes, rouletteNextAt }

  let enabledRecipes = state.enabledRecipes
  const candidates = Object.keys(RECIPES).filter(r => !state.enabledRecipes.includes(r))
  if (candidates.length > 0 && state.enabledRecipes.length > 0) {
    const removedIdx = Math.floor(Math.random() * state.enabledRecipes.length)
    const removed = state.enabledRecipes[removedIdx]
    const added = candidates[Math.floor(Math.random() * candidates.length)]
    enabledRecipes = state.enabledRecipes.map((r, i) => i === removedIdx ? added : r)
    draft.log.push('KITCHEN', `🎲 Recipe Roulette! ${RECIPES[removed]?.name ?? removed} → ${RECIPES[added]?.name ?? added}`, 'system')
    // The swapped-out dish may leave a station no active recipe needs anymore.
    // Clear its in-flight slots (they'd otherwise cook invisibly into unusable
    // items) and free the chefs working there.
    const stillNeeded = new Set(getEnabledStations(enabledRecipes))
    for (const [sid, st] of Object.entries(draft.stations)) {
      if (st.slots.length > 0 && !stillNeeded.has(sid)) {
        for (const sl of st.slots) delete draft.activeUsers[sl.user]
        draft.stations[sid] = { ...st, slots: [] }
      }
    }
  }
  return { enabledRecipes, rouletteNextAt: now + ROULETTE_INTERVAL_MS }
}

/** Advance every cooking slot: accrue heat, overheat stations, bank finished items.
 *  Returns money earned from overheats (Bloodhound garnish). */
function advanceStations(state: GameState, draft: TickDraft, delta: number, now: number): number {
  const overheatLimit = state.overheatThreshold ?? 100  // raised by Insulation, lowered by Glass Kitchen
  let bloodhoundMoney = 0

  for (const [id, station] of Object.entries(draft.stations)) {
    if (station.overheated || station.slots.length === 0) continue

    const remainingSlots: StationSlot[] = []
    let heat = station.heat

    for (const slot of station.slots) {
      const elapsedMs = slot.elapsedMs + delta

      // Heat accrues in proportion to progress; heat-exempt stations never heat up.
      let heatApplied = slot.heatApplied
      if (!HEAT_EXEMPT_STATIONS.has(id) && slot.state === 'cooking') {
        const expectedHeat = Math.min(1, elapsedMs / slot.cookDuration) * slot.heatPerCook
        if (expectedHeat > slot.heatApplied) {
          heat += expectedHeat - slot.heatApplied
          heatApplied = expectedHeat
        }
      }

      if (heat >= overheatLimit) {
        overheatStation(draft, id, station.slots, overheatLimit)
        if ((state.activeGarnishes ?? []).includes('bloodhound')) {
          bloodhoundMoney += BLOODHOUND_REWARD
          draft.log.push('KITCHEN', `🩸 Bloodhound earned $${BLOODHOUND_REWARD} from the overheat!`, 'success')
        }
        break // station is locked; remaining slots are destroyed
      }

      if (slot.state === 'cooking' && elapsedMs >= slot.cookDuration) {
        completeSlot(state, draft, id, slot, now) // finished slots are auto-collected (not kept)
      } else {
        remainingSlots.push({ ...slot, elapsedMs, heatApplied })
      }
    }

    if (!draft.stations[id].overheated) {
      draft.stations[id] = { ...draft.stations[id], heat, slots: remainingSlots }
    }
  }
  return bloodhoundMoney
}

function overheatStation(draft: TickDraft, stationId: string, slots: StationSlot[], overheatLimit: number): void {
  // Penalise every player cooking here, not just the one whose slot tipped it
  // over — overheating is a shared, team-level failure.
  for (const s of slots) draft.playerStats = bumpStat(draft.playerStats, s.user, 'firesCaused', 1)
  for (const s of draft.stations[stationId].slots) delete draft.activeUsers[s.user]
  draft.stations[stationId] = { ...draft.stations[stationId], slots: [], heat: overheatLimit, overheated: true, extinguishVotes: [] }
  draft.log.push('KITCHEN', `🔥 ${STATION_DEFS[stationId].name} OVERHEATED! Type extinguish ${stationId} to restore it!`, 'system')
}

function completeSlot(state: GameState, draft: TickDraft, stationId: string, slot: StationSlot, now: number): void {
  // Doppelgänger garnish: chance to produce a second copy of the ingredient.
  const extraCopy = (state.activeGarnishes ?? []).includes('doppelganger') && Math.random() < DOPPELGANGER_CHANCE
  const poolId = poolIdFor(state, slot.user)
  if (poolId) {
    const produced = extraCopy ? [slot.produces, slot.produces] : [slot.produces]
    draft.pools[poolId] = addItems(draft.pools[poolId], produced, slot.user)
  }
  // else: PvP cook with no team — item dropped
  if (extraCopy) draft.log.push('KITCHEN', `✨ Doppelgänger! Bonus ${slot.produces.replace(/_/g, ' ')}!`, 'success')
  delete draft.activeUsers[slot.user]
  draft.log.push('KITCHEN', `${slot.user} finished ${slot.target.replace(/_/g, ' ')}!`, 'success')
  draft.stations[stationId] = { ...draft.stations[stationId], lastCompletion: { ingredient: slot.produces, at: now, by: slot.user } }
}

/** Drain order patience, expire orders that run out, and drop resolved orders
 *  once their exit animation has had time to play. */
function advanceOrders(state: GameState, draft: TickDraft, delta: number, now: number): { orders: Order[]; lost: number; penalty: number } {
  let lost = state.lost
  let penalty = 0
  const orders = state.orders.map(order => {
    if (order.served) return order
    const patienceLeft = order.patienceLeft - delta
    if (patienceLeft > 0) return { ...order, patienceLeft }

    lost++
    const recipe = RECIPES[order.dish]
    draft.log.push('CUSTOMER', `Order #${order.id} expired! Lost a ${recipe.emoji}!`, 'error')
    // Base opportunity cost — a fraction of the ignored dish's value.
    penalty += Math.floor(recipe.reward * LOST_ORDER_PENALTY_FRACTION)
    // Bad Reviews boss — flat $ per expired order, stacked on top.
    if (state.lostOrderPenalty !== undefined) {
      penalty += state.lostOrderPenalty
      draft.log.push('KITCHEN', `⭐ Bad Reviews · −$${state.lostOrderPenalty}`, 'error')
    }
    return { ...order, served: true, patienceLeft: 0, outcome: 'lost' as const, completedAt: now }
  })
  return {
    orders: orders.filter(o => !o.served || (o.completedAt !== undefined && now - o.completedAt < RESOLVED_ORDER_LINGER_MS)),
    lost,
    penalty,
  }
}

function expireModifiers(state: GameState, now: number): Pick<GameState, 'cookingSpeedModifier' | 'moneyMultiplier'> {
  return {
    cookingSpeedModifier: state.cookingSpeedModifier && now < state.cookingSpeedModifier.expiresAt ? state.cookingSpeedModifier : undefined,
    moneyMultiplier: state.moneyMultiplier && now < state.moneyMultiplier.expiresAt ? state.moneyMultiplier : undefined,
  }
}
