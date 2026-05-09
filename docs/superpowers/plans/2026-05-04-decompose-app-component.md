# Decompose App Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break `App.tsx` (1,068 lines, god component) into focused units with clear responsibilities.

**Architecture:** Extract the gameplay render block into `<GameplayScreen>`, then lift each independent state machine (tutorial, PvP lobby, adventure run, game session) into dedicated hooks. Each step is independently verifiable — the app must build and render correctly after every task.

**Tech Stack:** React 18, TypeScript strict mode, Vite 5. No new dependencies. Build verification: `npm run build`. Visual verification: `npm run dev`.

---

## File Map

| File | Change | Responsibility |
|------|--------|---------------|
| `src/components/GameplayScreen.tsx` | **Create** | Renders the playing screen: Kitchen, OrdersBar, ChatPanel, BottomBar, overlays, PauseModal, TutorialOverlay |
| `src/hooks/useTutorialState.ts` | **Create** | All tutorial state: step, event, overlay open/close, prompt, destination |
| `src/hooks/usePvpLobby.ts` | **Create** | PvP lobby state, lobby commands, `!red`/`!blue`/`!join`/`!leave` handlers |
| `src/hooks/useAdventureRun.ts` | **Create** | Adventure run state, best run, shift progression callbacks |
| `src/hooks/useGameSession.ts` | **Create** | `startFreePlay`, `startFromPlayset`, `activeEventOptions`, `finalStats`, high score, history |
| `src/App.tsx` | **Modify** | Shrinks after each extraction; becomes a thin coordinator |

---

## Task 1: Extract `<GameplayScreen>` component

**Files:**
- Create: `src/components/GameplayScreen.tsx`
- Modify: `src/App.tsx` (replace inline playing-screen JSX with `<GameplayScreen .../>`)

The `else` branch at `App.tsx:980–1039` renders 9 elements with 15+ props sourced from App state. Move it verbatim into a new component; pass everything as props.

- [ ] **Step 1: Identify the exact prop surface**

The new component needs these props (read App.tsx:980–1039):
```ts
interface GameplayScreenProps {
  state: GameState
  paused: boolean
  chatOpen: boolean
  botsEnabled: boolean
  audioSettings: AudioSettings
  activeEvent: KitchenEvent | null
  tutorialEvent: KitchenEvent | null
  tutorialStep: number | null
  tutorialHighlight: string | null
  tutorialEventResolved: boolean
  isTutorial: boolean
  adventureRun: AdventureRun | null
  twitchStatus: string
  twitchChannel: string | null
  onChatSend: (text: string) => void
  onChatOpen: (open: boolean) => void
  onPause: (paused: boolean) => void
  onAudioChange: (s: AudioSettings) => void
  onExit: () => void
  onPlaysetPicker: (() => void) | undefined
  onRecipeSelect: (() => void) | undefined
  onTutorialNext: () => void
  onTutorialBack: () => void
  onTutorialSkip: () => void
  onTutorialRepeat: () => void
}
```

- [ ] **Step 2: Create `src/components/GameplayScreen.tsx`**

Copy the `else` block verbatim (App.tsx:980–1039), then replace all references to App-scoped variables with the props above. Import types from `../state/types` and `../audio/useGameAudio` (for AudioSettings). Import all child components directly.

```tsx
import { TUTORIAL_STEPS } from '../data/tutorialData'

const TUTORIAL_EVENT_INTRO_STEP = TUTORIAL_STEPS.findIndex(s => s.title === "🎲 Kitchen Events")
const TUTORIAL_EVENT_STEP       = TUTORIAL_STEPS.findIndex(s => s.title === "🧩 Mystery Recipe")
```

These two constants are needed by `TutorialOverlay`'s `shiftLeft` prop. Move them here (remove from App.tsx).

- [ ] **Step 3: Replace the `else` block in App.tsx**

Delete lines 980–1039 (`else { content = ( ... ) }`) and replace with:

```tsx
} else {
  content = (
    <GameplayScreen
      state={state}
      paused={paused}
      chatOpen={chatOpen}
      botsEnabled={botsEnabled}
      audioSettings={audioSettings}
      activeEvent={tutorialEvent ?? activeEvent}
      tutorialEvent={tutorialEvent}
      tutorialStep={tutorialStep}
      tutorialHighlight={tutorialHighlight}
      tutorialEventResolved={tutorialEventResolved}
      isTutorial={isTutorial}
      adventureRun={adventureRun}
      twitchStatus={twitchChat.status}
      twitchChannel={twitchChannel}
      onChatSend={handleChatSend}
      onChatOpen={setChatOpen}
      onPause={setPaused}
      onAudioChange={handleAudioChange}
      onExit={() => { setPaused(false); setTutorialStep(null); setScreen('menu') }}
      onPlaysetPicker={!adventureRun && !isTutorial ? () => { setPaused(false); setScreen('playsetpicker') } : undefined}
      onRecipeSelect={!adventureRun && !isTutorial ? () => { setPaused(false); setScreen('freeplaysetup') } : undefined}
      onTutorialNext={handleTutorialNext}
      onTutorialBack={handleTutorialBack}
      onTutorialSkip={handleTutorialComplete}
      onTutorialRepeat={handleTutorialRepeat}
    />
  )
}
```

- [ ] **Step 4: Build and verify**

```bash
npm run build
```
Expected: no TypeScript errors. `App.tsx` should now be ~120 lines shorter.

- [ ] **Step 5: Visual smoke test**

```bash
npm run dev
```
Open the game, start a round, verify: kitchen renders, orders show, chat opens, pause modal opens, tutorial runs end-to-end (if accessible), smoke overlay/event card appear during kitchen events.

- [ ] **Step 6: Commit**

```bash
git add src/components/GameplayScreen.tsx src/App.tsx
git commit -m "refactor: extract GameplayScreen component from App"
```

---

## Task 2: Extract `useTutorialState` hook

**Files:**
- Create: `src/hooks/useTutorialState.ts`
- Modify: `src/App.tsx`

Lifts 10 tutorial state variables + `startTutorial`, `handleTutorialNext`, `handleTutorialBack`, `handleTutorialComplete`, `handleTutorialRepeat`, `handleTutorialEventCommand`, `handleMenuTutorial`, `handleTutorialStartCooking` out of App.

- [ ] **Step 1: Create `src/hooks/useTutorialState.ts`**

The hook takes `dispatch`, `setScreen`, `setActiveEventOptions`, `activeGameOptionsRef`, `continueFromTutorial` as parameters and returns the full tutorial surface.

```ts
export function useTutorialState(
  dispatch: React.Dispatch<GameAction>,
  setScreen: (s: Screen) => void,
  setActiveEventOptions: (opts: ActiveEventOptions | null) => void,
  activeGameOptionsRef: React.MutableRefObject<GameOptions | null>,
  continueFromTutorial: (dest: TutorialDestination) => void,
) { ... }
```

Move the following from App.tsx into the hook body:
- All `tutorialStep`, `tutorialResetKey`, `tutorialEvent`, `tutorialEventResolved`, `tutorialOpen`, `showTutorialPrompt`, `tutorialDestination`, `hideTutorialPrompt`, `isTutorial`, `tutorialStepRef` declarations
- `startTutorial`, `handleTutorialNext`, `handleTutorialBack`, `handleTutorialComplete`, `handleTutorialRepeat`, `handleTutorialEventCommand`, `handleMenuTutorial`, `handleTutorialStartCooking`
- `tutorialGameOver`

Return all state values and callbacks as a single object.

- [ ] **Step 2: Wire into App.tsx**

Replace all extracted declarations with:
```ts
const tutorial = useTutorialState(dispatch, setScreen, setActiveEventOptions, activeGameOptionsRef, continueFromTutorial)
const { tutorialStep, tutorialEvent, tutorialEventResolved, isTutorial, tutorialStepRef, ... } = tutorial
```

- [ ] **Step 3: Build and verify**

```bash
npm run build
```
Expected: no errors. App.tsx shrinks by ~80 lines.

- [ ] **Step 4: Smoke test**

Start the app. Run through the tutorial flow from the main menu. Verify step progression, heat/extinguish steps, mystery recipe event step, skip, repeat.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTutorialState.ts src/App.tsx
git commit -m "refactor: extract useTutorialState hook from App"
```

---

## Task 3: Extract `usePvpLobby` hook

**Files:**
- Create: `src/hooks/usePvpLobby.ts`
- Modify: `src/App.tsx`

Lifts `pvpLobby`, `pvpLobbyRef`, `startPvp`, `startPvpGame`, `handleLobbyMetaCommand`, and the `!red`/`!blue`/`!join`/`!leave` message handlers.

- [ ] **Step 1: Create `src/hooks/usePvpLobby.ts`**

```ts
export function usePvpLobby(
  setScreen: (s: Screen) => void,
  showToast: (msg: string) => void,
) {
  const [pvpLobby, setPvpLobby] = useState<{red: string[], blue: string[]} | null>(null)
  const pvpLobbyRef = useRef(pvpLobby)
  pvpLobbyRef.current = pvpLobby
  // startPvp, startPvpGame, handleLobbyMetaCommand, handleLobbyJoin (for chat messages)
  return { pvpLobby, setPvpLobby, pvpLobbyRef, startPvp, startPvpGame, handleLobbyMetaCommand, handleLobbyJoin }
}
```

`handleLobbyJoin(user, cmd)` handles the `!red`/`!blue`/`!join`/`!leave` parsing that currently lives in both `handleTwitchMessage` and `handleChatSend`.

- [ ] **Step 2: Wire into App.tsx**

Replace all extracted PvP declarations and handlers. In `handleTwitchMessage` and `handleChatSend`, replace the inline lobby intercept with `lobby.handleLobbyJoin(user, cmd)`.

- [ ] **Step 3: Build and verify**

```bash
npm run build
```

- [ ] **Step 4: Smoke test**

Start a PvP game. Verify: `!red`, `!blue`, `!join`, `!leave` work from chat. Verify drag-and-drop roster still works. Verify `!balance` and `!move` mod commands show toasts.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePvpLobby.ts src/App.tsx
git commit -m "refactor: extract usePvpLobby hook from App"
```

---

## Task 4: Extract `useAdventureRun` hook

**Files:**
- Create: `src/hooks/useAdventureRun.ts`
- Modify: `src/App.tsx`

Lifts `adventureRun`, `adventureRunRef`, `adventureBestRun`, `isNewBestAdventureRun`, `startAdventure`, `handleShiftPassedNext`.

- [ ] **Step 1: Create `src/hooks/useAdventureRun.ts`**

```ts
export function useAdventureRun(
  dispatch: React.Dispatch<GameAction>,
  setScreen: (s: Screen) => void,
  setActiveEventOptions: (opts: ActiveEventOptions | null) => void,
  activeGameOptionsRef: React.MutableRefObject<GameOptions | null>,
) { ... }
```

Returns `{ adventureRun, adventureRunRef, setAdventureRun, adventureBestRun, isNewBestAdventureRun, setIsNewBestAdventureRun, startAdventure, handleShiftPassedNext }`.

- [ ] **Step 2: Wire into App.tsx**

- [ ] **Step 3: Build and verify**

```bash
npm run build
```

- [ ] **Step 4: Smoke test**

Start Adventure Mode. Play through one shift, verify shift-passed screen, verify shift progression. Let a shift fail, verify adventure-run-end screen with best-run logic.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAdventureRun.ts src/App.tsx
git commit -m "refactor: extract useAdventureRun hook from App"
```

---

## Task 5: Extract `useGameSession` hook

**Files:**
- Create: `src/hooks/useGameSession.ts`
- Modify: `src/App.tsx`

Lifts `startFreePlay`, `startFromPlayset`, `activeEventOptions`, `activeGameOptionsRef`, `starThresholds`, `finalStats`, `freePlayHighScore`, `isNewHighScore`, `freePlayHistory`, `handleGameOver`, `handleShiftEndDone`.

- [ ] **Step 1: Create `src/hooks/useGameSession.ts`**

```ts
export function useGameSession(
  dispatch: React.Dispatch<GameAction>,
  setScreen: (s: Screen) => void,
  gameOptionsRef: React.MutableRefObject<GameOptions>,
  pvpLobbyRef: React.MutableRefObject<{red: string[], blue: string[]} | null>,
  adventureRunRef: React.MutableRefObject<AdventureRun | null>,
  setAdventureRun: (fn: (prev: AdventureRun | null) => AdventureRun | null) => void,
  finalStatsFromAdventure: Record<string, unknown>,
) { ... }
```

- [ ] **Step 2: Wire into App.tsx**

- [ ] **Step 3: Build and verify**

```bash
npm run build
```

- [ ] **Step 4: Smoke test**

Complete a full Free Play round. Verify: game-over screen shows correct stats, high score updates, history updates. Complete a playset round. Verify star thresholds appear on game-over.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useGameSession.ts src/App.tsx
git commit -m "refactor: extract useGameSession hook from App"
```

---

## Task 6: Extract `useTwitchMessageRouter` hook

**Files:**
- Create: `src/hooks/useTwitchMessageRouter.ts`
- Modify: `src/App.tsx`

Lifts the `handleTwitchMessage` and `handleChatSend` routing logic into a hook so App just receives stable callbacks.

- [ ] **Step 1: Create `src/hooks/useTwitchMessageRouter.ts`**

```ts
export function useTwitchMessageRouter(deps: {
  dispatch: React.Dispatch<GameAction>
  screenRef: React.MutableRefObject<Screen>
  isTutorialRef: React.MutableRefObject<boolean>
  handleLobbyJoin: (user: string, cmd: string, isMod: boolean) => void
  handleEventCommand: (user: string, text: string) => void
  handleTutorialEventCommand: (text: string) => void
  handleMetaCommand: (user: string, text: string, isMod: boolean) => void
  handleCommand: (user: string, text: string) => void
  allowShortform: boolean
}) {
  const handleTwitchMessage = useCallback(...)
  const handleChatSend = useCallback(...)
  return { handleTwitchMessage, handleChatSend }
}
```

- [ ] **Step 2: Wire into App.tsx**

- [ ] **Step 3: Build and verify**

```bash
npm run build
```

- [ ] **Step 4: Smoke test**

Send chat messages in all screens. Verify commands route correctly in: menu (no-op), pvplobby (`!red`/`!blue`/`!join`), playing (game commands), tutorial (blocked game commands).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTwitchMessageRouter.ts src/App.tsx
git commit -m "refactor: extract useTwitchMessageRouter hook from App"
```

---

## Final verification

```bash
npm run build && npm run lint
```

Check `App.tsx` line count — target under 400 lines. All 6 extracted files should each be under 200 lines.
