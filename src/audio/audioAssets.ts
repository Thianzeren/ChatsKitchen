export interface TrackDef {
  src: string[]
  loop: boolean
  volume: number
}

export interface SfxDef {
  src: string[]
  volume: number
  loop?: boolean
}

export const MUSIC_TRACKS: Record<string, TrackDef> = {
  menu:     { src: ['/audio/music/menu.mp3'],     loop: true,  volume: 0.5 },
  gameplay: { src: ['/audio/music/gameplay.mp3'], loop: true,  volume: 0.5 },
  intense:  { src: ['/audio/music/intense.mp3'],  loop: true,  volume: 0.5 },
  gameover: { src: ['/audio/music/gameover.mp3'], loop: false, volume: 0.5 },
}

export const SFX: Record<string, SfxDef> = {
  'cook-start':        { src: ['/audio/sfx/cook-start.mp3'],        volume: 0.6 },
  'serve-success':     { src: ['/audio/sfx/serve-success.mp3'],     volume: 0.7 },
  'fire-alarm':        { src: ['/audio/sfx/fire-alarm.mp3'],        volume: 0.6, loop: true },
  'fire-extinguished': { src: ['/audio/sfx/fire-extinguished.mp3'], volume: 0.6 },
  'cool':              { src: ['/audio/sfx/fire-extinguished.mp3'], volume: 0.4 },
  'order-spawn':       { src: ['/audio/sfx/order-spawn.mp3'],       volume: 0.5 },
  'order-expired':     { src: ['/audio/sfx/order-expired.mp3'],     volume: 0.6 },
  'error-buzzer':      { src: ['/audio/sfx/error-buzzer.mp3'],      volume: 0.4 },
  'plating':           { src: ['/audio/sfx/plating.mp3'],           volume: 0.5 },
  'take-item':         { src: ['/audio/sfx/take-item.mp3'],         volume: 0.5 },
  'countdown-beep':    { src: ['/audio/sfx/countdown-beep.mp3'],    volume: 0.6 },
  'round-over':        { src: ['/audio/sfx/round-over.mp3'],        volume: 0.3 },
  'adventure-victory': { src: ['/audio/sfx/victory.mp3'],           volume: 0.7 },
}

// One-shot event stings (success / fail)
export const EVENT_SFX: Record<string, SfxDef> = {
  'event-success': { src: ['/audio/events/typing_frenzy-success.mp3'], volume: 0.5 },
  'event-fail':    { src: ['/audio/events/dance-start.mp3'],           volume: 0.5 },
}

// Looping ambient tracks (duck gameplay/intense music while active)
export const EVENT_AMBIENT: Record<string, SfxDef> = {
  'event-rat-ambient':         { src: ['/audio/events/rat_invasion-ambient.mp3'],      volume: 0.4 },
  'event-angry-chef-ambient':  { src: ['/audio/events/angry_chef-ambient.mp3'],        volume: 0.35 },
  'event-power-trip-ambient':  { src: ['/audio/events/power_trip-ambient.mp3'],        volume: 0.4 },
  'event-smoke-blast-ambient': { src: ['/audio/events/smoke_blast-ambient.mp3'],       volume: 0.4 },
  'event-glitch-ambient':      { src: ['/audio/events/glitched_orders-ambient.mp3'],   volume: 0.4 },
  'event-chant-ambient':       { src: ['/audio/events/chefs_chant-ambient.mp3'],       volume: 0.45 },
  'event-mystery-ambient':     { src: ['/audio/events/mystery_recipe-ambient.mp3'],    volume: 0.35 },
  'event-frenzy-ambient':      { src: ['/audio/events/typing_frenzy-ambient.mp3'],     volume: 0.45 },
  'event-dance-ambient':       { src: ['/audio/events/dance-ambient.mp3'],             volume: 0.5 },
}
