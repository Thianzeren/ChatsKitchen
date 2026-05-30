# Adventure S8 Win Celebration — Design

**Status:** Approved · 2026-05-23
**Sub-project:** A (first of 4) — Adventure Mode release polish
**Tracking branch:** TBD (new branch off `main`; current `feat/adventure-tutorial` is unrelated work)

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:writing-plans` is the next step after this spec is approved.

## Problem

Clearing shift 8 in Adventure Mode is currently visually indistinguishable from losing earlier — `AdventureRunEnd` swaps its title from "Run Over" to "Run Won!" and nothing else changes. No celebration, no audio differentiation, no MVP highlight. For a roguelike the run-clear should be the emotional payoff that justifies the whole run.

## Goals

1. Make the moment of clearing shift 8 feel like a *win*, not just another run-end.
2. Differentiate the run-won state both as an animated takeover **and** as a polished underlying screen.
3. Surface the run's MVP so chat feels recognised on stream.
4. Stay within the existing codebase patterns (portal overlays, audio manager, CSS modules) — no new dependencies.

## Non-goals

- Daily seed / leaderboards (deferred — separate sub-project).
- Sharing the run as a downloadable image (Sub-project B).
- New garnishes/bosses/path-cards (Sub-project C).
- Ascension difficulty (Sub-project D).
- Changing the fail-state run-end screen.

## User-facing design (locked)

### Two-stage celebration

When `run.runWon === true`, the user transitioning to `AdventureRunEnd` sees:

1. **Takeover overlay** (~5 seconds, click-to-skip) — parchment scroll in the centre, rising embers, dungeon-stone torch-glow backdrop.
2. **Fade-out** (~400ms opacity transition) reveals the polished run-end screen underneath.

### Overlay layout

```
        ┌─────────────────────────────────┐
        │  ⚔ 8 shifts cleared ⚔            │  ← eyebrow
        │                                  │
        │      ADVENTURE                   │  ← title (2 lines, Lilita One)
        │      SUCCESS                     │
        │                                  │
        │  ───────────  ✦  ───────────    │  ← divider
        │  The kitchen prevails.           │  ← italic flavor
        │  The feast is yours.             │
        │                                  │
        │  Recipe Mastered · 🇰🇷 Korean    │  ← cuisine row
        │                                  │
        └─────────────────────────────────┘
                     ★ MVP · CHEFNICK · 142 PTS    ← chip below scroll
```

- Backdrop: dungeon-stone gradient with two torch-glow corners at bottom-left/right.
- Embers float upward from low edges over ~3s (continuous loop while overlay is mounted).
- Click anywhere → immediate fade-out.
- Auto-fade after 5000ms if no click.

### Underlying screen (`AdventureRunEnd` polish when `runWon`)

| Element | Polish applied |
|---------|----------------|
| Root background | Warm parchment-tinted gradient + soft top glow |
| Above title | `★ ADVENTURE COMPLETED ★` banner (gold gradient, deep-brown border) |
| Title | Existing copy `"Run Won!"` retained; recoloured to `#f0c850` with deep-brown drop shadow |
| First stat card ("Shifts Survived") | Promoted to hero treatment — gold inset shadow, `✦` corner glyphs via `::before`/`::after`, larger value font-size |
| All panel borders | Amber `#6b3a18` (replaces neutral border) |
| Leaderboard row 1 | Star marker (`★` replaces rank number) + amber row tint |
| "Play Again" button | Amber gradient `#d4a155 → #b87333` |

No layout change — same 2-column grid, same data, same stats. Only theme + 1 banner + 1 hero stat treatment.

### Visual tokens

| Token | Value |
|-------|-------|
| Overlay z-index | `270` (above `EventCardOverlay`'s `260`; well above `SmokeOverlay`'s `250`) |
| Parchment fill | `linear-gradient(180deg, #ecd9a5 0%, #d9b56a 100%)` |
| Parchment border | `2px solid #6b3a18` outer + inset `4px solid #c89c4f` inner |
| Parchment glow | `0 0 50px rgba(255, 178, 70, 0.45)` |
| Parchment rolled edges | `::before` / `::after` 8px strip, `linear-gradient(90deg, #6b3a18 0%, #c89c4f 6%, #ecd9a5 50%, #c89c4f 94%, #6b3a18 100%)` |
| Corner flourishes | 4× 8px squares rotated 45°, `#c89c4f` fill + `1px #6b3a18` inset |
| Title font | `Lilita One` (existing), 48–56px, color `#6b3a18`, shadow `1px 1px 0 #c89c4f, 0 0 8px rgba(255,178,70,0.35)` |
| Embers | 4–5px circles, `radial-gradient(circle, #ffd47a 0%, #f0892f 50%, transparent 70%)` + box-shadow warm glow; `@keyframes` rise `translateY(0) → translateY(-60vh)` over ~3s, staggered, looping |
| MVP chip | Pill: `background: rgba(40,28,14,0.7); border: 1px solid #c89c4f; color: #f0c850; font: Lilita One 14px; letter-spacing: 1px` |
| Completed banner (underlying) | `background: linear-gradient(180deg, #d4a155 0%, #b87333 100%); color: #1a140e; border: 1px solid #6b3a18` |
| Hero stat treatment | Inset `0 0 14px rgba(255,178,70,0.25)`, outer `0 0 12px rgba(240,200,80,0.20)` |

### Copy

- Eyebrow: `⚔ 8 shifts cleared ⚔` (literal — `8` is hard-coded; matches `ADVENTURE_TOTAL_SHIFTS`)
- Title: `ADVENTURE` / `SUCCESS` (two lines)
- Divider: `✦`
- Italic sub: `The kitchen prevails. The feast is yours.`
- Cuisine line: `Recipe Mastered · {flag} {cuisineName}`
- MVP chip: `★ MVP · {USERNAME} · {SCORE} PTS`
- Banner (underlying): `★ ADVENTURE COMPLETED ★`
- AdventureRunEnd title (underlying): `Run Won!` (unchanged from today)

## Architecture

Three units of work, each focused:

### 1. New component — `src/components/AdventureSuccessOverlay.tsx` + `.module.css`

Portal-mounted under `document.body`, mirroring the pattern of `SmokeOverlay` and `EventCardOverlay`.

```typescript
interface Props {
  shiftCount: number          // typically ADVENTURE_TOTAL_SHIFTS (8)
  cuisineFlag: string         // e.g. '🇰🇷' (from RECIPE_SETS[cuisineId].flag)
  cuisineName: string         // e.g. 'Korean Kitchen' (from RECIPE_SETS[cuisineId].name)
  mvpName: string | null      // top-score player; null if no participants
  mvpScore: number | null
  onDismiss: () => void
}

export default function AdventureSuccessOverlay(props: Props) {
  useEffect(() => {
    getAudioManager().playSfx('adventure-victory')
    const t = setTimeout(props.onDismiss, 5000)
    return () => clearTimeout(t)
  }, [props.onDismiss])

  return createPortal(
    <div className={styles.backdrop} onClick={props.onDismiss}>
      {/* embers, scroll, mvp chip */}
    </div>,
    document.body,
  )
}
```

The overlay's CSS module owns the parchment scroll, embers, torch-glow backdrop, and all keyframes.

**Fade-out:** the overlay's parent (`AdventureRunEnd`) controls mount/unmount via a `showOverlay` boolean. To get a fade transition without a `setTimeout` race, use CSS-only: the backdrop has `transition: opacity 400ms`, and the component reads a local `isExiting` boolean that flips on dismiss. When `isExiting` is true, render with `opacity: 0`; after the 400ms transition, call `onDismiss` for real. Implementation detail noted in the plan.

### 2. Modified — `src/components/AdventureRunEnd.tsx` + `.module.css`

- Add `useState(showOverlay)` initialised from `run.runWon`.
- Render `<AdventureSuccessOverlay …/>` conditionally with `onDismiss={() => setShowOverlay(false)}`.
- Compute MVP once: `const mvp = leaderboard[0]` (already sorted by `calcPlayerScore`).
- Pass `mvp` (name + `calcPlayerScore(stats)`) into the overlay; pass `null` when `leaderboard.length === 0`.
- Root `<div className={styles.screen}>` becomes `${styles.screen} ${run.runWon ? styles.screenWon : ''}`.
- Add `<div className={styles.completedBanner}>★ ADVENTURE COMPLETED ★</div>` above the title when `run.runWon`.
- First `.stat` div ("Shifts Survived" — already first in the existing JSX) gets an additional `styles.statHero` class when `run.runWon`.
- Leaderboard: index `0` row gets `styles.lbMvp` when `run.runWon`; renders `★` instead of `1` for the rank.
- New CSS rules guarded under `.screenWon` parent selector — no impact on fail/in-progress states.

### 3. Modified — `src/audio/audioAssets.ts`

Add one line to `SFX`:

```typescript
'adventure-victory': { src: ['/audio/sfx/victory.mp3'], volume: 0.7 },
```

The actual `public/audio/sfx/victory.mp3` asset is sourced by the user separately (royalty-free orchestral/jingle stinger, ~2-3s). `AudioManager.playSfx` already no-ops silently on missing assets (`AudioManager.ts:147`: `if (!sound) return`), so the overlay can ship before the asset lands.

## Data flow

```
Shift 8 PASS (gameReducer SHIFT_END)
  └─ useAdventureRun.onShiftEnd()         [existing]
      ├─ run.runWon = true                 [useAdventureRun.ts:257 — no change]
      ├─ persistAdventureBestRun(...)      [existing — wonRuns++]
      ├─ clearSavedAdventureRun()          [existing — clears saved run]
      └─ setScreen('adventurerunend')      [existing]

AdventureRunEnd mounts with run.runWon = true
  ├─ showOverlay = true (initial state)
  ├─ leaderboard computed → mvp extracted
  └─ <AdventureSuccessOverlay …/> renders into portal

AdventureSuccessOverlay mount
  ├─ useEffect: playSfx('adventure-victory') once
  ├─ useEffect: timer = setTimeout(beginExit, 5000)
  ├─ onClick on backdrop → beginExit()
  └─ beginExit: setIsExiting(true) → after 400ms transition → props.onDismiss()

AdventureRunEnd
  └─ onDismiss → setShowOverlay(false) → overlay unmounts
```

## Edge cases

| Case | Behaviour |
|------|-----------|
| Solo run (`accumulatedPlayerStats` has only "You") | MVP chip shows `★ MVP · YOU · {score} PTS` |
| Empty `accumulatedPlayerStats` (somehow no actions taken) | MVP chip hidden (`mvpName === null` branch in JSX) |
| `victory.mp3` 404 / missing | `AudioManager.playSfx` returns silently — overlay renders without sound |
| `prefers-reduced-motion: reduce` | Ember animation, scroll glow pulse, and any other infinite animations disabled via `@media (prefers-reduced-motion: reduce)` block. Static composition still renders. |
| Click during fade-out (between `beginExit` and `onDismiss`) | Backdrop's click handler is detached when `isExiting === true`, so the click is a no-op |
| Tab close mid-overlay → reopen | `chatsKitchen_savedAdventureRun` was already cleared on shift-8 pass; reopened tab lands on `menu`, not `adventurerunend`. Overlay does not replay. Acceptable. |
| React strict-mode double-mount in dev | Timer cleanup in `useEffect` handles it; `playSfx` self-throttles 500ms gap per sound (`AudioManager.ts:151`) so audio doesn't double-fire |
| Multiple participants tied for top score | `leaderboard[0]` wins (deterministic from `.sort` stability — first added user wins ties); acceptable, no special-case |

## Testing (manual — no test framework in repo)

1. **Happy path:** play a run to shift 8 PASS → overlay appears with correct shift count + cuisine + MVP → auto-fades at ~5s → polished run-end visible underneath with banner, hero stat, leaderboard star.
2. **Click-to-skip:** repeat (1) but click overlay at ~1s → overlay fades immediately (~400ms) → polished run-end visible.
3. **Fail-path regression:** lose any shift before 8 → no overlay → run-end uses existing un-polished "Run Over" treatment.
4. **Solo path:** start a solo run (no `!join` from chat/bots) → win → MVP chip reads `★ MVP · YOU · {score} PTS`.
5. **Reduced motion:** enable OS-level reduced motion → win → embers do not animate, scroll does not pulse, but composition still renders.
6. **Audio:** with sound on, first win plays victory cue once; second win in same session plays it again (no permanent throttle).
7. **Audio fallback:** temporarily rename `public/audio/sfx/victory.mp3` → win → no sound plays, no console error, overlay still appears.
8. **Z-index:** during the rare overlap window (none expected, but verify), overlay sits above all `AdventureRunEnd` content including the sticky leaderboard header.

## Open questions / follow-ups

- **`victory.mp3` asset sourcing.** User to source a short (2-3s) royalty-free orchestral/jingle stinger and drop into `public/audio/sfx/`. Tracked separately from this spec; the spec ships the wire-up regardless.
- **Ascension tier wins (Sub-project D).** Future work: when Ascension lands, the overlay may need to accept a `tierName` prop so the eyebrow reads `⚔ Ascension III · 8 shifts cleared ⚔`. Out of scope here; the component should be designed so this is a one-prop addition.

## Files touched

| File | Change |
|------|--------|
| `src/components/AdventureSuccessOverlay.tsx` | **NEW** — ~120 lines |
| `src/components/AdventureSuccessOverlay.module.css` | **NEW** — ~180 lines (parchment, embers, MVP chip, reduced-motion guard) |
| `src/components/AdventureRunEnd.tsx` | Add overlay mount + MVP computation + `runWon` className branching + completed banner JSX |
| `src/components/AdventureRunEnd.module.css` | Add `.screenWon` parent block + `.completedBanner`, `.statHero`, `.lbMvp` rules |
| `src/audio/audioAssets.ts` | Add `'adventure-victory'` SFX entry |
| `public/audio/sfx/victory.mp3` | **NEW asset** — sourced separately by user |

## References

- Existing portal-overlay pattern: `src/components/SmokeOverlay.tsx`, `src/components/EventCardOverlay.tsx`
- Audio integration pattern: `src/components/AdventureCuisinePick.tsx:36`, `src/components/AdventurePathPick.tsx:28`
- `AudioManager.playSfx` graceful-missing-asset behaviour: `src/audio/AudioManager.ts:147`
- `run.runWon` set-point: `src/hooks/useAdventureRun.ts:257`
- `clearSavedAdventureRun()` on run end: `src/hooks/useAdventureRun.ts`
- Existing `AdventureRunEnd` structure: `src/components/AdventureRunEnd.tsx`
- `calcPlayerScore` formula: `src/state/types.ts`
- `ADVENTURE_TOTAL_SHIFTS = 8`: `src/data/adventureMode.ts`
