# Connection-First Screen Flow — Local Play for Every Mode

**Date:** 2026-05-31
**Status:** Approved design (pre-implementation)
**Branch:** `feat/local-play-screen-flow`

---

## Problem

"Local Play" (phone controllers joining a room via QR/code, powered by `useRoomHost` +
the relay server + the `/play` controller app) is currently a fourth *game mode* sitting
beside Free Play, Adventure, and PvP on the Main Menu. It only routes into Free Play
(`localplay` screen → `playsetpicker`). Meanwhile Free Play / Adventure / PvP are each
gated behind `checkTwitch`, so there is no way to play Adventure or PvP without Twitch,
and no way to play any mode with phone controllers except Free Play.

Local Play is not a mode — it is a **connection method**. The connection method (how
players join: Twitch chat, phone controllers, or solo keyboard) is orthogonal to the
game mode (Free Play / Adventure / PvP). The current flow conflates the two.

## Goal

Restructure the screen flow so connection is chosen **first** and is independent of mode.
After choosing a connection, the player picks any of the three modes. Local Play, Twitch,
and Solo all work with Free Play, Adventure, and PvP.

This is a **connection-first** flow (chosen over "mode-first" and "ambient connection on
the menu").

---

## Connection methods

Three first-class connection methods, surfaced on the new connection chooser:

| Method | `chatMode` | Drives the game via | Notes |
|--------|-----------|---------------------|-------|
| **Twitch** | `twitch` | Twitch chat commands | Existing connect card (enter channel). |
| **Local Play** | `room` | Phone controllers (room) | `useRoomHost` creates a room; players join by QR/code. |
| **Solo** | `local` | On-screen keyboard ("You") | No room, no Twitch needed. |

**Optional Twitch overlay:** when the primary driver is Local Play or Solo, a Twitch
channel may *still* be connected for read-only chat visibility on stream (preserves
today's behavior where Twitch stays connected during room play). Twitch chat is
**view-only** unless the primary driver is Twitch.

**Room roster = game roster (auto):** connecting a phone *is* joining. Players do not type
`!join` in Local Play — the connected room roster becomes the mode's participant roster.

---

## Screen flow

### Screens

- **`menu`** — repurposed as the **connection chooser**. Branding + three connection
  options (Twitch card, Local Play, Solo) + optional "Connect Twitch for chat overlay"
  when Local/Solo is primary + the secondary actions that already live here (Tutorial,
  How To Play, Options, Feedback, Credits). **Game-mode buttons are removed from here.**
- **`localplay`** — repurposed as the **room panel**: QR code, room code, live roster,
  Continue. Reached from the chooser when Local Play is selected, and re-openable from the
  hub (Show QR) so latecomers can join before the round locks.
- **`modehub`** — **new** screen. Free Play / Adventure / PvP buttons + Resume-Adventure
  pill. When Local Play is the active connection it also shows a compact room widget
  (`Room ABCD · N players · [Show QR]`). Has a "← Change connection" affordance.
- All existing mode/gameplay screens are unchanged in identity (`adventurelobby`,
  `pvplobby`, `playsetpicker`, `freeplaysetup`, `countdown`, `playing`, `shiftend`,
  `gameover`, the Adventure run screens, `options`, `credits`).

### Transitions

```
menu (connection chooser)
  ├─ Twitch:     connect channel ─▶ "Choose Mode →" ─▶ modehub
  ├─ Local Play: ─▶ localplay (room panel) ─▶ Continue ─▶ modehub
  └─ Solo:       ─▶ modehub

modehub
  ├─ Free Play  ─▶ playsetpicker ─▶ (freeplaysetup) ─▶ countdown ─▶ playing ─▶ shiftend ─▶ gameover
  ├─ Adventure  ─▶ adventurelobby ─▶ recipepick ─▶ briefing ─▶ … (existing loop)
  ├─ PvP        ─▶ pvplobby ─▶ (freeplaysetup) ─▶ countdown ─▶ playing ─▶ gameover
  ├─ Show QR    ─▶ localplay (room panel) ─▶ Back ─▶ modehub   (Local Play only)
  └─ Change connection ─▶ menu   (closes room if Local Play)

end of round (gameover / adventurerunend / etc.)
  └─ "Menu" ─▶ modehub   (NOT menu — connection & room survive across rounds)
```

**Key rule:** the **mode hub is the persistent home** while a connection is active.
Post-game "Menu" buttons retarget `modehub`. Only "Change connection" returns to `menu`
and tears down the room. This keeps the Local Play room and any Twitch connection alive
across multiple rounds.

---

## Implementation approach

**Hybrid (Approach 3):** new screen components + a *thin* connection hook, leaving the
working game-start plumbing intact.

### New components

- **`ConnectionChooser`** (evolved from `MainMenu`) — the `menu` screen. Keeps the Twitch
  connect card and secondary actions; adds Local Play + Solo selection and the optional
  Twitch-overlay control; drops the game-mode buttons.
- **`ModeHub`** — the `modehub` screen. Mode buttons, Resume pill, room widget, Change
  connection.
- **`LocalPlayScreen`** is reused as the room panel (already exists) with a Back action so
  it can return to the hub as well as continue forward.

### New hook: `useConnection`

`chatMode` remains the source of truth (`'twitch' | 'room' | 'local'`), derived from the
chosen primary driver. The hook is deliberately thin and owns only the *new* concerns:

- **State/derived:** `chatMode`, `connectionReady` (Twitch = `status === 'connected'`;
  Local = room `code != null`; Solo = always true once chosen), and a notion of whether a
  primary has been chosen yet.
- **Actions:** `chooseTwitch()`, `chooseLocalPlay()`, `chooseSolo()`, `changeConnection()`
  (reset to chooser + close room), plus the optional-overlay Twitch connect/disconnect.
- **Coordination:** `useRoomHost` and `useTwitchChat` stay instantiated in `App.tsx`
  (they close over `handleCommand`, `handleEventCommand`, etc.); the hook coordinates room
  lifecycle through a `roomRef` and reads/writes `chatMode`.

`App.tsx` consumes the hook and loses the ad-hoc `checkTwitch` gate, `handleLocalPlay`,
and `NoTwitchPrompt` gating for the mode buttons (Twitch is no longer required to reach a
mode — it is one connection choice among three).

### Twitch read-only rule

Broaden the existing room-only early return in `handleTwitchMessage`:

```
// today:  if (chatModeRef.current === 'room') return
// new:    if (chatModeRef.current !== 'twitch') return   // process commands only as Twitch primary
```

Chat is still logged via `ADD_CHAT` before the return, so the overlay still shows messages
under Local/Solo.

---

## Room → roster wiring

**Principle:** in Local Play, connected (non-disconnected) room players ARE the participant
roster. Room join/leave/disconnect events feed each mode's existing roster structures so
current mode logic works unchanged.

- **Free Play:** `participantCount` = connected room players. Already wired in
  `startFreePlay` / `startFromPlayset` (`roomPlayersRef.current.filter(p => !p.disconnected).length`).

- **Adventure:** a mirroring effect keeps `adventureLobby` in sync with connected room
  nicknames while `chatMode === 'room'` (player joined → add to roster, left/kicked → remove).
  `useAdventureRun` derives per-player goal scaling and `participantCount` from roster
  length, so no changes are needed inside the run state machine. Mid-run leave/disconnect
  re-counts at the next shift boundary via the existing `closeShop` logic.

- **PvP:** room players form an **unassigned pool** — connected room players not yet present
  in `pvpLobby.red` or `pvpLobby.blue`. Assignment happens two ways:
  - **Phone self-pick:** the controller `Lobby` already renders a Red/Blue picker that
    sends `!red` / `!blue`. These commands must be routed to the PvP lobby handler (see
    Command routing).
  - **Host drag:** the existing `PvPLobby` drag-and-drop / Balance controls. `PvPLobby`
    gains an **unassigned column** rendering the pool so the host can drag players onto a
    team.

---

## Command routing

Room player commands arrive via `useRoomHost`'s `onPlayerCommand` and currently bypass the
lobby/vote intercepts that `handleTwitchMessage` performs. `onPlayerCommand` must gain the
same screen-aware routing **before** falling through to `handleCommand`:

- `screen === 'pvplobby'` → route `!red` / `!blue` (and `!join`) to `handleLobbyJoin`.
- `screen === 'adventurelobby'` → route lobby commands to the adventure lobby handlers.
- `screen === 'adventurepantryshop' | 'adventurerecipepick'` → route `!1`..`!N` to
  `adventureVoteRef.current`.
- otherwise → `handleEventCommand` → `handleMetaCommand` → `handleCommand` (today's path).

### Phone snapshots in the PvP lobby

For phone self-pick to work, the snapshot the phone receives during the **PvP lobby** must:
- flag PvP-ness so the controller `Lobby` shows the team picker (it keys off
  `snapshot.teamMoney !== undefined`) — e.g. emit `teamMoney: { red: 0, blue: 0 }` while on
  `pvplobby` in room mode;
- carry each player's assigned `team` in their `PartialPlayerView` (sourced from
  `pvpLobby`) so the phone reflects host-side drags.

The snapshot interval already runs while `chatMode === 'room'` and maps screen → phase
(`lobby` / `playing` / `gameover`); extend the lobby snapshot to include the PvP flag and
per-player team view.

---

## Edge cases

- **Solo + PvP** is allowed but degenerate (one person). No special-casing — all three
  modes are selectable under every connection.
- **Change connection with players in the room** → confirm, then `closeRoom()` and return
  to the chooser.
- **Latecomers** join via the hub's Show-QR room panel until the round locks joins
  (existing `lockJoins()` on game start; `unlockJoins()` when returning to a lobby/hub).
- **Disconnect grace period** (60s reconnect window in `useRoomHost`) is unchanged; a
  disconnected player is excluded from `participantCount` and the mode roster but may
  reconnect.
- **Resume Adventure pill** continues to work from the hub (and may also appear on the
  chooser if desired — to be decided in the plan; default is hub only).

---

## Testing

There is no pre-existing test harness, but the codebase recently adopted **Vitest** (e.g.
`src/data/adventureRecipeDraft.test.ts`, `recipeProfile.test.ts`). New coverage:

- **`useConnection`** — readiness derivation per method, lifecycle transitions
  (choose → ready → changeConnection resets + closes room).
- **Room → roster mirroring** — pure helper that maps connected room players to the
  Adventure roster / PvP unassigned pool, tested in isolation.
- **Command routing** — the screen-aware `onPlayerCommand` dispatch (which handler fires
  per screen) where it can be factored into a testable function.

Manual verification by running the app for flows that resist unit testing: connection
chooser → each method → each mode → play → return to hub; phone self-pick in PvP; latecomer
join via Show QR.

---

## Out of scope

- No changes to the relay server protocol beyond what already exists (`PlayerActionMsg`
  already carries raw command text; `PartialPlayerView.team` already exists).
- No new game mechanics; this is screen-flow + connection wiring only.
- No redesign of the in-game (`playing`) screen.
