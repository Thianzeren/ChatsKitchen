import { useState, useRef, useCallback, Dispatch, SetStateAction } from 'react'
import { Screen } from '../state/types'

// Adventure runs cooperatively, so the lobby is a flat roster (no teams).
// The lobby starts empty: every chef joins via !join (or, in Local Play, by
// connecting a phone). The local host ("You") is an uncounted admin who plays
// through the in-game chatbox and is never added to the roster.
//
// The lobby state outlives the lobby screen — it stays alive through the run so
// mid-run !leave / !kick can shrink the roster, which `closeShop` reads at shift
// boundaries to rescale per-player goals and garnish prices.
export function useAdventureLobby(
  setScreen: (s: Screen) => void,
  showToast: (msg: string) => void,
) {
  const [adventureLobby, setAdventureLobby] = useState<string[] | null>(null)
  const adventureLobbyRef = useRef<string[] | null>(null)
  adventureLobbyRef.current = adventureLobby

  // Open the lobby empty — chefs join via !join / phone; the host is uncounted.
  const openAdventureLobby = useCallback(() => {
    setAdventureLobby([])
    setScreen('adventurelobby')
  }, [setScreen])

  const clearAdventureLobby = useCallback(() => {
    setAdventureLobby(null)
  }, [])

  const kickPlayer = useCallback((target: string) => {
    setAdventureLobby(prev => prev ? prev.filter(u => u !== target) : prev)
  }, [])

  // !join / !leave from chat. Returns true if the command was consumed.
  const handleLobbyJoin = useCallback((user: string, cmd: string) => {
    if (cmd === '!join') {
      setAdventureLobby(prev => {
        if (!prev) return prev
        if (prev.includes(user)) return prev
        return [...prev, user]
      })
      return true
    }
    if (cmd === '!leave' || cmd === '!quit') {
      setAdventureLobby(prev => prev ? prev.filter(u => u !== user) : prev)
      return true
    }
    return false
  }, [])

  // Mod/broadcaster commands. Returns 'start' if the lobby should begin the run,
  // true if the command was consumed (e.g. !kick), false otherwise.
  const handleLobbyMetaCommand = useCallback((_user: string, text: string, isMod: boolean): 'start' | true | false => {
    if (!isMod) return false
    const cmd = text.trim().toLowerCase()

    if (cmd === '!start') {
      return 'start'
    }

    const kickMatch = text.trim().match(/^!kick\s+@?(\S+)$/i)
    if (kickMatch) {
      const targetRaw = kickMatch[1]
      const lobby = adventureLobbyRef.current ?? []
      const target = lobby.find(u => u.toLowerCase() === targetRaw.toLowerCase())
      if (!target) {
        showToast(`❌ ${targetRaw} not found`)
        return true
      }
      kickPlayer(target)
      showToast(`🚫 Kicked ${target}`)
      return true
    }

    return false
  }, [kickPlayer, showToast])

  return {
    adventureLobby,
    setAdventureLobby: setAdventureLobby as Dispatch<SetStateAction<string[] | null>>,
    adventureLobbyRef,
    openAdventureLobby,
    clearAdventureLobby,
    kickPlayer,
    handleLobbyJoin,
    handleLobbyMetaCommand,
  }
}
