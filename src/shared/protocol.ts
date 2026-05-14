export type RoomCode = string  // 4 uppercase letters, e.g. "ABCD"
export type PlayerId = string  // server-generated ~8 chars

// ── Client → Server ──────────────────────────────────────────────
export interface PlayerJoinMsg { code: RoomCode; nickname: string }
export interface PlayerJoinAck { playerId: PlayerId; nickname: string }
export interface PlayerJoinErr { error: string }

export interface PlayerActionMsg {
  code: RoomCode
  playerId: PlayerId
  command: string // raw text, e.g. "chop lettuce" or "!red"
}

export interface HostSnapshotMsg {
  code: RoomCode
  snapshot: SharedSnapshot
  perPlayer?: Record<PlayerId, PartialPlayerView>
}

export interface HostLockJoinsMsg { code: RoomCode }
export interface HostUnlockJoinsMsg { code: RoomCode }

// ── Server → Host ────────────────────────────────────────────────
export interface PlayerJoinedEvent { playerId: PlayerId; nickname: string }
export interface PlayerLeftEvent { playerId: PlayerId }
export interface PlayerCommandEvent {
  playerId: PlayerId
  nickname: string
  command: string
}

// ── Server → Player ──────────────────────────────────────────────
export interface SnapshotEvent {
  shared: SharedSnapshot
  you: PartialPlayerView
}
export interface RoomClosedEvent { reason: 'host_gone' | 'kicked' }

// ── Snapshot shape (what phones render from) ─────────────────────
export interface SharedSnapshot {
  phase: 'lobby' | 'playing' | 'gameover'
  timeRemainingMs: number
  money: number
  teamMoney?: { red: number; blue: number }  // PvP only
  orders: Array<{
    id: number
    dish: string
    emoji: string
    needed: string[]   // ingredient targets still needed
    patiencePct: number
  }>
  stations: Array<{
    name: string
    heatPct: number
    overheated: boolean
    busySlots: number
    maxSlots: number
  }>
}

export interface PartialPlayerView {
  cooldownMs: number
  team?: 'red' | 'blue'
  personalScore?: number
}
