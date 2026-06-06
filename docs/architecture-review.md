# ChatsKitchen — Technical Architecture Review

**Date:** 2026-06-06
**Reviewer:** Claude (whole-codebase pass)
**Scope:** Entire repository — client app, relay server, data layer, tests, build/CI.
**Purpose:** Doubles as (a) an onboarding reference for how the system is structured and why, and (b) a candid health audit with prioritized recommendations. No code changes are made by this document.

> **Headline:** This is a disciplined, well-factored hobbyist codebase with genuinely strong fundamentals (pure, well-tested logic layer; strict TypeScript; type-safe client/server boundary; CI gating). The main structural risk is concentration: `App.tsx` and the `TICK` branch of `gameReducer.ts` have grown into oversized, untested hubs that now carry most of the system's accidental complexity.

---

## 1. System Overview & Topology

"Let Chat Cook" is a browser-based, real-time multiplayer cooking game. Two things are worth understanding before anything else:

**It is a single Vite bundle with two render targets.** `src/main.tsx` inspects `window.location.pathname`: `/play` renders the phone **Controller** app, everything else renders the main **game** (`App.tsx`). This is how one deployment serves both the host screen (a streamer's browser) and the players' phones.

```
src/main.tsx
  ├─ pathname === '/play'  → ControllerApp   (phone player UI)
  └─ otherwise             → App             (host / game UI)
```

**It is no longer purely client-side.** A thin **socket.io relay server** (`server/`, deployed to Fly.io) brokers "Local Play": phones join a 4-letter room code, send raw command strings, and receive per-player snapshots. The server holds no game logic — it is a stateless message relay with in-memory rooms and rate limiting. The game simulation always runs in the host's browser.

> ⚠️ **Doc drift:** `CLAUDE.md` still describes the project as "Client-side SPA (no backend)" with "No Backend / No Environment Variables." That was true at the React-migration stage but is now inaccurate — there is a relay server, a shared wire protocol, a Fly.io deploy workflow, and a relay URL config. See §6.

### Input topology — three sources, one pipeline

The defining architectural idea (well documented in `CLAUDE.md`) is that **three input sources converge on a single command pipeline**:

```
Twitch chat (tmi.js)  ─┐
Local chatbox         ─┼─→ routeChatCommand(user, text, isMod, forceDuringTutorial)  [App.tsx]
Phone controller      ─┘        → screen-based intercepts (PvP / Adventure lobbies & votes)
   (via relay server)           → kitchen-event match → meta-commands → parseCommand → dispatch(action)
                                 → gameReducer → new GameState → re-render → snapshot to phones
```

This convergence is a real strength — there is exactly one place where "a command becomes a state change." The cost is that the convergence point lives inside `App.tsx`, which is the most overloaded file in the repo (§5.1).

---

## 2. Layered Module Map

The repository separates cleanly into layers, roughly in dependency order (lower depends on nothing above it):

| Layer | Dir | LOC | Role | React? | Tested? |
|-------|-----|-----|------|--------|---------|
| **Content & pure logic** | `src/data/` | ~2,600 (12 files) | Recipes, kitchen events, Adventure (garnishes/bosses/draft/mode), recipe profiles, seeded RNG, star thresholds, playsets | No | **Strong** (10 of 12 modules) |
| **Domain state** | `src/state/` | ~1,870 (9 files) | `gameReducer` (the engine), `types`, and small pure helpers (`commandProcessor`, `snapshot`, `roomCommandRouting`, `roomRoster`, `participants`) | No | **Strong** (reducer, economy, routing, snapshot, storage all covered) |
| **Stateful glue** | `src/hooks/` | ~1,810 (12 files) | Lifecycles & orchestration: game loop, Twitch client, kitchen events, Adventure run, lobbies, room host, bot sim | Yes | **None** |
| **Presentation** | `src/components/` | ~ (43 files) | Screens + widgets; CSS Modules per component | Yes | **None** |
| **Phone controller** | `src/controller/` | ~490 (6 files) | Separate small app: join → lobby → play/vote | Yes | **None** |
| **Audio** | `src/audio/` | ~470 (3 files) | Howler-based `AudioManager`, asset map, `useGameAudio` | Mixed | **None** |
| **Shared protocol** | `src/shared/` | small | Wire types + config shared by client *and* server | No | (via snapshot test) |
| **Relay server** | `server/` | ~197 (1 file) | socket.io rooms, join/lock, rate limiting, snapshot fan-out | No (Node) | **None** |

**The shape is healthy:** content and domain logic (the bottom two layers, ~4,500 LOC) are pure, framework-free, and carry essentially all the unit tests. React appears only in the glue and presentation layers. This is exactly the right dependency direction and is the single biggest reason the codebase is maintainable despite its size.

---

## 3. Data & Control Flow

- **State management:** one `useReducer(gameReducer, …)` owns all *transient* game state (`GameState` in `types.ts`). It is reset per round; nothing about a live game is persisted. `GameOptions` and a handful of UI prefs live separately in `App.tsx`/components and persist to `localStorage` (keys catalogued in `CLAUDE.md`).
- **The game loop:** `useGameLoop` dispatches a `TICK` every 100 ms while playing; pause is implemented by simply *not dispatching* (so `elapsedMs`-based progress is automatically pause-correct — a deliberate, well-reasoned choice noted in the pitfalls).
- **Determinism:** Adventure mode uses a seeded RNG (`data/seededRng.ts`) for recipe drafts and boss assignment, making runs reproducible and testable. The reducer is pure and returns new state objects throughout.
- **Networking:** the host serializes a `SharedSnapshot` (+ per-player partial views) via `state/snapshot.ts` and pushes it through the relay; phones render from snapshots and send back raw command strings that re-enter `routeChatCommand`. Protocol types are defined once in `src/shared/protocol.ts` and imported by both sides (`server/src/index.ts` imports `../../src/shared/protocol.js`).

---

## 4. Strengths (what's done well)

1. **Pure, well-tested logic core.** 20 test files / 152 tests concentrate on the layers that matter most — reducer mechanics, economy, kitchen-event generators, Adventure garnishes/bosses/draft, seeded RNG, recipes, snapshot, command routing. Logic you can break silently is the logic that's covered.
2. **Disciplined TypeScript.** `strict` everywhere (app + node + server), `noUnusedLocals/Parameters`, **0 `as any`, 0 `TODO/FIXME/HACK`, only 5 `eslint-disable`** across the whole tree. This is unusually clean.
3. **Type-safe client/server boundary.** The relay protocol is a single shared module consumed by both client and server — no hand-synced duplicate interfaces. Rare and valuable for a hobby project.
4. **Reducer purity & immutability.** All state transitions live in one pure function with new-object returns; this is what makes the economy/event tests possible and keeps React re-rendering correct.
5. **Captured institutional knowledge.** `CLAUDE.md`'s "Common Pitfalls" encodes 16 hard-won invariants (heat exemptions, `preparedItemSources` parity, ref-mirroring, tutorial command asymmetry, co-play model). This is real architectural documentation, not filler.
6. **CI discipline.** `ci.yml` gates lint + test + build on every push and PR; `deploy-server.yml` path-filters on `server/**`/`shared/**` and gates the Fly.io deploy on green tests.
7. **Thoughtful mechanic-level design.** `elapsedMs` for pause-correctness; parallel `preparedItemSources` for provenance/bonus attribution; the shared `orderStepsForDisplay` helper; the `useChoiceVote` hook reused across Adventure draft and shop. These show deliberate factoring.

---

## 5. Risks & Tech-Debt Hotspots

Ordered by severity. Severity reflects *blast radius × likelihood of silent breakage*, not effort.

### 5.1 `App.tsx` is an 830-LOC God orchestrator — **HIGH**

`App.tsx` holds **17 `useState`, 16 `useRef`, 25 `useCallback`, 7 `useEffect`, 49 imports, and ~16 named handlers.** It owns: screen routing, all game-state initialization, Twitch/bot/room-host wiring, the unified command router, meta-commands, PvP & Adventure lobby/vote interception, tutorial gating, and reset-all. It has **no tests**.

- **Why it's risky:** every cross-cutting flow touches this file, so changes have high amplification and high cognitive load; the lack of tests on the single most-edited file means regressions surface only at runtime (the recent re-join-on-reconnect and command-routing bugs lived here).
- **The 16 `useRef`s are a symptom.** Many mirror React state into refs (`pvpLobbyRef`, `adventureLobbyRef`, `adventureVoteRef`, `isTutorialRef`, …) to dodge stale closures inside callbacks/intervals. This is documented as intentional (pitfalls #11/#12), but the *volume* of it signals the component is fighting React's model — a reducer/state-machine would remove most of the need.
- **Direction:** extract cohesive responsibilities into hooks/modules — e.g. `useChatRouter` (the `routeChatCommand` + intercepts + meta-commands chain), `useConnections` (Twitch + room host + bot wiring), and a dedicated screen-flow mechanism (§5.4). Aim to shrink `App.tsx` to wiring + render.

### 5.2 `gameReducer` `TICK` is a ~225-line mega-branch — **HIGH**

The `TICK` case spans lines 491–716 of `gameReducer.ts` and is the most complex unit in the codebase: per-slot cook progress + auto-collect, incremental heat, order patience/expiry + penalties, spawn cadence, speed/money modifiers, disabled stations, and a lazily-initialized boss (Recipe Roulette) timer.

- **Why it's risky:** it concentrates the most behavior in the least-isolated place; the economy test covers outcomes but the internal sub-steps aren't independently testable.
- **Direction:** decompose into composed pure sub-reducers — `advanceCooking(state, delta)`, `advanceHeat`, `advanceOrders`, `advanceModifiers`, `advanceBossTimers` — each a small pure function unit-tested in isolation, then `TICK` = sequential composition. No behavior change, large testability/readability gain.

### 5.3 The riskiest layers have zero tests — **HIGH**

All 20 test files are in `data/` and `state/`. **Hooks, components, the controller, and the relay server have no tests.** The relay (`server/src/index.ts`) is networked and *stateful* (in-memory rooms, join/lock, rate-limit buckets, host-gone cleanup) yet untested — exactly the kind of code where edge cases (duplicate joins, host reconnect, room GC) bite in production.

- **Direction:** (a) add **node tests for the relay** room lifecycle (cheap, high value, no DOM); (b) introduce **React Testing Library** (currently not a dependency) for the command-router and a few critical screens; (c) add focused tests for the highest-logic hooks (`useGameLoop`, `useKitchenEvents`, `useAdventureRun`).

### 5.4 Screen routing is stringly-typed and scattered — **MEDIUM**

The `Screen` union has ~16 members; `App.tsx` renders them via a chain of conditionals and performs transitions via `setScreen(...)` calls scattered across handlers. Adventure already runs a 9-screen loop. As flows grow this becomes brittle (illegal transitions are not prevented; the flow isn't visible in one place).

- **Direction:** centralize transitions in a small declarative table or a `screenReducer` (`(screen, event) → screen`). Makes flows testable and illegal transitions unrepresentable.

### 5.5 Documentation drift (onboarding) — **MEDIUM**

Beyond the "no backend" inaccuracy (§1), `CLAUDE.md` is otherwise excellent but now understates the system (relay, controller, shared protocol, deploy). New contributors/agents reading it would not learn Local Play exists from the overview. This review can seed a "Local Play / networking" section; the overview and "No Backend" sections need correcting.

### 5.6 Legacy & duplicate artifacts — **LOW**

- `chats-kitchen.html` (999 lines) is the **original Phaser.js prototype**, pre-React. It is unreferenced by Vite or `src/` — dead weight at the repo root. Recommend archiving or deleting (git history preserves it).
- `src/shared/protocol.js` (11 bytes) appears to be a stale stub alongside the real `protocol.ts`; verify and remove if dead.
- `src/assets/` contains only a `.DS_Store`.

### 5.7 Single bundle / no code-splitting — **LOW**

`npm run build` warns about a >500 KB chunk. Everything (game + Adventure + PvP + Controller + audio) ships in one bundle. For a game this is mostly cosmetic, but the Controller (`/play`, loaded on phones over mobile data) and the Adventure subsystem are natural `lazy()` boundaries if load time ever matters.

---

## 6. Prioritized Recommendations

**P0 — do before the next feature lands in these files**
1. **Add relay-server tests** (`server/src/index.ts`): room create/join/lock/leave, duplicate join, host-gone GC, rate-limit bucket. Pure Node, no DOM, high ROI. (§5.3)
2. **Correct `CLAUDE.md`** "Project Overview" + "No Backend" sections and add a short "Local Play / relay architecture" section. Cheap, prevents future agents reasoning from a false model. (§5.5)

**P1 — plan deliberately, execute incrementally**
3. **Decompose `TICK`** into composed pure sub-reducers + unit tests for each. (§5.2)
4. **Carve `App.tsx`** into `useChatRouter`, `useConnections`, and a screen-flow mechanism; target a substantial LOC/`useRef` reduction. Do it in slices, leaning on the documented pitfalls as a regression checklist. (§5.1)
5. **Introduce React Testing Library** and cover the unified command router + 2–3 critical screens. (§5.3)

**P2 — opportunistic**
6. Centralize screen transitions into a table/`screenReducer`. (§5.4)
7. Delete/archive `chats-kitchen.html`, remove `protocol.js` stub and the stray `.DS_Store`. (§5.6)
8. Lazy-load the Controller and Adventure bundles if/when load time matters. (§5.7)

---

## 7. Quick Reference — Largest / Most-Central Files

| File | LOC | Note |
|------|-----|------|
| `src/App.tsx` | 830 | Orchestrator hub — see §5.1 |
| `src/state/gameReducer.ts` | 786 | Engine; `TICK` ≈ 225 LOC — see §5.2 |
| `src/components/FreePlaySetup.tsx` | 541 | Largest single screen |
| `src/data/recipes.ts` | 505 | Content table (30 dishes) |
| `src/hooks/useAdventureRun.ts` | 465 | Adventure state machine |
| `src/hooks/useKitchenEvents.ts` | 373 | Event lifecycle |
| `src/data/kitchenEventDefs.ts` | 354 | Event defs + generators |
| `src/components/GameOver.tsx` | 349 | Results/leaderboard |
| `src/data/adventureGarnishes.ts` | 334 | Garnish catalog + effects |
| `src/audio/AudioManager.ts` | 296 | Howler wrapper |
| `server/src/index.ts` | 197 | Relay (untested — §5.3) |

**Codebase totals:** ~12,100 LOC of non-test `src/` TypeScript across 43 components, 12 hooks, 12 data modules, 9 state modules; +197 LOC relay server; 20 test files / 152 tests.

---

*This review is descriptive and advisory. None of the recommendations have been implemented on this branch; §6 is intended as input to future spec/plan cycles.*
