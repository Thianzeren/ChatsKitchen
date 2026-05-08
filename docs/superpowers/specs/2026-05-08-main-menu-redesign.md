# Main Menu Redesign — Spec

**Date:** 2026-05-08
**Branch:** feature/ui-revamp
**Status:** Approved for implementation

---

## Overview

Redesign the Main Menu (`MainMenu.tsx` + `MainMenu.module.css`) to match the dungeon fantasy direction established in `DESIGN.md`. The two-column layout is preserved. The primary structural change is a full-width banner section that houses the game title, escaping the left column constraint. Secondary changes address the Tutorial/How To Play button hierarchy and general visual polish.

No changes to the component's props interface, state, or logic — this is a pure CSS/JSX structure change.

---

## Layout Structure

### Before
```
┌─────────────────────────────────────────┐
│ Left col (560px)  │  Right col (flex: 1) │
│  title             │  twitch card         │
│  subtitle          │  tutorial buttons    │
│  divider           │  free play           │
│  steps             │  adventure / pvp     │
│  divider           │  options row         │
│  cheatsheet        │                      │
│  footer            │                      │
└─────────────────────────────────────────┘
```

### After
```
┌─────────────────────────────────────────┐
│  BANNER (full width)                     │
│  "Let Chat Cook" — 72px title            │
│  gold tagline below                      │
├───────────────────┬─────────────────────┤
│ Left col (420px)  │  Right col (flex: 1) │
│  steps (3)        │  twitch card         │
│  divider          │  tutorial row        │
│  cheatsheet       │  free play           │
│  footer           │  adventure / pvp     │
│                   │  options row         │
└───────────────────┴─────────────────────┘
```

The `.screen` root becomes a column flexbox. The banner sits at the top. Below it, a `.body` div uses the existing two-column grid.

---

## Banner Section

**Element:** new `.banner` div at the top of `.screen`, before `.body`

**Structure:**
```html
<div class="banner">
  <div class="bannerTitle">Let Chat Cook</div>
  <div class="bannerTagline">⚔ Dungeon Kitchen · Twitch Chat Restaurant Game</div>
</div>
```

**Styles:**
- Background: `linear-gradient(180deg, #231e19 0%, #1e1915 100%)` — slightly warmer than the main bg, creates separation without a harsh edge
- Bottom border: `2px solid #3c3228` (dungeon crack)
- Padding: `28px 48px 22px`
- Subtle radial warm glow: `radial-gradient(ellipse 60% 80% at 30% 50%, rgba(216,116,40,0.08) 0%, transparent 70%)` on a pseudo-element — suggests torch light from the left without being literal
- **No overflow on the `.screen` container** — the banner needs to be visible

**Title (`.bannerTitle`):**
- Font: Fredoka 700, `72px`, `line-height: 0.92`, `letter-spacing: -2px`
- Color: `#f5ead8` (parchment)
- Text shadow (dungeon press): `0 5px 0 #8e4e18, -2px -2px 0 #d87428, 2px -2px 0 #d87428, -2px 2px 0 #d87428, 2px 2px 0 #d87428`

**Tagline (`.bannerTagline`):**
- Font: Space Mono 400, `12px`, `text-transform: uppercase`, `letter-spacing: 3px`
- Color: `#c4a020` (dungeon gold)
- Margin top: `10px`

---

## Left Column

Remove the `.title`, `.subtitle` elements and associated styles — they move into the banner.

Keep: steps section, divider, streamer section (cheatsheet), divider, footer.

**Width:** reduce from `560px` to `420px` in the grid. The right column absorbs the freed space.

**Section label (`.sectionLabel`):** add `margin-bottom: 8px` to give the steps breathing room.

---

## Right Column — Tutorial Row

**Current:** both "Tutorial" and "How To Play" use `.modeTutorial` (same gold style).

**New behaviour:**
- `Tutorial` button → `.modeTutorial` (dungeon gold, press shadow) — unchanged primary CTA
- `How To Play` button → `.modeHowToPlay` (ghost/outline) — demoted to secondary

**`.modeHowToPlay` styles:**
- Background: `transparent`
- Border: `1.5px solid #3c3228`
- Border-radius: `10px`
- Color: `#7a6555` (worn text)
- Font: Fredoka 700, `22px`
- Hover: `border-color: #524538`, `color: #a08870`
- No press shadow

The tutorial row keeps its `flex: 0 0 64px` height — no height change needed.

---

## What Does NOT Change

- Right column mode buttons (Free Play, Adventure, PvP, Options row) — no structural or style changes
- Twitch card — no changes
- All component logic, props, state, event handlers
- The `.modeOptions` ghost buttons at the bottom

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/MainMenu.tsx` | Add `.banner` wrapper + `.bannerTitle` / `.bannerTagline` divs. Remove title/subtitle divs from left col. Add `.modeHowToPlay` class to "How To Play" button. Change `screen` to column flex, add `.body` wrapper for the two-column section. |
| `src/components/MainMenu.module.css` | Add `.banner`, `.bannerTitle`, `.bannerTagline`. Remove `.title`, `.subtitle` (or keep but unused). Add `.modeHowToPlay`. Update `.screen` to `flex-direction: column`. Add `.body` for the two-column grid. Adjust left column width to `420px`. |

---

## Constraints

- The `height: 100%` on `.screen` must be preserved — the game runs in a fixed viewport
- The banner must not add scrollable content; the body section below must flex to fill remaining height
- `overflow: hidden` on `.screen` must be preserved
- No changes to any other component
