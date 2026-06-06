# Gameplay Screen — Truncation & Typo Fixes (Design)

**Date:** 2026-06-06
**Branch:** `fix/gameplay-screen-polish`
**Scope:** Three isolated fixes on the main Free Play gameplay screen. No game logic changes beyond a display-string typo.

---

## Problem

Observed on the main gameplay screen during a live Free Play round:

1. **Cooking-slot text truncates.** The per-slot progress bar shows `FryQu… tom… 77%` — both the username and the ingredient ellipsize because, at 4 stations per row, each slot is too narrow.
2. **Order-ticket ingredient names wrap mid-word.** `LETTUCE` renders as `LETTUC E`, `CROUTON` as `CROUTO N`, because the ticket tile is too narrow and the label uses `word-break: break-all`.
3. **`chopping` typo.** Kitchen system messages read `started choping lettuce!` — the message is built as `` `${cookAction}ing` ``, and `chop + ing` = `choping`.

Out of scope (explicitly not touched): kitchen dead space / station grid filling, chat system-message spam, toggle sprawl, and any other gameplay-screen feedback.

---

## Decisions

- **Long / two-word order-ticket ingredient names** (`spring onion`, `bee hoon`, `gochujang`, `chicken wing`): wrap to two lines **at the space only**, never split a single word mid-letter. (Chosen over single-line ellipsis.)
- **Stations grid:** hard **3 columns everywhere** (`repeat(3, 1fr)`), accepting that a 4-station playset shows a row of 3 plus one station alone on row 2, and a 2-station playset leaves one track empty. Readability of the slots is prioritised over per-playset balance.

---

## Changes

### 1. `chopping` typo — `src/state/gameReducer.ts` (~line 451)

Introduce a minimal gerund-override map and use it when composing the "started …ing" message:

```ts
const COOK_GERUNDS: Record<string, string> = { chop: 'chopping' }
// message: `${user} started ${COOK_GERUNDS[cookAction] ?? `${cookAction}ing`} ${target.replace(/_/g, ' ')}!`
```

Every other cook verb is already correct via `+ing` (`grill→grilling`, `fry→frying`, `boil→boiling`, `mix→mixing`, `steam→steaming`, `simmer→simmering`, `cook→cooking`, `grind→grinding`, `knead→kneading`, `roast→roasting`, `toast→toasting`, `stirfry→stirfrying`). The map only carries irregular verbs needing consonant-doubling — today just `chop`. The "finished …" message (~line 626) has no gerund and is unaffected.

### 2. Order ticket ingredient names — `src/components/OrderTicket.module.css` + `src/components/DiningRoom.module.css`

- `DiningRoom.module.css` `.dining`: `width: 260px` → `width: 300px` (tunable; gives each of the 3 ingredient tiles room for common single words up to ~9 chars like `anchovies`, `dumplings`).
- `OrderTicket.module.css` `.ingredientName`:
  - `word-break: break-all` → `word-break: normal` (and ensure `overflow-wrap: normal`) so a single word is never split between letters.
  - Relax the forced single-line clipping (`overflow: hidden` / `text-overflow: ellipsis`) so a two-word name wraps to a second line and both lines remain visible. The flex-column tile grows to accommodate the second line.
  - Keep `text-align: center`.
- **Simple-ticket mode** (`.simpleIngredients` / `.simpleIngredientTile`) renders icons only with no names, so it is unaffected by this change.

### 3. Stations 3-per-row — `src/components/Kitchen.module.css`

`.stationsGrid`:

```css
/* before */ grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
/* after  */ grid-template-columns: repeat(3, minmax(0, 1fr));
```

Wider stations widen the cooking-slot bars, so `.barUser` / `.barItem` stop ellipsizing in the common cases. No change to `Station.tsx`; the existing per-segment ellipsis stays as a harmless safety net for pathologically long names.

---

## Known limitation (accepted)

The slot fix is width-driven. With the chat panel **open** *and* a genuinely long cook target (`spring onion`, `gochujang`), a cooking slot may still ellipsize slightly. This is far better than the 4-up state and never affects the order ticket. A future, out-of-scope option is to shrink the username's reserved width (`.barUser max-width`) inside the slot.

---

## Verification

- **Typo:** `npm run build` (tsc passes); confirm a `chop` action logs `started chopping …!` in the chat feed.
- **Order ticket:** run the app, Western Diner set — confirm `LETTUCE` / `CROUTON` no longer split; confirm a set containing `spring onion` (e.g. Stir-Fried Pork) wraps it to two lines at the space.
- **Stations:** confirm exactly 3 stations per row (Western shows 3 + lone Oven on row 2) and that cooking slots no longer truncate the ingredient in the common case.
