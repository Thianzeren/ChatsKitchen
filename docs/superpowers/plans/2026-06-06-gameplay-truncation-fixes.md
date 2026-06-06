# Gameplay Screen Truncation & Typo Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three isolated gameplay-screen issues — the `choping` typo, order-ticket ingredient names wrapping mid-word, and cooking-slot text truncating — without touching game logic or other UI concerns.

**Architecture:** One TDD'd one-line logic change in the reducer (gerund-override map for the chat message), and two CSS-only layout changes (widen the orders column + word-boundary wrapping for ticket ingredients; force a 3-column station grid to widen cooking slots). CSS changes are verified visually in the running dev app since they have no unit-testable surface.

**Tech Stack:** React 18 + TypeScript, Vite 5, CSS Modules, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-06-gameplay-truncation-fixes-design.md`

---

## File Structure

| File | Change |
|------|--------|
| `src/state/gameReducer.ts` | Add `COOK_GERUNDS` map; use it in the "started …ing" message (~line 451) |
| `src/state/gameReducer.test.ts` | New test asserting `chop` logs `started chopping …` |
| `src/components/DiningRoom.module.css` | `.dining` width `260px → 300px` |
| `src/components/OrderTicket.module.css` | `.ingredientName` word-boundary wrapping |
| `src/components/Kitchen.module.css` | `.stationsGrid` → hard 3 columns |

---

## Task 1: Fix the `chopping` typo (TDD)

**Files:**
- Modify: `src/state/gameReducer.ts` (~line 451, and a new const near the other module-level consts)
- Test: `src/state/gameReducer.test.ts` (add to the existing `describe('COOK', …)` block)

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe('COOK', () => { … })` block in `src/state/gameReducer.test.ts` (e.g. right after the first `it('starts a slot …')` test):

```ts
  it('logs "chopping" (not "choping") when a chop action starts', () => {
    const s = gameReducer(base(), { type: 'COOK', user: 'alice', action: 'chop', target: 'lettuce', now: NOW })
    expect(s.chatMessages.some(m => m.text === 'alice started chopping lettuce!')).toBe(true)
  })

  it('keeps the plain +ing form for regular verbs (grill → grilling)', () => {
    const s = gameReducer(base(), { type: 'COOK', user: 'alice', action: 'grill', target: 'patty', now: NOW })
    expect(s.chatMessages.some(m => m.text === 'alice started grilling patty!')).toBe(true)
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/state/gameReducer.test.ts -t "chopping"`
Expected: FAIL — the message is currently `alice started choping lettuce!`, so the `chopping` assertion fails. (The `grilling` test passes already; that's fine — it guards against the fix breaking regular verbs.)

- [ ] **Step 3: Add the gerund-override map**

Near the top of `src/state/gameReducer.ts`, with the other module-level constants, add:

```ts
// Cook-verb → present participle for the "started …ing" chat message.
// Only irregular verbs that need consonant-doubling live here; everything
// else is correct via `${action}ing` (grill→grilling, fry→frying, …).
const COOK_GERUNDS: Record<string, string> = { chop: 'chopping' }
```

- [ ] **Step 4: Use the map in the message**

In `src/state/gameReducer.ts` at ~line 451, change the message string from:

```ts
        'KITCHEN', `${user} started ${cookAction}ing ${target.replace(/_/g, ' ')}!`, 'success'
```

to:

```ts
        'KITCHEN', `${user} started ${COOK_GERUNDS[cookAction] ?? `${cookAction}ing`} ${target.replace(/_/g, ' ')}!`, 'success'
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/state/gameReducer.test.ts`
Expected: PASS (all COOK tests green, including both new ones).

- [ ] **Step 6: Type-check**

Run: `npm run build`
Expected: `tsc -b` completes with no errors and the Vite bundle is produced.

- [ ] **Step 7: Commit**

```bash
git add src/state/gameReducer.ts src/state/gameReducer.test.ts
git commit -m "fix(chat): say 'chopping' not 'choping' in cook start message"
```

---

## Task 2: Order-ticket ingredient names — widen column + word-boundary wrap

**Files:**
- Modify: `src/components/DiningRoom.module.css` (`.dining`)
- Modify: `src/components/OrderTicket.module.css` (`.ingredientName`)

No unit test — CSS layout is verified visually in the running app (Step 4).

- [ ] **Step 1: Widen the orders column**

In `src/components/DiningRoom.module.css`, in the `.dining` rule, change:

```css
  width: 260px;
```

to:

```css
  width: 300px;
```

- [ ] **Step 2: Switch ingredient labels to word-boundary wrapping**

In `src/components/OrderTicket.module.css`, replace the `.ingredientName` rule (currently lines ~130–142):

```css
.ingredientName {
  font-size: calc(var(--base-fs) / 1.5);
  font-family: 'Space Mono', monospace;
  color: #5a5040;
  text-transform: uppercase;
  letter-spacing: 0;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  text-align: center;
  word-break: break-all;
}
```

with:

```css
.ingredientName {
  font-size: calc(var(--base-fs) / 1.5);
  font-family: 'Space Mono', monospace;
  color: #5a5040;
  text-transform: uppercase;
  letter-spacing: 0;
  font-weight: 700;
  width: 100%;
  text-align: center;
  word-break: normal;
  overflow-wrap: normal;
}
```

(Removing `overflow: hidden` / `text-overflow: ellipsis` lets a two-word name show both wrapped lines; `word-break: normal` + `overflow-wrap: normal` means a single word is never split between letters.)

- [ ] **Step 3: Type-check / build**

Run: `npm run build`
Expected: no errors (CSS Modules compile; tsc passes).

- [ ] **Step 4: Visual verification in the running app**

Start the dev server if not running: `npm run dev`
In the browser:
1. Play → Free Play → **Western Diner** playset → Let's Cook. Open ⚙ → enable Bots, Resume.
2. Confirm order-ticket ingredient labels read `LETTUCE`, `TOMATO`, `CROUTON`, `BUN`, `PATTY` — each whole, **no** mid-word break like `LETTUC E`.
3. Exit to menu, start a set containing a two-word ingredient — **Chinese Restaurant** (Stir-Fried Pork has `spring onion`). Confirm `SPRING ONION` wraps to two lines **at the space**, not split mid-word.

Expected: all single words intact; multi-word names stack cleanly on two lines.

- [ ] **Step 5: Commit**

```bash
git add src/components/DiningRoom.module.css src/components/OrderTicket.module.css
git commit -m "fix(orders): widen column and wrap ingredient names at word boundaries"
```

---

## Task 3: Stations — hard 3-per-row to widen cooking slots

**Files:**
- Modify: `src/components/Kitchen.module.css` (`.stationsGrid`)

No unit test — verified visually (Step 3).

- [ ] **Step 1: Force a 3-column station grid**

In `src/components/Kitchen.module.css`, in the `.stationsGrid` rule, change:

```css
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
```

to:

```css
  grid-template-columns: repeat(3, minmax(0, 1fr));
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 3: Visual verification in the running app**

With the dev server running and a bots-enabled Western Diner round:
1. Confirm exactly **3 stations per row** — Chopping Board / Grill / Fryer on row 1, Oven alone on row 2.
2. Watch a few cook actions and confirm the slot bars now show the **full ingredient name** in the common case (e.g. `tomato`, `lettuce`, `crouton`) instead of `tom…`.
3. (Accepted limitation) With the chat panel open, a long cook target may still ellipsize slightly — this is expected per the spec and is fine.

Expected: 3-up layout; common ingredient names no longer truncated in slots.

- [ ] **Step 4: Commit**

```bash
git add src/components/Kitchen.module.css
git commit -m "fix(kitchen): 3 stations per row so cooking-slot text fits"
```

---

## Final verification

- [ ] Run the full test suite: `npx vitest run` — expected: all pass.
- [ ] `npm run lint` — expected: no new errors.
- [ ] `npm run build` — expected: clean.
- [ ] Confirm `git log --oneline` shows the three fix commits on `fix/gameplay-screen-polish`.
