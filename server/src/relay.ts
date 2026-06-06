import { createServer, Server as HttpServer } from 'http'
import { Server, Socket } from 'socket.io'
import type { PlayerJoinMsg, PlayerActionMsg, HostSnapshotMsg } from '../../src/shared/protocol.js'

// ── Tunables / defaults ──────────────────────────────────────────
const DEFAULT_HOST_GRACE_MS = 30_000
const DEFAULT_PLAYER_RECONNECT_GRACE_MS = 60_000
const DEFAULT_CORS_ORIGIN = ['https://letchatcook.vercel.app', 'http://localhost:5174']
const MAX_PLAYERS_PER_ROOM = 20
const MAX_COMMAND_LEN = 64
const RATE_TOKENS = 10 // commands per second per player

export interface PlayerRecord {
  socketId: string
  nickname: string
  disconnectedAt?: number
}

export interface Room {
  code: string
  hostSocketId: string
  players: Map<string, PlayerRecord>
  locked: boolean
  hostDisconnectedAt?: number
}

export interface RelayOptions {
  corsOrigin?: string | string[]
  hostGraceMs?: number
  playerGraceMs?: number
}

export interface Relay {
  http: HttpServer
  io: Server
  rooms: Map<string, Room>
}

// Token bucket: RATE_TOKENS commands/sec per player. Pure + clock-injectable so
// it can be unit-tested deterministically. State lives in the returned closure.
export function createRateLimiter(now: () => number = Date.now) {
  const buckets = new Map<string, { tokens: number; last: number }>()
  return {
    buckets,
    ok(pid: string): boolean {
      const t = now()
      const b = buckets.get(pid) ?? { tokens: RATE_TOKENS, last: t }
      const elapsed = (t - b.last) / 1000
      b.tokens = Math.min(RATE_TOKENS, b.tokens + elapsed * RATE_TOKENS)
      b.last = t
      if (b.tokens < 1) { buckets.set(pid, b); return false }
      b.tokens -= 1
      buckets.set(pid, b)
      return true
    },
  }
}

// Build a relay instance (http + socket.io + handlers) without listening, so the
// production entry and tests can both drive it. State (rooms, rate buckets) is
// instance-scoped — each call is fully isolated.
export function createRelay(opts: RelayOptions = {}): Relay {
  const corsOrigin = opts.corsOrigin ?? DEFAULT_CORS_ORIGIN
  const hostGraceMs = opts.hostGraceMs ?? DEFAULT_HOST_GRACE_MS
  const playerGraceMs = opts.playerGraceMs ?? DEFAULT_PLAYER_RECONNECT_GRACE_MS

  const http = createServer()
  const io = new Server(http, {
    cors: { origin: corsOrigin },
    transports: ['websocket', 'polling'],
  })

  const rooms = new Map<string, Room>()
  const limiter = createRateLimiter()

  function makeCode(): string {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    let c = ''
    do {
      c = ''
      for (let i = 0; i < 4; i++) c += A[Math.floor(Math.random() * A.length)]
    } while (rooms.has(c))
    return c
  }

  function makePlayerId(): string {
    return Math.random().toString(36).slice(2, 10)
  }

  io.on('connection', (socket: Socket) => {
    let role: 'host' | 'player' | null = null
    let roomCode: string | null = null
    let playerId: string | null = null

    socket.on('host:create', (_: unknown, ack: (r: { code: string }) => void) => {
      const code = makeCode()
      rooms.set(code, { code, hostSocketId: socket.id, players: new Map(), locked: false })
      socket.join(`room:${code}`)
      socket.join(`host:${code}`)
      role = 'host'
      roomCode = code
      ack({ code })
    })

    socket.on('host:close', (msg: { code: string }) => {
      const room = rooms.get(msg.code)
      if (!room || room.hostSocketId !== socket.id) return
      io.to(`players:${msg.code}`).emit('room:closed', { reason: 'host_gone' })
      room.players.forEach((_, pid) => limiter.buckets.delete(pid))
      rooms.delete(msg.code)
    })

    socket.on('host:lock_joins', (msg: { code: string }) => {
      const room = rooms.get(msg.code)
      if (!room || room.hostSocketId !== socket.id) return
      room.locked = true
    })

    socket.on('host:unlock_joins', (msg: { code: string }) => {
      const room = rooms.get(msg.code)
      if (!room || room.hostSocketId !== socket.id) return
      room.locked = false
    })

    socket.on('player:join', (msg: PlayerJoinMsg, ack: (r: { playerId?: string; nickname?: string; error?: string }) => void) => {
      const room = rooms.get(msg.code)
      if (!room) return ack({ error: 'Room not found' })

      // Reconnection: player provides their existing playerId
      if (msg.playerId) {
        const existing = room.players.get(msg.playerId)
        if (existing) {
          // Restore the player on the new socket regardless of lock state
          existing.socketId = socket.id
          existing.disconnectedAt = undefined
          socket.join(`room:${msg.code}`)
          socket.join(`players:${msg.code}`)
          role = 'player'
          roomCode = msg.code
          playerId = msg.playerId
          ack({ playerId: msg.playerId, nickname: existing.nickname })
          io.to(`host:${msg.code}`).emit('room:player_joined', { playerId: msg.playerId, nickname: existing.nickname })
          return
        }
      }

      // New join
      if (room.locked) return ack({ error: 'Game already in progress — wait for next round' })
      if (room.players.size >= MAX_PLAYERS_PER_ROOM) return ack({ error: 'Room full' })
      const pid = makePlayerId()
      const nickname = (msg.nickname || '').slice(0, 16).trim() || 'guest'
      room.players.set(pid, { socketId: socket.id, nickname })
      socket.join(`room:${msg.code}`)
      socket.join(`players:${msg.code}`)
      role = 'player'
      roomCode = msg.code
      playerId = pid
      ack({ playerId: pid, nickname })
      io.to(`host:${msg.code}`).emit('room:player_joined', { playerId: pid, nickname })
    })

    socket.on('player:action', (msg: PlayerActionMsg) => {
      const room = rooms.get(msg.code)
      if (!room) return
      const p = room.players.get(msg.playerId)
      if (!p || p.socketId !== socket.id) return
      if (!limiter.ok(msg.playerId)) return
      io.to(`host:${msg.code}`).emit('room:player_command', {
        playerId: msg.playerId,
        nickname: p.nickname,
        command: String(msg.command).slice(0, MAX_COMMAND_LEN),
      })
    })

    socket.on('host:snapshot', (msg: HostSnapshotMsg) => {
      const room = rooms.get(msg.code)
      if (!room || room.hostSocketId !== socket.id) return
      if (room.hostDisconnectedAt) return
      if (msg.perPlayer) {
        for (const [pid, view] of Object.entries(msg.perPlayer)) {
          const p = room.players.get(pid)
          if (p) io.to(p.socketId).emit('player:snapshot', { shared: msg.snapshot, you: view })
        }
      } else {
        io.to(`players:${msg.code}`).emit('player:snapshot', {
          shared: msg.snapshot,
          you: { cooldownMs: 0 },
        })
      }
    })

    socket.on('disconnect', () => {
      if (!roomCode) return
      const room = rooms.get(roomCode)
      if (!room) return
      if (role === 'host' && room.hostSocketId === socket.id) {
        room.hostDisconnectedAt = Date.now()
        const capturedHostCode = roomCode
        setTimeout(() => {
          const r = rooms.get(capturedHostCode)
          if (r?.hostDisconnectedAt && Date.now() - r.hostDisconnectedAt >= hostGraceMs) {
            r.players.forEach((_, pid) => limiter.buckets.delete(pid))
            io.to(`players:${capturedHostCode}`).emit('room:closed', { reason: 'host_gone' })
            rooms.delete(capturedHostCode)
          }
        }, hostGraceMs + 500)
      } else if (role === 'player' && playerId) {
        const p = room.players.get(playerId)
        if (p) {
          // Mark disconnected but keep record so the player can reconnect
          p.disconnectedAt = Date.now()
          io.to(`host:${roomCode}`).emit('room:player_left', { playerId })
          const capturedPlayerCode = roomCode
          const capturedPlayerId = playerId
          setTimeout(() => {
            const r = rooms.get(capturedPlayerCode)
            if (!r) return
            const record = r.players.get(capturedPlayerId)
            if (record?.disconnectedAt && Date.now() - record.disconnectedAt >= playerGraceMs) {
              r.players.delete(capturedPlayerId)
              limiter.buckets.delete(capturedPlayerId)
            }
          }, playerGraceMs + 500)
        }
      }
    })
  })

  return { http, io, rooms }
}
