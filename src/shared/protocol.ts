export type RoomCode = string  // 4 uppercase letters, e.g. "ABCD"
export type PlayerId = string  // server-generated ~8 chars

// ── Client → Server ──────────────────────────────────────────────
export interface PlayerJoinMsg { code: RoomCode; nickname: string; playerId?: PlayerId }
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

// ── Adventure vote screens (recipe draft / pantry shop) ──────────
// Present when the host is on an Adventure choice-vote screen so phones can
// render voting buttons instead of the "waiting for host" lobby.
export interface VoteOptionView {
  index: number       // 1-based; the !N command this option maps to
  label: string       // dish or garnish name
  emoji: string       // dish/garnish icon
  detail?: string     // reward "$65" (recipe) or "$40 · rare" (shop)
  votes: number       // current tally
  disabled?: boolean  // shop: unaffordable on this option
}

export interface VoteSnapshot {
  kind: 'recipe' | 'shop'
  title: string                 // "Add a Recipe" / "The Pantry"
  instruction: string           // short how-to line
  money?: number                // run bank (shop only)
  options: VoteOptionView[]
  skipCommand: string | null    // "!skip" / "!done" / null
  skipLabel: string | null      // "Skip" / "Done"
  timeLeftMs: number | null
  timeMaxMs: number | null      // original duration, for the timer bar
  paused: boolean
  resolved: boolean
}

// ── Snapshot shape (what phones render from) ─────────────────────
export interface SharedSnapshot {
  phase: 'lobby' | 'playing' | 'gameover'
  timeRemainingMs: number
  money: number
  teamMoney?: { red: number; blue: number }  // PvP only
  vote?: VoteSnapshot                          // present on Adventure vote screens
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
  }>
}

export interface PartialPlayerView {
  cooldownMs: number
  team?: 'red' | 'blue'
  personalScore?: number
}
