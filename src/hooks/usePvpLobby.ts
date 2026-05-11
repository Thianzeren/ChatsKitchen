import { useState, useRef, useCallback, Dispatch, SetStateAction } from 'react'
import { Screen } from '../state/types'

type Lobby = { red: string[], blue: string[] }

export function usePvpLobby(
  setScreen: (s: Screen) => void,
  showToast: (msg: string) => void,
) {
  const [pvpLobby, setPvpLobby] = useState<Lobby | null>(null)
  const pvpLobbyRef = useRef<Lobby | null>(null)
  pvpLobbyRef.current = pvpLobby

  const startPvp = useCallback(() => {
    setPvpLobby({ red: [], blue: [] })
    setScreen('pvplobby')
  }, [setScreen])

  const startPvpGame = useCallback(() => {
    setScreen('freeplaysetup')
  }, [setScreen])

  const balanceLobby = useCallback(() => {
    setPvpLobby(prev => {
      if (!prev) return prev
      const all = [...prev.red, ...prev.blue].sort(() => Math.random() - 0.5)
      return {
        red: all.filter((_, i) => i % 2 === 0),
        blue: all.filter((_, i) => i % 2 !== 0),
      }
    })
    showToast(`⚖️ Teams balanced`)
  }, [showToast])

  const handleLobbyMetaCommand = useCallback((_user: string, text: string, isMod: boolean) => {
    if (!isMod) return
    const cmd = text.trim().toLowerCase()

    if (cmd === '!balance') {
      balanceLobby()
      return
    }

    const kickMatch = text.trim().match(/^!kick\s+@?(\S+)$/i)
    if (kickMatch) {
      const targetRaw = kickMatch[1]
      const lobby = pvpLobbyRef.current
      const allPlayers = lobby ? [...lobby.red, ...lobby.blue] : []
      const target = allPlayers.find(u => u.toLowerCase() === targetRaw.toLowerCase())
      if (!target) {
        showToast(`❌ ${targetRaw} not found`)
        return
      }
      setPvpLobby(prev => {
        if (!prev) return prev
        return {
          red: prev.red.filter(u => u !== target),
          blue: prev.blue.filter(u => u !== target),
        }
      })
      showToast(`🚫 Kicked ${target}`)
      return
    }

    const moveMatch = text.trim().match(/^!move\s+(red|blue)\s+@?(\S+)$/i)
    if (moveMatch) {
      const team = moveMatch[1].toLowerCase() as 'red' | 'blue'
      const targetRaw = moveMatch[2]
      const other: 'red' | 'blue' = team === 'red' ? 'blue' : 'red'
      const lobby = pvpLobbyRef.current
      const allPlayers = lobby ? [...lobby.red, ...lobby.blue] : []
      const target = allPlayers.find(u => u.toLowerCase() === targetRaw.toLowerCase())
      if (!target) {
        showToast(`❌ ${targetRaw} not found`)
        return
      }
      setPvpLobby(prev => {
        if (!prev) return prev
        return {
          ...prev,
          [team]: prev[team].includes(target) ? prev[team] : [...prev[team], target],
          [other]: prev[other].filter(u => u !== target),
        }
      })
      showToast(`↔️ ${target} → ${team}`)
    }
  }, [showToast])

  // Handles !red / !blue / !join / !leave from chat. Returns true if the command was consumed.
  const handleLobbyJoin = useCallback((user: string, cmd: string) => {
    if (cmd === '!red' || cmd === '!blue' || cmd === '!join red' || cmd === '!join blue') {
      const team: 'red' | 'blue' = (cmd === '!red' || cmd === '!join red') ? 'red' : 'blue'
      const other: 'red' | 'blue' = team === 'red' ? 'blue' : 'red'
      setPvpLobby(prev => {
        if (!prev) return prev
        return {
          ...prev,
          [team]: prev[team].includes(user) ? prev[team] : [...prev[team], user],
          [other]: prev[other].filter(u => u !== user),
        }
      })
      return true
    }
    if (cmd === '!join') {
      setPvpLobby(prev => {
        if (!prev) return prev
        if (prev.red.includes(user) || prev.blue.includes(user)) return prev
        const team = prev.red.length <= prev.blue.length ? 'red' : 'blue'
        return { ...prev, [team]: [...prev[team], user] }
      })
      return true
    }
    if (cmd === '!leave' || cmd === '!quit') {
      setPvpLobby(prev => {
        if (!prev) return prev
        return {
          red: prev.red.filter(u => u !== user),
          blue: prev.blue.filter(u => u !== user),
        }
      })
      return true
    }
    return false
  }, [])

  return {
    pvpLobby,
    setPvpLobby: setPvpLobby as Dispatch<SetStateAction<Lobby | null>>,
    pvpLobbyRef,
    startPvp,
    startPvpGame,
    balanceLobby,
    handleLobbyMetaCommand,
    handleLobbyJoin,
  }
}
