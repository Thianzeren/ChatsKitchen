# Product

## Register

product

## Users

**Streamers**: Broadcast "Let Chat Cook" on Twitch. They set up the game, configure options, and run it visible on stream. The UI is their primary surface — they see it full-screen on their machine but viewers do not.

**Twitch viewers / chat players**: The active participants who type commands (`!chop`, `!grill`, `!serve`) to control the kitchen. They experience the game through the streamer's broadcast window — often cropped, resized, and viewed on mobile. They cannot interact with the UI directly; their only input channel is chat.

**Critical context**: The game screen appears as an OBS capture in streams, not full-screen for viewers. Every piece of text and every interactive element must be readable on a mobile device watching a stream. Default font sizes and component scales should be larger than a typical web app would use.

## Product Purpose

"Let Chat Cook" is a browser-based real-time cooking game where Twitch chat collectively manages a restaurant kitchen. Players send commands to chop, grill, plate, and serve dishes before the shift timer runs out — together, chaotically, in real time. The game exists at the intersection of streaming entertainment and participatory play.

Success looks like: a chat full of people yelling commands, laughing at near-misses, and celebrating a close-run service before the shift ends.

## Brand Personality

Chaotic, warm, alive.

The kitchen is always on the verge of disaster and everyone loves it. Energy is high, stakes feel real but never punishing, and the whole thing moves fast. Think Jackbox Party Games: broadcast-friendly, instantly readable, party-room energy — but grounded in a physical kitchen world (copper, fire, steam, weight).

## Anti-references

- **Generic SaaS dashboard**: No clean white cards, muted blue CTAs, or sterile professional aesthetics. This is not a tool; it's a game on a stage.
- **Streamer overlay / OBS aesthetic**: No neon on black, no glowing widget borders, no "gaming broadcast" visual language. The game has its own identity — it doesn't look like the stream container around it.

## Design Principles

1. **Broadcast-first scale**: The UI lives on a stream window, read from mobile. Every text size and tap target must be larger than a typical web app. When in doubt, go bigger.
2. **Controlled chaos, not visual noise**: Lively and energetic, but with clear information hierarchy. Jackbox-rule: even in the middle of chaos, the player knows what's happening and what to do next.
3. **Kitchen world identity**: Visual language belongs in a restaurant kitchen — copper, fire, warmth, weight. Not a game controller, not an office dashboard, not a streaming widget.
4. **Command clarity at a glance**: Players act through chat commands. Commands, their results, and status feedback must be instantly scannable even from a secondary screen at reduced size.
5. **Warm urgency, not cute pressure**: The emotional register is hot kitchen energy — copper and amber, urgency and humor — not pastel friendliness or saccharine reward loops.

## Accessibility & Inclusion

WCAG AA contrast ratios as a baseline. Stream-optimized sizing is a first-class requirement: the game is experienced by many users on small screens at low resolution (mobile viewers watching a stream), not by keyboard-navigating end users. Prioritize legibility and visual contrast over compact layouts.
