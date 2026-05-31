# Connection-First Screen Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Local Play (phone controllers), Twitch, and Solo three interchangeable *connection methods*, each usable with Free Play, Adventure, and PvP, by restructuring the flow to choose connection first, then mode.

**Architecture:** Connection-first flow. The `menu` screen becomes a connection chooser; a new `modehub` screen lists the three game modes; `localplay` is reused as the room panel. A thin `useConnection` hook + small pure helper modules (`src/state/connection.ts`, `src/state/roomRoster.ts`, `src/state/roomCommandRouting.ts`) hold the testable logic. Existing game-start plumbing, `useRoomHost`, and `useTwitchChat` stay in `App.tsx`. In Local Play the connected room roster becomes each mode's participant roster.

**Tech Stack:** React 18 + TypeScript, Vite 5, Vitest 1.6 (node environment — pure-function tests only; no jsdom/RTL). `tmi.js` (Twitch), `socket.io-client` (room relay).

---

## Testing reality

`npm run test` runs `vitest run` in a **node environment**. There is **no jsdom and no React Testing Library**, so we cannot render hooks or components in tests. Strategy:
- All decision logic is extracted into **pure functions** in `src/state/*.ts` and unit-tested.
- Hooks/components are thin glue, verified with `npm run build` (runs `tsc -b`, catches type errors) and manual runs of `npm run dev`.

Existing test examples to mirror: `src/data/adventureRecipeDraft.test.ts`, `src/data/recipeProfile.test.ts`.

---

## File structure

**Create:**
- `src/state/connection.ts` — `ConnectionMethod`, `methodToChatMode`, `isConnectionReady` (pure).
- `src/state/connection.test.ts` — tests for the above.
- `src/state/roomRoster.ts` — `connectedNicknames`, `unassignedPool` (pure).
- `src/state/roomRoster.test.ts` — tests.
- `src/state/roomCommandRouting.ts` — `classifyRoomCommand` (pure).
- `src/state/roomCommandRouting.test.ts` — tests.
- `src/hooks/useConnection.ts` — thin connection state/lifecycle hook.
- `src/components/ModeHub.tsx` + `ModeHub.module.css` — new mode-selection screen.

**Modify:**
- `src/state/types.ts` — add `'modehub'` to `Screen`.
- `src/state/snapshot.ts` — add `pvpLobbySnapshot`, `pvpLobbyPerPlayer` (pure, tested).
- `src/components/MainMenu.tsx` (+ css) — drop the four mode buttons; it becomes the connection chooser with Twitch / Local Play / Solo + optional Twitch overlay.
- `src/App.tsx` — consume `useConnection`; render `modehub`; remove `checkTwitch` gating of modes; retarget post-game `onMenu` → `modehub`; broaden Twitch read-only rule; route room commands; Adventure roster mirroring; PvP lobby snapshot.
- `src/components/PvPLobby.tsx` (+ css) — add an "unassigned pool" column for Local Play room players.
- `src/controller/ControllerApp.tsx` + `src/controller/Lobby.tsx` — reflect host-assigned `you.team` on the phone.

`src/components/LocalPlayScreen.tsx` is **not** modified — it already has Back + Start; only how `App.tsx` wires its `onBack`/`onStart` changes (Task 8).

---

## Phase A — Pure logic (fully testable, inert until wired)

### Task 1: Connection method helpers

**Files:**
- Create: `src/state/connection.ts`
- Test: `src/state/connection.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/state/connection.test.ts
import { describe, it, expect } from 'vitest'
import { methodToChatMode, isConnectionReady } from './connection'

describe('methodToChatMode', () => {
  it('maps twitch → twitch', () => expect(methodToChatMode('twitch')).toBe('twitch'))
  it('maps local (room) → room', () => expect(methodToChatMode('local')).toBe('room'))
  it('maps solo → local', () => expect(methodToChatMode('solo')).toBe('local'))
})

describe('isConnectionReady', () => {
  it('not ready when no method chosen', () => {
    expect(isConnectionReady(null, 'disconnected', null)).toBe(false)
  })
  it('twitch ready only when connected', () => {
    expect(isConnectionReady('twitch', 'connecting', null)).toBe(false)
    expect(isConnectionReady('twitch', 'connected', null)).toBe(true)
  })
  it('local ready only when a room code exists', () => {
    expect(isConnectionReady('local', 'disconnected', null)).toBe(false)
    expect(isConnectionReady('local', 'disconnected', 'ABCD')).toBe(true)
  })
  it('solo is always ready once chosen', () => {
    expect(isConnectionReady('solo', 'disconnected', null)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/connection.test.ts`
Expected: FAIL — cannot find module './connection'.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/state/connection.ts
import type { TwitchStatus } from '../hooks/useTwitchChat'

// Connection method = how players join. 'local' means the phone-controller room.
export type ConnectionMethod = 'twitch' | 'local' | 'solo'

// chatMode is App's existing source of truth: 'twitch' | 'room' | 'local'.
export type ChatMode = 'local' | 'twitch' | 'room'

export function methodToChatMode(method: ConnectionMethod): ChatMode {
  switch (method) {
    case 'twitch': return 'twitch'
    case 'local':  return 'room'
    case 'solo':   return 'local'
  }
}

export function isConnectionReady(
  method: ConnectionMethod | null,
  twitchStatus: TwitchStatus,
  roomCode: string | null,
): boolean {
  if (method === null) return false
  if (method === 'twitch') return twitchStatus === 'connected'
  if (method === 'local')  return roomCode != null
  return true // solo
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/connection.test.ts`
Expected: PASS (7 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/state/connection.ts src/state/connection.test.ts
git commit -m "feat(connection): add connection method helpers"
```

---

### Task 2: Room → roster helpers

**Files:**
- Create: `src/state/roomRoster.ts`
- Test: `src/state/roomRoster.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/state/roomRoster.test.ts
import { describe, it, expect } from 'vitest'
import { connectedNicknames, unassignedPool, type RoomPlayer } from './roomRoster'

const players: RoomPlayer[] = [
  { id: '1', nickname: 'alice' },
  { id: '2', nickname: 'bob', disconnected: true },
  { id: '3', nickname: 'carol' },
]

describe('connectedNicknames', () => {
  it('returns only non-disconnected nicknames in order', () => {
    expect(connectedNicknames(players)).toEqual(['alice', 'carol'])
  })
})

describe('unassignedPool', () => {
  it('excludes players already on a team', () => {
    expect(unassignedPool(players, ['alice'], [])).toEqual(['carol'])
  })
  it('returns all connected when no teams set', () => {
    expect(unassignedPool(players, [], [])).toEqual(['alice', 'carol'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/roomRoster.test.ts`
Expected: FAIL — cannot find module './roomRoster'.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/state/roomRoster.ts
export interface RoomPlayer { id: string; nickname: string; disconnected?: boolean }

export function connectedNicknames(players: RoomPlayer[]): string[] {
  return players.filter(p => !p.disconnected).map(p => p.nickname)
}

export function unassignedPool(players: RoomPlayer[], red: string[], blue: string[]): string[] {
  const teamed = new Set([...red, ...blue])
  return connectedNicknames(players).filter(n => !teamed.has(n))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/roomRoster.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/roomRoster.ts src/state/roomRoster.test.ts
git commit -m "feat(connection): add room→roster helpers"
```

---

### Task 3: Room command routing classifier

**Files:**
- Create: `src/state/roomCommandRouting.ts`
- Test: `src/state/roomCommandRouting.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/state/roomCommandRouting.test.ts
import { describe, it, expect } from 'vitest'
import { classifyRoomCommand } from './roomCommandRouting'

describe('classifyRoomCommand', () => {
  it('routes pvp lobby', () => expect(classifyRoomCommand('pvplobby')).toBe('pvpLobby'))
  it('routes adventure lobby', () => expect(classifyRoomCommand('adventurelobby')).toBe('adventureLobby'))
  it('routes adventure vote screens', () => {
    expect(classifyRoomCommand('adventurerecipepick')).toBe('adventureVote')
    expect(classifyRoomCommand('adventurepantryshop')).toBe('adventureVote')
  })
  it('routes everything else to game', () => {
    expect(classifyRoomCommand('playing')).toBe('game')
    expect(classifyRoomCommand('modehub')).toBe('game')
  })
})
```

> Note: `'modehub'` is added to `Screen` in Task 4. If you run this test before Task 4, change `'modehub'` to `'playing'` temporarily, or do Task 4 first. Recommended: do Task 4 before running this test.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/roomCommandRouting.test.ts`
Expected: FAIL — cannot find module './roomCommandRouting'.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/state/roomCommandRouting.ts
import type { Screen } from './types'

export type RoomCommandTarget = 'pvpLobby' | 'adventureLobby' | 'adventureVote' | 'game'

export function classifyRoomCommand(screen: Screen): RoomCommandTarget {
  if (screen === 'pvplobby') return 'pvpLobby'
  if (screen === 'adventurelobby') return 'adventureLobby'
  if (screen === 'adventurepantryshop' || screen === 'adventurerecipepick') return 'adventureVote'
  return 'game'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/roomCommandRouting.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/roomCommandRouting.ts src/state/roomCommandRouting.test.ts
git commit -m "feat(connection): add room command routing classifier"
```

---

### Task 4: Add `modehub` to the Screen type

**Files:**
- Modify: `src/state/types.ts:1`

- [ ] **Step 1: Edit the Screen union**

Find line 1 of `src/state/types.ts` and add `'modehub'` right after `'menu'`:

```ts
export type Screen = 'menu' | 'modehub' | 'localplay' | 'pvplobby' | 'adventurelobby' | 'adventurebriefing' | 'adventurepantryshop' | 'adventurerecipepick' | 'options' | 'playsetpicker' | 'freeplaysetup' | 'countdown' | 'playing' | 'shiftend' | 'gameover' | 'adventureshiftpassed' | 'adventurerunend' | 'credits'
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: PASS — `'modehub'` is inert (nothing routes to it yet); the existing `else` branch in `App.tsx` already covers unmatched screens.

- [ ] **Step 3: Commit**

```bash
git add src/state/types.ts
git commit -m "feat(connection): add modehub screen to Screen union"
```

---

### Task 5: PvP-lobby snapshot helpers

**Files:**
- Modify: `src/state/snapshot.ts`
- Test: `src/state/snapshot.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// src/state/snapshot.test.ts
import { describe, it, expect } from 'vitest'
import { pvpLobbySnapshot, pvpLobbyPerPlayer } from './snapshot'
import type { RoomPlayer } from './roomRoster'

describe('pvpLobbySnapshot', () => {
  it('signals PvP via teamMoney and is otherwise empty', () => {
    const s = pvpLobbySnapshot()
    expect(s.phase).toBe('lobby')
    expect(s.teamMoney).toEqual({ red: 0, blue: 0 })
    expect(s.orders).toEqual([])
    expect(s.stations).toEqual([])
  })
})

describe('pvpLobbyPerPlayer', () => {
  it('maps each playerId to their team (or undefined)', () => {
    const players: RoomPlayer[] = [
      { id: 'p1', nickname: 'alice' },
      { id: 'p2', nickname: 'bob' },
      { id: 'p3', nickname: 'carol' },
    ]
    const view = pvpLobbyPerPlayer(players, ['alice'], ['bob'])
    expect(view.p1.team).toBe('red')
    expect(view.p2.team).toBe('blue')
    expect(view.p3.team).toBeUndefined()
    expect(view.p1.cooldownMs).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/snapshot.test.ts`
Expected: FAIL — `pvpLobbySnapshot` is not exported.

- [ ] **Step 3: Add the implementation to `src/state/snapshot.ts`**

Append to the end of `src/state/snapshot.ts` (keep existing imports; add `PartialPlayerView` to the protocol import and import `RoomPlayer`):

```ts
import type { SharedSnapshot, PartialPlayerView } from '../shared/protocol'
import type { RoomPlayer } from './roomRoster'

// Snapshot pushed to phones while sitting in the PvP lobby (before RESET sets
// GameState teams). teamMoney being present is how the controller Lobby detects
// PvP and shows its Red/Blue picker.
export function pvpLobbySnapshot(): SharedSnapshot {
  return {
    phase: 'lobby',
    timeRemainingMs: 0,
    money: 0,
    teamMoney: { red: 0, blue: 0 },
    orders: [],
    stations: [],
  }
}

// Per-player team assignment so each phone reflects host-side drags.
export function pvpLobbyPerPlayer(
  players: RoomPlayer[],
  red: string[],
  blue: string[],
): Record<string, PartialPlayerView> {
  const out: Record<string, PartialPlayerView> = {}
  for (const p of players) {
    const team = red.includes(p.nickname) ? 'red' : blue.includes(p.nickname) ? 'blue' : undefined
    out[p.id] = { cooldownMs: 0, team }
  }
  return out
}
```

Note: `src/state/snapshot.ts` already imports `SharedSnapshot` on line 3 (`import type { SharedSnapshot } from '../shared/protocol'`). Replace that single-type import with the combined `SharedSnapshot, PartialPlayerView` import shown above rather than adding a duplicate import line.

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run src/state/snapshot.test.ts && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/snapshot.ts src/state/snapshot.test.ts
git commit -m "feat(connection): add PvP lobby snapshot helpers for phone team pick"
```

---

## Phase B — New components (inert until routed)

### Task 6: `ModeHub` component

**Files:**
- Create: `src/components/ModeHub.tsx`, `src/components/ModeHub.module.css`

- [ ] **Step 1: Create the component**

```tsx
// src/components/ModeHub.tsx
import styles from './ModeHub.module.css'

interface Props {
  connectionLabel: string            // e.g. "Twitch: mychannel" / "Local Play" / "Solo"
  roomCode: string | null            // non-null only in Local Play
  roomPlayerCount: number            // connected room players
  onShowRoom: () => void             // re-open the room panel (Local Play only)
  onFreePlay: () => void
  onAdventure: () => void
  onPvp: () => void
  savedRunPreview: { shift: number; totalShifts: number } | null
  onResumeSavedRun: () => void
  onChangeConnection: () => void
}

export default function ModeHub({
  connectionLabel, roomCode, roomPlayerCount, onShowRoom,
  onFreePlay, onAdventure, onPvp,
  savedRunPreview, onResumeSavedRun, onChangeConnection,
}: Props) {
  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.changeBtn} onClick={onChangeConnection}>← Change connection</button>
        <div className={styles.connBadge}>{connectionLabel}</div>
      </div>

      {roomCode && (
        <button className={styles.roomWidget} onClick={onShowRoom}>
          <span className={styles.roomCode}>Room {roomCode}</span>
          <span className={styles.roomPlayers}>{roomPlayerCount} player{roomPlayerCount !== 1 ? 's' : ''}</span>
          <span className={styles.roomQr}>Show QR →</span>
        </button>
      )}

      <h1 className={styles.title}>Choose a mode</h1>

      <div className={styles.modes}>
        <button className={styles.modeFreePlay} onClick={onFreePlay}>
          <div className={styles.modeName}>Free Play</div>
          <div className={styles.modeDesc}>Pick recipes, set duration &amp; difficulty</div>
        </button>
        <button className={styles.modeAdventure} onClick={onAdventure}>
          <div className={styles.modeName}>Adventure</div>
          <div className={styles.modeDesc}>Roguelike runs — how many shifts can you survive?</div>
        </button>
        <button className={styles.modePvp} onClick={onPvp}>
          <div className={styles.modeName}>PvP</div>
          <div className={styles.modeDesc}>Two teams compete — most money wins!</div>
        </button>
      </div>

      {savedRunPreview && (
        <button type="button" className={styles.resumeRunPill} onClick={onResumeSavedRun} title="Resume your saved Adventure run">
          <span className={styles.resumeRunIcon}>📂</span>
          <span className={styles.resumeRunBody}>
            <span className={styles.resumeRunLabel}>Resume Adventure</span>
            <span className={styles.resumeRunMeta}>Shift {savedRunPreview.shift} / {savedRunPreview.totalShifts}</span>
          </span>
          <span className={styles.resumeRunArrow}>→</span>
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create the stylesheet**

```css
/* src/components/ModeHub.module.css */
.screen { display:flex; flex-direction:column; gap:20px; padding:32px; max-width:900px; margin:0 auto; height:100%; box-sizing:border-box; }
.header { display:flex; align-items:center; justify-content:space-between; }
.changeBtn { background:transparent; border:1px solid var(--border, #555); color:inherit; border-radius:8px; padding:8px 14px; cursor:pointer; font-size:14px; }
.connBadge { font-size:13px; opacity:.8; padding:6px 12px; border-radius:999px; background:rgba(127,127,127,.15); }
.roomWidget { display:flex; align-items:center; gap:16px; padding:12px 18px; border-radius:12px; border:1px solid #7fbdd6; background:rgba(127,189,214,.12); cursor:pointer; color:inherit; }
.roomCode { font-weight:700; font-size:16px; letter-spacing:.1em; }
.roomPlayers { opacity:.8; font-size:14px; }
.roomQr { margin-left:auto; font-size:13px; opacity:.9; }
.title { font-size:28px; margin:8px 0 0; }
.modes { display:flex; flex-direction:column; gap:14px; }
.modes button { text-align:left; padding:20px 24px; border-radius:14px; border:1px solid var(--border, #555); cursor:pointer; color:inherit; background:rgba(127,127,127,.08); transition:transform .08s ease, background .15s ease; }
.modes button:hover { transform:translateY(-2px); background:rgba(127,127,127,.16); }
.modeName { font-size:20px; font-weight:700; margin-bottom:4px; }
.modeDesc { font-size:14px; opacity:.75; }
.modeFreePlay { border-color:#5fb07a !important; }
.modeAdventure { border-color:#c0a050 !important; }
.modePvp { border-color:#b06f8f !important; }
.resumeRunPill { display:flex; align-items:center; gap:12px; padding:12px 18px; border-radius:12px; border:1px solid #c0a050; background:rgba(192,160,80,.12); cursor:pointer; color:inherit; }
.resumeRunBody { display:flex; flex-direction:column; }
.resumeRunLabel { font-weight:700; }
.resumeRunMeta { font-size:12px; opacity:.75; }
.resumeRunArrow { margin-left:auto; }
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: PASS — component compiles but is not yet rendered (`noUnusedLocals` won't fire because it's a default export, not a local).

- [ ] **Step 4: Commit**

```bash
git add src/components/ModeHub.tsx src/components/ModeHub.module.css
git commit -m "feat(connection): add ModeHub screen component"
```

---

### Task 7: Turn `MainMenu` into the connection chooser

**Files:**
- Modify: `src/components/MainMenu.tsx`, `src/components/MainMenu.module.css`

The chooser keeps the Twitch connect card, How-to-play steps, and the secondary buttons (Tutorial / How To Play / Options / Feedback / Credits). It **removes** the four game-mode buttons and the Resume pill (those move to `ModeHub`). It **adds** Local Play and Solo entry buttons, and (when those are active) the optional Twitch overlay is just the same Twitch card used read-only.

- [ ] **Step 1: Update the Props interface**

Replace the mode callbacks (`onPlay`, `onPvp`, `onAdventure`, `onLocalPlay`) and the Resume props with connection callbacks. New interface:

```tsx
interface Props {
  onChooseTwitch: () => void          // proceed to mode hub with Twitch as primary
  onChooseLocalPlay: () => void       // create room → room panel
  onChooseSolo: () => void            // proceed to mode hub, keyboard only
  onOptions: () => void
  onFeedback: () => void
  onCredits: () => void
  onTutorial: () => void
  onStartTutorial: () => void
  twitchChannel: string | null
  twitchStatus: TwitchStatus
  twitchError: string | undefined
  onTwitchConnect: (channel: string) => void
  onTwitchDisconnect: () => void
}
```

- [ ] **Step 2: Replace the mode-button block with connection options**

In the JSX, find the `{/* Game modes */}` block (the `div.modes` containing `modePlayRow`, `modeRow`, the Resume pill, and the bottom Options/Feedback/Credits row). Replace the `modePlayRow` and `modeRow` and Resume-pill markup with a connection-options block. Keep the `modeBottomRow` (Tutorial/How To Play) and the bottom Options/Feedback/Credits row.

```tsx
{/* Connection options */}
<div className={styles.modes}>

  <div className={styles.modeBottomRow}>
    <button className={styles.modeTutorial} onClick={onStartTutorial}>Tutorial</button>
    <button className={styles.modeHowToPlay} onClick={onTutorial}>How To Play</button>
  </div>

  <div className={styles.connLabel}>How are players joining?</div>

  <button className={styles.connTwitch} onClick={onChooseTwitch} disabled={!isConnected}>
    <div>
      <div className={styles.connName}>Twitch Chat</div>
      <div className={styles.connDesc}>
        {isConnected ? 'Your chat is the kitchen crew' : 'Connect a channel above first'}
      </div>
    </div>
    <div className={styles.connArrow}>▶</div>
  </button>

  <button className={styles.connLocal} onClick={onChooseLocalPlay}>
    <div>
      <div className={styles.connName}>Local Play</div>
      <div className={styles.connDesc}>Phone controllers — no Twitch needed</div>
    </div>
    <div className={styles.connArrow}>→</div>
  </button>

  <button className={styles.connSolo} onClick={onChooseSolo}>
    <div>
      <div className={styles.connName}>Solo</div>
      <div className={styles.connDesc}>Just you, typing commands on this screen</div>
    </div>
    <div className={styles.connArrow}>→</div>
  </button>

  <div className={styles.modeBottomRow}>
    <button className={styles.modeOptions} onClick={onOptions}>Options</button>
    <button className={styles.modeOptions} onClick={onFeedback}>Feedback</button>
    <button className={styles.modeOptions} onClick={onCredits}>Credits</button>
  </div>

</div>
```

Update the function signature destructuring to match the new Props (remove `onPlay, onPvp, onAdventure, onLocalPlay, savedRunPreview, onResumeSavedRun`; add `onChooseTwitch, onChooseLocalPlay, onChooseSolo`). Keep `isConnected`/`isConnecting`/`isDisconnected` and the Twitch card exactly as-is — the card now doubles as the optional overlay control.

- [ ] **Step 3: Add styles**

Append to `src/components/MainMenu.module.css`:

```css
.connLabel { font-size:13px; text-transform:uppercase; letter-spacing:.06em; opacity:.7; margin:6px 0 2px; }
.connTwitch, .connLocal, .connSolo { display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; padding:16px 20px; border-radius:12px; border:1px solid var(--border,#555); background:rgba(127,127,127,.08); color:inherit; cursor:pointer; }
.connTwitch:disabled { opacity:.5; cursor:not-allowed; }
.connTwitch { border-color:#9147ff; }
.connLocal { border-color:#5fb07a; }
.connSolo { border-color:#7fbdd6; }
.connName { font-size:17px; font-weight:700; }
.connDesc { font-size:13px; opacity:.75; }
.connArrow { font-size:18px; opacity:.8; }
```

- [ ] **Step 4: Typecheck**

Run: `npm run build`
Expected: FAIL in `App.tsx` only — `MainMenu` is rendered with the old props. That is expected; Task 8 rewires it. Do **not** "fix" `App.tsx` here beyond what Task 8 specifies. (If you want a green build at this commit, do Tasks 7 and 8 back-to-back before committing, and combine their commits.)

- [ ] **Step 5: Commit (with Task 8) — see note above**

```bash
git add src/components/MainMenu.tsx src/components/MainMenu.module.css
git commit -m "feat(connection): convert MainMenu into connection chooser"
```

---

## Phase C — Wire the new flow into App.tsx

### Task 8: `useConnection` hook + route chooser → hub

**Files:**
- Create: `src/hooks/useConnection.ts`
- Modify: `src/App.tsx`

This task flips the flow. Read it fully before editing. It depends on Tasks 4, 6, 7.

- [ ] **Step 1: Create `useConnection`**

```ts
// src/hooks/useConnection.ts
import { useState, useCallback } from 'react'
import { ConnectionMethod, methodToChatMode, isConnectionReady, ChatMode } from '../state/connection'
import { TwitchStatus } from './useTwitchChat'

interface Args {
  setChatMode: (m: ChatMode) => void
  enterRoom: () => void   // unlock joins + create/keep room (App provides; calls roomRef)
  closeRoom: () => void   // tear down room (App provides)
}

export function useConnection({ setChatMode, enterRoom, closeRoom }: Args) {
  const [method, setMethod] = useState<ConnectionMethod | null>(null)

  const chooseTwitch = useCallback(() => {
    setMethod('twitch'); setChatMode(methodToChatMode('twitch'))
  }, [setChatMode])

  const chooseLocalPlay = useCallback(() => {
    setMethod('local'); setChatMode(methodToChatMode('local')); enterRoom()
  }, [setChatMode, enterRoom])

  const chooseSolo = useCallback(() => {
    setMethod('solo'); setChatMode(methodToChatMode('solo'))
  }, [setChatMode])

  const changeConnection = useCallback(() => {
    closeRoom(); setChatMode('local'); setMethod(null)
  }, [setChatMode, closeRoom])

  const ready = useCallback(
    (twitchStatus: TwitchStatus, roomCode: string | null) => isConnectionReady(method, twitchStatus, roomCode),
    [method],
  )

  return { method, chooseTwitch, chooseLocalPlay, chooseSolo, changeConnection, ready }
}
```

- [ ] **Step 2: Wire the hook in `App.tsx`**

Below the existing `const room = useRoomHost({...})` / `roomRef` block (around `App.tsx:498-517`), add:

```tsx
const enterRoom = useCallback(() => {
  setChatMode('room')
  setRoomPlayers([])
  roomRef.current.unlockJoins()
}, [])
const closeRoom = useCallback(() => {
  roomRef.current.closeRoom()
  setChatMode('local')
  setRoomPlayers([])
}, [])
const connection = useConnection({ setChatMode, enterRoom, closeRoom })
```

Add the import near the other hook imports: `import { useConnection } from './hooks/useConnection'`.

- [ ] **Step 3: Replace the old `handleLocalPlay` and menu navigation**

Delete the existing `handleLocalPlay` (App.tsx:202-207). Replace the three `handleMenu*` mode handlers (`handleMenuAdventure`, `handleMenuPvp`) and the `checkTwitch`-gated `handleMenuPlay`/`continueFromTutorial` paths so the modes are reached from the **hub**, not gated by Twitch:

```tsx
// Connection chooser → mode hub
const goToHub = useCallback(() => setScreen('modehub'), [])

const chooseTwitch = useCallback(() => { connection.chooseTwitch(); goToHub() }, [connection, goToHub])
const chooseSolo   = useCallback(() => { connection.chooseSolo();   goToHub() }, [connection, goToHub])
const chooseLocalPlay = useCallback(() => { connection.chooseLocalPlay(); setScreen('localplay') }, [connection])

const changeConnection = useCallback(() => { connection.changeConnection(); setScreen('menu') }, [connection])

// Mode hub buttons
const hubFreePlay  = useCallback(() => setScreen('playsetpicker'), [])
const hubAdventure = useCallback(() => openAdventureLobby(), [openAdventureLobby])
const hubPvp       = useCallback(() => startPvp(), [startPvp])
```

Remove `checkTwitch`, `confirmNoTwitch`, `cancelNoTwitch`, `showNoTwitchPrompt`, `setShowNoTwitchPrompt`, `pendingActionRef`, and the `NoTwitchPrompt` import + render — Twitch is no longer a gate (it is one connection choice). The tutorial-prompt flow (`handleMenuPlay`/`continueFromTutorial`) is reworked in Step 4.

- [ ] **Step 4: Rework the tutorial-prompt destination**

The tutorial prompt previously fired before Free Play/Playset. Now the tutorial is launched from the chooser's Tutorial button (`onStartTutorial` → `startTutorial`) and the "How To Play" button (`onTutorial` → `handleMenuTutorial`), both unchanged. The `TutorialDestination`-based `continueFromTutorial`/`handleMenuPlay`/`dismissTutorialPrompt`/`disableTutorialPrompt` machinery that gated Free Play is no longer needed for mode entry. Keep `startTutorial` and `handleMenuTutorial`; delete `handleMenuPlay`, `continueFromTutorial`, `dismissTutorialPrompt`, `disableTutorialPrompt`, `handleTutorialStartCooking`'s dependency on `tutorialDestination` (route it to `setScreen('menu')` on completion), and remove the `TutorialPrompt` render block tied to `showTutorialPrompt`. (The tutorial itself still runs; only its menu-gating wrapper is removed.)

> Rationale: the old prompt asked "want the tutorial first?" when clicking Play. With connection-first, the Tutorial is an explicit button on the chooser, so the implicit gate is redundant.

- [ ] **Step 5: Render the chooser and hub**

Update the `screen === 'menu'` branch to pass the new chooser props:

```tsx
if (screen === 'menu') {
  content = (
    <MainMenu
      onChooseTwitch={chooseTwitch}
      onChooseLocalPlay={chooseLocalPlay}
      onChooseSolo={chooseSolo}
      onOptions={() => setScreen('options')}
      onFeedback={() => setShowFeedback(true)}
      onCredits={() => setScreen('credits')}
      onTutorial={handleMenuTutorial}
      onStartTutorial={startTutorial}
      twitchChannel={twitchChannel}
      twitchStatus={twitchChat.status}
      twitchError={twitchChat.error}
      onTwitchConnect={(ch) => { setTwitchChannel(ch); setChatMode('twitch') }}
      onTwitchDisconnect={() => { setTwitchChannel(null); setChatMode('local') }}
    />
  )
}
```

Add a new branch for the hub (after the `menu` branch):

```tsx
else if (screen === 'modehub') {
  const connectionLabel =
    connection.method === 'twitch' ? `Twitch: ${twitchChannel ?? '—'}`
    : connection.method === 'local' ? 'Local Play'
    : 'Solo'
  content = (
    <ModeHub
      connectionLabel={connectionLabel}
      roomCode={chatMode === 'room' ? room.code : null}
      roomPlayerCount={roomPlayers.filter(p => !p.disconnected).length}
      onShowRoom={() => { roomRef.current.unlockJoins(); setScreen('localplay') }}
      onFreePlay={hubFreePlay}
      onAdventure={hubAdventure}
      onPvp={hubPvp}
      savedRunPreview={savedRunPreview ? { shift: savedRunPreview.run.currentShift, totalShifts: ADVENTURE_TOTAL_SHIFTS } : null}
      onResumeSavedRun={handleResumeSavedRun}
      onChangeConnection={changeConnection}
    />
  )
}
```

Add `import ModeHub from './components/ModeHub'`.

- [ ] **Step 6: Update the `localplay` branch**

The room panel must support both "continue to hub" (from the chooser) and "back to hub" (from Show QR). Update:

```tsx
} else if (screen === 'localplay') {
  content = (
    <LocalPlayScreen
      code={room.code}
      players={roomPlayers}
      onBack={() => setScreen('modehub')}
      onStart={() => setScreen('modehub')}
    />
  )
}
```

(Previously `onBack` closed the room and went to `menu`, and `onStart` went to `playsetpicker`. Now both land on the hub; the room stays open. "Change connection" on the hub is the only room teardown.)

- [ ] **Step 7: Retarget every post-game `onMenu` to the hub**

In these render branches, change `setScreen('menu')` to `setScreen('modehub')` (keep the surrounding cleanup like `setAdventureRun(null)` / `clearAdventureLobby()` / `setPvpLobby(null)`):
- `gameover` branch `onMenu` (App.tsx ~814)
- `adventureshiftpassed` `onMenu` (~831)
- `adventurerunend` `onMenu` (~852)
- `adventurebriefing` `onMenu` (~747)
- `adventurelobby` `onBack` non-run branch (~722): change `setScreen('menu')` → `setScreen('modehub')`
- `GameplayScreen` `onExit` (~875): change `setScreen('menu')` → `setScreen('modehub')`
- `pvplobby` `onBack` (~709): `setScreen('menu')` → `setScreen('modehub')`
- `freeplaysetup` `onBack`: stays `playsetpicker`/`pvplobby` (unchanged)
- `playsetpicker` `onBack` (~772): change `chatMode === 'room' ? 'localplay' : 'menu'` → `'modehub'`

Leave the `gameover` `onOpenLobby` (room) handler pointing to `localplay` (re-open room panel) — that still makes sense.

- [ ] **Step 8: Typecheck + manual smoke**

Run: `npm run build`
Expected: PASS. Fix any leftover references to deleted symbols (`checkTwitch`, `handleLocalPlay`, `NoTwitchPrompt`, `handleMenuPlay`, `continueFromTutorial`, `TutorialDestination` import if now unused, `savedRunPreview` props on MainMenu).

Run: `npm run dev`, then verify in the browser:
1. Menu shows three connection options + Twitch card.
2. Solo → mode hub → Free Play → playset picker (game starts; you can type commands).
3. Back/exit from a round returns to the **mode hub**, not the menu.
4. "Change connection" returns to the menu.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx src/hooks/useConnection.ts src/components/MainMenu.tsx src/components/MainMenu.module.css
git commit -m "feat(connection): connection-first flow with mode hub"
```

---

### Task 9: Twitch read-only under Local/Solo

**Files:**
- Modify: `src/App.tsx` (`handleTwitchMessage`, ~456-459)

- [ ] **Step 1: Broaden the early return**

In `handleTwitchMessage`, the line that currently reads:

```tsx
// In Local Play (room mode) Twitch chat is view-only — messages are logged but don't drive the game
if (chatModeRef.current === 'room') return
```

becomes:

```tsx
// Twitch chat drives the game ONLY when Twitch is the primary connection.
// Under Local Play (room) or Solo (local), an attached channel is view-only.
if (chatModeRef.current !== 'twitch') return
```

- [ ] **Step 2: Typecheck + manual check**

Run: `npm run build`
Expected: PASS.

Manual: with Solo selected, connect a Twitch channel via the menu card (optional overlay). Confirm chat messages appear in the log but do **not** execute commands (e.g. a viewer typing `chop lettuce` does nothing). With Twitch chosen as primary, commands execute as before.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(connection): make Twitch view-only unless it is the primary connection"
```

---

### Task 10: Route room commands through lobby/vote handlers

**Files:**
- Modify: `src/App.tsx` (`onPlayerCommand` inside `useRoomHost({...})`, ~501-507)

- [ ] **Step 1: Replace the `onPlayerCommand` body**

Use `classifyRoomCommand` to route by screen before falling through to the game path:

```tsx
onPlayerCommand: (nickname, command) => {
  dispatch({ type: 'ADD_CHAT', username: nickname, text: command, msgType: 'normal' })
  const target = classifyRoomCommand(screenRef.current)
  if (target === 'pvpLobby') {
    if (handleLobbyJoin(nickname, command.trim().toLowerCase())) return
  } else if (target === 'adventureLobby') {
    if (handleAdventureLobbyJoin(nickname, command.trim().toLowerCase())) return
    if (handleAdventureLobbyMetaCommand(nickname, command, false) !== false) return
  } else if (target === 'adventureVote') {
    if (adventureVoteRef.current?.(nickname, command)) return
  }
  handleEventCommand(nickname, command)
  handleTutorialEventCommand(command)
  handleMetaCommand(nickname, command, false)
  if (!isTutorialRef.current) handleCommand(nickname, command)
},
```

Add `import { classifyRoomCommand } from './state/roomCommandRouting'`.

> Note on hoisting: `onPlayerCommand` references `handleLobbyJoin`, `handleAdventureLobbyJoin`, `handleAdventureLobbyMetaCommand`, and `adventureVoteRef`, which are all defined above the `useRoomHost` call (lobby hooks at ~136-160, `adventureVoteRef` at ~158). Confirm they are in scope; they are, since `useRoomHost` is called at ~498.

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(connection): route room player commands to lobby/vote handlers"
```

---

## Phase D — Mode-specific roster wiring

### Task 11: Adventure roster mirrors the room

**Files:**
- Modify: `src/App.tsx`

In Local Play, Adventure's roster should be the connected room players, not `!join` typers. Mirror `roomPlayers` → `adventureLobby` while in room mode and on/under the Adventure flow.

- [ ] **Step 1: Add a mirroring effect**

After the existing room-related effects (near App.tsx:619-638), add:

```tsx
// In Local Play, the connected room roster IS the Adventure roster.
// Mirror room players into the adventure lobby whenever it is active.
useEffect(() => {
  if (chatMode !== 'room') return
  if (adventureLobby == null) return // adventure not active
  const connected = connectedNicknames(roomPlayers)
  // Preserve 'You' (the host) if present, then append connected room players.
  const next = ['You', ...connected.filter(n => n !== 'You')]
  const sameLength = adventureLobby.length === next.length
  const same = sameLength && adventureLobby.every((u, i) => u === next[i])
  if (!same) setAdventureLobby(next)
}, [chatMode, roomPlayers, adventureLobby, setAdventureLobby])
```

Add `import { connectedNicknames } from './state/roomRoster'`.

> Why keep `'You'`: the host plays via the local keyboard even in Local Play, so they remain a participant. If you do **not** want the host counted in Local Play, drop the `'You'` prefix and the filter — confirm with product before changing; default keeps `'You'`.

- [ ] **Step 2: Open the Adventure lobby empty-of-strangers in room mode**

`openAdventureLobby` seeds `['You']`. That is correct — the mirror effect then appends room players. No change needed, but verify `hubAdventure` → `openAdventureLobby` still seeds `['You']`.

- [ ] **Step 3: Typecheck + manual**

Run: `npm run build`
Expected: PASS.

Manual (needs a phone or second browser tab at `/play`): Local Play → hub → Adventure. A phone that joins the room appears in the Adventure lobby roster without typing `!join`. Disconnecting removes them (after the grace period).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(connection): mirror Local Play room roster into Adventure lobby"
```

---

### Task 12: PvP unassigned pool — wiring + snapshot

**Files:**
- Modify: `src/App.tsx`, `src/components/PvPLobby.tsx`, `src/components/PvPLobby.module.css`

PvP needs room players to appear as an unassigned pool the host can drag, plus phone self-pick via snapshots.

- [ ] **Step 1: Compute the unassigned pool and pass it to `PvPLobby`**

In the `pvplobby` render branch (App.tsx:686-712), compute the pool and pass it:

```tsx
} else if (screen === 'pvplobby') {
  const pool = chatMode === 'room'
    ? unassignedPool(roomPlayers, pvpLobby?.red ?? [], pvpLobby?.blue ?? [])
    : []
  content = (
    <PvPLobby
      red={pvpLobby?.red ?? []}
      blue={pvpLobby?.blue ?? []}
      unassigned={pool}
      onMovePlayer={(username, team) => setPvpLobby(prev => {
        if (!prev) return prev
        const other: 'red' | 'blue' = team === 'red' ? 'blue' : 'red'
        return {
          ...prev,
          [team]: prev[team].includes(username) ? prev[team] : [...prev[team], username],
          [other]: prev[other].filter(u => u !== username),
        }
      })}
      onBalance={balanceLobby}
      onKick={username => setPvpLobby(prev => {
        if (!prev) return prev
        return { red: prev.red.filter(u => u !== username), blue: prev.blue.filter(u => u !== username) }
      })}
      onClear={() => setPvpLobby(prev => prev ? { red: [], blue: [] } : prev)}
      onBack={() => { setPvpLobby(null); setScreen('modehub') }}
      onNext={startPvpGame}
    />
  )
}
```

Add `import { unassignedPool } from './state/roomRoster'`. (These `onMovePlayer`/`onKick`/`onClear` closures are identical to the current `pvplobby` branch — only `unassigned` and the `onBack` target are new.)

- [ ] **Step 2: Add the unassigned column to `PvPLobby`**

Add `unassigned: string[]` to `PvPLobby`'s `Props`. Render a pool above the rosters that is drag-source-enabled (reuse `handleDragStart`/`handleDragEnd`). In the `rightCol`, before `rosters`:

```tsx
{unassigned.length > 0 && (
  <div className={styles.pool}>
    <div className={styles.poolLabel}>Unassigned ({unassigned.length}) — drag onto a team</div>
    <div className={styles.poolList}>
      {unassigned.map(p => (
        <div
          key={p}
          draggable
          className={`${styles.poolMember} ${dragUser === p ? styles.memberDragging : ''}`}
          onDragStart={() => handleDragStart(p)}
          onDragEnd={handleDragEnd}
        >{p}</div>
      ))}
    </div>
  </div>
)}
```

Add styles to `PvPLobby.module.css`:

```css
.pool { margin-bottom:16px; padding:12px; border:1px dashed var(--border,#666); border-radius:10px; }
.poolLabel { font-size:12px; opacity:.7; margin-bottom:8px; }
.poolList { display:flex; flex-wrap:wrap; gap:8px; }
.poolMember { padding:6px 12px; border-radius:8px; background:rgba(127,127,127,.18); cursor:grab; }
```

Also update the `hint` text to mention phones: `Phones can pick a team, or drag players below onto a team`.

- [ ] **Step 3: Send PvP-lobby snapshots so phones show the team picker**

In the snapshot interval effect (App.tsx:619-634), special-case the PvP lobby. Replace the body of the interval with:

```tsx
const interval = setInterval(() => {
  const currentScreen = screenRef.current
  if (currentScreen === 'pvplobby') {
    // Always re-send (team assignments change without GameState changing).
    roomRef.current.sendSnapshot(
      pvpLobbySnapshot(),
      pvpLobbyPerPlayer(roomPlayersRef.current, pvpLobbyRef.current?.red ?? [], pvpLobbyRef.current?.blue ?? []),
    )
    return
  }
  const phase: 'lobby' | 'playing' | 'gameover' =
    currentScreen === 'playing' ? 'playing'
    : (currentScreen === 'shiftend' || currentScreen === 'gameover') ? 'gameover'
    : 'lobby'
  const s = stateRef.current
  if (s === lastSnapshotStateRef.current && phase === lastSnapshotPhaseRef.current) return
  lastSnapshotStateRef.current = s
  lastSnapshotPhaseRef.current = phase
  roomRef.current.sendSnapshot(gameStateToSnapshot(s, phase))
}, 300)
```

Add imports: `import { pvpLobbySnapshot, pvpLobbyPerPlayer } from './state/snapshot'` (extend the existing `gameStateToSnapshot` import line). `pvpLobbyRef` already exists from `usePvpLobby`.

- [ ] **Step 4: Typecheck + manual**

Run: `npm run build`
Expected: PASS.

Manual: Local Play → hub → PvP. A joining phone appears in the Unassigned pool. Drag them to Red → the phone's lobby shows "You're on 🔴 Red". On the phone, tapping Blue moves them to Blue on the host. `Configure & Start` proceeds to setup → countdown.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/PvPLobby.tsx src/components/PvPLobby.module.css
git commit -m "feat(connection): PvP unassigned pool + lobby snapshots for phone team pick"
```

---

### Task 13: Phone reflects host-assigned team

**Files:**
- Modify: `src/controller/ControllerApp.tsx`, `src/controller/Lobby.tsx`

Today the phone's team comes only from its own button taps. Thread the per-player `you.team` from the snapshot so host drags reflect on the phone.

- [ ] **Step 1: Store `you` in `ControllerApp`**

In `ControllerApp.tsx`, add state for the per-player view and pass `you.team` to `Lobby`:

```tsx
const [you, setYou] = useState<import('../shared/protocol').PartialPlayerView | null>(null)
// in usePlayerSocket onSnapshot:
onSnapshot: (shared, partial) => { setSnapshot(shared); setYou(partial) },
```

Pass `assignedTeam={you?.team ?? null}` to `<Lobby ... />`.

- [ ] **Step 2: Use `assignedTeam` in `Lobby`**

Add `assignedTeam?: 'red' | 'blue' | null` to `Lobby` Props. Initialise the displayed team from it and keep it in sync:

```tsx
const [team, setTeam] = useState<'red' | 'blue' | null>(assignedTeam ?? null)
useEffect(() => { if (assignedTeam && assignedTeam !== team) setTeam(assignedTeam) }, [assignedTeam])
```

(Add `useEffect` to the import.) The button `onClick` handlers still optimistically `setTeam(...)` and `send('!red')` / `send('!blue')`.

- [ ] **Step 3: Typecheck + manual**

Run: `npm run build`
Expected: PASS.

Manual: with a phone in the PvP lobby, drag it between teams on the host — the phone's "You're on …" indicator updates to match.

- [ ] **Step 4: Commit**

```bash
git add src/controller/ControllerApp.tsx src/controller/Lobby.tsx
git commit -m "feat(connection): reflect host-assigned PvP team on the phone"
```

---

## Phase E — Final verification

### Task 14: Full-flow verification

- [ ] **Step 1: Run all tests**

Run: `npm run test`
Expected: PASS — connection, roomRoster, roomCommandRouting, snapshot suites plus the pre-existing adventure/recipe suites.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run build && npm run lint`
Expected: build PASS; lint clean (fix any unused-import warnings left from deleted symbols).

- [ ] **Step 3: Manual matrix** (`npm run dev`)

Verify each connection × mode entry reaches countdown:

| | Free Play | Adventure | PvP |
|---|---|---|---|
| **Solo** | type & cook | roster = You; run starts | host sets both teams; degenerate but starts |
| **Twitch** | chat cooks | `!join` builds roster | `!red`/`!blue` build teams |
| **Local Play** | phones cook | phones auto-fill roster | phones appear in pool; drag/self-pick |

Also verify: post-round "Menu" → mode hub; "Change connection" → chooser (room closes); Show QR re-opens room panel for latecomers; optional Twitch overlay is view-only under Solo/Local.

- [ ] **Step 4: Final commit (if any fixes)**

```bash
git add -A
git commit -m "fix(connection): polish from full-flow verification"
```

---

## Spec coverage check

- Connection-first flow, three methods → Tasks 1, 7, 8. ✅
- `menu` → chooser, new `modehub`, `localplay` reused → Tasks 4, 6, 7, 8. ✅
- Optional Twitch overlay, view-only rule → Task 9. ✅
- Room roster = game roster: Free Play (existing), Adventure (Task 11), PvP pool (Task 12). ✅
- Command routing for room players → Task 10. ✅
- PvP phone self-pick snapshots + host-reflect → Tasks 5, 12, 13. ✅
- Post-game returns to hub; change-connection closes room → Task 8. ✅
- Solo+PvP allowed, no special-casing → Task 14 matrix. ✅
- Tests for pure logic; manual for wiring → Tasks 1-3, 5 (unit), 8/11/12/14 (manual). ✅
