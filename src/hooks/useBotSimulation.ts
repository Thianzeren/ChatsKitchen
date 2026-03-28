import { useEffect, useRef } from 'react'
import { GameAction } from '../state/gameReducer'
import { GameState } from '../state/types'
import { RECIPES, BOT_NAMES } from '../data/recipes'

const CHATTER = ["let's go!", 'waiting for orders...', 'COOK COOK COOK', 'we got this chat!', 'any orders?']

function pickBotAction(state: GameState): { name: string; command: string } | null {
  const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]

  // Skip if this bot is already busy
  if (state.activeUsers[name]) return null

  // Fire — any station on fire
  for (const station of Object.values(state.stations)) {
    if (station.onFire) return { name, command: '!extinguish' }
  }

  // Done slots — take bot's own first, then any done slot (skip plating — auto-completes)
  for (const [id, station] of Object.entries(state.stations)) {
    if (id === 'plating') continue
    const doneSlot = station.slots.find(s => s.state === 'done' && s.user === name)
      || station.slots.find(s => s.state === 'done')
    if (doneSlot) return { name, command: `!take ${id}` }
  }

  // Serve — check plating station for done slots
  const plating = state.stations['plating']
  for (const order of state.orders) {
    if (order.served) continue
    if (plating.slots.some(s => s.state === 'done' && s.produces === order.dish)) return { name, command: `!serve ${order.id}` }
  }

  // Plate — check plating station capacity
  const platingStation = state.stations['plating']
  const platingCapacity = state.stationCapacity.plating
  if (platingStation && platingStation.slots.length < platingCapacity) {
    for (const order of state.orders) {
      if (order.served) continue
      const recipe = RECIPES[order.dish]
      const available = [...state.preparedItems]
      let canPlate = true
      for (const item of recipe.plate) {
        const idx = available.indexOf(item)
        if (idx === -1) { canPlate = false; break }
        available.splice(idx, 1)
      }
      if (canPlate) return { name, command: `!plate ${order.dish}` }
    }
  }

  // Cook something needed — check station capacity
  for (const order of state.orders) {
    if (order.served) continue
    const recipe = RECIPES[order.dish]
    for (const step of recipe.steps) {
      const station = state.stations[step.station]
      if (!station || station.onFire) continue

      // Check capacity
      const capacity = step.station === 'cutting_board'
        ? state.stationCapacity.chopping
        : state.stationCapacity.cooking
      if (station.slots.length >= capacity) continue

      if (state.preparedItems.includes(step.produces)) continue
      const alreadyCooking = station.slots.some(s => s.produces === step.produces)
      if (alreadyCooking) continue
      if (step.requires && !state.preparedItems.includes(step.requires)) continue
      return { name, command: `!${step.action} ${step.target}` }
    }
  }

  // Idle chatter
  return { name, command: CHATTER[Math.floor(Math.random() * CHATTER.length)] }
}

export function useBotSimulation(
  state: GameState,
  dispatch: React.Dispatch<GameAction>,
  onCommand: (user: string, text: string) => void,
  enabled: boolean,
) {
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  useEffect(() => {
    if (!enabled) return

    const interval = setInterval(() => {
      const action = pickBotAction(stateRef.current)
      if (action) {
        dispatch({ type: 'ADD_CHAT', username: action.name, text: action.command, msgType: 'normal' })
        onCommand(action.name, action.command)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [dispatch, onCommand, enabled])
}
