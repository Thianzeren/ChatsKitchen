# Adventure S8 Win Celebration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the two-stage Adventure S8 win celebration — parchment-scroll takeover overlay (5s auto-fade or click-to-skip) + polished `AdventureRunEnd` underneath when `run.runWon`.

**Architecture:** New portal-mounted `AdventureSuccessOverlay` component mirrors the `SmokeOverlay` / `EventCardOverlay` pattern (z-index 270). `AdventureRunEnd` gains a `screenWon` className branch that recolors existing elements; no layout changes. One new `adventure-victory` SFX entry; `AudioManager.playSfx` already no-ops on missing assets so the wire-up ships before the audio file lands.

**Tech Stack:** React 18 + TypeScript (strict), CSS Modules, Vite 5, existing `AudioManager` + `createPortal`. No new dependencies.

**Branch:** `feat/adventure-s8-win-celebration` (off `origin/release/adventure-roguelike`). Spec at `docs/superpowers/specs/2026-05-23-adventure-s8-win-celebration-design.md`.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/audio/audioAssets.ts` | Modify | Register `'adventure-victory'` SFX |
| `src/data/adventureMode.ts` | Modify | Export new `getCuisineRecipeSet(cuisine)` helper |
| `src/components/AdventureSuccessOverlay.tsx` | **Create** | Portal-mounted celebration overlay |
| `src/components/AdventureSuccessOverlay.module.css` | **Create** | Parchment scroll, embers, MVP chip, reduced-motion guard |
| `src/components/AdventureRunEnd.tsx` | Modify | Mount overlay when `runWon`, apply `screenWon` polish |
| `src/components/AdventureRunEnd.module.css` | Modify | Add `.screenWon`, `.completedBanner`, `.statHero`, `.lbMvp` rules |
| `public/audio/sfx/victory.mp3` | (User adds later) | Asset sourced separately; not part of this PR |

---

## Task 1: Wire up audio asset + cuisine helper

**Files:**
- Modify: `src/audio/audioAssets.ts:33`
- Modify: `src/data/adventureMode.ts` (add a new exported helper)

### Step 1: Add the `adventure-victory` SFX entry

- [ ] **Step 1.1:** Open `src/audio/audioAssets.ts`. Locate the `SFX` object (lines 20–33). After the `'round-over'` line and before the closing `}`, add a new entry. Final state of the `SFX` block:

```typescript
export const SFX: Record<string, SfxDef> = {
  'cook-start':        { src: ['/audio/sfx/cook-start.mp3'],        volume: 0.6 },
  'serve-success':     { src: ['/audio/sfx/serve-success.mp3'],     volume: 0.7 },
  'fire-alarm':        { src: ['/audio/sfx/fire-alarm.mp3'],        volume: 0.6, loop: true },
  'fire-extinguished': { src: ['/audio/sfx/fire-extinguished.mp3'], volume: 0.6 },
  'cool':              { src: ['/audio/sfx/fire-extinguished.mp3'], volume: 0.4 },
  'order-spawn':       { src: ['/audio/sfx/order-spawn.mp3'],       volume: 0.5 },
  'order-expired':     { src: ['/audio/sfx/order-expired.mp3'],     volume: 0.6 },
  'error-buzzer':      { src: ['/audio/sfx/error-buzzer.mp3'],      volume: 0.4 },
  'plating':           { src: ['/audio/sfx/plating.mp3'],           volume: 0.5 },
  'take-item':         { src: ['/audio/sfx/take-item.mp3'],         volume: 0.5 },
  'countdown-beep':    { src: ['/audio/sfx/countdown-beep.mp3'],    volume: 0.6 },
  'round-over':        { src: ['/audio/sfx/round-over.mp3'],        volume: 0.3 },
  'adventure-victory': { src: ['/audio/sfx/victory.mp3'],           volume: 0.7 },
}
```

### Step 2: Export a cuisine→RecipeSet lookup helper

- [ ] **Step 2.1:** Open `src/data/adventureMode.ts`. The file already has a private `CUISINE_TO_RECIPE_SET_ID` map (line 56) and exports `getCuisineRecipeKeys`. Add a new exported helper that returns the full `RecipeSet` (needed for cuisine name + flag in the overlay). Place it directly after `getCuisineRecipeKeys` (around line 69). Insert:

```typescript
import { RECIPES, RECIPE_SETS } from '../data/recipes'
import { PlayerStats, CuisineId, AdventureRun, RecipeSet } from '../state/types'
// ... (existing imports — only change if RecipeSet is not already imported)

export function getCuisineRecipeSet(cuisine: CuisineId): RecipeSet | undefined {
  const setId = CUISINE_TO_RECIPE_SET_ID[cuisine]
  return RECIPE_SETS.find(s => s.id === setId)
}
```

  Note: `RecipeSet` is already exported from `src/state/types.ts:150`. Verify the import line at the top of `adventureMode.ts` and add `RecipeSet` to it if missing. Existing line is:
  ```typescript
  import { PlayerStats, CuisineId, AdventureRun } from '../state/types'
  ```
  Change to:
  ```typescript
  import { PlayerStats, CuisineId, AdventureRun, RecipeSet } from '../state/types'
  ```

### Step 3: Build check

- [ ] **Step 3.1:** Run `npm run build`. Expected: build succeeds. If it fails, fix the import / syntax error before continuing.

### Step 4: Commit

- [ ] **Step 4.1:**

```bash
git add src/audio/audioAssets.ts src/data/adventureMode.ts
git commit -m "feat(adventure): register victory SFX + cuisine recipe-set helper

Adds 'adventure-victory' to the SFX registry (asset sourced separately;
playSfx no-ops silently while the .mp3 is absent). Exports a new
getCuisineRecipeSet(cuisine) helper for use by the upcoming
AdventureSuccessOverlay.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Create `AdventureSuccessOverlay` component

**Files:**
- Create: `src/components/AdventureSuccessOverlay.tsx`
- Create: `src/components/AdventureSuccessOverlay.module.css`

### Step 1: Write the component

- [ ] **Step 1.1:** Create `src/components/AdventureSuccessOverlay.tsx` with the complete contents below:

```typescript
import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { getAudioManager } from '../audio/AudioManager'
import styles from './AdventureSuccessOverlay.module.css'

interface Props {
  shiftCount: number
  cuisineFlag: string
  cuisineName: string
  mvpName: string | null
  mvpScore: number | null
  onDismiss: () => void
}

const AUTO_DISMISS_MS = 5000
const FADE_OUT_MS = 400

export default function AdventureSuccessOverlay({
  shiftCount,
  cuisineFlag,
  cuisineName,
  mvpName,
  mvpScore,
  onDismiss,
}: Props) {
  const [isExiting, setIsExiting] = useState(false)
  const dismissedRef = useRef(false)

  // Single dismissal path — guards against the 5s timer racing a user click.
  const beginExit = () => {
    if (dismissedRef.current) return
    dismissedRef.current = true
    setIsExiting(true)
    window.setTimeout(onDismiss, FADE_OUT_MS)
  }

  useEffect(() => {
    getAudioManager().playSfx('adventure-victory')
    const t = window.setTimeout(beginExit, AUTO_DISMISS_MS)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 14 staggered embers — positions chosen so they sit clear of the centred scroll.
  const embers = [
    { left: 5,  top: 20, lg: false }, { left: 9,  top: 48, lg: true },
    { left: 14, top: 72, lg: false }, { left: 18, top: 30, lg: false },
    { left: 24, top: 60, lg: true  }, { left: 6,  top: 88, lg: false },
    { left: 78, top: 18, lg: false }, { left: 84, top: 45, lg: true  },
    { left: 88, top: 72, lg: false }, { left: 93, top: 30, lg: false },
    { left: 96, top: 58, lg: true  }, { left: 80, top: 88, lg: false },
    { left: 48, top: 6,  lg: false }, { left: 52, top: 94, lg: false },
  ]

  return createPortal(
    <div
      className={`${styles.backdrop} ${isExiting ? styles.exiting : ''}`}
      onClick={isExiting ? undefined : beginExit}
      role="dialog"
      aria-label="Adventure success"
    >
      <div className={styles.stone} aria-hidden="true" />
      <div className={styles.embers} aria-hidden="true">
        {embers.map((e, i) => (
          <span
            key={i}
            className={`${styles.ember} ${e.lg ? styles.emberLg : ''}`}
            style={{
              left: `${e.left}%`,
              top: `${e.top}%`,
              animationDelay: `${(i * 0.18).toFixed(2)}s`,
            }}
          />
        ))}
      </div>

      <div className={styles.scrollWrap}>
        <div className={styles.scroll}>
          <span className={`${styles.flourish} ${styles.flourishTL}`} />
          <span className={`${styles.flourish} ${styles.flourishTR}`} />
          <span className={`${styles.flourish} ${styles.flourishBL}`} />
          <span className={`${styles.flourish} ${styles.flourishBR}`} />

          <div className={styles.eyebrow}>⚔ {shiftCount} shifts cleared ⚔</div>
          <div className={styles.title}>ADVENTURE<br />SUCCESS</div>
          <div className={styles.divider}>✦</div>
          <div className={styles.sub}>The kitchen prevails. The feast is yours.</div>

          <div className={styles.cuisineRow}>
            <span className={styles.cuisineLabel}>Recipe Mastered ·</span>
            <span className={styles.cuisineFlag}>{cuisineFlag}</span>
            <span className={styles.cuisineName}>{cuisineName}</span>
          </div>
        </div>

        {mvpName && mvpScore !== null && (
          <div className={styles.mvpChip}>
            ★ MVP · {mvpName.toUpperCase()} · {mvpScore} PTS
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
```

### Step 2: Write the CSS module

- [ ] **Step 2.1:** Create `src/components/AdventureSuccessOverlay.module.css` with the complete contents below:

```css
/* ── Backdrop & layering ────────────────────────────────────────────────── */

.backdrop {
  position: fixed;
  inset: 0;
  z-index: 270;
  cursor: pointer;
  opacity: 1;
  transition: opacity 400ms ease;
  background:
    radial-gradient(ellipse at 50% 38%, rgba(255, 178, 70, 0.18) 0%, transparent 55%),
    radial-gradient(ellipse at 8% 100%, rgba(255, 140, 50, 0.25) 0%, transparent 40%),
    radial-gradient(ellipse at 92% 100%, rgba(255, 140, 50, 0.25) 0%, transparent 40%),
    radial-gradient(ellipse at 50% 0%, rgba(0, 0, 0, 0.55), transparent 50%),
    linear-gradient(180deg, #1a140e 0%, #0c0805 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  overflow: hidden;
}

.exiting {
  opacity: 0;
  pointer-events: none;
}

.stone {
  position: absolute;
  inset: 0;
  opacity: 0.18;
  pointer-events: none;
  background-image:
    radial-gradient(circle at 20% 30%, rgba(255,255,255,0.06) 1px, transparent 2px),
    radial-gradient(circle at 70% 60%, rgba(255,255,255,0.04) 1px, transparent 2px),
    radial-gradient(circle at 40% 80%, rgba(0,0,0,0.4) 1px, transparent 2px),
    radial-gradient(circle at 80% 20%, rgba(0,0,0,0.4) 1px, transparent 2px);
  background-size: 24px 24px, 32px 32px, 28px 28px, 36px 36px;
}

/* ── Embers ─────────────────────────────────────────────────────────────── */

.embers {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.ember {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: radial-gradient(circle, #ffd47a 0%, #f0892f 50%, transparent 70%);
  box-shadow: 0 0 8px #f0a040, 0 0 14px rgba(255, 170, 60, 0.6);
  animation: emberRise 3.2s ease-in infinite;
  opacity: 0.85;
}

.emberLg {
  width: 5px;
  height: 5px;
  box-shadow: 0 0 12px #ffb060, 0 0 22px rgba(255, 170, 60, 0.7);
}

@keyframes emberRise {
  0%   { transform: translateY(0)      scale(1);   opacity: 0;   }
  20%  { opacity: 0.85; }
  80%  { opacity: 0.6;  }
  100% { transform: translateY(-60vh)  scale(0.4); opacity: 0;   }
}

/* ── Parchment scroll ───────────────────────────────────────────────────── */

.scrollWrap {
  position: relative;
  text-align: center;
  padding: 0 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.scroll {
  position: relative;
  padding: 28px 56px 26px;
  background: linear-gradient(180deg, #ecd9a5 0%, #d9b56a 100%);
  color: #3a230e;
  border: 2px solid #6b3a18;
  border-radius: 8px;
  box-shadow:
    inset 0 0 36px rgba(120, 70, 20, 0.30),
    inset 0 0 0 5px #c89c4f,
    0 0 60px rgba(255, 178, 70, 0.45),
    0 10px 30px rgba(0, 0, 0, 0.6);
  min-width: 380px;
  animation: scrollGlow 2.4s ease-in-out infinite alternate;
}

@keyframes scrollGlow {
  from { box-shadow: inset 0 0 36px rgba(120, 70, 20, 0.30),
                     inset 0 0 0 5px #c89c4f,
                     0 0 50px rgba(255, 178, 70, 0.35),
                     0 10px 30px rgba(0, 0, 0, 0.6); }
  to   { box-shadow: inset 0 0 36px rgba(120, 70, 20, 0.30),
                     inset 0 0 0 5px #c89c4f,
                     0 0 80px rgba(255, 178, 70, 0.65),
                     0 10px 30px rgba(0, 0, 0, 0.6); }
}

/* Rolled top & bottom edges */
.scroll::before,
.scroll::after {
  content: '';
  position: absolute;
  left: -10px;
  right: -10px;
  height: 10px;
  background: linear-gradient(90deg, #6b3a18 0%, #c89c4f 6%, #ecd9a5 50%, #c89c4f 94%, #6b3a18 100%);
  border: 1px solid #6b3a18;
  border-radius: 4px;
}
.scroll::before { top: -12px; }
.scroll::after  { bottom: -12px; }

/* ── Corner flourishes ──────────────────────────────────────────────────── */

.flourish {
  position: absolute;
  width: 9px;
  height: 9px;
  background: #c89c4f;
  transform: rotate(45deg);
  box-shadow: inset 0 0 0 1px #6b3a18;
}
.flourishTL { top: 8px;    left: 10px;  }
.flourishTR { top: 8px;    right: 10px; }
.flourishBL { bottom: 8px; left: 10px;  }
.flourishBR { bottom: 8px; right: 10px; }

/* ── Scroll typography ──────────────────────────────────────────────────── */

.eyebrow {
  font-family: 'Fredoka', sans-serif;
  font-size: 13px;
  letter-spacing: 5px;
  color: #6b3a18;
  font-weight: 700;
  text-transform: uppercase;
  margin-bottom: 8px;
  opacity: 0.85;
}

.title {
  font-family: 'Lilita One', cursive;
  font-size: 56px;
  color: #6b3a18;
  text-shadow: 1px 1px 0 #c89c4f, 0 0 12px rgba(255, 178, 70, 0.35);
  letter-spacing: 5px;
  line-height: 0.95;
  margin: 0;
  font-weight: 800;
}

.divider {
  margin: 14px auto 8px;
  width: 80%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #6b3a18;
  opacity: 0.55;
  font-size: 16px;
}
.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: currentColor;
}

.sub {
  font-family: 'Fredoka', sans-serif;
  font-style: italic;
  font-size: 16px;
  color: #5a3818;
  opacity: 0.88;
  margin-top: 4px;
}

.cuisineRow {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.cuisineLabel {
  font-family: 'Fredoka', sans-serif;
  font-size: 12px;
  letter-spacing: 2px;
  color: #6b3a18;
  opacity: 0.75;
  text-transform: uppercase;
}

.cuisineFlag {
  font-size: 28px;
  line-height: 1;
}

.cuisineName {
  font-family: 'Lilita One', cursive;
  font-size: 20px;
  color: #6b3a18;
  letter-spacing: 1.5px;
  font-weight: 800;
}

/* ── MVP chip ───────────────────────────────────────────────────────────── */

.mvpChip {
  font-family: 'Lilita One', cursive;
  font-size: 14px;
  letter-spacing: 1.5px;
  color: #f0c850;
  background: rgba(40, 28, 14, 0.7);
  border: 1px solid #c89c4f;
  border-radius: 999px;
  padding: 6px 16px;
  box-shadow: 0 0 14px rgba(255, 178, 70, 0.20);
}

/* ── Reduced motion ─────────────────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .ember { animation: none; opacity: 0; }
  .scroll { animation: none; }
  .backdrop { transition-duration: 0ms; }
}
```

### Step 3: Build check

- [ ] **Step 3.1:** Run `npm run build`. Expected: build succeeds.

### Step 4: Lint check

- [ ] **Step 4.1:** Run `npm run lint`. Expected: no new warnings or errors introduced by the new files.

### Step 5: Commit

- [ ] **Step 5.1:**

```bash
git add src/components/AdventureSuccessOverlay.tsx src/components/AdventureSuccessOverlay.module.css
git commit -m "feat(adventure): AdventureSuccessOverlay portal component

Parchment-scroll takeover with rising embers and dungeon-stone backdrop.
Auto-dismisses after 5s; click anywhere fades early. Mounts under
document.body via createPortal (mirrors SmokeOverlay / EventCardOverlay
pattern, z-index 270). Honours prefers-reduced-motion.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Integrate overlay + polish `AdventureRunEnd`

**Files:**
- Modify: `src/components/AdventureRunEnd.tsx`
- Modify: `src/components/AdventureRunEnd.module.css`

### Step 1: Update `AdventureRunEnd.tsx`

- [ ] **Step 1.1:** Open `src/components/AdventureRunEnd.tsx`. Replace the entire file with the contents below. (Changes: import overlay + helper + useState; compute `mvpName` / `mvpScore` / `cuisineSet`; add `showOverlay` state seeded from `run.runWon`; add `screenWon` class branching; add `completedBanner` JSX; add `statHero` on the first stat; add `lbMvp` on row 0; render overlay last.)

```typescript
import { useState } from 'react'
import { AdventureRun, AdventureBestRun, calcPlayerScore } from '../state/types'
import { RECIPES, NAME_COLORS, hashStr } from '../data/recipes'
import { GARNISHES } from '../data/adventureGarnishes'
import { BOSSES, BossId } from '../data/adventureBosses'
import { getCuisineRecipeSet, ADVENTURE_TOTAL_SHIFTS } from '../data/adventureMode'
import FoodIcon from './FoodIcon'
import AdventureSuccessOverlay from './AdventureSuccessOverlay'
import styles from './AdventureRunEnd.module.css'

interface Props {
  run: AdventureRun
  bestRun: AdventureBestRun | null
  isNewBestRun: boolean
  onPlayAgain: () => void
  onMenu: () => void
}

export default function AdventureRunEnd({ run, bestRun, isNewBestRun, onPlayAgain, onMenu }: Props) {
  const passedShifts = run.shiftResults.filter(r => r.passed).length
  const totalMoney   = run.shiftResults.reduce((sum, r) => sum + r.moneyEarned, 0)
  const totalServed  = run.shiftResults.reduce((sum, r) => sum + r.served, 0)
  const totalLost    = run.shiftResults.reduce((sum, r) => sum + r.lost, 0)
  const totalBonuses = run.shiftResults.reduce((sum, r) => sum + (r.cashBonusEarned ?? 0), 0)

  const ownedGarnishes = run.ownedGarnishes
    .map(p => GARNISHES[p.garnishId])
    .filter((g): g is NonNullable<typeof g> => Boolean(g))

  const leaderboard = Object.entries(run.accumulatedPlayerStats)
    .sort(([, a], [, b]) => calcPlayerScore(b) - calcPlayerScore(a))

  const isWon = run.runWon === true
  const [showOverlay, setShowOverlay] = useState(isWon)

  const mvpEntry = leaderboard[0]
  const mvpName  = mvpEntry ? mvpEntry[0] : null
  const mvpScore = mvpEntry ? calcPlayerScore(mvpEntry[1]) : null

  const cuisineSet  = getCuisineRecipeSet(run.startCuisine)
  const cuisineFlag = cuisineSet?.flag ?? ''
  const cuisineName = cuisineSet?.name ?? ''

  return (
    <div className={`${styles.screen} ${isWon ? styles.screenWon : ''}`}>
      {/* ── LEFT ── */}
      <div className={styles.leftCol}>
        {isWon && (
          <div className={styles.completedBanner}>★ ADVENTURE COMPLETED ★</div>
        )}
        <h1 className={styles.title}>{isWon ? 'Run Won!' : 'Run Over'}</h1>

        <div className={styles.stats}>
          <div className={`${styles.stat} ${isWon ? styles.statHero : ''}`}>
            <div className={styles.statValue}>{passedShifts}</div>
            <div className={styles.statLabel}>Shifts Survived</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>${totalMoney}</div>
            <div className={styles.statLabel}>Total Earned</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{totalServed}</div>
            <div className={styles.statLabel}>Served</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{totalLost}</div>
            <div className={styles.statLabel}>Lost</div>
          </div>
          {totalBonuses > 0 && (
            <div className={styles.stat}>
              <div className={styles.statValue}>+${totalBonuses}</div>
              <div className={styles.statLabel}>Path Bonuses</div>
            </div>
          )}
        </div>

        {ownedGarnishes.length > 0 && (
          <div className={styles.garnishesPanel}>
            <div className={styles.garnishesTitle}>Garnishes Collected · {ownedGarnishes.length}</div>
            <div className={styles.garnishChips}>
              {ownedGarnishes.map(g => (
                <span key={g.id} className={`${styles.garnishChip} ${styles[`tier_${g.tier}`]}`} title={g.description}>
                  <span className={styles.garnishChipIcon}>{g.icon}</span>
                  {g.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {isNewBestRun && (
          <div className={styles.newBest}>New Best Run!</div>
        )}

        {bestRun && !isNewBestRun && (
          <div className={styles.bestChip}>
            Best run: Shift {bestRun.furthestShift} · ${bestRun.totalMoney}
            {bestRun.wonRuns > 0 ? ` · ${bestRun.wonRuns} won` : ''}
          </div>
        )}

        <div className={styles.buttons}>
          <button className={styles.playAgainBtn} onClick={onPlayAgain}>Play Again</button>
          <button className={styles.menuBtn} onClick={onMenu}>Main Menu</button>
        </div>
      </div>

      {/* ── RIGHT ── */}
      <div className={styles.rightCol}>
        <div className={styles.historyPanel}>
          <div className={styles.panelTitle}>Shift History</div>
          <div className={styles.historyHeader}>
            <span className={styles.historyShift}>#</span>
            <span className={styles.historyRecipes}>Recipes</span>
            <span className={styles.historyGoal}>Goal</span>
            <span className={styles.historyEarned}>Earned</span>
            <span className={styles.historyResult}>Result</span>
          </div>
          {run.shiftResults.map(r => {
            const boss = r.bossDebuffId ? BOSSES[r.bossDebuffId as BossId] : null
            return (
              <div
                key={r.shiftNumber}
                className={`${styles.historyRow} ${!r.passed ? styles.historyRowFail : ''}`}
              >
                <span className={styles.historyShift}>{r.shiftNumber}</span>
                <span className={styles.historyRecipes}>
                  {boss && (
                    <span className={styles.historyBoss} title={`${boss.name} — ${boss.description}`}>{boss.icon}</span>
                  )}
                  {r.recipes.map(k => <FoodIcon key={k} icon={RECIPES[k]?.emoji ?? '?'} size={18} />)}
                  {r.cashBonusEarned && r.cashBonusEarned > 0 && (
                    <span className={styles.historyBonus} title="Path-card cash bonus">+${r.cashBonusEarned}</span>
                  )}
                </span>
                <span className={styles.historyGoal}>${r.goalMoney}</span>
                <span className={styles.historyEarned}>${r.moneyEarned}</span>
                <span className={r.passed ? styles.resultPass : styles.resultFail}>
                  {r.passed ? 'PASS' : 'FAIL'}
                </span>
              </div>
            )
          })}
        </div>

        <div className={styles.leaderboard}>
          <div className={styles.lbStickyHead}>
            <div className={styles.lbTitle}>Leaderboard</div>
            <div className={styles.lbHeader}>
              <span className={styles.lbRank}>#</span>
              <span className={styles.lbName}>Player</span>
              <span className={styles.lbDetail} title="Cooked">🍳</span>
              <span className={styles.lbDetail} title="Served">✅</span>
              <span className={styles.lbDetail} title="Extinguished">🧯</span>
              <span className={styles.lbDetail} title="Cooled">❄️</span>
              <span className={styles.lbDetail} title="Event Participations">✨</span>
              <span className={styles.lbDetail} title="Fires Caused">🔥</span>
              <span className={styles.lbDetail} title="Bonus Points">⭐</span>
              <span className={styles.lbTotal}>Score</span>
            </div>
          </div>
          {leaderboard.length === 0 ? (
            <div className={styles.lbEmpty}>No players this run</div>
          ) : (
            leaderboard.map(([name, s], i) => {
              const color = NAME_COLORS[Math.abs(hashStr(name)) % NAME_COLORS.length]
              const isYou = name === 'You'
              const isMvp = isWon && i === 0
              return (
                <div
                  key={name}
                  className={`${styles.lbRow} ${isYou ? styles.lbYou : ''} ${isMvp ? styles.lbMvp : ''}`}
                >
                  <span className={styles.lbRank}>{isMvp ? '★' : i + 1}</span>
                  <span className={styles.lbName} style={{ color }}>{name}</span>
                  <span className={styles.lbDetail}>{s.cooked}</span>
                  <span className={styles.lbDetail}>{s.served}</span>
                  <span className={styles.lbDetail}>{s.extinguished * 2}</span>
                  <span className={styles.lbDetail}>{s.cooled}</span>
                  <span className={styles.lbDetail}>{s.eventParticipations * 2}</span>
                  <span className={styles.lbDetail} style={{ color: '#d94f4f' }}>{s.firesCaused}</span>
                  <span className={styles.lbDetail} style={{ color: '#c4a020' }}>{s.bonusPoints > 0 ? `+${s.bonusPoints}` : '0'}</span>
                  <span className={styles.lbTotal}>{calcPlayerScore(s)}</span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {showOverlay && (
        <AdventureSuccessOverlay
          shiftCount={ADVENTURE_TOTAL_SHIFTS}
          cuisineFlag={cuisineFlag}
          cuisineName={cuisineName}
          mvpName={mvpName}
          mvpScore={mvpScore}
          onDismiss={() => setShowOverlay(false)}
        />
      )}
    </div>
  )
}
```

### Step 2: Add the `screenWon` polish rules to the CSS module

- [ ] **Step 2.1:** Open `src/components/AdventureRunEnd.module.css`. **Append** the following block to the very end of the file (don't replace the existing rules — these are additions, all scoped under `.screenWon`):

```css
/* ──────────────────────────────────────────────────────────────────────────
   .screenWon — applied to the root .screen when run.runWon === true
   Recolors existing elements to a warm parchment / gold theme.
   ────────────────────────────────────────────────────────────────────────── */

.screenWon {
  background:
    radial-gradient(ellipse at 50% 0%, rgba(255, 178, 70, 0.10) 0%, transparent 55%),
    var(--bg);
}

/* ── Completed banner (above title) ── */

.completedBanner {
  align-self: flex-start;
  font-family: 'Lilita One', cursive;
  font-size: 18px;
  letter-spacing: 5px;
  color: #1a140e;
  background: linear-gradient(180deg, #d4a155 0%, #b87333 100%);
  border: 1px solid #6b3a18;
  border-radius: 4px;
  padding: 6px 18px;
  box-shadow: 0 0 18px rgba(255, 178, 70, 0.30);
}

/* ── Title recolor when won ── */

.screenWon .title {
  color: #f0c850;
  text-shadow: 0 2px 0 #6b3a18, 0 0 18px rgba(240, 200, 80, 0.45);
}

/* ── Hero stat treatment (Shifts Survived) ── */

.statHero {
  position: relative;
  background: linear-gradient(180deg, rgba(212, 161, 85, 0.30) 0%, rgba(107, 58, 24, 0.40) 100%);
  border: 1px solid #d4a155;
  border-radius: 10px;
  padding: 12px 18px;
  box-shadow: inset 0 0 16px rgba(255, 178, 70, 0.25), 0 0 14px rgba(240, 200, 80, 0.20);
}

.statHero::before,
.statHero::after {
  content: '✦';
  position: absolute;
  top: 4px;
  color: #f0c850;
  font-size: 14px;
  text-shadow: 0 0 8px #ffb060;
}
.statHero::before { left: 6px; }
.statHero::after  { right: 6px; }

.statHero .statValue {
  font-size: 48px;
  color: #f0c850;
  text-shadow: 0 2px 0 #6b3a18;
}

/* ── Panel borders pick up the amber theme when won ── */

.screenWon .historyPanel,
.screenWon .leaderboard {
  border-color: #6b3a18;
}

.screenWon .panelTitle,
.screenWon .lbTitle {
  color: #d4a155;
}

/* ── Leaderboard MVP row ── */

.lbMvp {
  background: rgba(240, 200, 80, 0.12) !important;
  border: 1px solid rgba(212, 161, 85, 0.45);
}

.lbMvp .lbRank {
  color: #f0c850;
  text-shadow: 0 0 8px rgba(255, 178, 70, 0.5);
}

/* ── Play Again button — amber gradient when won ── */

.screenWon .playAgainBtn {
  background: linear-gradient(180deg, #d4a155 0%, #b87333 100%);
  color: #1a140e;
  border: 1px solid #6b3a18;
  box-shadow: 0 2px 10px rgba(255, 178, 70, 0.25);
}
```

### Step 3: Build check

- [ ] **Step 3.1:** Run `npm run build`. Expected: build succeeds.

### Step 4: Lint check

- [ ] **Step 4.1:** Run `npm run lint`. Expected: no new warnings or errors.

### Step 5: Commit

- [ ] **Step 5.1:**

```bash
git add src/components/AdventureRunEnd.tsx src/components/AdventureRunEnd.module.css
git commit -m "feat(adventure): polish AdventureRunEnd + mount win overlay when runWon

When run.runWon === true: mount AdventureSuccessOverlay on first render,
apply the .screenWon class (amber theme), show the ★ ADVENTURE COMPLETED
banner above the title, promote 'Shifts Survived' to hero treatment with
flourishes, and star-mark the top leaderboard row.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Manual verification

**Files:** none (verification only)

> Use the `superpowers:verification-before-completion` skill to gate task completion. Each check below must be eyeballed in a real browser; do not claim done without observing the result.

### Step 1: Start the dev server

- [ ] **Step 1.1:** Run `npm run dev` and open the printed local URL in a browser.

### Step 2: Verify happy path (single-player win)

- [ ] **Step 2.1:** From the Main Menu, start Adventure. In the lobby, do not invite anyone — solo run with "You". Pick any cuisine. Use mod commands or speedrun shifts to get to shift 8 (or temporarily lower `ADVENTURE_TOTAL_SHIFTS` to 1 in a local dev branch — revert before commit, do NOT commit that change).
- [ ] **Step 2.2:** On the shift-8 PASS transition, observe:
  - Parchment scroll overlay appears centered with title "ADVENTURE / SUCCESS"
  - Eyebrow reads `⚔ 8 shifts cleared ⚔`
  - Italic sub reads `The kitchen prevails. The feast is yours.`
  - Cuisine row matches the run's starting cuisine (flag + name)
  - MVP chip below scroll reads `★ MVP · YOU · {score} PTS`
  - Embers float upward; scroll glow pulses
  - Underlying screen (when overlay fades) shows the amber banner `★ ADVENTURE COMPLETED ★`, gold "Run Won!" title, hero "Shifts Survived" tile with ✦ flourishes, amber-trimmed panels, ★ on leaderboard row 1
- [ ] **Step 2.3:** Wait ~5 seconds without clicking. Overlay should auto-fade (~400ms transition) revealing the polished run-end screen.

### Step 3: Verify click-to-skip

- [ ] **Step 3.1:** Repeat (2) but click the overlay ~1s after it appears. Overlay should fade immediately; the auto-timer should not also trigger after.
- [ ] **Step 3.2:** Repeat clicks during the fade — they should be ignored (no console errors, no double-dismiss).

### Step 4: Verify fail-path regression

- [ ] **Step 4.1:** Start a fresh run. Deliberately fail an early shift (e.g. shift 2 or 3).
- [ ] **Step 4.2:** Observe AdventureRunEnd:
  - No overlay appears
  - Title reads "Run Over" (unchanged from before this PR)
  - No `★ ADVENTURE COMPLETED ★` banner
  - "Shifts Survived" stat shows the normal (non-hero) treatment
  - No ★ on leaderboard
  - No amber theme on panels / buttons
  - Screen looks identical to the pre-PR fail screen

### Step 5: Verify multiplayer MVP

- [ ] **Step 5.1:** Open the dev console in a second tab connected to your local Twitch test channel (or use the local chat input to simulate multiple users via `!join @userA`, `!join @userB`, etc.).
- [ ] **Step 5.2:** Have multiple users cook during a winning run.
- [ ] **Step 5.3:** On win, MVP chip should show the top-scoring user (highest `calcPlayerScore`), not "You" unless you happen to top the chart.

### Step 6: Verify reduced motion

- [ ] **Step 6.1:** Enable OS-level reduced motion:
  - macOS: System Settings → Accessibility → Display → Reduce motion ✓
  - Or via dev tools: Rendering panel → Emulate CSS media feature `prefers-reduced-motion: reduce`
- [ ] **Step 6.2:** Trigger a win. Embers should NOT animate (they remain invisible). Scroll glow should NOT pulse. Backdrop fade transition should be instantaneous.

### Step 7: Verify audio fallback

- [ ] **Step 7.1:** Confirm `public/audio/sfx/victory.mp3` does NOT yet exist.
- [ ] **Step 7.2:** Trigger a win. Expected: overlay shows normally, no audio plays, no console error / warning related to the missing file. (Howler may log a `decodeAudioData` warning — verify it's silenced or non-fatal.)

### Step 8: Verify build + lint clean

- [ ] **Step 8.1:** Run `npm run build` from a clean state. Expected: zero TypeScript errors, bundle succeeds.
- [ ] **Step 8.2:** Run `npm run lint`. Expected: zero new warnings or errors compared to a `release/adventure-roguelike` baseline.

### Step 9: Sanity check the z-index stack

- [ ] **Step 9.1:** While the overlay is visible, inspect the rendered DOM in dev tools. Confirm `.backdrop` has `z-index: 270` and sits above any AdventureRunEnd descendants including the sticky leaderboard header (`z-index: 1`). No part of the run-end screen should poke through the parchment.

---

## Self-review

Cross-checking the plan against the spec sections:

| Spec section | Covered by |
|--------------|-----------|
| Two-stage celebration (5s + click) | Task 2 Step 1 (`AUTO_DISMISS_MS`, `FADE_OUT_MS`, `beginExit`) |
| Overlay layout (eyebrow / title / divider / sub / cuisine) | Task 2 Step 1 JSX |
| Underlying screen polish (banner, statHero, lbMvp, amber theme) | Task 3 Step 1 + Step 2 |
| Visual tokens (parchment gradient, glow, borders, fonts) | Task 2 Step 2 CSS |
| Embers + reduced motion | Task 2 Step 2 (`@keyframes emberRise`, `@media (prefers-reduced-motion: reduce)`) |
| MVP chip + solo `YOU` fallback | Task 2 Step 1 (props), Task 3 Step 1 (mvpEntry computation — leaderboard[0] from sorted accumulatedPlayerStats includes "You") |
| Empty stats → MVP hidden | Task 2 Step 1 JSX (`{mvpName && mvpScore !== null && …}`) |
| `victory.mp3` missing → no-op | Task 1 (registry entry) + Task 4 Step 7 (manual verify) |
| Audio asset registration | Task 1 Step 1 |
| Cuisine name + flag lookup | Task 1 Step 2 (`getCuisineRecipeSet`) + Task 3 Step 1 (call site) |
| z-index 270 above EventCardOverlay's 260 | Task 2 Step 2 (`.backdrop { z-index: 270 }`) + Task 4 Step 9 (verify) |
| Click during fade is no-op | Task 2 Step 1 (`onClick={isExiting ? undefined : beginExit}`) + `dismissedRef` guard |
| React strict-mode double-mount safety | Task 2 Step 1 (`useEffect` cleanup clears timer; `playSfx` self-throttles 500ms) |
| All 8 manual test cases from spec | Task 4 Steps 2–8 |

**Placeholder scan:** No `TBD`, `TODO`, or "handle edge cases" placeholders. Every code step has the full code block. Every command is exact.

**Type consistency:** `getCuisineRecipeSet` defined in Task 1 returns `RecipeSet | undefined`; consumed in Task 3 with optional-chain `cuisineSet?.flag ?? ''`. `mvpScore` defined as `number | null` in both the component prop type (Task 2) and the parent computation (Task 3).

---

## Execution notes

- **Project rule:** the parent CLAUDE.md says use the `superpowers` skill family when planning. This plan was produced via `superpowers:writing-plans`. Use `superpowers:subagent-driven-development` (or `executing-plans`) to execute it.
- **PR strategy:** matches the existing pr1/pr2/pr3 chained pattern — this branch sits off `release/adventure-roguelike` and merges back into it (not `main`).
- **Out of scope for this PR:** sourcing `victory.mp3`. The user adds the file separately to `public/audio/sfx/`. Component already references it; `playSfx` no-ops silently until the file is present.
- **Future-proofing for Sub-project D (Ascension):** the overlay accepts `shiftCount` as a prop rather than hard-coding 8. When Ascension lands, the eyebrow can extend to read `⚔ Ascension III · 8 shifts cleared ⚔` via a single new optional prop.
