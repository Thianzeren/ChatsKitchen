# Gameplay Screen Polish — Spec

**Date:** 2026-05-09
**Branch:** feature/ui-revamp
**Status:** Approved for implementation

---

## Overview

Four focused visual improvements to the gameplay screen, all pure CSS or minimal JSX changes. No logic, state, props, or game mechanics are touched.

1. **PreparedItems bar** — show only stocked ingredients (count > 0); larger pills; empty state hint
2. **Station idle state** — replace plain "idle" text with the station's command hint
3. **Bottom stats bar** — dungeon palette colours; slightly taller; bigger numbers
4. **Orders panel** — dungeon palette alignment throughout DiningRoom CSS

---

## 1. PreparedItems — Stocked Only, Bigger Pills

### Logic change (`PreparedItems.tsx`)

In solo mode, `visibleIngredients` currently renders all ingredients for enabled recipes regardless of count. Change it to only show stocked items:

```tsx
// After computing counts (line ~35), add:
const stockedIngredients = visibleIngredients.filter(item => (counts[item] || 0) > 0)
```

Then in the solo mode render block, use `stockedIngredients` instead of `visibleIngredients`. The existing `counts` record is unchanged — just the filter changes which items are rendered.

Add an empty state below the header when `stockedIngredients.length === 0`:

```tsx
{stockedIngredients.length === 0 ? (
  <div className={styles.emptyHint}>Nothing prepped yet — start cooking!</div>
) : (
  <div className={`${styles.items} ${showNames ? styles.itemsWithNames : styles.itemsCompact}`}>
    {stockedIngredients.map(item => (
      // existing tray render — unchanged
    ))}
  </div>
)}
```

**PvP mode is not changed.** PvP uses its own render path with `redItems`/`blueItems` pools — those already only show items from the actual pool, so no filtering needed there.

### CSS changes (`PreparedItems.module.css`)

**`.prep` border-bottom:** `rgba(200, 132, 26, 0.2)` → `rgba(216, 116, 40, 0.2)` (torch-flame tinted)

**`.trayFilled`** — update to dungeon-gold palette:
```css
.trayFilled {
  background: rgba(196, 160, 32, 0.14);
  border: 2px solid rgba(196, 160, 32, 0.6);
  box-shadow: 0 0 8px rgba(196, 160, 32, 0.1);
}
```
(Removes old `rgba(240, 200, 80, ...)` values)

**`.trayEmpty`** — already fine (`#141414` / `#252525`), no change needed.

**`.emoji`** — increase size for stream readability:
```css
.emoji {
  font-size: 28px;  /* was 26px */
  line-height: 1;
  flex-shrink: 0;
}
```

**`.tray`** — slightly more padding:
```css
.tray {
  padding: 8px 12px 8px 10px;  /* was 6px 10px 6px 8px */
}
```

**Add `.emptyHint`** (new class):
```css
.emptyHint {
  font-family: 'Space Mono', monospace;
  font-size: 14px;
  color: #4e4038;
  font-style: italic;
  padding: 4px 2px;
}
```

**PvP colour classes** — update to dungeon palette:
```css
.pvpDivider {
  background: rgba(216, 116, 40, 0.15);  /* was rgba(200, 132, 26, 0.15) */
}
```

---

## 2. Station Idle State — Command Hint

### Logic change (`Station.tsx`)

At line 148–149, the idle state currently renders:
```tsx
} : station.slots.length === 0 ? (
  <div className={styles.idleStatus}>idle</div>
```

Replace with:
```tsx
} : station.slots.length === 0 ? (
  <div className={styles.idleStatus}>
    <div className={styles.idleCmd}>!{def.actions[0]} &lt;ingredient&gt;</div>
    <div className={styles.idleHint}>available</div>
  </div>
```

`def.actions[0]` is available at this point in the component — `def` is resolved at line 96. For multi-action stations (e.g., `oven` has `['toast', 'roast']`), this shows the first action, which is the primary one.

### CSS changes (`Station.module.css`)

**`.idleStatus`** — update from generic "idle" styling to a container style:
```css
.idleStatus {
  text-align: center;
  padding: 8px 4px;
}
```

**Add `.idleCmd`** (new):
```css
.idleCmd {
  font-family: 'Space Mono', monospace;
  font-size: 14px;
  color: #3a3028;
  letter-spacing: 0.3px;
}
```

**Add `.idleHint`** (new):
```css
.idleHint {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  color: #2e2820;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-top: 3px;
}
```

**`SlotRow` bar colours** — update `barColor` to dungeon palette (in `Station.tsx`, `SlotRow` function, ~line 20):
```tsx
const barColor = progress > 0.85
  ? 'rgba(192, 56, 48, 0.6)'    /* was rgba(217,79,79,0.55)  — signal-red */
  : progress > 0.65
    ? 'rgba(224, 112, 48, 0.6)' /* was rgba(232,148,58,0.55) — signal-orange */
    : 'rgba(66, 160, 94, 0.55)' /* was rgba(92,184,92,0.42)  — verdure */
```

**`heatBorderColor`** — update colours (in `Station.tsx`, ~line 53):
```tsx
function heatBorderColor(heat: number, overheated: boolean): string {
  if (overheated) return '#c03830'   /* was #cc2200 — signal-red */
  if (heat > 70)  return '#e07030'   /* unchanged — signal-orange */
  if (heat > 40)  return '#c4a020'   /* was #d4c43a — dungeon-gold */
  return '#42a05e'                   /* unchanged — verdure */
}
```

---

## 3. Bottom Stats Bar

### Colour changes (`BottomBar.tsx`)

The three `style={{ color: ... }}` inline values on the stat spans:

| Stat | Old value | New value |
|------|-----------|-----------|
| money | `#50d870` | `#c4a020` (dungeon-gold) |
| served | `#78c8f0` | `#42a05e` (verdure) |
| lost | `#f07860` | `#c03830` (signal-red) |

### CSS changes (`BottomBar.module.css`)

**`.bar`:**
```css
.bar {
  height: 56px;                          /* was 48px */
  background: #1a1512;                   /* was #0d0d0d */
  border-top: 2px solid var(--border);   /* was 1px solid rgba(200,132,26,0.25) */
}
```

**`.value`:**
```css
.value {
  font-family: 'Lilita One', cursive;
  font-size: 28px;   /* was 24px */
  line-height: 1;
}
```

**`.label`:**
```css
.label {
  font-family: 'Space Mono', monospace;
  font-size: 12px;            /* was var(--base-fs) = 18px — too large for a label */
  color: #7a6555;             /* was #6a6258 */
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
```

**`.divider`:**
```css
.divider {
  width: 1px;
  height: 28px;              /* was 24px */
  background: var(--border); /* was #2a2a2a */
  flex-shrink: 0;
}
```

**`.hint`:**
```css
.hint {
  font-family: 'Space Mono', monospace;
  font-size: var(--base-fs);
  color: #4e4038;  /* was #3a3530 — slightly lighter for readability */
}
```

---

## 4. Orders Panel — DiningRoom Palette

**CSS-only changes to `DiningRoom.module.css`:**

**`.dining` border:**
```css
border-right: 3px solid var(--border);  /* was rgba(200, 132, 26, 0.33) */
```

**`.dining` background:**
```css
background: var(--surface-4);  /* was #131313 */
```

**`.timeBlock`:**
```css
.timeBlock {
  background: linear-gradient(180deg, #231e19 0%, #1a1512 100%);  /* was #1d1209 → #160e06 */
  border-bottom: 2px solid var(--border);                          /* was rgba(200,132,26,0.33) */
}
```

**`.timeLabel`:**
```css
color: #d87428;  /* was #c8841a — torch-flame */
```

**`.timeValue`:**
```css
color: #c4a020;
text-shadow: 0 0 24px rgba(196, 160, 32, 0.35);  /* was rgba(240,200,80,...) */
```

**`.urgent`:**
```css
.urgent {
  color: #c03830 !important;                                  /* was #f05050 */
  text-shadow: 0 0 24px rgba(192, 56, 48, 0.5) !important;  /* was rgba(240,80,80,...) */
}
```

**`.ordersHeader`:**
```css
.ordersHeader {
  background: var(--surface-3);  /* was #1a1a1a */
  border-bottom: 1px solid var(--border);  /* was #2a2a2a */
}
```

**`.ordersTitle`:**
```css
color: var(--text);  /* was #e0d0b0 */
```

**`.ordersCount`:**
```css
.ordersCount {
  background: #d87428;       /* was #c8841a — torch-flame */
  color: #f5ead8;            /* was #0d0d0d */
  box-shadow: 0 2px 0 #8e4e18;  /* add press shadow */
}
```

**`.viewToggle` hover:**
```css
.viewToggle:hover {
  color: #d87428;                          /* was #c8841a */
  background: rgba(216, 116, 40, 0.08);   /* was rgba(200,132,26,0.08) */
  border-color: rgba(216, 116, 40, 0.3);  /* was rgba(200,132,26,0.3) */
}
```

**`.empty`:**
```css
color: var(--text-faint);  /* was #5a5048 */
```

---

## Files Changed

| File | Changes |
|------|---------|
| `src/components/PreparedItems.tsx` | Filter to stocked only; add empty state hint |
| `src/components/PreparedItems.module.css` | Palette, pill size, empty hint class |
| `src/components/Station.tsx` | Idle command hint JSX; bar + border colours |
| `src/components/Station.module.css` | idleStatus container, new idleCmd/idleHint classes |
| `src/components/BottomBar.tsx` | Inline stat colours |
| `src/components/BottomBar.module.css` | Height, font size, colours |
| `src/components/DiningRoom.module.css` | Full palette alignment |

## What Does NOT Change

- All component logic, props, state, game mechanics
- Slot rendering in Station (`SlotRow` structure)
- PvP prep items render path (except `.pvpDivider` colour)
- Order ticket rendering (OrderTicket component)
- CommandsStrip
- ChatPanel
- EventCardOverlay, SmokeOverlay
