# Local Play Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Jackbox room-hosting UI out of the main menu into a dedicated `localplay` screen, accessed via a new LOCAL PLAY button beside FREE PLAY.

**Architecture:** Add `'localplay'` to the Screen union; entering it sets `chatMode='room'` (which enables `useRoomHost` and connects the relay). A new `LocalPlayScreen` component renders purely from props (code, players, callbacks) — it owns no socket logic. The existing PlaysetPicker/game flow is reused unchanged. `RoomHostCard.tsx` is deleted; its QR logic is inlined into `LocalPlayScreen`.

**Tech Stack:** React 18, TypeScript, CSS Modules, `qrcode` (already installed), dungeon CSS custom properties (`var(--bg)`, `var(--accent)`, `var(--accent-gold)`, etc. from `src/theme.css`).

---

## File Map

| Path | Change |
|---|---|
| `src/state/types.ts` | Add `'localplay'` to `Screen` union |
| `src/components/LocalPlayScreen.tsx` | **NEW** — centered room code + QR + player list + Back/Start |
| `src/components/LocalPlayScreen.module.css` | **NEW** — dungeon-palette styles |
| `src/components/MainMenu.tsx` | Remove 5 room props + RoomHostCard; add `onLocalPlay` + LOCAL PLAY button |
| `src/components/MainMenu.module.css` | New `.modePlayRow` + `.modeLocalPlay` + `.lpName`/`.lpDesc`/`.lpArrow`; `modeFreePlay` flex adjusted |
| `src/App.tsx` | Add `handleLocalPlay`; add `localplay` screen render; update MainMenu call site |
| `src/components/RoomHostCard.tsx` | **DELETED** |
| `src/components/RoomHostCard.module.css` | **DELETED** |

---

## Task 1: Add `'localplay'` to Screen type

**Files:**
- Modify: `src/state/types.ts:1`

- [ ] **Step 1: Add `'localplay'` to the Screen union**

Open `src/state/types.ts`. Find line 1:
```ts
export type Screen = 'menu' | 'pvplobby' | 'adventurebriefing' | 'options' | 'playsetpicker' | 'freeplaysetup' | 'countdown' | 'playing' | 'shiftend' | 'gameover' | 'adventureshiftpassed' | 'adventurerunend' | 'credits'
```

Replace with:
```ts
export type Screen = 'menu' | 'localplay' | 'pvplobby' | 'adventurebriefing' | 'options' | 'playsetpicker' | 'freeplaysetup' | 'countdown' | 'playing' | 'shiftend' | 'gameover' | 'adventureshiftpassed' | 'adventurerunend' | 'credits'
```

- [ ] **Step 2: Verify build**

```bash
cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen"
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/state/types.ts
git commit -m "feat: add 'localplay' to Screen union type"
```

---

## Task 2: Create `LocalPlayScreen` component and styles

**Files:**
- Create: `src/components/LocalPlayScreen.module.css`
- Create: `src/components/LocalPlayScreen.tsx`

- [ ] **Step 1: Create `src/components/LocalPlayScreen.module.css`**

```css
.screen {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: var(--bg);
}

.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 48px;
  min-width: 480px;
  max-width: 560px;
}

.codeLabel {
  font-family: 'Space Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--accent-gold);
}

.code {
  font-family: 'Fredoka', sans-serif;
  font-size: 96px;
  font-weight: 700;
  letter-spacing: 12px;
  color: var(--text);
  line-height: 1;
  text-shadow:
    0 5px 0 #8e4e18,
    -2px -2px 0 #d87428,
     2px -2px 0 #d87428,
    -2px  2px 0 #d87428,
     2px  2px 0 #d87428;
}

.creating {
  font-family: 'Space Mono', monospace;
  font-size: 22px;
  color: var(--text-muted);
  font-style: italic;
  height: 96px;
  display: flex;
  align-items: center;
}

.qr {
  border-radius: 8px;
  background: #fff;
  padding: 4px;
  display: block;
}

.joinUrl {
  font-family: 'Space Mono', monospace;
  font-size: 18px;
  color: var(--text-muted);
}

.divider {
  width: 100%;
  height: 1px;
  background: var(--border);
}

.playerCount {
  font-family: 'Space Mono', monospace;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-secondary);
  text-align: center;
}

.playerList {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  max-height: 180px;
  overflow-y: auto;
}

.playerRow {
  font-family: 'Space Mono', monospace;
  font-size: 18px;
  color: var(--text);
  padding: 6px 12px;
  background: var(--surface);
  border-radius: 6px;
}

.buttons {
  display: flex;
  gap: 12px;
  width: 100%;
  margin-top: 8px;
}

.backBtn {
  flex: 1;
  padding: 16px;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 12px;
  font-family: 'Fredoka', sans-serif;
  font-size: 22px;
  font-weight: 700;
  color: var(--text-muted);
  cursor: pointer;
  transition: border-color 0.15s;
}

.backBtn:hover {
  border-color: var(--text-faint);
}

.startBtn {
  flex: 2;
  padding: 16px;
  background: var(--accent);
  border: none;
  border-radius: 12px;
  font-family: 'Fredoka', sans-serif;
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  cursor: pointer;
  box-shadow: 0 4px 0 var(--accent-deep);
  transition: filter 0.15s, transform 0.1s, box-shadow 0.1s;
}

.startBtn:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.startBtn:active {
  transform: translateY(2px);
  box-shadow: 0 2px 0 var(--accent-deep);
}
```

- [ ] **Step 2: Create `src/components/LocalPlayScreen.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import styles from './LocalPlayScreen.module.css'

interface Props {
  code: string | null
  connected: boolean
  players: Array<{ id: string; nickname: string }>
  onBack: () => void
  onStart: () => void
}

export default function LocalPlayScreen({ code, players, onBack, onStart }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!code || !canvasRef.current) return
    const url = `${window.location.origin}/play?room=${code}`
    QRCode.toCanvas(canvasRef.current, url, { width: 200, margin: 1 }).catch(console.error)
  }, [code])

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.codeLabel}>Room Code</div>

        {code
          ? <div className={styles.code}>{code}</div>
          : <div className={styles.creating}>Creating room…</div>
        }

        {code && (
          <>
            <canvas ref={canvasRef} className={styles.qr} />
            <div className={styles.joinUrl}>{window.location.origin}/play</div>
          </>
        )}

        <div className={styles.divider} />

        <div className={styles.playerCount}>
          {players.length === 0
            ? 'No players yet — share the code!'
            : `${players.length} player${players.length !== 1 ? 's' : ''} joined`
          }
        </div>

        {players.length > 0 && (
          <div className={styles.playerList}>
            {players.map(p => (
              <div key={p.id} className={styles.playerRow}>👤 {p.nickname}</div>
            ))}
          </div>
        )}

        <div className={styles.buttons}>
          <button className={styles.backBtn} onClick={onBack}>← Back</button>
          <button className={styles.startBtn} onClick={onStart}>Start →</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen"
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no errors. (`LocalPlayScreen` is not imported anywhere yet, so it won't appear in the bundle — that's fine.)

- [ ] **Step 4: Commit**

```bash
git add src/components/LocalPlayScreen.tsx src/components/LocalPlayScreen.module.css
git commit -m "feat: add LocalPlayScreen component with room code, QR, player list"
```

---

## Task 3: Update MainMenu — LOCAL PLAY button + remove room props

**Files:**
- Modify: `src/components/MainMenu.tsx`
- Modify: `src/components/MainMenu.module.css`

- [ ] **Step 1: Update the `Props` interface in `MainMenu.tsx`**

Find the Props interface (lines 6–25). Replace it entirely:

```ts
interface Props {
  onPlay: () => void
  onPvp: () => void
  onAdventure: () => void
  onOptions: () => void
  onFeedback: () => void
  onCredits: () => void
  onTutorial: () => void
  onStartTutorial: () => void
  onLocalPlay: () => void
  twitchChannel: string | null
  twitchStatus: TwitchStatus
  twitchError: string | undefined
  onTwitchConnect: (channel: string) => void
  onTwitchDisconnect: () => void
}
```

- [ ] **Step 2: Update the component signature**

Find the function signature line (line 27):
```ts
export default function MainMenu({ onPlay, onPvp, onAdventure, onOptions, onFeedback, onCredits, onTutorial, onStartTutorial, twitchChannel, twitchStatus, twitchError, onTwitchConnect, onTwitchDisconnect, roomCode, roomConnected, roomPlayers, onHostRoom, onLeaveRoom }: Props) {
```

Replace with:
```ts
export default function MainMenu({ onPlay, onPvp, onAdventure, onOptions, onFeedback, onCredits, onTutorial, onStartTutorial, onLocalPlay, twitchChannel, twitchStatus, twitchError, onTwitchConnect, onTwitchDisconnect }: Props) {
```

- [ ] **Step 3: Remove the RoomHostCard import**

Find at the top of the file:
```ts
import RoomHostCard from './RoomHostCard'
```

Delete that entire line.

- [ ] **Step 4: Remove `RoomHostCard` from the JSX and add LOCAL PLAY button**

Find the `{/* Room Host Card */}` block in the right column JSX and delete it:
```tsx
          {/* Room Host Card */}
          <RoomHostCard
            code={roomCode}
            connected={roomConnected}
            players={roomPlayers}
            onHostRoom={onHostRoom}
            onLeaveRoom={onLeaveRoom}
          />
```

Then find the standalone `modeFreePlay` button:
```tsx
            <button className={styles.modeFreePlay} onClick={onPlay}>
              <div>
                <div className={styles.fpName}>Free Play</div>
                <div className={styles.fpDesc}>Pick recipes, set duration &amp; difficulty</div>
              </div>
              <div className={styles.fpArrow}>▶</div>
            </button>
```

Replace it with a row containing both FREE PLAY and LOCAL PLAY:
```tsx
            <div className={styles.modePlayRow}>
              <button className={styles.modeFreePlay} onClick={onPlay}>
                <div>
                  <div className={styles.fpName}>Free Play</div>
                  <div className={styles.fpDesc}>Pick recipes, set duration &amp; difficulty</div>
                </div>
                <div className={styles.fpArrow}>▶</div>
              </button>

              <button className={styles.modeLocalPlay} onClick={onLocalPlay}>
                <div>
                  <div className={styles.lpName}>Local Play</div>
                  <div className={styles.lpDesc}>Phone controllers, no Twitch needed</div>
                </div>
                <div className={styles.lpArrow}>→</div>
              </button>
            </div>
```

- [ ] **Step 5: Add new CSS rules to `MainMenu.module.css`**

Find the `.modes` rule and add `.modePlayRow` immediately after it:

After:
```css
.modes {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 0;
}
```

Add:
```css
.modePlayRow {
  display: flex;
  gap: 10px;
  flex: 1.6;
  min-height: 0;
}
```

- [ ] **Step 6: Adjust `modeFreePlay` flex to `1` (was standalone, now shares a row)**

Find in `MainMenu.module.css`:
```css
.modeFreePlay {
  background: #d87428;
  border: none;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  cursor: pointer;
  transition: filter 0.15s, transform 0.1s, box-shadow 0.1s;
  flex: 1.6;
  min-height: 0;
  box-shadow: 0 4px 0 #8e4e18;
  text-align: left;
}
```

Change `flex: 1.6;` to `flex: 1;`:
```css
.modeFreePlay {
  background: #d87428;
  border: none;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  cursor: pointer;
  transition: filter 0.15s, transform 0.1s, box-shadow 0.1s;
  flex: 1;
  min-height: 0;
  box-shadow: 0 4px 0 #8e4e18;
  text-align: left;
}
```

- [ ] **Step 7: Add LOCAL PLAY button styles to `MainMenu.module.css`**

After the `.fpArrow` rule, add:

```css
/* Local Play button */
.modeLocalPlay {
  background: var(--surface);
  border: 2px solid #c4a020;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  cursor: pointer;
  transition: filter 0.15s, transform 0.1s, box-shadow 0.1s;
  flex: 1;
  min-height: 0;
  box-shadow: 0 4px 0 rgba(196, 160, 32, 0.4);
  text-align: left;
}

.modeLocalPlay:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.modeLocalPlay:active {
  transform: translateY(2px);
  box-shadow: 0 2px 0 rgba(196, 160, 32, 0.4);
}

.lpName {
  font-family: 'Fredoka', sans-serif;
  font-size: 30px;
  font-weight: 700;
  color: #c4a020;
  line-height: 1;
}

.lpDesc {
  font-family: 'Space Mono', monospace;
  font-size: 15px;
  color: var(--text-muted);
  margin-top: 4px;
}

.lpArrow {
  font-size: 28px;
  color: rgba(196, 160, 32, 0.4);
  flex-shrink: 0;
}
```

- [ ] **Step 8: Verify build**

```bash
cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen"
npm run build 2>&1 | tail -10
```

Expected errors: App.tsx will complain that it's still passing the 5 removed room props and missing `onLocalPlay`. That's expected — fixed in Task 4. Filter those out:

```bash
npm run build 2>&1 | grep -v "App.tsx" | tail -10
```

Expected: no errors outside of App.tsx prop mismatches.

- [ ] **Step 9: Commit**

```bash
git add src/components/MainMenu.tsx src/components/MainMenu.module.css
git commit -m "feat(MainMenu): add LOCAL PLAY button, remove RoomHostCard and room props"
```

---

## Task 4: Wire App.tsx + delete RoomHostCard

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/components/RoomHostCard.tsx`
- Delete: `src/components/RoomHostCard.module.css`

- [ ] **Step 1: Add the `LocalPlayScreen` import to `App.tsx`**

At the top of `src/App.tsx`, near the other component imports, add:
```ts
import LocalPlayScreen from './components/LocalPlayScreen'
```

- [ ] **Step 2: Add the `handleLocalPlay` callback in `App.tsx`**

Find `startFreePlay` in `App.tsx`. Add `handleLocalPlay` immediately after it:

```ts
  const handleLocalPlay = useCallback(() => {
    setChatMode('room')
    setRoomPlayers([])
    setScreen('localplay')
  }, [])
```

(`setRoomPlayers([])` ensures the player list is clean if the host re-enters the screen after a previous session.)

- [ ] **Step 3: Update the `MainMenu` JSX in `App.tsx`**

Find the `MainMenu` JSX block (starts around line 496):
```tsx
    content = (
      <MainMenu
        onPlay={() => handleMenuPlay('playsetpicker')}
        onPvp={handleMenuPvp}
        onAdventure={handleMenuAdventure}
        onOptions={() => setScreen('options')}
        onFeedback={() => setShowFeedback(true)}
        onCredits={() => setScreen('credits')}
        onTutorial={handleMenuTutorial}
        onStartTutorial={startTutorial}
        twitchChannel={twitchChannel}
        twitchStatus={twitchChat.status}
        twitchError={twitchChat.error}
        onTwitchConnect={(ch) => setTwitchChannel(ch)}
        onTwitchDisconnect={() => setTwitchChannel(null)}
        roomCode={chatMode === 'room' ? room.code : null}
        roomConnected={room.connected}
        roomPlayers={chatMode === 'room' ? roomPlayers : []}
        onHostRoom={() => { setChatMode('room'); setRoomPlayers([]) }}
        onLeaveRoom={() => setChatMode('local')}
      />
    )
```

Replace with:
```tsx
    content = (
      <MainMenu
        onPlay={() => handleMenuPlay('playsetpicker')}
        onPvp={handleMenuPvp}
        onAdventure={handleMenuAdventure}
        onOptions={() => setScreen('options')}
        onFeedback={() => setShowFeedback(true)}
        onCredits={() => setScreen('credits')}
        onTutorial={handleMenuTutorial}
        onStartTutorial={startTutorial}
        onLocalPlay={handleLocalPlay}
        twitchChannel={twitchChannel}
        twitchStatus={twitchChat.status}
        twitchError={twitchChat.error}
        onTwitchConnect={(ch) => setTwitchChannel(ch)}
        onTwitchDisconnect={() => setTwitchChannel(null)}
      />
    )
```

- [ ] **Step 4: Add the `localplay` screen render block in `App.tsx`**

Find the `if (screen === 'menu') {` block. Add the `localplay` case immediately after it (before `} else if (screen === 'pvplobby') {`):

```tsx
  } else if (screen === 'localplay') {
    content = (
      <LocalPlayScreen
        code={room.code}
        connected={room.connected}
        players={roomPlayers}
        onBack={() => { setChatMode('local'); setScreen('menu') }}
        onStart={() => setScreen('playsetpicker')}
      />
    )
  } else if (screen === 'pvplobby') {
```

Note: `onStart` goes directly to `setScreen('playsetpicker')` — bypassing `checkTwitch` since Local Play explicitly does not need Twitch.

- [ ] **Step 5: Delete RoomHostCard files**

```bash
cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen"
rm src/components/RoomHostCard.tsx src/components/RoomHostCard.module.css
```

- [ ] **Step 6: Verify clean build**

```bash
npm run build 2>&1 | tail -10
```

Expected: `✓ built in` with zero TypeScript errors. No references to `RoomHostCard` should remain.

If there's a stale import anywhere:
```bash
grep -r "RoomHostCard" src/
```
Expected: no output.

- [ ] **Step 7: Visual smoke test**

Start the dev server (relay must also be running for the `localplay` screen to show a code):

```bash
# Terminal 1 — relay
cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen/server" && npm run dev

# Terminal 2 — frontend
cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen" && npm run dev
```

Open `http://localhost:5174` and verify:
1. Main menu shows **FREE PLAY** and **LOCAL PLAY** side by side in the same row
2. No RoomHostCard visible anywhere in the menu right column
3. Clicking LOCAL PLAY navigates to the `localplay` screen
4. The localplay screen shows "Creating room…" briefly, then a 4-letter code appears
5. A QR code renders below the code
6. Clicking `← Back` returns to the menu and the code disappears
7. Clicking `Start →` from the localplay screen navigates to the PlaysetPicker
8. On a second tab at `/play?room=CODE` — joining shows the nickname in the localplay player list

- [ ] **Step 8: Commit**

```bash
cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen"
git add src/App.tsx src/components/RoomHostCard.tsx src/components/RoomHostCard.module.css
git commit -m "feat: wire localplay screen in App.tsx; delete RoomHostCard"
```

(`git add` on a deleted file stages the deletion.)

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered in |
|---|---|
| `'localplay'` added to Screen union | Task 1 |
| Room connects immediately on screen enter | Task 4 Step 4 — `setChatMode('room')` in `handleLocalPlay` fires before `setScreen('localplay')`, enabling `useRoomHost` |
| Loading state while `code === null` | Task 2 — `.creating` div shown when `!code` |
| Room code displayed at 96px Fredoka | Task 2 CSS — `.code` rule |
| QR canvas at 200px pointing to `/play?room=CODE` | Task 2 — `useEffect` with `QRCode.toCanvas` |
| Join URL hint | Task 2 — `.joinUrl` div |
| Player list with count | Task 2 — `.playerCount` + `.playerList` |
| Empty state text | Task 2 — conditional in `.playerCount` |
| Back button disconnects room | Task 4 Step 4 — `onBack: () => { setChatMode('local'); setScreen('menu') }` |
| Start button goes to PlaysetPicker | Task 4 Step 4 — `onStart: () => setScreen('playsetpicker')` |
| Start always enabled (no player gate) | Task 2 — no `disabled` on `startBtn` |
| Twitch check bypassed for Local Play | Task 4 Step 4 — `setScreen('playsetpicker')` directly |
| FREE PLAY and LOCAL PLAY in same row | Task 3 — `.modePlayRow` wrapper |
| LOCAL PLAY button: dungeon-gold border, Fredoka | Task 3 — `.modeLocalPlay`, `.lpName` CSS |
| LOCAL PLAY subtext | Task 3 — `.lpDesc` "Phone controllers, no Twitch needed" |
| `RoomHostCard` removed from MainMenu | Task 3 Step 4 |
| Five room props removed from MainMenu | Task 3 Steps 1–3 |
| `RoomHostCard.tsx` deleted | Task 4 Step 5 |
| Twitch Connect in main menu unchanged | ✅ — never touched |
| `useRoomHost` unchanged | ✅ — never touched |
| `lockJoins`/`unlockJoins` unchanged | ✅ — still fire in `startFreePlay`/`startFromPlayset`/`handleGameOver` |
| `roomPlayers` cleared on re-enter | Task 4 Step 2 — `setRoomPlayers([])` in `handleLocalPlay` |

**Placeholder scan:** None found. All steps have complete code.

**Type consistency:**
- `LocalPlayScreen` Props: `{ code, connected, players, onBack, onStart }` — defined in Task 2, used in Task 4
- `handleLocalPlay` calls `setChatMode`, `setRoomPlayers`, `setScreen` — all exist in App.tsx
- `room.code` and `room.connected` from `useRoomHost` return — matches Task 4 `LocalPlayScreen` props
