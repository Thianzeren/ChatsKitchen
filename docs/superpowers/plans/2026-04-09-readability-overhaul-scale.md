# Readability Overhaul — Aggressive +50% Scale, All Screens, Grow Cards

## Context
The game is used as a Twitch stream overlay and is typically viewed at partial-screen size. Font sizes as low as 8–10px and progress bars of 5px height make critical gameplay info illegible. The goal is a uniform aggressive (~50%) scale-up across all screens, with card/component sizes growing to match.

## Scale Reference
| Old   | New   |
|-------|-------|
| 8px   | 13px  |
| 10px  | 15px  |
| 11px  | 16px  |
| 12px  | 16px  |
| 13px  | 18px  |
| 14px  | 20px  |
| 15px  | 22px  |
| 16px  | 22px  |
| 18px  | 24px  |
| 22px  | 30px  |
| 24px  | 32px  |

---

## Files to Change

### 1. `src/components/Station.module.css`
**Font sizes:**
- `.label`: 14px → 20px
- `.idleStatus`, `.fireStatus`: 12px → 16px
- `.slotUser`, `.slotItem`, `.slotStatus`, `.fireSlotStatus`, `.capacity`: 10px → 15px
- `.burnLabel`: 8px → 13px

**Card & layout sizing:**
- `.station` min-width: 170px → 220px
- `.station` padding: 6px → 10px
- `.slot` padding: 3px → 6px
- `.slotOnFire` padding: 3px → 6px
- `.slots` gap: 4px → 8px
- Progress bar height: 8px → 14px
- Burn bar height: 5px → 10px

---

### 2. `src/components/OrderTicket.module.css`
**Font sizes:**
- `.dishName`: 15px → 22px
- `.orderNum`: 14px → 20px
- `.ingredientName`: 10px → 15px
- `.ingredientEmoji`: 14px → 20px

**Card & layout sizing:**
- `.ticket` width: 150px → 190px
- `.ingredients` gap: 2px → 4px
- `.ingredientRow` gap: 6px → 10px
- `.header` padding: 6px 10px → 8px 14px
- `.body` padding: 8px 10px 6px → 10px 14px 8px
- Patience bar height: 5px → 10px

---

### 3. `src/components/PreparedItems.module.css`
**Font sizes:**
- `.toggle`: 10px → 15px
- `.count`: 12px → 16px
- `.name`: 10px → 15px
- `.divider`: 16px → 22px (consistent with other dividers)

**Layout sizing:**
- `.prep` padding: 6px 20px → 8px 24px
- `.items` gap: 8px → 12px

---

### 4. `src/components/AssemblyArea.module.css`
**Font sizes:**
- `.platingUser`, `.platingDish`, `.platingStatus`, `.emptyLabel`: 10px → 15px
- `.doneDish`: 13px → 18px
- `.platingDivider`: 16px → 22px

**Card & layout sizing:**
- `.platingSlot` min-width: 160px → 200px
- `.platingSlot` padding: 8px 12px → 10px 16px
- `.platingSlots` gap: 8px → 12px
- `.platingInfo` gap: 3px → 6px
- `.platingHeader` gap: 6px → 10px
- Plating progress bar height: 8px → 14px

---

### 5. `src/App.module.css`
**Font sizes:**
- `.header h1`: 24px → 32px
- `.levelIndicator`: 12px → 16px
- `.muteToggle`, `.chatToggle`, `.botToggle`, `.exitBtn`: 12px → 16px
- `.twitchIndicator`: 11px → 15px

**Layout sizing:**
- `.header` padding: 8px 20px → 10px 24px
- `.headerButtons` gap: 8px → 12px
- Button padding: 6px 14px → 8px 18px

---

### 6. `src/components/InfoBar.module.css`
**Font sizes:**
- `.toggle`: 12px → 16px
- `.sectionTitle`: 13px → 18px
- `.commands`, `.recipe`: 11px → 16px
- `.hint`: 10px → 15px

**Layout:**
- `.toggle` padding: 8px 20px → 10px 24px
- `.section` padding: 0 16px → 0 20px
- `.recipe` gap: 8px → 12px

---

### 7. `src/components/StatsBar.module.css`
**Font sizes:**
- Primary value (money/served/lost/timer): 22px → 30px
- Stat labels: 13px → 18px

---

### 8. `src/components/Kitchen.module.css`
**Font sizes:**
- `.divider`: 16px → 22px

**Layout:**
- Station gap: 8px → 12px

---

### 9. `src/components/DiningRoom.module.css`
**Font sizes:**
- `.divider`: 16px → 22px
- `.empty`: 13px → 18px

---

### 10. `src/components/ChatPanel.module.css`
**Font sizes:**
- Messages: 13px → 18px
- Header: 14px → 20px

**Layout:**
- Panel width: 280px → 340px

---

### 11. Menu/UI screens — minor bumps (already well-sized)
These screens are already at reasonable sizes. Apply a lighter touch (+1 size tier on small text only):

**`src/components/GameOver.module.css`**
- `.lbHeader` span: 10px → 14px
- `.lbRank`, `.lbName`, `.lbDetail`: 12px → 16px
- `.lbTotal`: 12px → 16px
- Leaderboard width: 560px → 680px

**`src/components/Countdown.module.css`**
- Small text (toggle, hints): 10–12px → 15–16px

**`src/components/OptionsScreen.module.css`**
- Small labels and hints: 10–12px → 15–16px

---

## Layout Impact Notes
- Station cards growing from 170→220px means 6 stations = 1320px min-width. On narrower viewports they will wrap to two rows — this is acceptable and actually improves readability per row.
- Order tickets growing from 150→190px. DiningRoom uses a horizontal scroll row so this is safe.
- No mobile breakpoint changes needed in this pass — the mobile overrides will naturally be overridden by larger base values.

## Critical Files (touches 13 CSS modules total)
- `src/components/Station.module.css` — most impactful
- `src/components/OrderTicket.module.css`
- `src/components/PreparedItems.module.css`
- `src/components/AssemblyArea.module.css`
- `src/App.module.css`
- `src/components/InfoBar.module.css`
- `src/components/StatsBar.module.css`
- `src/components/Kitchen.module.css`
- `src/components/DiningRoom.module.css`
- `src/components/ChatPanel.module.css`
- `src/components/GameOver.module.css`
- `src/components/Countdown.module.css`
- `src/components/OptionsScreen.module.css`

## Verification
1. `npm run build` — must pass with no type errors
2. Open gameplay screen — station cards, order tickets, and prepared items should all be visibly larger
3. Check that 6 stations still render reasonably (may wrap to 2 rows at narrow viewport)
4. Check InfoBar (command reference) is legible
5. Open GameOver screen — leaderboard should fit wider layout
6. Check Options and menu screens for text size consistency
