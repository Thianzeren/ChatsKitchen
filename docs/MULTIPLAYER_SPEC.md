# ChatsKitchen — Jackbox-Style Multiplayer Spec

> **Status (implemented, model evolved):** Local Play room hosting shipped. The final design is **co-play**: a room is always live (`chatMode` stays `'room'` — it is no longer toggled between `local`/`twitch`/`room`), and a connected Twitch channel plays *alongside* the room rather than as a separate mode. The room is surfaced via the always-on Local Play card on the main menu and a `RoomQRModal` popup (there is no standalone local-play screen / `RoomHostCard`). See `CLAUDE.md` → "Connection model (Jackbox-style co-play)" for current behaviour; sections below are the original spec and may differ in detail.

> **Relay server (as-built):** The relay lives in `server/` (socket.io, deployed to Fly.io) and stays a dumb router exactly as specified below — no game logic. It is built by `createRelay(opts)` in `server/src/relay.ts` (instance-scoped `rooms`/`buckets`, injectable CORS + grace timers, no auto-listen); `server/src/index.ts` is just the listen entry. It's ~197 LOC across those two files (the "~110 lines" estimate below predates room reconnect/grace handling). The wire protocol is `src/shared/protocol.ts`, imported by both the client and the server. The relay is covered by `server/src/relay.test.ts` (Vitest integration + a rate-limiter unit test), gated in CI (`ci.yml`) and before each deploy (`deploy-server.yml`).

## Context

ChatsKitchen is a real-time browser cooking game where chat commands drive gameplay. Today it works in two ways:
1. **Local mode**: type commands into the in-app chat input
2. **Twitch mode**: connect a Twitch channel and chat messages become commands

We want to add a **third mode** — Jackbox-style room hosting:
- A **host** opens the game on a laptop/TV and gets a 4-letter room code (e.g. `ABCD`)
- **Players** scan a QR code or visit `letchatcook.vercel.app/play`, enter the code + a nickname
- Players get a controller UI on their phone with buttons that emit game commands
- The host's browser still runs the game; players just send input to it

This must coexist with Twitch mode (user picks one per session, not both at once).

---

## Critical Architectural Principle

**Game logic stays on the host's browser. Do NOT move it to the server.**

The existing `src/state/gameReducer.ts` is already authoritative. Twitch chat doesn't "run" the game today — it just feeds string commands into `commandProcessor.ts` which dispatches actions to the reducer. Phones will do the exact same thing.

The server is a **dumb relay**. It:
- Routes messages between host and players
- Maps room codes to sockets
- Handles connection lifecycle

The server does NOT:
- Import the reducer
- Know anything about recipes, stations, or heat
- Store game state
- Validate game actions

If you find yourself writing game logic on the server, stop and reconsider.

---

## High-Level Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  HOST (laptop)  │◄───WS──►│  RELAY SERVER    │◄───WS──►│ PLAYER (phone)  │
│  / (existing)   │         │  Node+Socket.IO  │         │  /play          │
│                 │         │                  │         │                 │
│  gameReducer    │         │  no game state   │         │  controller UI  │
│  (authoritative)│         │  just routing    │         │  buttons/forms  │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

**Two flows:**
1. **Player → Host (input)**: phone emits structured action ("chop lettuce" from `alice`), relay forwards to host, host runs it through `commandProcessor` → `gameReducer.dispatch`, exactly like a Twitch message today.
2. **Host → Player (light state)**: host periodically sends a small snapshot — current orders, stations, money, time remaining. Phones don't need full `GameState`; they need enough to render a useful controller.

---

## Tech Choices (Already Decided)

| Decision | Choice | Why |
|---|---|---|
| Coexist with Twitch? | Yes — separate modes, pick one per session | User selected this |
| Hosting | Fly.io | Persistent WebSocket, free tier, simple deploy, single-region OK at this scale |
| Target room size | ~20 players | Medium party-game scale |
| Transport | Socket.IO | Handles reconnection, room broadcast, polling fallback for flaky mobile networks |

---

## Project Layout (What to Add)

```
ChatsKitchen/
├── server/                      ← NEW: Fly.io-deployed relay
│   ├── src/index.ts             ← Socket.IO server (~110 lines)
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── fly.toml
├── src/
│   ├── App.tsx                  ← MODIFY: add route /play
│   ├── hooks/
│   │   ├── useTwitchChat.ts     (unchanged)
│   │   └── useRoomHost.ts       ← NEW: mirrors useTwitchChat's shape
│   ├── components/
│   │   └── RoomHostCard.tsx     ← NEW: room code display, QR, player list
│   ├── controller/              ← NEW: phone-side player UI
│   │   ├── ControllerApp.tsx    ← entry point for /play
│   │   ├── JoinScreen.tsx       ← code + nickname input
│   │   ├── Lobby.tsx            ← waiting room + PvP team picker
│   │   ├── Controller.tsx       ← main controller view
│   │   └── usePlayerSocket.ts   ← client-side socket hook
│   └── shared/
│       └── protocol.ts          ← shared types (used by client & server)
```

---

## Wire Protocol — `src/shared/protocol.ts`

Single source of truth for message shapes. Imported by both the React app and the Node server.

```ts
export type RoomCode = string; // 4 uppercase letters, e.g. "ABCD"
export type PlayerId = string; // server-generated, ~8 chars

// ── Client → Server ──────────────────────────────────────────────
export interface HostCreateMsg {}
export interface HostCreateAck { code: RoomCode }

export interface PlayerJoinMsg { code: RoomCode; nickname: string }
export interface PlayerJoinAck { playerId: PlayerId; nickname: string }
export interface PlayerJoinErr { error: string }

export interface PlayerActionMsg {
  code: RoomCode;
  playerId: PlayerId;
  command: string; // raw text, e.g. "chop lettuce"
}

export interface HostSnapshotMsg {
  code: RoomCode;
  snapshot: SharedSnapshot;
  perPlayer?: Record<PlayerId, PartialPlayerView>;
}

// ── Server → Host ────────────────────────────────────────────────
export interface PlayerJoinedEvent { playerId: PlayerId; nickname: string }
export interface PlayerLeftEvent { playerId: PlayerId }
export interface PlayerCommandEvent {
  playerId: PlayerId;
  nickname: string;
  command: string;
}

// ── Server → Player ──────────────────────────────────────────────
export interface SnapshotEvent {
  shared: SharedSnapshot;
  you: PartialPlayerView;
}
export interface RoomClosedEvent { reason: 'host_gone' | 'kicked' }

// ── Snapshot shape (what phones render from) ─────────────────────
export interface SharedSnapshot {
  phase: 'lobby' | 'playing' | 'gameover';
  timeRemainingMs: number;
  money: number; // or per-team for PvP — extend as needed
  teamMoney?: { red: number; blue: number }; // PvP only
  orders: Array<{
    id: number;
    dish: string;
    emoji: string;
    needed: string[]; // ingredients still needed (post-prep-pool)
    patiencePct: number;
  }>;
  stations: Array<{
    name: string;
    heatPct: number;
    overheated: boolean;
    busySlots: number;
    maxSlots: number;
  }>;
}

export interface PartialPlayerView {
  cooldownMs: number;
  team?: 'red' | 'blue';
  personalScore?: number;
}
```

**Key point**: `command: string` means the host treats a room command IDENTICALLY to a Twitch message. `commandProcessor.ts` does not change.

---

## Server — `server/src/index.ts`

```ts
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import type {
  PlayerJoinMsg, PlayerActionMsg, HostSnapshotMsg,
} from '../../src/shared/protocol';

const http = createServer();
const io = new Server(http, {
  cors: { origin: '*' }, // tighten for prod: allow only your Vercel domain
  transports: ['websocket', 'polling'],
});

interface Room {
  code: string;
  hostSocketId: string;
  players: Map<string, { socketId: string; nickname: string }>;
  hostDisconnectedAt?: number;
}
const rooms = new Map<string, Room>();
const HOST_GRACE_MS = 30_000;

function makeCode(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O for readability
  let c = '';
  do {
    c = '';
    for (let i = 0; i < 4; i++) c += A[Math.floor(Math.random() * A.length)];
  } while (rooms.has(c));
  return c;
}

function makePlayerId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Per-player token bucket — 10 commands/sec/player
const buckets = new Map<string, { tokens: number; last: number }>();
function rateOk(pid: string): boolean {
  const now = Date.now();
  const b = buckets.get(pid) ?? { tokens: 10, last: now };
  const elapsed = (now - b.last) / 1000;
  b.tokens = Math.min(10, b.tokens + elapsed * 10);
  b.last = now;
  if (b.tokens < 1) { buckets.set(pid, b); return false; }
  b.tokens -= 1;
  buckets.set(pid, b);
  return true;
}

io.on('connection', (socket: Socket) => {
  let role: 'host' | 'player' | null = null;
  let roomCode: string | null = null;
  let playerId: string | null = null;

  socket.on('host:create', (_: unknown, ack: (r: { code: string }) => void) => {
    const code = makeCode();
    rooms.set(code, { code, hostSocketId: socket.id, players: new Map() });
    socket.join(`room:${code}`);
    socket.join(`host:${code}`);
    role = 'host';
    roomCode = code;
    ack({ code });
  });

  socket.on('player:join', (msg: PlayerJoinMsg, ack) => {
    const room = rooms.get(msg.code);
    if (!room) return ack({ error: 'Room not found' });
    if (room.players.size >= 20) return ack({ error: 'Room full' });
    const pid = makePlayerId();
    const nickname = (msg.nickname || '').slice(0, 16).trim() || 'guest';
    room.players.set(pid, { socketId: socket.id, nickname });
    socket.join(`room:${msg.code}`);
    socket.join(`players:${msg.code}`);
    role = 'player';
    roomCode = msg.code;
    playerId = pid;
    ack({ playerId: pid, nickname });
    io.to(`host:${msg.code}`).emit('room:player_joined', { playerId: pid, nickname });
  });

  socket.on('player:action', (msg: PlayerActionMsg) => {
    const room = rooms.get(msg.code);
    if (!room) return;
    const p = room.players.get(msg.playerId);
    if (!p || p.socketId !== socket.id) return; // anti-spoof
    if (!rateOk(msg.playerId)) return;
    io.to(`host:${msg.code}`).emit('room:player_command', {
      playerId: msg.playerId,
      nickname: p.nickname,
      command: String(msg.command).slice(0, 64),
    });
  });

  socket.on('host:snapshot', (msg: HostSnapshotMsg) => {
    const room = rooms.get(msg.code);
    if (!room || room.hostSocketId !== socket.id) return;
    if (msg.perPlayer) {
      for (const [pid, view] of Object.entries(msg.perPlayer)) {
        const p = room.players.get(pid);
        if (p) io.to(p.socketId).emit('player:snapshot', { shared: msg.snapshot, you: view });
      }
    } else {
      io.to(`players:${msg.code}`).emit('player:snapshot', {
        shared: msg.snapshot,
        you: { cooldownMs: 0 },
      });
    }
  });

  socket.on('disconnect', () => {
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;
    if (role === 'host' && room.hostSocketId === socket.id) {
      room.hostDisconnectedAt = Date.now();
      setTimeout(() => {
        const r = rooms.get(roomCode!);
        if (r && r.hostDisconnectedAt && Date.now() - r.hostDisconnectedAt >= HOST_GRACE_MS) {
          io.to(`players:${roomCode!}`).emit('room:closed', { reason: 'host_gone' });
          rooms.delete(roomCode!);
        }
      }, HOST_GRACE_MS + 500);
    } else if (role === 'player' && playerId) {
      room.players.delete(playerId);
      io.to(`host:${roomCode}`).emit('room:player_left', { playerId });
    }
  });
});

const PORT = Number(process.env.PORT) || 8080;
http.listen(PORT, () => console.log(`relay on :${PORT}`));
```

### Server package.json

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

### Server tsconfig.json

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

### Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist ./dist
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

Build locally with `npm run build` before `fly deploy`, or add a multi-stage build to compile inside the image.

### fly.toml

```toml
app = "chatskitchen-relay"
primary_region = "sin"  # change to your region (iad, lhr, etc.)

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

`auto_stop_machines = "suspend"` hibernates the VM when idle — basically free, ~1s wake when host creates a room.

---

## Host Hook — `src/hooks/useRoomHost.ts`

Drop-in sibling of `useTwitchChat`. Shape MUST match so the rest of the app doesn't care which is active.

```ts
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { SharedSnapshot, PartialPlayerView } from '../shared/protocol';

const RELAY_URL = import.meta.env.VITE_RELAY_URL ?? 'http://localhost:8080';

interface Args {
  enabled: boolean;
  onPlayerCommand: (nickname: string, command: string) => void;
  onPlayerJoined: (playerId: string, nickname: string) => void;
  onPlayerLeft: (playerId: string) => void;
}

export function useRoomHost({ enabled, onPlayerCommand, onPlayerJoined, onPlayerLeft }: Args) {
  const [code, setCode] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const s = io(RELAY_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = s;
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.emit('host:create', {}, ({ code }: { code: string }) => setCode(code));
    s.on('room:player_joined', (e) => onPlayerJoined(e.playerId, e.nickname));
    s.on('room:player_left', (e) => onPlayerLeft(e.playerId));
    s.on('room:player_command', (e) => onPlayerCommand(e.nickname, e.command));
    return () => { s.disconnect(); socketRef.current = null; };
  }, [enabled]);

  const sendSnapshot = (
    snapshot: SharedSnapshot,
    perPlayer?: Record<string, PartialPlayerView>,
  ) => {
    if (!code || !socketRef.current) return;
    socketRef.current.emit('host:snapshot', { code, snapshot, perPlayer });
  };

  return { code, connected, sendSnapshot };
}
```

### Integration in `App.tsx`

The mode picker should be a simple radio selector — Local / Twitch / Room. When Room is selected, mount `useRoomHost` and route its `onPlayerCommand` callback into the same `dispatch` path that `useTwitchChat` uses today.

```tsx
const chatMode: 'local' | 'twitch' | 'room' = ...; // from UI state

useTwitchChat({
  enabled: chatMode === 'twitch',
  channel: twitchChannel,
  onMessage: handleChatMessage, // existing
});

const room = useRoomHost({
  enabled: chatMode === 'room',
  onPlayerCommand: (nickname, command) => handleChatMessage(nickname, command),
  onPlayerJoined: (id, name) => { /* optional: dispatch a PLAYER_JOINED action */ },
  onPlayerLeft: (id) => { /* optional */ },
});
```

### Snapshot loop

Inside the existing `useGameLoop` 100ms tick (or in a sibling effect), every 2nd or 3rd tick build a `SharedSnapshot` from the current `GameState` and call `room.sendSnapshot(snapshot)`. Don't send `perPlayer` unless you have actually personal data — broadcasting a shared snapshot is one network message regardless of player count.

Add a `gameStateToSnapshot(state: GameState): SharedSnapshot` pure function. Keep it in `src/state/` next to the reducer.

---

## Host UI — `src/components/RoomHostCard.tsx`

Lives in the main menu next to the Twitch Connect card. Shows:
- The room code in a big readable font
- A QR code pointing to `${origin}/play?room=${code}`
- A live list of joined players (driven by `onPlayerJoined` / `onPlayerLeft`)
- Connection status indicator

Use the `qrcode` npm package, render to a `<canvas>`.

---

## Player Controller — `/play` route

This is a SEPARATE small SPA route. It does NOT import the reducer, recipe data, or any game logic. It only renders from `SharedSnapshot` and emits commands.

### Routing

Add a check at the top of `App.tsx`:
```tsx
if (window.location.pathname === '/play') return <ControllerApp />;
```

Or use a proper router if you prefer. Keep it simple.

### `ControllerApp.tsx`

```tsx
function ControllerApp() {
  const [stage, setStage] = useState<'join' | 'lobby' | 'playing'>('join');
  const [room, setRoom] = useState<{ code: string; playerId: string; nickname: string } | null>(null);
  const [snapshot, setSnapshot] = useState<SharedSnapshot | null>(null);
  const [you, setYou] = useState<PartialPlayerView>({ cooldownMs: 0 });

  const { send, connected } = usePlayerSocket({
    room,
    onSnapshot: (shared, you) => {
      setSnapshot(shared);
      setYou(you);
      if (shared.phase === 'playing' && stage !== 'playing') setStage('playing');
      if (shared.phase === 'lobby' && stage !== 'lobby') setStage('lobby');
    },
    onRoomClosed: () => { setRoom(null); setStage('join'); },
  });

  if (stage === 'join' || !room) {
    return <JoinScreen onJoined={(r) => { setRoom(r); setStage('lobby'); }} />;
  }
  if (stage === 'lobby' || !snapshot) {
    return <Lobby nickname={room.nickname} send={send} />;
  }
  return <Controller snapshot={snapshot} you={you} send={send} />;
}
```

### `JoinScreen.tsx`

- Big code input (4 uppercase letters), prefilled from `?room=ABCD` query param
- Nickname input (16 chars max)
- "Join" button → emits `player:join` → on success, advance to lobby
- Stash `{ code, playerId, nickname }` in `sessionStorage` keyed by code, so refresh / screen-lock doesn't kick the player out

### `Lobby.tsx`

- "Waiting for host to start..."
- For PvP: two big buttons "Join Red" / "Join Blue" → `send('join red')` etc.
- Shows your nickname and chosen team

### `Controller.tsx`

The main controller view. Two-tap pattern: pick verb → pick ingredient.

```tsx
function Controller({ snapshot, you, send }: Props) {
  const [verb, setVerb] = useState<string | null>(null);
  const liveIngredients = [...new Set(snapshot.orders.flatMap(o => o.needed))];

  return (
    <div className="controller">
      <Header
        money={snapshot.money}
        timeMs={snapshot.timeRemainingMs}
        cooldownMs={you.cooldownMs}
      />
      <OrdersStrip orders={snapshot.orders} />

      <div className="verbs">
        {['chop','grill','fry','boil','toast','roast',
          'stirfry','steam','simmer','cook','mix','grind','knead']
          .map(v => (
            <button key={v}
              className={verb===v ? 'sel' : ''}
              disabled={you.cooldownMs > 0}
              onClick={() => setVerb(v)}>{v}</button>
          ))}
      </div>

      {verb && (
        <div className="ingredients">
          {liveIngredients.map(i => (
            <button key={i} onClick={() => { send(`${verb} ${i}`); setVerb(null); }}>
              {i}
            </button>
          ))}
          {/* fallback: type freely */}
          <FreeformInput onSubmit={(text) => { send(`${verb} ${text}`); setVerb(null); }} />
        </div>
      )}

      <div className="serve-row">
        {snapshot.orders.map(o => (
          <button key={o.id} onClick={() => send(`serve ${o.id}`)}>
            Serve #{o.id} ({o.dish})
          </button>
        ))}
      </div>

      <CoolExtinguishRow stations={snapshot.stations} send={send} />
    </div>
  );
}
```

### `usePlayerSocket.ts`

Mirror of `useRoomHost` but for the player side. Handles join, snapshot reception, command emission, reconnection with stashed `playerId`.

---

## Important UX Details

1. **Cooldown ring on phone**: When the player taps a button, start a local 1500ms timer immediately for instant feedback. The snapshot can correct it but the UI must feel snappy.
2. **Reconnection**: Stash `{ code, playerId, nickname }` in `sessionStorage`. On page load, if a stash exists and matches `?room=`, attempt rejoin. Server should accept rejoin with existing `playerId` (extend protocol if needed — for v1, treating it as a fresh join is acceptable).
3. **QR code on host**: `https://letchatcook.vercel.app/play?room=ABCD` — `/play` auto-fills the code from the query string.
4. **Mobile viewport**: ensure `<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">` and large touch targets (44px min). Use existing CSS Modules approach.
5. **Snapshot bandwidth**: at 200–300ms intervals with 20 players via room broadcast, that's one ~1KB message per tick. Don't loop emit per player; use the Socket.IO room.

---

## Build Order (Recommended)

Each step is independently testable. Do not skip ahead.

| Step | What | Acceptance criteria |
|---|---|---|
| 1 | `shared/protocol.ts` | Types compile, importable from both `src/` and `server/src/` |
| 2 | Server `index.ts` with all 6 events | `wscat` or a 20-line HTML test page can create a room, join as player, emit actions, receive forwards |
| 3 | `useRoomHost` hook + crude room mode toggle in main menu | Host browser sees player commands logged to console |
| 4 | Route player commands into existing `handleChatMessage` | Typing on a fake player client moves the game — same as Twitch |
| 5 | `JoinScreen` + dumb text-input `Controller` (no buttons yet) | **End-to-end multiplayer works, ugly but playable** |
| 6 | `gameStateToSnapshot` + host emits in the game loop | Phone receives and logs snapshots at expected interval |
| 7 | Real `Controller.tsx` with verb/ingredient buttons | Two-tap commands work; cooldown ring functions |
| 8 | `Lobby.tsx` + PvP team picker | PvP mode works with phones |
| 9 | `RoomHostCard.tsx` with QR code + player list | Host screen looks Jackbox-ish |
| 10 | Deploy server to Fly, set `VITE_RELAY_URL` in Vercel env | Production works |

Steps 1–5 give you a working ugly version in roughly one focused session. Steps 6–10 are polish.

---

## Deployment

### Server (Fly.io)

```bash
cd server
npm install
npm run build
fly launch    # answers: no Postgres, no Redis, pick region
fly deploy
```

After deploy, note the URL (e.g. `https://chatskitchen-relay.fly.dev`).

### Frontend (Vercel)

Add env var `VITE_RELAY_URL=https://chatskitchen-relay.fly.dev` in the Vercel dashboard. Redeploy.

Tighten the server's CORS `origin` from `*` to your actual Vercel domain before going public.

---

## What NOT to Do

- Do not move `gameReducer.ts` logic to the server.
- Do not have the server validate game actions (e.g. "is this player allowed to chop?"). The host's reducer already does this.
- Do not send the full `GameState` in snapshots. Build a slim `SharedSnapshot` explicitly.
- Do not loop-emit snapshots per player when a room broadcast would do.
- Do not modify `commandProcessor.ts` to handle a "room command type" — the whole point is that it stays oblivious. Room commands are just strings.
- Do not add a database for v1. In-memory `Map` on the server is fine. Rooms are ephemeral.
- Do not implement player authentication beyond the room code. The trust model is "if you have the code, you can play" — same as Jackbox.

---

## Open Questions / Decisions to Make During Implementation

These are flagged for the implementer to think about; resolve them with the user if you're unsure:

1. **Should joining mid-round be allowed, or only during lobby phase?** Twitch mode allows mid-round joins; recommend matching that.
2. **Does the host need a "Start Round" button, or does it auto-start from the existing free play / PvP / adventure flow?** Probably reuse the existing flow — room mode is just a different input source.
3. **What happens to phones after `gameover`?** They should see a "Game Over — final score $X" screen and a "Wait for next round" message. Snapshot `phase: 'gameover'` already supports this.
4. **Bot players**: the existing bot sim should keep working in room mode. The host still owns it.
5. **Player presence on the host UI**: do you want to render a player list on the host's screen during a round? Useful for "who's connected", optional.

---

## File Reference Checklist

When you're done, the following should be true:

- [ ] `src/state/gameReducer.ts` — UNCHANGED
- [ ] `src/state/commandProcessor.ts` — UNCHANGED
- [ ] `src/hooks/useTwitchChat.ts` — UNCHANGED
- [ ] `src/hooks/useGameLoop.ts` — maybe modified to call `sendSnapshot` every Nth tick
- [ ] `src/App.tsx` — modified to add `/play` route and mode selector
- [ ] `src/shared/protocol.ts` — NEW
- [ ] `src/hooks/useRoomHost.ts` — NEW
- [ ] `src/components/RoomHostCard.tsx` — NEW
- [ ] `src/controller/*` — NEW (5 files)
- [ ] `src/state/snapshot.ts` (or similar) — NEW pure function `gameStateToSnapshot`
- [ ] `server/` — NEW (entire directory)
- [ ] `package.json` — added `socket.io-client` and `qrcode` dependencies

---

## Summary in One Line

**Build a thin Socket.IO relay server, add a `useRoomHost` hook that mirrors `useTwitchChat`, build a separate `/play` SPA route that emits commands and renders from snapshots — the game reducer stays exactly where it is.**
