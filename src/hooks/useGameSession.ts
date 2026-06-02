import { useState, useRef, useCallback } from 'react'
import { RoundRecord, FinalStats } from '../state/types'
import { storage } from '../state/storage'

// Owns game-result state: finalStats, star thresholds, high score, history.
export function useGameSession() {
  const [finalStats, setFinalStats] = useState<FinalStats>({ money: 0, served: 0, lost: 0, playerStats: {} })
  const finalStatsRef = useRef<FinalStats>(finalStats)
  finalStatsRef.current = finalStats

  const [starThresholds, setStarThresholds] = useState<[number, number, number] | null>(null)

  const [freePlayHighScore, setFreePlayHighScore] = useState<number>(() =>
    parseInt(storage.get('chatsKitchen_freePlayHighScore') || '0', 10)
  )
  const [isNewHighScore, setIsNewHighScore] = useState(false)
  const [freePlayHistory, setFreePlayHistory] = useState<RoundRecord[]>(() =>
    storage.getJSON<RoundRecord[]>('chatsKitchen_freePlayHistory', [])
  )

  const resetSession = useCallback(() => {
    setFreePlayHighScore(0)
    setIsNewHighScore(false)
    setFreePlayHistory([])
    storage.remove('chatsKitchen_freePlayHighScore')
    storage.remove('chatsKitchen_freePlayHistory')
  }, [])

  return {
    finalStats,
    setFinalStats,
    finalStatsRef,
    starThresholds,
    setStarThresholds,
    freePlayHighScore,
    setFreePlayHighScore,
    isNewHighScore,
    setIsNewHighScore,
    freePlayHistory,
    setFreePlayHistory,
    resetSession,
  }
}
