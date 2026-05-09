---
name: Let Chat Cook
description: Broadcast-ready dungeon cooking game for Twitch streams
colors:
  torch-flame: "#d87428"
  torch-shadow: "#8e4e18"
  verdure: "#42a05e"
  verdure-deep: "#2a6e3e"
  arcane: "#7858cc"
  arcane-deep: "#4e3a8a"
  cave-stone: "#1a1512"
  cave-dark: "#141210"
  hewn-surface: "#231e19"
  worn-surface: "#2b2520"
  inset-surface: "#242019"
  recessed: "#1e1b16"
  dungeon-crack: "#3c3228"
  parchment: "#f5ead8"
  dim-parchment: "#d8c9b5"
  stone-text: "#a08870"
  worn-text: "#7a6555"
  shadow-text: "#4e4038"
  dungeon-gold: "#c4a020"
  twitch-purple: "#9146ff"
  ticket-paper: "#f0e5c8"
  signal-green: "#4aa854"
  signal-red: "#c03830"
  signal-orange: "#e07030"
typography:
  display:
    fontFamily: "'Fredoka', sans-serif"
    fontSize: "54px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-1px"
  headline:
    fontFamily: "'Lilita One', cursive"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: 1.1
  title:
    fontFamily: "'Fredoka', sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "'Space Mono', monospace"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Space Mono', monospace"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.02em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  pill: "99px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  xxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.torch-flame}"
    textColor: "{colors.parchment}"
    rounded: "{rounded.xl}"
    padding: "14px 28px"
  button-primary-hover:
    backgroundColor: "#e48030"
  button-primary-active:
    backgroundColor: "{colors.torch-flame}"
  button-ghost:
    backgroundColor: "{colors.hewn-surface}"
    textColor: "{colors.stone-text}"
    rounded: "{rounded.lg}"
    padding: "10px 18px"
  button-ghost-hover:
    backgroundColor: "{colors.worn-surface}"
  input-field:
    backgroundColor: "#1e1a14"
    textColor: "{colors.parchment}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  station-card:
    backgroundColor: "{colors.hewn-surface}"
    rounded: "{rounded.lg}"
    padding: "10px"
  order-ticket:
    backgroundColor: "{colors.ticket-paper}"
    rounded: "8px 8px 0 0"
    padding: "14px 10px 10px"
---

# Design System: Let Chat Cook

## 1. Overview

**Creative North Star: "The Dungeon Tavern Board"**

This is a cooking game played in a dungeon. The visual language lives at the intersection of a torch-lit adventurer's camp kitchen and a Jackbox party screen: dark cave stone behind everything, warm fire-orange commanding every action, parchment-colored text that reads from across a Twitch stream on a phone. The game appears as an OBS capture, so every element is sized for a mobile viewer watching from across a room. Subtlety is not the goal. Clarity is.

The aesthetic draws from Dungeon Meshi (Delicious in Dungeon): earthy, organic survival cooking inside a dungeon. Not epic fantasy, not a modern restaurant. Adventurers cooking monster ingredients over a campfire — warm, practical, slightly chaotic. The palette reflects this: dark warm cave stone, amber torch fire, earthy ingredient greens, alchemical purple for magic moments. These are not decorative choices — they map directly to game states. Torch-orange is action and heat. Verdure green is success and fresh ingredients. Signal red is danger and overheat. Dungeon gold is reward.

This system explicitly rejects four failure modes: the **generic SaaS dashboard** (white card surfaces, muted blue CTAs, clean sterile grids — this is a game on a stage, not a productivity tool); the **streaming overlay aesthetic** (neon on black, OBS-style glowing widget borders — the game has its own visual identity); **cute kawaii** (pastel pinks, bubbly rounded shapes, saccharine sweetness — the kitchen has weight and grit); and **fantasy RPG title screen** (dragon-and-sword tropes, dark purple magic auras, Diablo-style gothic darkness — the dungeon here is where adventurers cook their catch, earthy and practical not epic and ominous).

**Key Characteristics:**
- Dark warm dungeon stone as the base layer; all surfaces warm-tinted, never cold grey
- Broadcast-first scale: 18px absolute minimum for all text, key game elements 22-56px
- Full palette: torch-flame (primary action), verdure (success), arcane (magic/adventure), dungeon-gold (reward)
- Tactile press physics on buttons: hard bottom shadow that collapses on active
- Order tickets as physical parchment artifacts with perforated edges, not UI cards
- Floating feedback text (cook completion, money, cool effects) is the primary animation language


## 2. Colors: The Dungeon Palette

Four named roles plus a rich neutral family. Torch-flame does the heavy lifting; the others are purposeful and rare.

All color tokens are exposed as CSS custom properties in `src/theme.css`: `--accent` (torch-flame), `--accent-deep` (torch-shadow), `--accent-secondary` (verdure), `--accent-tertiary` (arcane), `--accent-gold` (dungeon-gold), plus the full neutral family (`--bg`, `--surface`, `--border`, `--text`, etc.).

### Primary
- **Torch Flame** (`#d87428` / `var(--accent)`): The action color. Every primary CTA, station slot progress fill, Free Play button, step numbering, interactive elements requiring immediate attention. This is fire: use it for things that are active, hot, or urgent.
- **Torch Shadow** (`#8e4e18` / `var(--accent-deep)`): The tactile press shadow under primary buttons (`0 4px 0`). The physical weight of pressing a hot copper pan handle.

### Secondary
- **Monster Verdure** (`#42a05e` / `var(--accent-secondary)`): Success and freshness. Order ticket header at normal patience, serve-confirmation floats, signal for "this is good." The green of dungeon herbs freshly cut from a cave wall.
- **Verdure Deep** (`#2a6e3e` / `var(--accent-secondary-deep)`): Hover and shadow states for verdure surfaces.

### Tertiary
- **Arcane Glimmer** (`#7858cc` / `var(--accent-tertiary)`): Magic and the unusual. Adventure mode button, PvP accents, tutorial highlight pulses. The color of an alchemical vial glowing in the dark.
- **Arcane Deep** (`#4e3a8a` / `var(--accent-tertiary-deep)`): Pressed state and deep shadow for arcane elements.

### Neutral
- **Cave Stone** (`#1a1512` / `var(--bg)`): The deepest background layer. Dungeon corridor floor — nearly black but warm-toned. Never pure black.
- **Cave Dark** (`#141210` / `var(--bg-dark)`): Deeper recesses. Cheatsheet panels, the darkest inset surfaces.
- **Hewn Surface** (`#231e19` / `var(--surface)`): Primary surface. Station cards, dialog panels, the main gameplay surfaces.
- **Worn Surface** (`#2b2520` / `var(--surface-2)`): Secondary surface, slightly lifted. Hover states, inset sub-panels.
- **Inset Surface** (`#242019` / `var(--surface-3)`): A step inside worn. Nested panels, toolbar backgrounds.
- **Recessed** (`#1e1b16` / `var(--surface-4)`): Deeply recessed areas. Orders panel background.
- **Dungeon Crack** (`#3c3228` / `var(--border)`): Border and divider color. The crack between stone blocks.
- **Parchment** (`#f5ead8` / `var(--text)`): Primary text. Aged paper white, warm-tinted. Never pure white.
- **Dim Parchment** (`#d8c9b5` / `var(--text-dim)`): Secondary text, readable but stepped back.
- **Stone Text** (`#a08870` / `var(--text-secondary)`): Tertiary text — labels, secondary descriptions.
- **Worn Text** (`#7a6555` / `var(--text-muted)`): Muted text — hints, placeholders, disabled states.
- **Shadow Text** (`#4e4038` / `var(--text-faint)`): Near-invisible — dividers, faint decorative elements.
- **Dungeon Gold** (`#c4a020` / `var(--accent-gold)` / `var(--text-warm)`): Money, rewards, command key-highlights. The coin-glint color. Appears only on monetary or reward values.
- **Ticket Paper** (`#f0e5c8`): Order ticket body. Aged parchment — a deliberate material contrast to the dark dungeon surfaces behind it.
- **Signal Green** (`#4aa854`): Normal/safe order ticket header, success confirmation.
- **Signal Red** (`#c03830`): Critical order header, overheat title text, alarm state, lost orders stat.
- **Signal Orange** (`#e07030`): Warning order header, heat badge. Between safe and critical.
- **Twitch Purple** (`#9146ff`): Twitch integration surfaces only. Not a brand accent; it belongs to Twitch.

### Named Rules
**The Dungeon Fire Rule.** Torch Flame (`var(--accent)`) is the sole primary action color. One fire color, one meaning. It does not appear on decorative elements.

**The Warm Stone Rule.** Every neutral surface is tinted toward amber. Cold grey is prohibited. If a neutral could pass for a corporate dashboard background, it is wrong.

**The Gold Scarcity Rule.** Dungeon Gold (`var(--accent-gold)`) appears only on money values and reward feedback. Not decorative.


## 3. Typography: Tavern Sign Meets Dungeon Log

**Display Font:** Fredoka (rounded sans-serif, 700 weight) — headlines, button labels, score callouts, game UI announcements
**Headline Font:** Lilita One (bold display cursive) — station labels, order ticket dish names, in-game physical labels, stat numbers in the bottom bar
**Mono Font:** Space Mono (monospace, 400 and 700) — commands, descriptions, status readouts, anything that references typed chat input

**Character:** Fredoka carries the warmth and party-game accessibility of Jackbox: rounded, friendly, reads fast at large sizes. Lilita One gives station cards and order tickets a chalk-board, hand-stamped quality — the weight of a dungeon tavern label. Space Mono anchors the command syntax layer: it says "this is a terminal and your words control the kitchen." Three fonts, three registers: announcement, physical label, instruction.

### Hierarchy
- **Display** (Fredoka, 700, 54–72px, line-height 0.92–1, letter-spacing -1px to -2px): Game title, banner section, shift-end score reveals. Maximum two instances per screen.
- **Headline** (Lilita One, 28–56px): Station names, dish names on order tickets, overheat labels, timer display. The chalk-on-board weight.
- **Title** (Fredoka, 700, 22–30px, line-height 1.2): Mode button labels, section headers, countdown digits. Fredoka announcing something.
- **Body** (Space Mono, 400, 18px, line-height 1.5): Descriptions, command references, chat messages, status text. All gameplay instruction is mono.
- **Label** (Space Mono, 700, 12–14px, letter-spacing 0.02em): Progress bar text, ingredient names, stat bar labels, player name tags. Only permitted below 18px inside components where the player has full spatial context.

### Named Rules
**The Broadcast Scale Rule.** The base font size is 18px (`var(--base-fs)`), non-negotiable. The game is watched on streams at mobile-phone scale. Text below 18px is invisible to the players who matter. `var(--base-fs)` scales to 24px in mobile mode (`data-mobile="true"`).


## 4. Elevation

The system uses a **hybrid** model: flat tonal layering for all static surfaces, structural press shadows on interactive buttons only.

Surface depth is expressed through the warm-dark neutral scale. A station card at Hewn Surface (`#231e19`) reads as elevated above Cave Stone (`#1a1512`) by tonal contrast alone. No ambient shadow required.

Interactive elements break the flat rule deliberately. Primary buttons carry a hard `0 4px 0` bottom shadow in the button's deep shade. On `:active`, the shadow collapses to `0 2px 0` and the button shifts `translateY(2px)`. This tactile press feedback requires no transition animation — the instant state change reads as physical weight.

### Shadow Vocabulary
- **Tactile Press** (`0 4px 0 var(--accent-deep)`): Primary button rest. Collapses to `0 2px 0` on `:active`. Primary buttons only.
- **Arcane Press** (`0 4px 0 var(--accent-tertiary-deep)`): Adventure/PvP button rest. Same mechanics, tertiary color.
- **Orders Count Press** (`0 2px 0 #8e4e18`): Small badge press shadow on the orders count pill.
- **Lift** (`0 4px 14px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.06)`): Order tickets. They float above the dungeon floor.
- **Modal Depth** (`0 20px 50px rgba(0,0,0,0.45)`): Overlay panels hovering above the game layer.
- **Inset Vignette** (`inset 10px 0 30px rgba(0,0,0,0.3)`): Side-shadow vignettes on wide split panels for spatial depth.

### Named Rules
**The Flat Surface Rule.** No ambient box-shadow on cards, stations, or static containers. Tonal contrast handles depth. Shadows are reserved for button press state and floating overlay panels.


## 5. Components

### Buttons

Physical, heavy, dungeon-weight.

- **Shape:** Gently curved (10–12px radius). Not pill-shaped, not sharp-cornered.
- **Primary:** Torch Flame background (`var(--accent)`), Parchment text (`var(--text)`). Fredoka 700, 18–22px. Hard press shadow (`0 4px 0 var(--accent-deep)`). On `:hover`: `filter: brightness(1.1)`, `translateY(-1px)`. On `:active`: `translateY(2px)`, shadow collapses.
- **Ghost/Secondary:** Hewn Surface background, 1.5px Dungeon Crack border, Stone Text. On `:hover`: Worn Surface background.
- **How To Play (demoted):** Transparent background, 1.5px Dungeon Crack border, Worn Text. Ghost variant for secondary navigation.

### Order Tickets (Signature Component)

Physical parchment artifacts in a dungeon world, not UI cards.

- **Material:** Ticket Paper (`#f0e5c8`) — aged parchment against the dark cave stone floor.
- **Shape:** Rounded top corners (8px), square bottom. After the body: a perforated tear strip (radial-gradient punch-holes).
- **Punch hole:** 13px circle in Cave Dark at top-center.
- **Header:** Gradient fill maps to urgency: normal (Signal Green gradient), warning (Signal Orange gradient), critical (Signal Red gradient). Lilita One dish name.
- **Shadow:** Lift shadow — tickets float above the dark surface.
- **No border.** Material contrast between parchment and cave stone is sufficient.

### Station Cards

The primary game-state surface. Up to 12 visible simultaneously; must be scannable at a glance from a stream.

- **Shape:** 10px radius
- **Background:** `var(--station-bg)` = `rgba(35,30,25,0.85)` — slightly translucent stone
- **Border:** 4px solid, dynamically colored by heat: Verdure (cool) → Dungeon Gold (warm) → Signal Orange (hot) → Signal Red (overheated). The border IS the heat gauge.
- **Idle state:** Faint command hint (`!chop <ingredient>`) in Space Mono 14px at `#3a3028`, with `AVAILABLE` label below at 10px. Near-invisible at rest, just enough to orient new players.
- **Slot bars:** 32px height, 7px radius. Progress fill color: Signal Green (0–65%) → Signal Orange (65–85%) → Signal Red (85–100%). Fredoka username + Space Mono ingredient name on the bar.
- **No shadow.** Tonal contrast is sufficient.

### PlaysetPicker Cards

Game mode selection cards with per-playset theme colors.

- **Unselected:** Hewn Surface background, Dungeon Crack border (2px). Header shows flag + name + optional tag badge.
- **Hovered (not selected):** border-color shifts to `var(--card-color)`. Header gets 15% tint of card color via `color-mix`.
- **Selected:** Header fills solid with `var(--card-color)`. Title text inverts to white. Tag badge inverts to dark overlay on white. No glow box-shadow.
- **Card body:** Emoji + name only (no prices, no station labels). Prices live in the bottom breakdown panel.

### Bottom Stats Bar

Stats bar at 56px height. Lilita One 28px for values, Space Mono 12px for labels.

- Money stat: Dungeon Gold (`var(--accent-gold)`)
- Served stat: Verdure (`var(--accent-secondary)`)
- Lost stat: Signal Red (`#c03830`)
- Background: Cave Stone (`var(--bg)`), 2px Dungeon Crack border-top

### Prepped Ingredients Bar

Shows only stocked ingredients (count > 0). Empty state shows "Nothing prepped yet — start cooking!" in italic Space Mono 14px.

- **Filled pills:** Dungeon Gold background tint (`rgba(196,160,32,0.14)`), 2px solid border (`rgba(196,160,32,0.6)`), subtle glow.
- **Empty state:** No pills rendered. Hint text only.

### Inputs / Fields

- **Style:** Dark inset background (`#1e1a14`), 1.5px Dungeon Crack border.
- **Focus:** Border shifts to Torch Flame. No glow.
- **Disabled:** 60% opacity.


## 6. Do's and Don'ts

### Do:
- **Do** use Torch Flame (`var(--accent)`) for every primary interactive action. One fire color, one meaning.
- **Do** size all visible text at 18px minimum (`var(--base-fs)`). Label-scale (12–14px) is permitted only inside space-constrained components.
- **Do** apply the tactile press shadow (`0 4px 0 var(--accent-deep)`) on every primary button.
- **Do** treat order tickets as physical parchment objects: perforated tears, punch holes, aged paper colors.
- **Do** use tonal contrast (warm-dark neutral scale) to convey surface elevation. Shadows for overlays and button press only.
- **Do** make the border the primary station heat indicator. 4px colored border carries more signal than any badge.
- **Do** keep broadcast scale in mind. If a first-time viewer can't read it on a 375px phone watching a stream, it is too small.
- **Do** tint every neutral toward amber. Cold grey surfaces are forbidden.
- **Do** use the CSS custom property family (`var(--accent)`, `var(--accent-secondary)`, etc.) rather than hardcoding hex values.

### Don't:
- **Don't** use `#ffffff` or `#000000` for any surface or text. Cave Dark (`#141210`) is the floor; Parchment (`#f5ead8`) is the ceiling.
- **Don't** make it look like a SaaS dashboard: no white card grids, no muted blue primary buttons, no sterile professional surface language.
- **Don't** make it look like a Twitch streaming overlay: no neon on black, no OBS-widget aesthetic. The game has its own visual world.
- **Don't** make it cute or pastel. The kitchen has weight. If rounded edges start to feel bubbly or sweet, flatten them.
- **Don't** add a fantasy RPG title screen aesthetic: no dark purple magic auras, no gothic Diablo-style darkness, no dragon-and-sword tropes. The dungeon is where adventurers cook, not where heroes fight.
- **Don't** add `border-left` stripes greater than 1px as status accents on cards or list items. Use a full border, a background tint, or a leading icon.
- **Don't** use gradient text (`background-clip: text`). Emphasis is expressed through weight and scale.
- **Don't** use Dungeon Gold (`var(--accent-gold)`) decoratively. It appears on money values and reward feedback only.
- **Don't** use Twitch Purple (`#9146ff`) outside of Twitch integration surfaces.
- **Don't** use identical card grids. Station cards have heat-state borders, progress, and dynamic labels — they are never static same-sized decorative tiles.
