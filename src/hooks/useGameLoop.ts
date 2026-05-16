import { useEffect, useRef } from 'react'
import { GameAction } from '../state/gameReducer'
import { GameState } from '../state/types'

const EMPTY_BOOST_DURATION = 10000  // ms — how long the faster spawn rate lasts
const EMPTY_BOOST_MULTIPLIER = 2    // spawn 2× faster during boost window

export function useGameLoop(
  state: GameState,
  dispatch: React.Dispatch<GameAction>,
  onGameOver?: () => void,
  paused?: boolean,
  resetKey?: number,
) {
  const lastTimeRef = useRef(Date.now())
  const gameTimeRef = useRef(0)
  const orderTimerRef = useRef(0)
  const firstOrderSpawned = useRef(false)
  const gameOverFired = useRef(false)
  const lastOrderCountRef = useRef(0)
  const boostEndTimeRef = useRef(0)
  const stateRef = useRef(state)
  stateRef.current = state
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  // Reset refs when a new game starts
  useEffect(() => {
    if (onGameOver) {
      lastTimeRef.current = Date.now()
      gameTimeRef.current = 0
      orderTimerRef.current = 0
      firstOrderSpawned.current = false
      gameOverFired.current = false
      lastOrderCountRef.current = 0
      boostEndTimeRef.current = 0
    }
  }, [onGameOver, resetKey])

  useEffect(() => {
    if (!onGameOver) return // Only run when game is active

    const interval = setInterval(() => {
      const now = Date.now()
      const delta = now - lastTimeRef.current
      lastTimeRef.current = now

      const s = stateRef.current
      const nowPaused = pausedRef.current

      // Check game over before ticking
      if (s.timeLeft <= 0 && !gameOverFired.current) {
        gameOverFired.current = true
        onGameOver()
        return
      }

      if (nowPaused) return

      gameTimeRef.current += delta

      // Tick game state — slot elapsedMs advances only here, so pause naturally freezes cooking
      dispatch({ type: 'TICK', delta, now })

      // Spawn orders
      orderTimerRef.current += delta
      const pendingOrders = s.orders.filter(o => !o.served).length
      const isBoosting = now < boostEndTimeRef.current
      const playerCount = Object.keys(s.playerStats).length
      const dynamicSpawnMultiplier = Math.min(3.0, 1.0 + playerCount / 25)
      const orderInterval = (13000 / s.orderSpawnRate) / (isBoosting ? EMPTY_BOOST_MULTIPLIER : 1) / dynamicSpawnMultiplier

      if (!firstOrderSpawned.current && gameTimeRef.current > 2000) {
        dispatch({ type: 'SPAWN_ORDER', now })
        firstOrderSpawned.current = true
        orderTimerRef.current = 0
      } else if (firstOrderSpawned.current && pendingOrders === 0 && lastOrderCountRef.current > 0) {
        // Queue just emptied — spawn immediately and start boost window
        dispatch({ type: 'SPAWN_ORDER', now })
        boostEndTimeRef.current = now + EMPTY_BOOST_DURATION
        orderTimerRef.current = 0
      } else if (orderTimerRef.current > orderInterval) {
        dispatch({ type: 'SPAWN_ORDER', now })
        orderTimerRef.current = 0
      }

      lastOrderCountRef.current = pendingOrders
    }, 100)

    return () => clearInterval(interval)
  }, [dispatch, onGameOver])
}
