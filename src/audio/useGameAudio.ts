import { useEffect, useRef } from 'react'
import { GameState, AudioSettings, Screen } from '../state/types'
import { getAudioManager } from './AudioManager'

export function useGameAudio(screen: Screen, state: GameState, audioSettings: AudioSettings) {
  const audio = getAudioManager()
  const prevMsgCount = useRef(state.chatMessages.length)
  const prevOrderCount = useRef(state.orders.filter(o => !o.served).length)
  const prevServed = useRef(state.served)
  const prevLost = useRef(state.lost)
  const prevFireCount = useRef(0)
  const prevCookingCount = useRef(0)
  const prevPreparedCount = useRef(state.preparedItems.length)
  const prevLastCooledAt = useRef(0)
  const intenseFired = useRef(false)
  const frenziedFired = useRef(false)

  const { trackEnabled } = audioSettings

  // Music transitions based on screen — also re-runs when track toggles change
  useEffect(() => {
    switch (screen) {
      case 'menu':
      case 'adventurelobby':
      case 'adventurebriefing':
      case 'adventurepantryshop':
      case 'adventurepathpick':
      case 'adventurecuisinepick':
      case 'adventurebossbriefing':
      case 'adventurerunend':
      case 'options':
      case 'freeplaysetup':
        audio.stopAllSfx()
        if (trackEnabled.menu) audio.playMusic('menu')
        else audio.stopMusic()
        break
      case 'countdown':
        audio.stopMusic()
        break
      case 'playing':
        if (trackEnabled.gameplay) audio.playMusic('gameplay')
        else audio.stopMusic()
        intenseFired.current = false
        frenziedFired.current = false
        prevServed.current = state.served
        prevLost.current = state.lost
        prevFireCount.current = 0
        prevCookingCount.current = 0
        prevPreparedCount.current = state.preparedItems.length
        prevOrderCount.current = state.orders.filter(o => !o.served).length
        prevMsgCount.current = state.chatMessages.length
        break
      case 'shiftend':
        audio.stopMusic()
        audio.playSfx('round-over')
        break
      case 'adventureshiftpassed':
      case 'gameover':
        audio.stopAllSfx()
        if (trackEnabled.gameover) audio.playMusic('gameover')
        break
    }
  // State values (served, lost, etc.) are intentionally omitted — this effect must only
  // fire on screen transitions to snapshot initial ref baselines. Re-running on every
  // game-tick state change would reset those refs and break intensity escalation logic.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, audio, trackEnabled.menu, trackEnabled.gameplay, trackEnabled.gameover])

  // Volume and mute sync
  useEffect(() => {
    audio.setMasterVolume(audioSettings.masterVolume)
    audio.setMusicVolume(audioSettings.musicVolume)
    audio.setSfxVolume(audioSettings.sfxVolume)
    audio.setMusicMuted(audioSettings.musicMuted)
    audio.setSfxMuted(audioSettings.sfxMuted)
  }, [audioSettings.masterVolume, audioSettings.musicVolume, audioSettings.sfxVolume, audioSettings.musicMuted, audioSettings.sfxMuted, audio])

  // Intense music crossfade when time is low
  useEffect(() => {
    if (screen === 'playing' && state.timeLeft <= 30000 && state.timeLeft > 0 && !intenseFired.current) {
      intenseFired.current = true
      audio.crossfadeToIntense()
    }
    if (screen === 'playing' && state.timeLeft <= 10000 && state.timeLeft > 0 && !frenziedFired.current) {
      frenziedFired.current = true
      audio.setIntenseRate(2.0)
    }
  }, [screen, state.timeLeft, audio])

  // SFX triggers from state changes
  useEffect(() => {
    if (screen !== 'playing') return

    const orderCount = state.orders.filter(o => !o.served).length
    const fireCount = Object.values(state.stations).filter(s => s.overheated).length
    const cookingCount = Object.values(state.stations)
      .reduce((n, s) => n + s.slots.filter(sl => sl.state === 'cooking').length, 0)

    const latestCooledAt = Math.max(0, ...Object.values(state.stations).map(s => s.lastCooledAt ?? 0))

    if (orderCount > prevOrderCount.current)                          audio.playSfx('order-spawn')
    if (state.served > prevServed.current)                            audio.playSfx('serve-success')
    if (state.lost > prevLost.current)                                audio.playSfx('order-expired')
    if (cookingCount > prevCookingCount.current)                      audio.playSfx('cook-start')
    if (state.preparedItems.length > prevPreparedCount.current)       audio.playSfx('take-item')
    if (fireCount > prevFireCount.current)                            audio.playSfx('fire-alarm')
    if (fireCount === 0 && prevFireCount.current > 0)                 audio.stopSfx('fire-alarm')
    if (latestCooledAt > prevLastCooledAt.current)                    audio.playSfx('cool')

    prevOrderCount.current    = orderCount
    prevServed.current        = state.served
    prevLost.current          = state.lost
    prevFireCount.current     = fireCount
    prevCookingCount.current  = cookingCount
    prevPreparedCount.current = state.preparedItems.length
    prevLastCooledAt.current  = latestCooledAt
  })

  // Error buzzer — type-based check, no text parsing
  useEffect(() => {
    if (screen !== 'playing') return
    const msgCount = state.chatMessages.length
    if (msgCount > prevMsgCount.current) {
      const newMessages = state.chatMessages.slice(prevMsgCount.current)
      if (newMessages.some(m => m.type === 'error')) audio.playSfx('error-buzzer')
    }
    prevMsgCount.current = msgCount
  })
}
