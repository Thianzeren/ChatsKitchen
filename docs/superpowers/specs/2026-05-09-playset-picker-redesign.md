# PlaysetPicker Redesign — Spec

**Date:** 2026-05-09
**Branch:** feature/ui-revamp
**Status:** Approved for implementation

---

## Overview

Redesign `PlaysetPicker.tsx` + `PlaysetPicker.module.css` to improve stream readability and align with the dungeon fantasy direction in `DESIGN.md`. The layout structure (carousel + bottom panel) is preserved. Changes are: stronger selection state, stripped card body content, removed station labels from card headers, and palette alignment to design tokens.

No changes to the component's props interface, state logic, or data layer.

---

## Card Header

### Before
- Flag emoji + playset name + optional tag badge + station labels (second row, 12px Space Mono)

### After
- Flag emoji + playset name + optional tag badge
- **Station labels removed entirely** from the card header. Stations are detail-level information; they belong in the bottom breakdown panel, not the card.

**CSS change:** Remove `.cardStations` usage from JSX. The `.cardStations` CSS class can be deleted.

---

## Card Selection State

### Before
- Selected: `border-color: var(--card-color)` + `box-shadow: 0 0 24px -4px var(--card-color)` (subtle glow, hard to read on dark background from stream distance)
- Hovered: same but smaller shadow

### After
- **Selected**: `.cardHeader` background fills with `var(--card-color)` at full opacity. Border becomes `var(--card-color)`. Header text switches to `#fff` with `text-shadow: 0 1px 4px rgba(0,0,0,0.4)` for legibility over any theme colour. Tag badge inverts to `rgba(0,0,0,0.2)` background with `rgba(255,255,255,0.75)` text.
- **Hovered (not pinned)**: border becomes `var(--card-color)`. Header gets `background: color-mix(in srgb, var(--card-color) 20%, var(--surface-2))` — a hint of the theme colour without the full fill.
- **Neither**: border stays `var(--border)`, header stays `var(--surface-2)`.

**CSS implementation:**

```css
/* Base card header */
.cardHeader {
  background: var(--surface-2);
  transition: background 0.18s;
}

/* Hovered (not selected) */
.cardHovered .cardHeader {
  border-bottom-color: var(--card-color);
  background: color-mix(in srgb, var(--card-color) 15%, var(--surface-2));
}
.cardHovered {
  border-color: var(--card-color);
}

/* Selected */
.cardSelected .cardHeader {
  background: var(--card-color);
  border-bottom-color: transparent;
}
.cardSelected {
  border-color: var(--card-color);
}
/* Text overrides inside selected header */
.cardSelected .cardName {
  color: #fff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}
.cardSelected .cardTag {
  background: rgba(0, 0, 0, 0.2);
  color: rgba(255, 255, 255, 0.8);
  border-color: rgba(255, 255, 255, 0.2);
}
```

Remove the old `box-shadow` from `.cardHovered` and `.cardSelected`.

---

## Card Body — Strip to Emoji + Name Only

### Before
- Recipes: emoji + name + price (`$65`)
- Events: emoji + name + hazard/opportunity badge

### After
- Recipes: emoji + name only (no price)
- Events: emoji + name + hazard/opportunity badge (badge stays — it's a quick visual signal, not detail)

**Rationale:** Prices belong in the bottom breakdown where there is room. Cards are for quick visual identification at stream resolution.

**JSX change:** Remove `<span className={styles.itemMeta}>${recipe.reward}</span>` from the recipe `itemRow`.

**CSS change:** `.itemMeta` class can be deleted (it is only used for prices).

---

## Palette Alignment

Replace all hardcoded off-palette colours with design tokens:

| Element | Old value | New value |
|---------|-----------|-----------|
| `.sectionLabelRecipes` | `#5a9ab0` | `#7858cc` (arcane — dishes are alchemical) |
| `.sectionLabelEvents` | `#c49820` | `#c4a020` (dungeon-gold, already correct value; update to exact token) |
| `.evtBadgeHazard` color | `#d06060` | `#c03830` (signal-red) |
| `.evtBadgeHazard` background | `rgba(208,64,64,0.15)` | `rgba(192,56,48,0.15)` |
| `.evtBadgeHazard` border | `rgba(208,64,64,0.25)` | `rgba(192,56,48,0.3)` |
| `.evtBadgeOpportunity` color | `#5cb85c` | `#42a05e` (signal-green / verdure) |
| `.evtBadgeOpportunity` background | `rgba(92,184,92,0.12)` | `rgba(66,160,94,0.12)` |
| `.evtBadgeOpportunity` border | `rgba(92,184,92,0.25)` | `rgba(66,160,94,0.25)` |
| `.diffBtnNormal.active` color | `#5cb85c` | `#42a05e` |
| `.diffBtnHard.active` color | `#e05050` | `#c03830` |
| `.bdBadgeHazard` color | `#d06060` | `#c03830` |
| `.bdBadgeHazard` background | `rgba(208,64,64,0.15)` | `rgba(192,56,48,0.15)` |
| `.bdBadgeHazard` border | `rgba(208,64,64,0.25)` | `rgba(192,56,48,0.3)` |
| `.bdBadgeOpportunity` color | `#5cb85c` | `#42a05e` |
| `.bdBadgeOpportunity` background | `rgba(92,184,92,0.12)` | `rgba(66,160,94,0.12)` |
| `.bdBadgeOpportunity` border | `rgba(92,184,92,0.25)` | `rgba(66,160,94,0.25)` |
| `.stepChip` background | `rgba(240,200,80,0.1)` | `rgba(196,160,32,0.1)` |
| `.stepChip` border | `rgba(240,200,80,0.25)` | `rgba(196,160,32,0.25)` |

---

## Cook Button — Tactile Press Shadow

The "Let's Cook!" button currently uses `filter + scale` for hover. Per DESIGN.md, primary buttons use a hard press shadow.

**CSS change for `.cookBtn`:**

```css
.cookBtn {
  /* existing properties stay */
  box-shadow: 0 4px 0 #8e4e18;
  transition: filter 0.1s, transform 0.1s, box-shadow 0.1s;
}

.cookBtn:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.cookBtn:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: 0 2px 0 #8e4e18;
}
```

Remove the old `:active` `transform: scale(0.98)`.

---

## Item Row Sizing

Increase the body row padding slightly for better stream readability:

```css
.itemRow {
  padding: 6px 8px; /* was 5px 7px */
}

.itemEmoji {
  font-size: 22px;  /* was var(--base-fs) = 18px */
  width: 26px;      /* was 22px */
}
```

Section label font size stays at `11px` (it's a label, not body text — its purpose is to separate sections, not be read independently). Item name stays at `var(--base-fs)` = 18px, which is already at the broadcast minimum.

---

## What Does NOT Change

- Layout structure: topbar → carousel → bottom panel
- Carousel navigation logic and state
- `DetailBreakdown` component (bottom panel) — no changes except palette alignment above
- Bottom panel height
- Action area (Cook + Customise buttons) — only cook button gets shadow treatment
- All props, state, event handlers
- `--ps-accent` variable usage
- Card hover/click interaction logic in TSX

---

## Files Changed

| File | Changes |
|------|---------|
| `src/components/PlaysetPicker.module.css` | Selection state styles, card header background, palette colour replacements, cook button shadow, item row sizing, remove `.cardStations` and `.itemMeta` |
| `src/components/PlaysetPicker.tsx` | Remove station labels div from card header JSX, remove price `itemMeta` span from recipe rows |
