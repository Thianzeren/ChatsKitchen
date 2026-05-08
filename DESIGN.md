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

The palette draws from dungeon ecology: the dark warm stone of cave walls, the amber of cook-fires, the vivid green of fresh monster herbs, the purple of alchemical vials. These are not decorative choices — they map directly to game states. Torch-orange is action and heat. Verdure green is success and fresh ingredients. Signal red is danger and overheat. Dungeon gold is reward. The dungeon has a visual vocabulary and every screen uses it.

This system explicitly rejects two failure modes: the **generic SaaS dashboard** (white card surfaces, muted blue CTAs, clean sterile grids — this is a game on a stage, not a project management tool) and the **streaming overlay aesthetic** (neon on black, OBS-style glowing widget borders, Twitch-extension-panel energy — the game has its own identity and does not look like the stream container around it).

**Key Characteristics:**
- Dark warm dungeon stone as the base layer; all surfaces warm-tinted, never cold grey
- Broadcast-first scale: 18px absolute minimum for all text, key game elements 22-54px
- Full palette: torch-flame (primary action), verdure (success), arcane (magic/adventure), dungeon-gold (reward)
- Tactile press physics on buttons: hard bottom shadow that collapses on active
- Order tickets as physical parchment artifacts with perforated edges, not UI cards
- Floating feedback text (cook completion, money, cool effects) is the primary animation language


## 2. Colors: The Dungeon Palette

Four named roles plus a rich neutral family. Torch-flame does the heavy lifting; the others are purposeful and rare.

### Primary
- **Torch Flame** (`#d87428`): The action color. Every primary CTA, station slot progress fill, Free Play button, step numbering, interactive elements requiring immediate attention. This is fire: use it for things that are active, hot, or urgent.
- **Torch Shadow** (`#8e4e18`): The tactile press shadow under primary buttons (`0 4px 0`). The physical weight of pressing a hot copper pan handle.

### Secondary
- **Monster Verdure** (`#42a05e`): Success and freshness. Order ticket header at normal patience, serve-confirmation floats, signal for "this is good." The green of dungeon herbs freshly cut from a cave wall.
- **Verdure Deep** (`#2a6e3e`): Hover and shadow states for verdure surfaces.

### Tertiary
- **Arcane Glimmer** (`#7858cc`): Magic and the unusual. Adventure mode button, PvP accents, tutorial highlight pulses. The color of an alchemical vial glowing in the dark.
- **Arcane Deep** (`#4e3a8a`): Pressed state and deep shadow for arcane elements.

### Neutral
- **Cave Stone** (`#1a1512`): The deepest background layer. Dungeon corridor floor — nearly black but warm-toned. Never pure black.
- **Cave Dark** (`#141210`): Deeper recesses. Cheatsheet panels, the darkest inset surfaces behind surfaces.
- **Hewn Surface** (`#231e19`): Primary surface. Station cards, dialog panels, the main gameplay surfaces.
- **Worn Surface** (`#2b2520`): Secondary surface, slightly lifted. Hover states, inset sub-panels.
- **Inset Surface** (`#242019`): A step inside worn. Nested panels, inset input backgrounds.
- **Recessed** (`#1e1b16`): Deeply recessed areas behind active surfaces.
- **Dungeon Crack** (`#3c3228`): Border and divider color. The crack between stone blocks.
- **Parchment** (`#f5ead8`): Primary text. Aged paper white, warm-tinted. Never pure white.
- **Dim Parchment** (`#d8c9b5`): Secondary text, readable but stepped back.
- **Stone Text** (`#a08870`): Tertiary text — labels, secondary descriptions, metadata.
- **Worn Text** (`#7a6555`): Muted text — hints, placeholders, disabled states.
- **Shadow Text** (`#4e4038`): Near-invisible — dividers, faint decorative elements.
- **Dungeon Gold** (`#c4a020`): Money, rewards, command key-highlights in the cheatsheet. The coin-glint color. Appears only on actual monetary or reward values.
- **Ticket Paper** (`#f0e5c8`): Order ticket body. Aged parchment — a deliberate material contrast to the dark dungeon surfaces behind it.
- **Signal Green** (`#4aa854`): Normal/safe order ticket header, success confirmation.
- **Signal Red** (`#c03830`): Critical order header, overheat title text, alarm state.
- **Signal Orange** (`#e07030`): Warning order header, heat badge. Between safe and critical.
- **Twitch Purple** (`#9146ff`): Twitch integration surfaces only — the connect card, channel status indicator. Not a brand accent; it belongs to Twitch.

### Named Rules
**The Dungeon Fire Rule.** Torch Flame (`#d87428`) is the sole primary action color. It appears on primary buttons, progress fills, and step numbers. When something demands immediate player action, it is this color. It does not appear on decorative elements.

**The Warm Stone Rule.** Every neutral surface is tinted toward amber. Cave Stone (`#1a1512`) is the floor; cold grey is prohibited. If a neutral could pass for a corporate dashboard background, it is wrong.

**The Gold Scarcity Rule.** Dungeon Gold (`#c4a020`) appears only on game currency values and reward feedback. Not on buttons, not on borders, not as a general accent. Its rarity makes money feel real.


## 3. Typography: Tavern Sign Meets Dungeon Log

**Display Font:** Fredoka (rounded sans-serif, 700 weight) — headlines, button labels, score callouts, game UI announcements
**Headline Font:** Lilita One (bold display cursive) — station labels, order ticket dish names, in-game physical labels
**Mono Font:** Space Mono (monospace, 400 and 700) — commands, descriptions, status readouts, anything that references typed chat input

**Character:** Fredoka carries the warmth and party-game accessibility of Jackbox: rounded, friendly, reads fast at large sizes. Lilita One gives station cards and order tickets a chalk-board, hand-stamped quality — the weight of a kitchen label. Space Mono anchors the command syntax layer: it says "this is a terminal and your words control the kitchen." Three fonts, three registers: announcement, physical label, instruction.

### Hierarchy
- **Display** (Fredoka, 700, 54px, line-height 1, letter-spacing -1px): Game title, shift-end score reveals. Maximum two instances per screen.
- **Headline** (Lilita One, 28px, line-height 1.1): Station names, dish names on order tickets, overheat alert labels. The chalk-on-board weight.
- **Title** (Fredoka, 700, 22-30px, line-height 1.2): Mode button labels, section headers, countdown digits. Fredoka announcing something.
- **Body** (Space Mono, 400, 18px, line-height 1.5): Descriptions, command references, chat messages, status text. All gameplay instruction is mono.
- **Label** (Space Mono, 700, 14px, letter-spacing 0.02em): Progress bar text, ingredient names, reward amounts, player name tags. Only permitted below 18px inside components where the player has full spatial context.

### Named Rules
**The Broadcast Scale Rule.** The base font size is 18px, not 14-16px. The game is watched on streams at mobile-phone scale. Text below 18px is invisible to the players who matter. When in doubt, go bigger.


## 4. Elevation

The system uses a **hybrid** model: flat tonal layering for all static surfaces, structural press shadows on interactive buttons only.

Surface depth is expressed through the warm-dark neutral scale. A station card at Hewn Surface (`#231e19`) reads as elevated above Cave Stone (`#1a1512`) by tonal contrast alone. No ambient shadow required. Adding shadows to static surfaces muddies the dark environment and creates visual noise that competes with the game state information.

Interactive elements break the flat rule deliberately. Primary buttons carry a hard `0 4px 0` bottom shadow in the button's deep shade. On `:active`, the shadow collapses to `0 2px 0` and the button shifts `translateY(2px)`. This tactile press feedback requires no transition animation — the instant state change reads as physical weight. It is the only decorative shadow in the system.

### Shadow Vocabulary
- **Tactile Press** (`0 4px 0 #8e4e18`): Primary button rest. Collapses to `0 2px 0` on `:active`. Primary buttons only.
- **Arcane Press** (`0 4px 0 #4e3a8a`): Adventure/PvP button rest. Same mechanics, tertiary color.
- **Lift** (`0 4px 14px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.06)`): Order tickets. They float above the dungeon floor.
- **Modal Depth** (`0 20px 50px rgba(0,0,0,0.45)`): Overlay panels (pause, event cards) hovering above the game layer.
- **Inset Vignette** (`inset 10px 0 30px rgba(0,0,0,0.3)`): Side-shadow vignettes on wide split panels for spatial depth.

### Named Rules
**The Flat Surface Rule.** No ambient box-shadow on cards, stations, or static containers. Tonal contrast handles depth. Shadows are reserved for button press state and floating overlay panels.


## 5. Components

### Buttons

Physical, heavy, dungeon-weight. A button in this system feels like pressing a lever on kitchen equipment, not tapping a touchscreen element.

- **Shape:** Gently curved (10-12px radius). Not pill-shaped, not sharp-cornered. The radius of a worn kitchen handle.
- **Primary:** Torch Flame background (`#d87428`), Parchment text (`#f5ead8`). Fredoka 700, 18-22px. Padding 14px vertical, 28px+ horizontal. Hard press shadow (`0 4px 0 #8e4e18`). On `:hover`: `filter: brightness(1.1)`, `translateY(-1px)`. On `:active`: `translateY(2px)`, shadow `0 2px 0 #8e4e18`.
- **Ghost/Secondary:** Hewn Surface background, 1.5px Dungeon Crack border, Stone Text. On `:hover`: Worn Surface background, border lightens.
- **Danger:** Signal Red background (`#c03830`), Parchment text. Same press mechanics.
- **Featured (large mode buttons):** Fills the available height of its container. Arrow glyph at right, 30-40% opacity. Name in Title scale, description in Body scale below.

### Order Tickets (Signature Component)

The most distinctive component. Physical parchment artifacts in a dungeon world, not UI cards.

- **Material:** Ticket Paper (`#f0e5c8`) — aged parchment against the dark cave stone floor.
- **Shape:** Rounded top corners (8px), square bottom. After the body: a perforated tear strip simulated by `radial-gradient` punch-holes (`background-image: radial-gradient(circle, Cave Dark 3.5px, transparent 3.5px)`).
- **Punch hole:** 13px circle in Cave Dark at top-center, simulating a physical hanging clip.
- **Header:** Gradient fill maps to urgency: normal (Signal Green gradient), warning (Signal Orange gradient), critical (Signal Red gradient). Lilita One dish name.
- **Shadow:** Lift shadow — tickets float above the dark surface.
- **No border.** Material contrast between parchment and cave stone is sufficient.

### Station Cards

The primary game-state surface. Twelve of them may be visible simultaneously; they must be scannable at a glance from a stream.

- **Shape:** 10px radius
- **Background:** `rgba(35, 30, 25, 0.85)` — slightly translucent stone, readable against any backdrop
- **Border:** 4px solid, dynamically colored by heat: Verdure (cool) → Dungeon Gold (warm) → Signal Orange (hot) → Signal Red (overheated). The border IS the heat gauge.
- **No shadow.** Tonal contrast from the game background is sufficient.
- **Label:** Lilita One for station name, Space Mono for capacity and status.
- **Internal padding:** 10px compact. Density is a feature.

### Progress Bars (Slot Bars)

A cook-in-progress indicator. The bar is the command being executed.

- **Shape:** 7px radius, 32px height — large enough to carry two text elements
- **Background:** `rgba(0,0,0,0.45)` — a dark inset in the stone
- **Fill:** Color varies by recipe/ingredient
- **Text on bar:** Fredoka bold username + Space Mono ingredient, side-by-side. Text shadow for legibility over any fill color.

### Inputs / Fields

- **Style:** Dark inset background (`#1e1a14`), 1.5px Dungeon Crack border. The input is a slot cut into stone.
- **Focus:** Border color shifts to Torch Flame (text input) or Arcane (search/special). No glow, no halo — border color alone.
- **Disabled:** 60% opacity.
- **Typography:** Fredoka for user-facing input, Space Mono where the input accepts commands.

### Chat Panel

The Twitch command feed. Not a conventional messaging UI — it's the dungeon scroll where commands appear.

- **Background:** Cave Dark, one step below the main surface layer.
- **Messages:** Space Mono. Username in team or station-assigned color; command text in Dim Parchment.
- **Local input:** Standard input field at bottom, Fredoka font.


## 6. Do's and Don'ts

### Do:
- **Do** use Torch Flame (`#d87428`) for every primary interactive action and station progress fill. One fire color, one meaning. Its consistency is what makes it a signal.
- **Do** size all visible text at 18px minimum. Label-scale (14px) is permitted only inside components where the player already has full spatial context (a progress bar's inline labels).
- **Do** apply the tactile press shadow (`0 4px 0`) on every primary button. The physical collapse on `:active` is part of the game's kitchen identity.
- **Do** treat order tickets as physical parchment objects: perforated tears, punch holes, aged paper colors. They are artifacts encountered in the world, not UI cards.
- **Do** use tonal contrast (warm-dark neutral scale) to convey surface elevation. Reserve shadows for overlay panels and button press state only.
- **Do** make the border the primary station heat indicator. A 4px colored border carries more immediate signal than any badge or overlay could.
- **Do** keep broadcast scale in mind at every decision. If a first-time viewer can't read it on a 375px phone watching a stream, it is too small.
- **Do** tint every neutral toward amber. Cold grey surfaces are forbidden. Check: would this neutral pass for a SaaS dashboard? If yes, add warmth.

### Don't:
- **Don't** use `#ffffff` or `#000000` for any surface, text, or border. Cave Dark (`#141210`) is the floor; Parchment (`#f5ead8`) is the ceiling.
- **Don't** make it look like a generic SaaS dashboard: no white card grids, no muted blue primary buttons, no sterile professional surface language. This is a dungeon kitchen. It should look and feel like one.
- **Don't** make it look like a Twitch streaming overlay: no neon on black, no glowing border widgets, no OBS-extension aesthetic. The game has its own visual world.
- **Don't** add `border-left` stripes greater than 1px as status accents on cards or list items. Use a full border, a background tint, or a leading icon instead.
- **Don't** use gradient text (`background-clip: text`). Emphasis is expressed through weight and scale, not paint effects.
- **Don't** use Dungeon Gold (`#c4a020`) decoratively. It appears on money values and reward feedback only. Using it as a general accent dilutes the signal.
- **Don't** use Twitch Purple (`#9146ff`) outside of Twitch integration surfaces. It is Twitch's color, not this game's.
- **Don't** make it cute or pastel. The kitchen has weight. If rounded edges start to feel bubbly or sweet, flatten them.
- **Don't** use identical card grids. Station cards have heat-state borders, progress, and dynamic labels. They are never static same-sized decorative tiles.
