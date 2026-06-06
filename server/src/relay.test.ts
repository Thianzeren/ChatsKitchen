import { describe, it, expect, afterEach } from 'vitest'
import type { AddressInfo } from 'net'
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client'
import { createRelay, createRateLimiter, type Relay, type RelayOptions } from './relay.js'

// ── Harness ──────────────────────────────────────────────────────
let relay: Relay | null = null
const clients: ClientSocket[] = []

function startRelay(opts: RelayOptions = {}): Promise<string> {
  const r = createRelay(opts)
  relay = r
  return new Promise(resolve => {
    r.http.listen(0, () => {
      const { port } = r.http.address() as AddressInfo
      resolve(`http://localhost:${port}`)
    })
  })
}

function connect(url: string): ClientSocket {
  const c = ioc(url, { transports: ['websocket'], forceNew: true })
  clients.push(c)
  return c
}

function emitAck<T>(c: ClientSocket, ev: string, payload: unknown = null): Promise<T> {
  return new Promise(res => c.emit(ev, payload, (r: T) => res(r)))
}

function once<T>(c: ClientSocket, ev: string, timeoutMs = 1500): Promise<T> {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`timeout waiting for "${ev}"`)), timeoutMs)
    c.once(ev, (d: T) => { clearTimeout(t); res(d) })
  })
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

// Create a room and return its code (host stays connected).
async function createRoom(url: string, host?: ClientSocket): Promise<{ host: ClientSocket; code: string }> {
  const h = host ?? connect(url)
  const { code } = await emitAck<{ code: string }>(h, 'host:create')
  return { host: h, code }
}

afterEach(async () => {
  for (const c of clients) c.disconnect()
  clients.length = 0
  if (relay) {
    relay.io.close()
    relay.http.close()
    relay = null
  }
  await delay(10)
})

// ── Rate limiter (pure unit) ─────────────────────────────────────
describe('createRateLimiter', () => {
  it('allows 10 commands then blocks the 11th, and refills over time', () => {
    let t = 0
    const rl = createRateLimiter(() => t)
    for (let i = 0; i < 10; i++) expect(rl.ok('p')).toBe(true)
    expect(rl.ok('p')).toBe(false)       // bucket empty
    t = 1000                              // 1s later → +10 tokens (capped at 10)
    expect(rl.ok('p')).toBe(true)
  })

  it('tracks buckets per player independently', () => {
    const t = 0
    const rl = createRateLimiter(() => t)
    for (let i = 0; i < 10; i++) rl.ok('a')
    expect(rl.ok('a')).toBe(false)
    expect(rl.ok('b')).toBe(true)         // separate bucket
  })
})

// ── Relay integration (real socket.io) ───────────────────────────
describe('createRelay', () => {
  it('host:create returns a 4-letter code from the safe alphabet', async () => {
    const url = await startRelay()
    const { code } = await createRoom(url)
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/)
    expect(relay!.rooms.has(code)).toBe(true)
  })

  it('a player joins a room and the host is notified', async () => {
    const url = await startRelay()
    const { host, code } = await createRoom(url)

    const player = connect(url)
    const joinedAtHost = once<{ playerId: string; nickname: string }>(host, 'room:player_joined')
    const ack = await emitAck<{ playerId?: string; nickname?: string; error?: string }>(
      player, 'player:join', { code, nickname: 'Alice' },
    )

    expect(ack.error).toBeUndefined()
    expect(ack.playerId).toBeTruthy()
    expect(ack.nickname).toBe('Alice')

    const evt = await joinedAtHost
    expect(evt.nickname).toBe('Alice')
    expect(evt.playerId).toBe(ack.playerId)
    expect(relay!.rooms.get(code)!.players.size).toBe(1)
  })

  it('rejects joining a room that does not exist', async () => {
    const url = await startRelay()
    const player = connect(url)
    const ack = await emitAck<{ error?: string }>(player, 'player:join', { code: 'ZZZZ', nickname: 'x' })
    expect(ack.error).toBe('Room not found')
  })

  it('rejects new joins once the room is locked', async () => {
    const url = await startRelay()
    const { host, code } = await createRoom(url)
    host.emit('host:lock_joins', { code })
    await delay(50) // let the lock apply (different socket → no ordering guarantee)

    const player = connect(url)
    const ack = await emitAck<{ error?: string }>(player, 'player:join', { code, nickname: 'late' })
    expect(ack.error).toMatch(/in progress/i)
  })

  it('lets a player reconnect with their playerId, keeping the original nickname', async () => {
    const url = await startRelay()
    const { code } = await createRoom(url)

    const p1 = connect(url)
    const first = await emitAck<{ playerId?: string }>(p1, 'player:join', { code, nickname: 'Bob' })
    const pid = first.playerId!

    // A fresh socket re-joins with the same playerId.
    const p2 = connect(url)
    const again = await emitAck<{ playerId?: string; nickname?: string }>(
      p2, 'player:join', { code, playerId: pid, nickname: 'ignored-on-reconnect' },
    )
    expect(again.playerId).toBe(pid)
    expect(again.nickname).toBe('Bob')       // restored, not overwritten
    expect(relay!.rooms.get(code)!.players.size).toBe(1)
  })

  it('relays a player action to the host (truncated to 64 chars)', async () => {
    const url = await startRelay()
    const { host, code } = await createRoom(url)
    const player = connect(url)
    const { playerId } = await emitAck<{ playerId?: string }>(player, 'player:join', { code, nickname: 'Cara' })

    const cmd = once<{ playerId: string; nickname: string; command: string }>(host, 'room:player_command')
    player.emit('player:action', { code, playerId, command: 'chop lettuce' })

    const got = await cmd
    expect(got).toMatchObject({ playerId, nickname: 'Cara', command: 'chop lettuce' })
  })

  it('rate-limits a flood of actions to at most 10 relayed commands', async () => {
    const url = await startRelay()
    const { host, code } = await createRoom(url)
    const player = connect(url)
    const { playerId } = await emitAck<{ playerId?: string }>(player, 'player:join', { code, nickname: 'Flood' })

    let relayed = 0
    host.on('room:player_command', () => { relayed++ })
    for (let i = 0; i < 15; i++) player.emit('player:action', { code, playerId, command: `c${i}` })

    await delay(150)
    expect(relayed).toBeGreaterThan(0)
    expect(relayed).toBeLessThanOrEqual(10) // token bucket caps the burst
  })

  it('host:close notifies players and deletes the room', async () => {
    const url = await startRelay()
    const { host, code } = await createRoom(url)
    const player = connect(url)
    await emitAck(player, 'player:join', { code, nickname: 'Dee' })

    const closed = once<{ reason: string }>(player, 'room:closed')
    host.emit('host:close', { code })
    const evt = await closed
    expect(evt.reason).toBe('host_gone')

    await delay(20)
    expect(relay!.rooms.has(code)).toBe(false)
  })

  it('closes the room and notifies players after the host grace expires', async () => {
    const url = await startRelay({ hostGraceMs: 40 }) // setTimeout fires at grace + 500ms
    const { host, code } = await createRoom(url)
    const player = connect(url)
    await emitAck(player, 'player:join', { code, nickname: 'Eve' })

    const closed = once<{ reason: string }>(player, 'room:closed', 2000)
    host.disconnect()

    const evt = await closed
    expect(evt.reason).toBe('host_gone')
    expect(relay!.rooms.has(code)).toBe(false)
  })
})
