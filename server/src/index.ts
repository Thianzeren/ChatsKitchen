import { createServer } from 'http'
import { Server, Socket } from 'socket.io'
import type { PlayerJoinMsg, PlayerActionMsg, HostSnapshotMsg } from '../../src/shared/protocol.js'

const http = createServer()
const io = new Server(http, {
  cors: { origin: ['https://letchatcook.vercel.app', 'http://localhost:5174'] },
  transports: ['websocket', 'polling'],
})

interface PlayerRecord {
  socketId: string
  nickname: string
  disconnectedAt?: number
}

interface Room {
  code: string
  hostSocketId: string
  players: Map<string, PlayerRecord>
  locked: boolean
  hostDisconnectedAt?: number
}

const rooms = new Map<string, Room>()
const HOST_GRACE_MS = 30_000
const PLAYER_RECONNECT_GRACE_MS = 60_000

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

// Token bucket: 10 commands/sec per player
const buckets = new Map<string, { tokens: number; last: number }>()
function rateOk(pid: string): boolean {
  const now = Date.now()
  const b = buckets.get(pid) ?? { tokens: 10, last: now }
  const elapsed = (now - b.last) / 1000
  b.tokens = Math.min(10, b.tokens + elapsed * 10)
  b.last = now
  if (b.tokens < 1) { buckets.set(pid, b); return false }
  b.tokens -= 1
  buckets.set(pid, b)
  return true
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
    room.players.forEach((_, pid) => buckets.delete(pid))
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
    if (room.players.size >= 20) return ack({ error: 'Room full' })
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
    if (!rateOk(msg.playerId)) return
    io.to(`host:${msg.code}`).emit('room:player_command', {
      playerId: msg.playerId,
      nickname: p.nickname,
      command: String(msg.command).slice(0, 64),
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
        if (r?.hostDisconnectedAt && Date.now() - r.hostDisconnectedAt >= HOST_GRACE_MS) {
          r.players.forEach((_, pid) => buckets.delete(pid))
          io.to(`players:${capturedHostCode}`).emit('room:closed', { reason: 'host_gone' })
          rooms.delete(capturedHostCode)
        }
      }, HOST_GRACE_MS + 500)
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
          if (record?.disconnectedAt && Date.now() - record.disconnectedAt >= PLAYER_RECONNECT_GRACE_MS) {
            r.players.delete(capturedPlayerId)
            buckets.delete(capturedPlayerId)
          }
        }, PLAYER_RECONNECT_GRACE_MS + 500)
      }
    }
  })
})

const PORT = Number(process.env.PORT) || 8080
http.listen(PORT, () => console.log(`relay on :${PORT}`))
