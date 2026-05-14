# Jackbox-Style Multiplayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Room" chat mode where the host gets a 4-letter code, players join at `/play` on their phones, and phone buttons emit game commands through a Socket.IO relay — the game reducer stays unchanged.

**Architecture:** A dumb Socket.IO relay server (Fly.io) routes string commands from phone browsers to the host's browser, which feeds them into the existing `handleTwitchMessage` path. Phones receive periodic `SharedSnapshot` payloads (not full `GameState`) to render a controller UI. The `/play` route is a separate React component tree bootstrapped in `main.tsx` before any game hooks run.

**Tech Stack:** Socket.IO 4 (`socket.io` on server, `socket.io-client` on client), `qrcode` npm package for QR rendering, Node 20 + tsx for local server dev, Fly.io for deploy.

**Decisions baked in:**
- Players can only join during lobby phase (server enforces via `host:lock_joins` / `host:unlock_joins`)
- Host reuses existing Free Play / PvP / Adventure flow to start rounds
- Phones show a gameover screen when `snapshot.phase === 'gameover'`
- Player presence list shown on host screen only during lobby/setup (not during gameplay)
- Bots keep working as-is; host owns them

---

## File Map

### New files
| Path | Responsibility |
|------|---------------|
| `src/shared/protocol.ts` | Shared types for all socket messages; imported by both React app and relay server |
| `src/hooks/useRoomHost.ts` | Host-side socket hook; mirrors `useTwitchChat` shape |
| `src/state/snapshot.ts` | Pure `gameStateToSnapshot()` function |
| `src/components/RoomHostCard.tsx` | QR code + room code + player list — shown in MainMenu when room is active |
| `src/components/RoomHostCard.module.css` | Styles for RoomHostCard |
| `src/controller/ControllerApp.tsx` | Root component for `/play` route; owns stage state machine |
| `src/controller/usePlayerSocket.ts` | Player-side socket hook |
| `src/controller/JoinScreen.tsx` | Code + nickname input, sessionStorage stash |
| `src/controller/JoinScreen.module.css` | Mobile-first styles |
| `src/controller/Lobby.tsx` | Waiting room + PvP team picker + gameover screen |
| `src/controller/Lobby.module.css` | Mobile-first styles |
| `src/controller/Controller.tsx` | Main controller: verb → ingredient two-tap + cooldown ring |
| `src/controller/Controller.module.css` | Mobile-first styles |
| `server/src/index.ts` | Socket.IO relay (~130 lines); dumb router, no game logic |
| `server/package.json` | Server dependencies |
| `server/tsconfig.json` | Server TypeScript config |
| `server/Dockerfile` | Production container |
| `server/fly.toml` | Fly.io app config |
| `vercel.json` | SPA rewrite so `/play` serves `index.html` |

### Modified files
| Path | Change |
|------|--------|
| `src/main.tsx` | Route `/play` → `<ControllerApp />`, else `<App />` |
| `src/App.tsx` | Add `chatMode` state, wire `useRoomHost`, lock/unlock joins, snapshot emission effect |
| `src/components/MainMenu.tsx` | Add room mode card (code display + player list when active, "Host Room" button when not) |
| `src/components/MainMenu.module.css` | Styles for room card |
| `package.json` | Add `socket.io-client`, `qrcode`, `@types/qrcode` |

### Unchanged files (verify at end)
- `src/state/gameReducer.ts`
- `src/state/commandProcessor.ts`
- `src/hooks/useTwitchChat.ts`
- `src/hooks/useGameLoop.ts`

---

## Task 1: Shared protocol types + install client packages

**Files:**
- Create: `src/shared/protocol.ts`
- Modify: `package.json`

- [ ] **Step 1: Install client-side packages**

```bash
cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen"
npm install socket.io-client qrcode
npm install --save-dev @types/qrcode
```

Expected: packages appear in `node_modules/`, `package.json` updated.

- [ ] **Step 2: Create `src/shared/protocol.ts`**

```ts
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
```

- [ ] **Step 3: Verify types compile**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors related to `src/shared/`.

- [ ] **Step 4: Commit**

```bash
git add src/shared/protocol.ts package.json package-lock.json
git commit -m "feat: add shared socket protocol types and install socket.io-client + qrcode"
```

---

## Task 2: Relay server

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/index.ts`
- Create: `server/Dockerfile`
- Create: `server/fly.toml`

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "chatskitchen-relay",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts"
  },
  "dependencies": {
    "socket.io": "^4.7.5"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true
  },
  "include": ["src/**/*", "../src/shared/**/*"]
}
```

- [ ] **Step 3: Install server deps**

```bash
cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen/server"
npm install
```

- [ ] **Step 4: Create `server/src/index.ts`**

```ts
import { createServer } from 'http'
import { Server, Socket } from 'socket.io'
import type { PlayerJoinMsg, PlayerActionMsg, HostSnapshotMsg } from '../../src/shared/protocol.js'

const http = createServer()
const io = new Server(http, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
})

interface Room {
  code: string
  hostSocketId: string
  players: Map<string, { socketId: string; nickname: string }>
  locked: boolean
  hostDisconnectedAt?: number
}

const rooms = new Map<string, Room>()
const HOST_GRACE_MS = 30_000

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

  socket.on('player:join', (msg: PlayerJoinMsg, ack: (r: PlayerJoinMsg | { error: string }) => void) => {
    const room = rooms.get(msg.code)
    if (!room) return ack({ error: 'Room not found' } as any)
    if (room.locked) return ack({ error: 'Game already in progress — wait for next round' } as any)
    if (room.players.size >= 20) return ack({ error: 'Room full' } as any)
    const pid = makePlayerId()
    const nickname = (msg.nickname || '').slice(0, 16).trim() || 'guest'
    room.players.set(pid, { socketId: socket.id, nickname })
    socket.join(`room:${msg.code}`)
    socket.join(`players:${msg.code}`)
    role = 'player'
    roomCode = msg.code
    playerId = pid
    ack({ playerId: pid, nickname } as any)
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
      setTimeout(() => {
        const r = rooms.get(roomCode!)
        if (r?.hostDisconnectedAt && Date.now() - r.hostDisconnectedAt >= HOST_GRACE_MS) {
          io.to(`players:${roomCode!}`).emit('room:closed', { reason: 'host_gone' })
          rooms.delete(roomCode!)
        }
      }, HOST_GRACE_MS + 500)
    } else if (role === 'player' && playerId) {
      room.players.delete(playerId)
      io.to(`host:${roomCode}`).emit('room:player_left', { playerId })
    }
  })
})

const PORT = Number(process.env.PORT) || 8080
http.listen(PORT, () => console.log(`relay on :${PORT}`))
```

- [ ] **Step 5: Verify server compiles**

```bash
cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen/server"
npm run build 2>&1
```

Expected: outputs to `server/dist/`, no TypeScript errors.

- [ ] **Step 6: Smoke-test the server**

In one terminal:
```bash
cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen/server"
npm run dev
```
Expected output: `relay on :8080`

In another terminal (requires `wscat`: `npm install -g wscat`):
```bash
# Alternatively, open browser console at http://localhost:8080 and use socket.io CDN
# Or just proceed — you'll verify end-to-end in Task 5
```

- [ ] **Step 7: Create `server/Dockerfile`**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist ./dist
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

- [ ] **Step 8: Create `server/fly.toml`**

```toml
app = "chatskitchen-relay"
primary_region = "sin"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "suspend"
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  size = "shared-cpu-1x"
  memory = "256mb"
```

- [ ] **Step 9: Commit**

```bash
cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen"
git add server/
git commit -m "feat: add Socket.IO relay server with room create/join/lock/snapshot/disconnect"
```

---

## Task 3: `useRoomHost` hook

**Files:**
- Create: `src/hooks/useRoomHost.ts`

- [ ] **Step 1: Create `src/hooks/useRoomHost.ts`**

```ts
import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import type { SharedSnapshot, PartialPlayerView } from '../shared/protocol'

const RELAY_URL = import.meta.env.VITE_RELAY_URL ?? 'http://localhost:8080'

interface Args {
  enabled: boolean
  onPlayerCommand: (nickname: string, command: string) => void
  onPlayerJoined: (playerId: string, nickname: string) => void
  onPlayerLeft: (playerId: string) => void
}

export function useRoomHost({ enabled, onPlayerCommand, onPlayerJoined, onPlayerLeft }: Args) {
  const [code, setCode] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const codeRef = useRef<string | null>(null)

  // Stable refs for callbacks so the useEffect dep array stays [enabled]
  const onPlayerCommandRef = useRef(onPlayerCommand)
  const onPlayerJoinedRef = useRef(onPlayerJoined)
  const onPlayerLeftRef = useRef(onPlayerLeft)
  onPlayerCommandRef.current = onPlayerCommand
  onPlayerJoinedRef.current = onPlayerJoined
  onPlayerLeftRef.current = onPlayerLeft

  useEffect(() => {
    if (!enabled) return
    const s = io(RELAY_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = s

    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))

    s.emit('host:create', {}, ({ code }: { code: string }) => {
      setCode(code)
      codeRef.current = code
    })

    s.on('room:player_joined', (e: { playerId: string; nickname: string }) => {
      onPlayerJoinedRef.current(e.playerId, e.nickname)
    })
    s.on('room:player_left', (e: { playerId: string }) => {
      onPlayerLeftRef.current(e.playerId)
    })
    s.on('room:player_command', (e: { nickname: string; command: string }) => {
      onPlayerCommandRef.current(e.nickname, e.command)
    })

    return () => {
      s.disconnect()
      socketRef.current = null
      codeRef.current = null
      setCode(null)
      setConnected(false)
    }
  }, [enabled])

  const sendSnapshot = (snapshot: SharedSnapshot, perPlayer?: Record<string, PartialPlayerView>) => {
    const c = codeRef.current
    if (!c || !socketRef.current) return
    socketRef.current.emit('host:snapshot', { code: c, snapshot, perPlayer })
  }

  const lockJoins = () => {
    const c = codeRef.current
    if (!c || !socketRef.current) return
    socketRef.current.emit('host:lock_joins', { code: c })
  }

  const unlockJoins = () => {
    const c = codeRef.current
    if (!c || !socketRef.current) return
    socketRef.current.emit('host:unlock_joins', { code: c })
  }

  return { code, connected, sendSnapshot, lockJoins, unlockJoins }
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen"
npm run build 2>&1 | tail -20
```

Expected: no new TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useRoomHost.ts
git commit -m "feat: add useRoomHost hook (host-side socket.io client)"
```

---

## Task 4: App.tsx — mode state, command routing, join locking, snapshot emission

**Files:**
- Modify: `src/App.tsx`

This task wires `useRoomHost` into App.tsx. Player commands from the room flow into the same `handleTwitchMessage` path as Twitch. Join locking fires when the game starts/ends. Snapshots are emitted every 300ms when room mode is active.

- [ ] **Step 1: Add `chatMode` state and `roomPlayers` tracking near the top of the `App` function body (after existing state declarations, before `startFreePlay`)**

In `src/App.tsx`, find the block ending with:
```ts
  const [showNoTwitchPrompt, setShowNoTwitchPrompt] = useState(false)
  const pendingActionRef = useRef<(() => void) | null>(null)
```

Add after it:
```ts
  const [chatMode, setChatMode] = useState<'local' | 'twitch' | 'room'>('local')
  const [roomPlayers, setRoomPlayers] = useState<Array<{ id: string; nickname: string }>>([])
  const chatModeRef = useRef(chatMode)
  chatModeRef.current = chatMode
```

- [ ] **Step 2: Modify the `useTwitchChat` call to disable Twitch when room mode is active**

Find:
```ts
  const twitchChat = useTwitchChat(twitchChannel, handleTwitchMessage)
```

Replace with:
```ts
  const effectiveTwitchChannel = chatMode === 'twitch' ? twitchChannel : null
  const twitchChat = useTwitchChat(effectiveTwitchChannel, handleTwitchMessage)
```

- [ ] **Step 3: Add `useRoomHost` call after the `twitchChat` line**

```ts
  const room = useRoomHost({
    enabled: chatMode === 'room',
    onPlayerCommand: (nickname, command) => handleTwitchMessage(nickname, command, false),
    onPlayerJoined: (id, nickname) => setRoomPlayers(prev => [...prev, { id, nickname }]),
    onPlayerLeft: (id) => setRoomPlayers(prev => prev.filter(p => p.id !== id)),
  })
```

Also add the import at the top of `src/App.tsx`:
```ts
import { useRoomHost } from './hooks/useRoomHost'
```

- [ ] **Step 4: Add join locking — call `lockJoins` when game starts, `unlockJoins` when it ends**

In `startFreePlay`, find `setScreen('countdown')` and add before it:
```ts
    if (chatModeRef.current === 'room') room.lockJoins()
```

In `startFromPlayset`, find `setScreen('countdown')` and add before it:
```ts
    if (chatModeRef.current === 'room') room.lockJoins()
```

In `handleGameOver`, find `setScreen('shiftend')` and add before it:
```ts
    if (chatModeRef.current === 'room') room.unlockJoins()
```

Note: `room` from `useRoomHost` is declared in the render scope; wrap `lockJoins`/`unlockJoins` calls in refs so callbacks don't go stale:

Add near the ref declarations:
```ts
  const roomRef = useRef(room)
  roomRef.current = room
```

Then use `roomRef.current.lockJoins()` and `roomRef.current.unlockJoins()` in the callbacks.

- [ ] **Step 5: Add snapshot emission effect**

Add this import at the top:
```ts
import { gameStateToSnapshot } from './state/snapshot'
```

Add this effect after the existing `useEffect` blocks (before the `let content` line):
```ts
  useEffect(() => {
    if (chatMode !== 'room') return
    const interval = setInterval(() => {
      const currentScreen = screenRef.current
      const phase: 'lobby' | 'playing' | 'gameover' =
        currentScreen === 'playing' ? 'playing'
        : (currentScreen === 'shiftend' || currentScreen === 'gameover') ? 'gameover'
        : 'lobby'
      roomRef.current.sendSnapshot(gameStateToSnapshot(stateRef.current, phase))
    }, 300)
    return () => clearInterval(interval)
  }, [chatMode])
```

- [ ] **Step 6: Clear `roomPlayers` when room mode is disabled**

```ts
  useEffect(() => {
    if (chatMode !== 'room') setRoomPlayers([])
  }, [chatMode])
```

- [ ] **Step 7: Pass room props to `MainMenu`**

Find the `MainMenu` JSX block and add these props:
```tsx
        roomCode={chatMode === 'room' ? room.code : null}
        roomConnected={room.connected}
        roomPlayers={chatMode === 'room' ? roomPlayers : []}
        onHostRoom={() => { setChatMode('room'); setRoomPlayers([]) }}
        onLeaveRoom={() => setChatMode('local')}
```

(You'll add these props to `MainMenu` in Task 10.)

- [ ] **Step 8: Verify types compile (expect MainMenu prop errors — that's OK for now)**

```bash
npm run build 2>&1 | grep -v "MainMenu" | tail -20
```

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "feat(App): wire useRoomHost, chatMode state, join lock/unlock, snapshot emission"
```

---

## Task 5: `/play` route — `main.tsx`, `ControllerApp`, `usePlayerSocket`, mobile viewport

**Files:**
- Modify: `src/main.tsx`
- Modify: `index.html`
- Create: `src/controller/ControllerApp.tsx`
- Create: `src/controller/usePlayerSocket.ts`
- Create: `vercel.json`

- [ ] **Step 1: Update `index.html` mobile viewport**

Find:
```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
```
Replace with:
```html
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
```

- [ ] **Step 2: Create `vercel.json` for SPA routing**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 3: Update `src/main.tsx` to route `/play`**

Replace the entire file:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import App from './App.tsx'
import ControllerApp from './controller/ControllerApp.tsx'

const isController = window.location.pathname === '/play'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isController ? <ControllerApp /> : <App />}
  </StrictMode>,
)
```

- [ ] **Step 4: Create `src/controller/usePlayerSocket.ts`**

```ts
import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import type { SharedSnapshot, PartialPlayerView } from '../shared/protocol'

const RELAY_URL = import.meta.env.VITE_RELAY_URL ?? 'http://localhost:8080'

interface RoomInfo { code: string; playerId: string; nickname: string }

interface Args {
  room: RoomInfo | null
  onSnapshot: (shared: SharedSnapshot, you: PartialPlayerView) => void
  onRoomClosed: () => void
}

export function usePlayerSocket({ room, onSnapshot, onRoomClosed }: Args) {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const onSnapshotRef = useRef(onSnapshot)
  const onRoomClosedRef = useRef(onRoomClosed)
  onSnapshotRef.current = onSnapshot
  onRoomClosedRef.current = onRoomClosed

  useEffect(() => {
    if (!room) return
    const s = io(RELAY_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = s
    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))
    s.on('player:snapshot', (e: { shared: SharedSnapshot; you: PartialPlayerView }) => {
      onSnapshotRef.current(e.shared, e.you)
    })
    s.on('room:closed', () => onRoomClosedRef.current())
    return () => { s.disconnect(); socketRef.current = null; setConnected(false) }
  }, [room?.code, room?.playerId])

  const send = (command: string) => {
    if (!room || !socketRef.current) return
    socketRef.current.emit('player:action', {
      code: room.code,
      playerId: room.playerId,
      command,
    })
  }

  return { send, connected }
}
```

- [ ] **Step 5: Create `src/controller/ControllerApp.tsx`**

```tsx
import { useState } from 'react'
import type { SharedSnapshot, PartialPlayerView } from '../shared/protocol'
import { usePlayerSocket } from './usePlayerSocket'
import JoinScreen from './JoinScreen'
import Lobby from './Lobby'
import Controller from './Controller'

type Stage = 'join' | 'lobby' | 'playing' | 'gameover'

interface RoomInfo { code: string; playerId: string; nickname: string }

export default function ControllerApp() {
  const [stage, setStage] = useState<Stage>('join')
  const [room, setRoom] = useState<RoomInfo | null>(null)
  const [snapshot, setSnapshot] = useState<SharedSnapshot | null>(null)
  const [you, setYou] = useState<PartialPlayerView>({ cooldownMs: 0 })

  const { send, connected } = usePlayerSocket({
    room,
    onSnapshot: (shared, playerView) => {
      setSnapshot(shared)
      setYou(playerView)
      if (shared.phase === 'playing' && stage !== 'playing') setStage('playing')
      if (shared.phase === 'gameover' && stage !== 'gameover') setStage('gameover')
      if (shared.phase === 'lobby' && stage !== 'lobby' && stage !== 'join') setStage('lobby')
    },
    onRoomClosed: () => { setRoom(null); setStage('join') },
  })

  if (stage === 'join' || !room) {
    return (
      <JoinScreen
        onJoined={(r) => { setRoom(r); setStage('lobby') }}
      />
    )
  }

  if (stage === 'lobby' || stage === 'gameover' || !snapshot) {
    return (
      <Lobby
        nickname={room.nickname}
        stage={stage}
        snapshot={snapshot}
        send={send}
        connected={connected}
      />
    )
  }

  return <Controller snapshot={snapshot} you={you} send={send} connected={connected} />
}
```

- [ ] **Step 6: Verify build passes with stubs**

Create temporary stub files so the build doesn't fail:

`src/controller/JoinScreen.tsx`:
```tsx
export default function JoinScreen({ onJoined }: { onJoined: (r: any) => void }) {
  return <div>JoinScreen stub</div>
}
```

`src/controller/Lobby.tsx`:
```tsx
export default function Lobby(_: any) {
  return <div>Lobby stub</div>
}
```

`src/controller/Controller.tsx`:
```tsx
export default function Controller(_: any) {
  return <div>Controller stub</div>
}
```

```bash
npm run build 2>&1 | tail -20
```

Expected: build passes (the `gameStateToSnapshot` import in App.tsx will fail — that's OK, fix it by adding a stub `src/state/snapshot.ts`):

```ts
// src/state/snapshot.ts — stub, replaced in Task 7
import type { GameState } from './types'
import type { SharedSnapshot } from '../shared/protocol'
export function gameStateToSnapshot(state: GameState, phase: SharedSnapshot['phase']): SharedSnapshot {
  return { phase, timeRemainingMs: state.timeLeft, money: state.money, orders: [], stations: [] }
}
```

Run build again until it passes, then commit.

- [ ] **Step 7: Commit**

```bash
git add src/main.tsx index.html vercel.json src/controller/ src/state/snapshot.ts
git commit -m "feat: add /play route, ControllerApp shell, usePlayerSocket, snapshot stub"
```

---

## Task 6: `JoinScreen`

**Files:**
- Modify: `src/controller/JoinScreen.tsx` (replace stub)
- Create: `src/controller/JoinScreen.module.css`

- [ ] **Step 1: Create `src/controller/JoinScreen.module.css`**

```css
.screen {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #1a1a2e;
  color: #fff;
  padding: 24px;
  gap: 20px;
  font-family: system-ui, sans-serif;
}

.title {
  font-size: 2rem;
  font-weight: 800;
  text-align: center;
}

.subtitle {
  font-size: 1rem;
  opacity: 0.7;
  text-align: center;
}

.input {
  width: 100%;
  max-width: 320px;
  padding: 16px;
  font-size: 1.5rem;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  border: 2px solid #444;
  border-radius: 12px;
  background: #2a2a3e;
  color: #fff;
  outline: none;
}

.input:focus {
  border-color: #7c6af7;
}

.nicknameInput {
  width: 100%;
  max-width: 320px;
  padding: 14px 16px;
  font-size: 1.1rem;
  border: 2px solid #444;
  border-radius: 12px;
  background: #2a2a3e;
  color: #fff;
  outline: none;
}

.nicknameInput:focus {
  border-color: #7c6af7;
}

.btn {
  width: 100%;
  max-width: 320px;
  padding: 18px;
  font-size: 1.2rem;
  font-weight: 700;
  border: none;
  border-radius: 12px;
  background: #7c6af7;
  color: #fff;
  cursor: pointer;
  min-height: 56px;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.error {
  color: #ff6b6b;
  font-size: 0.95rem;
  text-align: center;
}
```

- [ ] **Step 2: Replace `src/controller/JoinScreen.tsx` stub**

```tsx
import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import styles from './JoinScreen.module.css'

const RELAY_URL = import.meta.env.VITE_RELAY_URL ?? 'http://localhost:8080'
const SESSION_KEY = 'chatskitchen_room'

interface JoinedRoom { code: string; playerId: string; nickname: string }

interface Props {
  onJoined: (room: JoinedRoom) => void
}

export default function JoinScreen({ onJoined }: Props) {
  const params = new URLSearchParams(window.location.search)
  const [code, setCode] = useState(params.get('room') ?? '')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Attempt sessionStorage rejoin on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (!stored) return
    try {
      const cached = JSON.parse(stored) as JoinedRoom
      // Only auto-rejoin if the URL room param matches (or no param)
      const urlRoom = params.get('room')
      if (!urlRoom || urlRoom.toUpperCase() === cached.code.toUpperCase()) {
        onJoined(cached)
      }
    } catch {
      sessionStorage.removeItem(SESSION_KEY)
    }
  }, [])

  const handleJoin = () => {
    const trimCode = code.trim().toUpperCase().slice(0, 4)
    const trimNick = nickname.trim().slice(0, 16) || 'guest'
    if (trimCode.length < 4) { setError('Enter a 4-letter room code'); return }
    setLoading(true)
    setError(null)
    const s = io(RELAY_URL, { transports: ['websocket', 'polling'] })
    s.emit('player:join', { code: trimCode, nickname: trimNick }, (res: any) => {
      if (res.error) {
        setError(res.error)
        setLoading(false)
        s.disconnect()
        return
      }
      const room: JoinedRoom = { code: trimCode, playerId: res.playerId, nickname: res.nickname }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(room))
      s.disconnect() // usePlayerSocket manages its own connection
      onJoined(room)
    })
  }

  return (
    <div className={styles.screen}>
      <div className={styles.title}>🍳 Let Chat Cook</div>
      <div className={styles.subtitle}>Enter the room code shown on the host screen</div>
      <input
        className={styles.input}
        value={code}
        maxLength={4}
        placeholder="ABCD"
        onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
        onKeyDown={e => e.key === 'Enter' && handleJoin()}
      />
      <input
        className={styles.nicknameInput}
        value={nickname}
        maxLength={16}
        placeholder="Your nickname"
        onChange={e => setNickname(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleJoin()}
      />
      {error && <div className={styles.error}>{error}</div>}
      <button className={styles.btn} onClick={handleJoin} disabled={loading}>
        {loading ? 'Joining…' : 'Join Room'}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add src/controller/JoinScreen.tsx src/controller/JoinScreen.module.css
git commit -m "feat(controller): JoinScreen with room code input, nickname, sessionStorage stash"
```

---

## Task 7: `gameStateToSnapshot` — full implementation

**Files:**
- Modify: `src/state/snapshot.ts` (replace stub)

- [ ] **Step 1: Replace `src/state/snapshot.ts` stub with full implementation**

```ts
import { RECIPES } from '../data/recipes'
import { getStationCapacity } from './gameReducer'
import type { GameState } from './types'
import type { SharedSnapshot } from '../shared/protocol'

export function gameStateToSnapshot(state: GameState, phase: SharedSnapshot['phase']): SharedSnapshot {
  const activeOrders = state.orders.filter(o => !o.served && !o.outcome)

  return {
    phase,
    timeRemainingMs: Math.max(0, state.timeLeft),
    money: state.money,
    teamMoney:
      state.redMoney !== undefined
        ? { red: state.redMoney, blue: state.blueMoney ?? 0 }
        : undefined,
    orders: activeOrders.map(o => {
      const recipe = RECIPES[o.dish]
      const needed = recipe
        ? [...new Set(recipe.steps.map(s => s.target))]
        : []
      return {
        id: o.id,
        dish: recipe?.name ?? o.dish,
        emoji: recipe?.emoji ?? '🍽️',
        needed,
        patiencePct: o.patienceMax > 0 ? o.patienceLeft / o.patienceMax : 0,
      }
    }),
    stations: Object.values(state.stations).map(s => ({
      name: s.id,
      heatPct: s.heat / 100,
      overheated: s.overheated,
      busySlots: s.slots.length,
      maxSlots: getStationCapacity(s.id, state.stationCapacity, state.restrictSlots),
    })),
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -20
```

Expected: clean build. `getStationCapacity` is already exported from `gameReducer.ts`.

- [ ] **Step 3: Manual snapshot test**

Start dev server:
```bash
npm run dev
```

In browser console (game at `localhost:5173`), switch to Room mode (button added in Task 10 — for now verify the snapshot function logic by checking that enabling room mode emits to server). You can add a temporary `console.log` in the snapshot effect in App.tsx:
```ts
console.log('snapshot', gameStateToSnapshot(stateRef.current, 'lobby'))
```
Expected output: object with `phase: 'lobby'`, `orders: []`, correct station list.

- [ ] **Step 4: Remove any debug console.log, then commit**

```bash
git add src/state/snapshot.ts
git commit -m "feat: implement gameStateToSnapshot pure function"
```

---

## Task 8: Full `Controller.tsx` with verb/ingredient buttons + cooldown ring

**Files:**
- Modify: `src/controller/Controller.tsx` (replace stub)
- Create: `src/controller/Controller.module.css`

- [ ] **Step 1: Create `src/controller/Controller.module.css`**

```css
.controller {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1a1a2e;
  color: #fff;
  font-family: system-ui, sans-serif;
  padding: 0;
  overflow-y: auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #2a2a3e;
  font-size: 0.9rem;
  gap: 8px;
}

.money { font-weight: 700; font-size: 1.1rem; color: #ffd700; }
.timer { font-weight: 700; }
.conn { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.connOn { background: #4caf50; }
.connOff { background: #f44336; }

.ordersStrip {
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  overflow-x: auto;
  background: #12122a;
  min-height: 72px;
  align-items: center;
}

.orderChip {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #2a2a3e;
  border-radius: 10px;
  padding: 6px 10px;
  flex-shrink: 0;
  font-size: 0.75rem;
  gap: 2px;
}

.orderEmoji { font-size: 1.4rem; }
.patienceBar { width: 48px; height: 4px; background: #444; border-radius: 2px; }
.patienceFill { height: 100%; border-radius: 2px; background: #4caf50; }
.patienceLow { background: #f44336; }

.section {
  padding: 10px 16px 4px;
  font-size: 0.8rem;
  opacity: 0.6;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.verbGrid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 16px;
}

.verbBtn {
  padding: 12px 14px;
  border: 2px solid #444;
  border-radius: 10px;
  background: #2a2a3e;
  color: #fff;
  font-size: 0.95rem;
  font-weight: 600;
  min-height: 48px;
  cursor: pointer;
}

.verbBtn.selected {
  border-color: #7c6af7;
  background: #3d356b;
}

.verbBtn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.ingredientGrid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 16px;
}

.ingredientBtn {
  padding: 14px 16px;
  border: none;
  border-radius: 10px;
  background: #7c6af7;
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  min-height: 52px;
  cursor: pointer;
}

.serveGrid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 16px;
}

.serveBtn {
  padding: 12px 16px;
  border: none;
  border-radius: 10px;
  background: #2e7d32;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 700;
  min-height: 48px;
  cursor: pointer;
}

.stationRow {
  display: flex;
  gap: 8px;
  padding: 8px 16px 16px;
  overflow-x: auto;
}

.stationChip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.heatBar { width: 48px; height: 6px; background: #333; border-radius: 3px; }
.heatFill { height: 100%; border-radius: 3px; background: #4caf50; }
.heatWarm  { background: #ff9800; }
.heatHot   { background: #f44336; }

.stationLabel { font-size: 0.7rem; opacity: 0.7; }

.coolBtn, .extBtn {
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  min-height: 36px;
}
.coolBtn { background: #0288d1; color: #fff; }
.extBtn  { background: #c62828; color: #fff; }

.cooldownBar {
  height: 4px;
  background: #7c6af7;
  transition: width 0.1s linear;
  margin: 0 16px 8px;
  border-radius: 2px;
}

.freeform {
  display: flex;
  gap: 8px;
  padding: 4px 16px 8px;
}
.freeformInput {
  flex: 1;
  padding: 12px;
  border: 2px solid #444;
  border-radius: 10px;
  background: #2a2a3e;
  color: #fff;
  font-size: 0.95rem;
}
.freeformBtn {
  padding: 12px 16px;
  border: none;
  border-radius: 10px;
  background: #555;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}
```

- [ ] **Step 2: Replace `src/controller/Controller.tsx` stub**

```tsx
import { useState, useEffect, useRef } from 'react'
import type { SharedSnapshot, PartialPlayerView } from '../shared/protocol'
import styles from './Controller.module.css'

const VERBS = ['chop','grill','fry','boil','toast','roast','stirfry','steam','simmer','cook','mix','grind','knead']
const COOLDOWN_MS = 1500

interface Props {
  snapshot: SharedSnapshot
  you: PartialPlayerView
  send: (command: string) => void
  connected: boolean
}

export default function Controller({ snapshot, you, send, connected }: Props) {
  const [verb, setVerb] = useState<string | null>(null)
  const [freeText, setFreeText] = useState('')
  const [localCooldownMs, setLocalCooldownMs] = useState(0)
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isOnCooldown = localCooldownMs > 0 || you.cooldownMs > 0
  const cooldownPct = Math.max(localCooldownMs, you.cooldownMs) / COOLDOWN_MS

  const startLocalCooldown = () => {
    setLocalCooldownMs(COOLDOWN_MS)
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)
    cooldownTimerRef.current = setInterval(() => {
      setLocalCooldownMs(prev => {
        const next = prev - 100
        if (next <= 0) { clearInterval(cooldownTimerRef.current!); return 0 }
        return next
      })
    }, 100)
  }

  useEffect(() => () => {
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)
  }, [])

  const sendCommand = (cmd: string) => {
    send(cmd)
    startLocalCooldown()
    setVerb(null)
    setFreeText('')
  }

  const liveIngredients = [...new Set(snapshot.orders.flatMap(o => o.needed))]

  const formatTime = (ms: number) => {
    const s = Math.ceil(ms / 1000)
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  return (
    <div className={styles.controller}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.money}>${snapshot.money}</span>
        <span className={styles.timer}>{formatTime(snapshot.timeRemainingMs)}</span>
        {snapshot.teamMoney && (
          <span>🔴 ${snapshot.teamMoney.red} 🔵 ${snapshot.teamMoney.blue}</span>
        )}
        <span className={`${styles.conn} ${connected ? styles.connOn : styles.connOff}`} />
      </div>

      {/* Cooldown bar */}
      <div
        className={styles.cooldownBar}
        style={{ width: `${Math.min(1, cooldownPct) * 100}%` }}
      />

      {/* Orders strip */}
      <div className={styles.ordersStrip}>
        {snapshot.orders.length === 0
          ? <span style={{ opacity: 0.5, fontSize: '0.85rem' }}>No active orders</span>
          : snapshot.orders.map(o => (
            <div key={o.id} className={styles.orderChip}>
              <span className={styles.orderEmoji}>{o.emoji}</span>
              <span>{o.dish}</span>
              <div className={styles.patienceBar}>
                <div
                  className={`${styles.patienceFill} ${o.patiencePct < 0.3 ? styles.patienceLow : ''}`}
                  style={{ width: `${o.patiencePct * 100}%` }}
                />
              </div>
            </div>
          ))
        }
      </div>

      {/* Verb buttons */}
      <div className={styles.section}>Cook action</div>
      <div className={styles.verbGrid}>
        {VERBS.map(v => (
          <button
            key={v}
            className={`${styles.verbBtn} ${verb === v ? styles.selected : ''}`}
            disabled={isOnCooldown}
            onClick={() => setVerb(verb === v ? null : v)}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Ingredient buttons (shown when verb selected) */}
      {verb && (
        <>
          <div className={styles.section}>Ingredient ({verb})</div>
          <div className={styles.ingredientGrid}>
            {liveIngredients.map(i => (
              <button
                key={i}
                className={styles.ingredientBtn}
                onClick={() => sendCommand(`${verb} ${i}`)}
              >
                {i}
              </button>
            ))}
          </div>
          <div className={styles.freeform}>
            <input
              className={styles.freeformInput}
              placeholder="type ingredient…"
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && freeText.trim()) {
                  sendCommand(`${verb} ${freeText.trim()}`)
                }
              }}
            />
            <button
              className={styles.freeformBtn}
              onClick={() => freeText.trim() && sendCommand(`${verb} ${freeText.trim()}`)}
            >
              Go
            </button>
          </div>
        </>
      )}

      {/* Serve buttons */}
      {snapshot.orders.length > 0 && (
        <>
          <div className={styles.section}>Serve</div>
          <div className={styles.serveGrid}>
            {snapshot.orders.map(o => (
              <button
                key={o.id}
                className={styles.serveBtn}
                disabled={isOnCooldown}
                onClick={() => sendCommand(`serve ${o.id}`)}
              >
                {o.emoji} {o.dish}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Station heat + cool/extinguish */}
      {snapshot.stations.some(s => s.heatPct > 0 || s.overheated) && (
        <>
          <div className={styles.section}>Stations</div>
          <div className={styles.stationRow}>
            {snapshot.stations
              .filter(s => s.heatPct > 0 || s.overheated)
              .map(s => (
                <div key={s.name} className={styles.stationChip}>
                  <div className={styles.heatBar}>
                    <div
                      className={`${styles.heatFill} ${s.heatPct > 0.7 ? styles.heatHot : s.heatPct > 0.4 ? styles.heatWarm : ''}`}
                      style={{ width: `${Math.min(1, s.heatPct) * 100}%` }}
                    />
                  </div>
                  <span className={styles.stationLabel}>{s.name}</span>
                  {s.overheated
                    ? <button className={styles.extBtn} onClick={() => send(`!extinguish ${s.name}`)}>extinguish</button>
                    : <button className={styles.coolBtn} onClick={() => send(`!cool ${s.name}`)}>cool</button>
                  }
                </div>
              ))
            }
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 4: End-to-end test**

1. Start relay server: `cd server && npm run dev`
2. Start frontend: `cd .. && npm run dev`
3. Open `http://localhost:5173` — this is the host screen
4. Enable room mode (Task 10 adds the button — for now temporarily add a button in App.tsx or test via browser console)
5. Open `http://localhost:5173/play` on phone or second browser tab
6. Join using the code shown in the host's console
7. Tap a verb button, tap an ingredient — verify the game state changes on the host screen

- [ ] **Step 5: Commit**

```bash
git add src/controller/Controller.tsx src/controller/Controller.module.css
git commit -m "feat(controller): full Controller UI with verb/ingredient buttons and cooldown ring"
```

---

## Task 9: `Lobby.tsx` + gameover screen

**Files:**
- Modify: `src/controller/Lobby.tsx` (replace stub)
- Create: `src/controller/Lobby.module.css`

- [ ] **Step 1: Create `src/controller/Lobby.module.css`**

```css
.screen {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #1a1a2e;
  color: #fff;
  font-family: system-ui, sans-serif;
  padding: 24px;
  gap: 20px;
  text-align: center;
}

.title { font-size: 1.8rem; font-weight: 800; }
.subtitle { font-size: 1rem; opacity: 0.7; }
.nickname { font-size: 1.1rem; font-weight: 600; color: #7c6af7; }

.teamRow {
  display: flex;
  gap: 12px;
  width: 100%;
  max-width: 320px;
}

.teamBtn {
  flex: 1;
  padding: 18px;
  font-size: 1.1rem;
  font-weight: 700;
  border: 3px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  min-height: 60px;
}

.redBtn   { background: #8b0000; color: #fff; }
.blueBtn  { background: #003580; color: #fff; }
.redBtn.active  { border-color: #ff4444; }
.blueBtn.active { border-color: #4488ff; }

.team { font-size: 0.95rem; opacity: 0.8; }

.money { font-size: 2.5rem; font-weight: 800; color: #ffd700; }
.divider { width: 80px; height: 2px; background: #444; }

.conn { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; opacity: 0.6; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #f44336; }
.dotOn { background: #4caf50; }
```

- [ ] **Step 2: Replace `src/controller/Lobby.tsx` stub**

```tsx
import { useState } from 'react'
import type { SharedSnapshot } from '../shared/protocol'
import styles from './Lobby.module.css'

interface Props {
  nickname: string
  stage: 'lobby' | 'gameover'
  snapshot: SharedSnapshot | null
  send: (cmd: string) => void
  connected: boolean
}

export default function Lobby({ nickname, stage, snapshot, send, connected }: Props) {
  const [team, setTeam] = useState<'red' | 'blue' | null>(null)
  const isPvP = snapshot?.teamMoney !== undefined

  if (stage === 'gameover' && snapshot) {
    return (
      <div className={styles.screen}>
        <div className={styles.title}>Game Over!</div>
        <div className={styles.money}>${snapshot.money}</div>
        {snapshot.teamMoney && (
          <>
            <div>🔴 Red: ${snapshot.teamMoney.red}</div>
            <div>🔵 Blue: ${snapshot.teamMoney.blue}</div>
          </>
        )}
        <div className={styles.divider} />
        <div className={styles.subtitle}>Wait for the host to start a new round…</div>
        <div className={styles.conn}>
          <span className={`${styles.dot} ${connected ? styles.dotOn : ''}`} />
          {connected ? 'Connected' : 'Reconnecting…'}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      <div className={styles.title}>🍳 Kitchen Lobby</div>
      <div className={styles.nickname}>Playing as {nickname}</div>
      <div className={styles.subtitle}>Waiting for the host to start…</div>

      {isPvP && (
        <>
          <div className={styles.subtitle}>Pick your team:</div>
          <div className={styles.teamRow}>
            <button
              className={`${styles.teamBtn} ${styles.redBtn} ${team === 'red' ? styles.active : ''}`}
              onClick={() => { setTeam('red'); send('!red') }}
            >
              🔴 Red
            </button>
            <button
              className={`${styles.teamBtn} ${styles.blueBtn} ${team === 'blue' ? styles.active : ''}`}
              onClick={() => { setTeam('blue'); send('!blue') }}
            >
              🔵 Blue
            </button>
          </div>
          {team && <div className={styles.team}>You're on {team === 'red' ? '🔴 Red' : '🔵 Blue'} team</div>}
        </>
      )}

      <div className={styles.conn}>
        <span className={`${styles.dot} ${connected ? styles.dotOn : ''}`} />
        {connected ? 'Connected' : 'Reconnecting…'}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add src/controller/Lobby.tsx src/controller/Lobby.module.css
git commit -m "feat(controller): Lobby screen with PvP team picker and gameover state"
```

---

## Task 10: `RoomHostCard` + MainMenu integration

**Files:**
- Create: `src/components/RoomHostCard.tsx`
- Create: `src/components/RoomHostCard.module.css`
- Modify: `src/components/MainMenu.tsx`
- Modify: `src/components/MainMenu.module.css`

- [ ] **Step 1: Create `src/components/RoomHostCard.module.css`**

```css
.card {
  background: #2a2a3e;
  border: 2px solid #3a3a5e;
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 200px;
}

.cardActive {
  border-color: #7c6af7;
}

.label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.6;
  color: #fff;
}

.code {
  font-size: 2.4rem;
  font-weight: 900;
  letter-spacing: 0.15em;
  color: #fff;
  font-family: monospace;
}

.canvas {
  border-radius: 8px;
  align-self: flex-start;
}

.playerList {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 120px;
  overflow-y: auto;
}

.player {
  font-size: 0.85rem;
  color: #ccc;
  padding: 2px 0;
}

.emptyPlayers {
  font-size: 0.82rem;
  opacity: 0.5;
  color: #fff;
  font-style: italic;
}

.statusRow {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  color: #aaa;
}

.dot { width: 8px; height: 8px; border-radius: 50%; background: #f44336; flex-shrink: 0; }
.dotOn { background: #4caf50; }

.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
}

.startBtn { background: #7c6af7; color: #fff; }
.leaveBtn { background: #3a3a5e; color: #ccc; }
```

- [ ] **Step 2: Create `src/components/RoomHostCard.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import styles from './RoomHostCard.module.css'

interface Props {
  code: string | null
  connected: boolean
  players: Array<{ id: string; nickname: string }>
  onHostRoom: () => void
  onLeaveRoom: () => void
}

export default function RoomHostCard({ code, connected, players, onHostRoom, onLeaveRoom }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!code || !canvasRef.current) return
    const url = `${window.location.origin}/play?room=${code}`
    QRCode.toCanvas(canvasRef.current, url, { width: 120, margin: 1 })
  }, [code])

  if (!code) {
    return (
      <div className={styles.card}>
        <div className={styles.label}>Room Mode</div>
        <button className={`${styles.btn} ${styles.startBtn}`} onClick={onHostRoom}>
          Host a Room
        </button>
        <div className={styles.emptyPlayers}>
          Players join at {window.location.origin}/play
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.card} ${styles.cardActive}`}>
      <div className={styles.label}>Room Code</div>
      <div className={styles.code}>{code}</div>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.statusRow}>
        <span className={`${styles.dot} ${connected ? styles.dotOn : ''}`} />
        {connected ? `${players.length} player${players.length !== 1 ? 's' : ''} connected` : 'Connecting…'}
      </div>
      <div className={styles.playerList}>
        {players.length === 0
          ? <div className={styles.emptyPlayers}>No players yet — share the code!</div>
          : players.map(p => <div key={p.id} className={styles.player}>👤 {p.nickname}</div>)
        }
      </div>
      <button className={`${styles.btn} ${styles.leaveBtn}`} onClick={onLeaveRoom}>
        Leave Room
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Add room props to `MainMenu` component**

In `src/components/MainMenu.tsx`, add to the `Props` interface:
```ts
  roomCode: string | null
  roomConnected: boolean
  roomPlayers: Array<{ id: string; nickname: string }>
  onHostRoom: () => void
  onLeaveRoom: () => void
```

Add the import at the top:
```tsx
import RoomHostCard from './RoomHostCard'
```

In the component's destructured params, add:
```tsx
{ ..., roomCode, roomConnected, roomPlayers, onHostRoom, onLeaveRoom }
```

Find where the Twitch connect section ends in the JSX (the right column or connection area) and add the `RoomHostCard` below it:
```tsx
<RoomHostCard
  code={roomCode}
  connected={roomConnected}
  players={roomPlayers}
  onHostRoom={onHostRoom}
  onLeaveRoom={onLeaveRoom}
/>
```

- [ ] **Step 4: Verify App.tsx already passes room props to MainMenu (from Task 4 Step 7)**

Open `src/App.tsx` and confirm the `MainMenu` JSX has these props:
```tsx
roomCode={chatMode === 'room' ? room.code : null}
roomConnected={room.connected}
roomPlayers={chatMode === 'room' ? roomPlayers : []}
onHostRoom={() => { setChatMode('room'); setRoomPlayers([]) }}
onLeaveRoom={() => setChatMode('local')}
```

If not, add them now.

- [ ] **Step 5: Build and fix any TypeScript errors**

```bash
npm run build 2>&1 | tail -30
```

Fix any prop-type mismatches. Common issue: `room.code` may be `string | null` — that's correct for `RoomHostCard.code`.

- [ ] **Step 6: Full end-to-end test**

1. `cd server && npm run dev` (relay on :8080)
2. `npm run dev` (frontend on :5173)
3. Host screen at `localhost:5173`: click "Host a Room" → see QR code and 4-letter code
4. Phone (or second tab) at `localhost:5173/play?room=CODE` → enter nickname → join
5. Host screen shows player nickname in list
6. Host clicks through to a game (Free Play or PvP) → starts countdown
7. Phone transitions to Lobby screen showing "Waiting for host..."
8. Once countdown finishes, phone transitions to Controller screen
9. Tap a verb → ingredient → game state updates on host screen

- [ ] **Step 7: Commit**

```bash
git add src/components/RoomHostCard.tsx src/components/RoomHostCard.module.css src/components/MainMenu.tsx src/components/MainMenu.module.css
git commit -m "feat: RoomHostCard with QR code and player list; MainMenu room mode integration"
```

---

## Task 11: Deployment

This task is manual/operational. No code changes.

- [ ] **Step 1: Install Fly CLI (if not installed)**

```bash
brew install flyctl
flyctl auth login
```

- [ ] **Step 2: Build and deploy the relay server**

```bash
cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen/server"
npm run build
fly launch --name chatskitchen-relay --region sin --no-deploy
# When prompted: no Postgres, no Redis
fly deploy
```

Note the deployed URL (e.g., `https://chatskitchen-relay.fly.dev`).

- [ ] **Step 3: Set `VITE_RELAY_URL` on Vercel**

In the Vercel dashboard for `letchatcook`:
- Settings → Environment Variables
- Add `VITE_RELAY_URL` = `https://chatskitchen-relay.fly.dev`
- Redeploy

- [ ] **Step 4: Tighten CORS on the server**

In `server/src/index.ts`, change:
```ts
cors: { origin: '*' },
```
to:
```ts
cors: { origin: ['https://letchatcook.vercel.app', 'http://localhost:5173'] },
```

Rebuild and redeploy:
```bash
npm run build && fly deploy
```

- [ ] **Step 5: Verify production end-to-end**

1. Open `https://letchatcook.vercel.app` → click Host a Room → get a code
2. Phone: `https://letchatcook.vercel.app/play?room=CODE` → join
3. Play a round end-to-end

- [ ] **Step 6: Final checklist verification**

Confirm these files are unchanged:
```bash
git diff main -- src/state/gameReducer.ts src/state/commandProcessor.ts src/hooks/useTwitchChat.ts src/hooks/useGameLoop.ts
```
Expected: no diff (these files are untouched).

- [ ] **Step 7: Final commit**

```bash
cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen"
git add server/src/index.ts server/fly.toml server/Dockerfile vercel.json
git commit -m "feat: tighten CORS for production, add vercel.json SPA rewrite"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered in |
|---|---|
| 4-letter room code, host gets it on connect | Task 2 (server `makeCode`), Task 3 (useRoomHost ack) |
| Players join at `/play` with QR | Task 5 (`main.tsx` route), Task 10 (QR code) |
| Phone buttons emit commands | Task 8 (Controller.tsx) |
| Game logic stays on host's browser | ✅ server/src/index.ts has no game imports |
| Dumb relay — just routes messages | ✅ server only routes, no validation |
| Join locked to lobby phase | Task 2 (`room.locked`), Task 3 (`lockJoins`), Task 4 (called on game start) |
| Coexist with Twitch mode | Task 4 (`effectiveTwitchChannel`) |
| Snapshot every ~300ms | Task 4 (snapshot emission effect) |
| `commandProcessor.ts` unchanged | ✅ room commands are just strings going through same path |
| Per-player cooldown ring | Task 8 (local 1500ms timer) |
| sessionStorage rejoin | Task 6 (JoinScreen) |
| QR prefills room code | Task 10 (RoomHostCard URL includes `?room=`) |
| Mobile viewport 44px targets | Task 5 (viewport meta), Task 8/9 CSS (`min-height: 48px+`) |
| Host disconnects → 30s grace | Task 2 (`HOST_GRACE_MS`) |
| Room full at 20 players | Task 2 (`players.size >= 20`) |
| Rate limit 10 cmd/s | Task 2 (token bucket) |
| PvP team picker on phone | Task 9 (Lobby.tsx team buttons send `!red`/`!blue`) |
| Gameover screen on phone | Task 9 (Lobby with `stage === 'gameover'`) |
| Player list on host — lobby only | Task 10 (RoomHostCard shown in MainMenu, not in GameplayScreen) |
| Bot players work as-is | ✅ bots call `handleCommand` directly, unaffected |
| `gameReducer.ts` unchanged | ✅ |
| Deploy to Fly.io | Task 11 |
| VITE_RELAY_URL env var | Task 11 |

**No placeholders** — all steps have complete code.

**Type consistency check:**
- `useRoomHost` returns `{ code, connected, sendSnapshot, lockJoins, unlockJoins }` — used correctly in App.tsx
- `gameStateToSnapshot(state: GameState, phase: SharedSnapshot['phase'])` — called with `stateRef.current` and derived phase in App.tsx
- `usePlayerSocket` returns `{ send, connected }` — matches usage in ControllerApp, Controller, Lobby
- `RoomHostCard` props `{ code, connected, players, onHostRoom, onLeaveRoom }` — passed from App.tsx via MainMenu

**Scope check:** Focused on one feature. Existing screens, reducer, and bot sim are untouched.
