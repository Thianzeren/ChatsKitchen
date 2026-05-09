# Product

## Register

product

## Users

**Streamers**: Broadcast "Let Chat Cook" on Twitch. They set up the game, configure options, and run it visible on stream. The UI is their primary surface — they see it full-screen on their machine but viewers do not.

**Twitch viewers / chat players**: The active participants who type commands (`!chop`, `!grill`, `!serve`) to control the kitchen. They experience the game through the streamer's broadcast window — often cropped, resized, and viewed on mobile. They cannot interact with the UI directly; their only input channel is chat.

**Critical context**: The game screen appears as an OBS capture in streams, not full-screen for viewers. Every piece of text and every interactive element must be readable on a mobile device watching a stream. Default font sizes and component scales should be larger than a typical web app would use.

## Product Purpose

"Let Chat Cook" is a browser-based real-time cooking game where Twitch chat collectively manages a restaurant kitchen inside a dungeon. Players send commands to chop, grill, plate, and serve dishes before the shift timer runs out — together, chaotically, in real time. The game exists at the intersection of streaming entertainment and participatory play.

The world: a makeshift kitchen set up in a torch-lit dungeon corridor. Ingredients are harvested from monsters. The recipes are real food. The chaos is real.

Success looks like: a chat full of people yelling commands, laughing at near-misses, and celebrating a close-run service before the shift ends.

## Brand Personality

Chaotic, warm, alive — with dungeon grit.

The kitchen is always on the verge of disaster and everyone loves it. Energy is high, stakes feel real but never punishing, and the whole thing moves fast. Think Jackbox Party Games: broadcast-friendly, instantly readable, party-room energy — but grounded in a dungeon world (cave stone, torch fire, monster herbs, arcane vials). The aesthetic is Dungeon Meshi: earthy, warm campfire light, adventurer's survival cooking, medieval-adjacent without being precious.

Three words: **frantic, warm, dungeon**.

## Anti-references

- **Generic SaaS dashboard**: No clean white cards, muted blue CTAs, or sterile professional aesthetics. This is not a tool; it's a game on a stage.
- **Streamer overlay / OBS aesthetic**: No neon on black, no glowing widget borders, no "gaming broadcast" visual language. The game has its own identity — it doesn't look like the stream container around it.
- **Cute kawaii / pastel**: No bubbly rounded shapes, saccharine pinks, or soft pastel palettes. The kitchen has weight and grit. Warmth yes, sweetness no.
- **Fantasy RPG title screen**: No dragon-and-sword fantasy tropes, no dark purple magic auras, no Diablo-style gothic darkness. The dungeon here is where adventurers cook their catch — earthy and practical, not epic and ominous.

## Design Principles

1. **Broadcast-first scale**: The UI lives on a stream window, read from mobile. Every text size and tap target must be larger than a typical web app. When in doubt, go bigger.
2. **Controlled chaos, not visual noise**: Lively and energetic, but with clear information hierarchy. Jackbox-rule: even in the middle of chaos, the player knows what's happening and what to do next.
3. **Dungeon world identity**: Visual language belongs in a torch-lit dungeon kitchen — cave stone surfaces, amber fire, earthy warmth, physical weight. Not a modern restaurant, not a fantasy RPG title screen. The reference is Dungeon Meshi: survival cooking by adventurers, grounded and organic.
4. **Command clarity at a glance**: Players act through chat commands. Commands, their results, and status feedback must be instantly scannable even from a secondary screen at reduced size.
5. **Warm urgency, not cute pressure**: The emotional register is dungeon campfire energy — copper and amber, urgency and humor — not pastel friendliness or saccharine reward loops.

## Accessibility & Inclusion

WCAG AA contrast ratios as a baseline. Stream-optimized sizing is a first-class requirement: the game is experienced by many users on small screens at low resolution (mobile viewers watching a stream), not by keyboard-navigating end users. Prioritize legibility and visual contrast over compact layouts.
