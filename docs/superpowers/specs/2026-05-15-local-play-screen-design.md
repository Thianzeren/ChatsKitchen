# Local Play Screen — Design Spec

## Summary

Move the Jackbox-style room hosting mechanism out of the main menu and into a dedicated `localplay` screen. Add a **LOCAL PLAY** button to the main menu alongside FREE PLAY. The new screen shows the room code and QR immediately on entry, lets players join while the host configures, then hands off to the existing PlaysetPicker flow.

---

## Decisions

| Question | Decision |
|---|---|
| When does the room connect? | Immediately on screen enter (code visible while host browses) |
| How does the host start the game? | Start button → existing PlaysetPicker → existing game flow |
| Twitch Connect in main menu? | Unchanged — stays in right column |
| Screen structure | New `'localplay'` screen, not a modal or inline expansion |

---

## Section 1: Main Menu Changes

### What's removed
- `RoomHostCard` component removed from the right column
- Five props removed from `MainMenu`: `roomCode`, `roomConnected`, `roomPlayers`, `onHostRoom`, `onLeaveRoom`
- `RoomHostCard` import removed from `MainMenu.tsx`

### What's added
The **FREE PLAY** button row splits into two side-by-side buttons:

```
┌─────────────────┬─────────────────┐
│   FREE PLAY     │   LOCAL PLAY    │  ← same flex row, equal width
└─────────────────┴─────────────────┘
```

Both buttons have the same row height (currently Free Play is `flex: 1.6` — keep that height, split into two columns with `flex: 1` each).

**FREE PLAY** — unchanged appearance (torch-flame orange `#d87428`, same text/arrow).

**LOCAL PLAY** — distinct but complementary treatment:
- Background: `var(--surface)` (`#231e19`) with a `2px solid var(--accent-gold)` (`#c4a020`) border
- Label: "Local Play" in Fredoka 700, same size as the Adventure/PvP buttons
- Subtext: "Phone controllers, no Twitch needed" in Space Mono 18px, muted
- Arrow: `→` in dim text
- Hover: `filter: brightness(1.1)`, `translateY(-1px)`
- Press shadow: `0 4px 0 rgba(196,160,32,0.4)` collapsing to `0 2px 0` on active

### New `onLocalPlay` prop
`MainMenu` receives `onLocalPlay: () => void` (replaces the five room props). Wired to the LOCAL PLAY button's `onClick`.

---

## Section 2: LocalPlay Screen

### Route
`screen === 'localplay'` renders `<LocalPlayScreen />` in `App.tsx`.

### Entry behavior
On enter: `setChatMode('room'); setScreen('localplay')`.  
`useRoomHost` becomes enabled immediately (its dep on `chatMode === 'room'` fires). The room code arrives via the `host:create` ack — typically within 200ms. While `code` is null, show a loading state ("Creating room…").

### Exit behavior
Back button: `setChatMode('local'); setScreen('menu')`.  
`useRoomHost` cleanup runs automatically (socket disconnects, code clears, roomPlayers empties).

### Layout — centered single column

```
┌──────────────────────────────────────────┐
│                                          │
│   ROOM CODE                              │  ← label, small caps
│   A B C D                                │  ← 96px monospace, letter-spaced
│                                          │
│   [QR CODE — 200×200px canvas]           │
│                                          │
│   letchatcook.vercel.app/play            │  ← join URL, stone-text mono
│                                          │
│   ── 2 players joined ──                 │  ← divider + count
│   👤 alice                               │
│   👤 bob                                 │
│   (or "No players yet — share the code") │
│                                          │
│   [← Back]          [Start →]            │  ← bottom button row
│                                          │
└──────────────────────────────────────────┘
```

### Component: `LocalPlayScreen.tsx`

Props received from `App.tsx`:
```ts
interface Props {
  code: string | null          // from useRoomHost
  connected: boolean           // from useRoomHost
  players: Array<{ id: string; nickname: string }>  // roomPlayers state
  onBack: () => void
  onStart: () => void          // calls handleMenuPlay('playsetpicker')
}
```

The component does not own socket logic — it only renders from props passed down from App.tsx.

### QR code
`QRCode.toCanvas(canvasRef.current, url, { width: 200, margin: 1 }).catch(console.error)` where `url = \`${window.location.origin}/play?room=${code}\``. Fires in a `useEffect` watching `[code]`.

### Start button
Always enabled (host can start with 0 players — bots or local chat still work). Calls `onStart`. `chatMode` stays `'room'` through the game, so room commands continue routing into `handleTwitchMessage`.

### Loading state
While `code === null`: show "Creating room…" in place of the code. The QR canvas is not rendered yet.

### Style notes (dungeon palette)
- Screen background: `var(--bg)` (`#1a1512`)
- Room code text: `var(--text)` (`#f5ead8`), Fredoka 700, 96px, letter-spacing 12px
- "ROOM CODE" label: `var(--accent-gold)`, Space Mono 700 12px, uppercase, letter-spacing 2px
- QR canvas: white background (required for QR scanning), 8px border-radius
- Join URL: `var(--text-muted)`, Space Mono 400 18px
- Player list divider line: `var(--border)`
- Player count text: `var(--text-secondary)`, Space Mono 700 18px
- Player names: `var(--text)`, Space Mono 400 18px, with `👤` prefix
- Back button: ghost style (`var(--surface)` bg, `var(--border)` border, `var(--text-muted)`)
- Start button: primary style (torch-flame, `0 4px 0 var(--accent-deep)` press shadow)

---

## Section 3: App.tsx Wiring

### types.ts
Add `'localplay'` to the `Screen` union:
```ts
export type Screen = 'menu' | 'localplay' | 'pvplobby' | 'adventurebriefing' | ...
```

### App.tsx changes

**New handler:**
```ts
const handleLocalPlay = useCallback(() => {
  setChatMode('room')
  setScreen('localplay')
}, [])
```

**MainMenu call site** — remove five room props, add `onLocalPlay`:
```tsx
<MainMenu
  ...
  onLocalPlay={handleLocalPlay}
  // roomCode, roomConnected, roomPlayers, onHostRoom, onLeaveRoom — REMOVED
/>
```

**New screen render:**
```tsx
} else if (screen === 'localplay') {
  content = (
    <LocalPlayScreen
      code={room.code}
      connected={room.connected}
      players={roomPlayers}
      onBack={() => { setChatMode('local'); setScreen('menu') }}
      onStart={() => handleMenuPlay('playsetpicker')}
    />
  )
}
```

**No changes to:**
- `useRoomHost` hook
- `lockJoins`/`unlockJoins` calls in `startFreePlay`, `startFromPlayset`, `handleGameOver`
- `roomPlayers` state management
- `roomRef` / snapshot emission effect
- Twitch Connect props on MainMenu

---

## File Checklist

| File | Change |
|---|---|
| `src/state/types.ts` | Add `'localplay'` to `Screen` union |
| `src/App.tsx` | Add `handleLocalPlay`, add `localplay` screen render, update `MainMenu` props |
| `src/components/MainMenu.tsx` | Replace five room props with `onLocalPlay`; split Free Play row into Free Play + Local Play |
| `src/components/MainMenu.module.css` | New `.modeLocalPlay` button styles; split Free Play row |
| `src/components/LocalPlayScreen.tsx` | New component |
| `src/components/LocalPlayScreen.module.css` | New styles |
| `src/components/RoomHostCard.tsx` | Unchanged (still used internally by LocalPlayScreen via QR logic — or inline the QR logic) |

**Note on RoomHostCard:** The QR canvas logic from `RoomHostCard.tsx` can either be reused (import into LocalPlayScreen) or inlined directly. Since `LocalPlayScreen` has a richer, more opinionated layout than the card slot allowed, inlining is cleaner. `RoomHostCard.tsx` can be deleted.

---

## What Does Not Change

- `useRoomHost.ts` — unchanged
- `usePlayerSocket.ts` — unchanged
- `commandProcessor.ts` — unchanged
- `gameReducer.ts` — unchanged
- `useTwitchChat.ts` — unchanged
- The `/play` route and all controller components — unchanged
- Twitch Connect card in MainMenu — unchanged
