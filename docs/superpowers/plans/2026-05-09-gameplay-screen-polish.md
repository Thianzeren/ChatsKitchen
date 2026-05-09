# Gameplay Screen Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish four gameplay screen areas — PreparedItems stocked-only filter, Station idle command hints, BottomBar dungeon colours, DiningRoom palette alignment.

**Architecture:** Pure CSS and minimal JSX changes across 7 files. No logic, state, props, or game mechanics are modified. Each task is self-contained and independently verifiable.

**Tech Stack:** React 18, TypeScript, CSS Modules, Vite 5. No test framework — verification is `npm run build` + visual inspection at `http://localhost:5174/`.

---

## Files

| File | Task |
|------|------|
| `src/components/PreparedItems.tsx` | 1 |
| `src/components/PreparedItems.module.css` | 1 |
| `src/components/Station.tsx` | 2 |
| `src/components/Station.module.css` | 2 |
| `src/components/BottomBar.tsx` | 3 |
| `src/components/BottomBar.module.css` | 3 |
| `src/components/DiningRoom.module.css` | 4 |

---

### Task 1: PreparedItems — stocked-only filter + bigger pills

**Files:**
- Modify: `src/components/PreparedItems.tsx`
- Modify: `src/components/PreparedItems.module.css`

- [ ] **Step 1: Add stocked-only filter in `PreparedItems.tsx`**

  In `src/components/PreparedItems.tsx`, find the `counts` computation block (around line 35). After it, add the `stockedIngredients` filter:

  ```tsx
  const counts: Record<string, number> = {}
  for (const item of items) {
    counts[item] = (counts[item] || 0) + 1
  }

  // NEW: only items with at least one unit prepped
  const stockedIngredients = visibleIngredients.filter(item => (counts[item] || 0) > 0)
  ```

- [ ] **Step 2: Replace solo render with stocked-only + empty state**

  In the solo mode render (the `return` block that is NOT inside `if (pvpMode && ...)`) find the section that renders the items grid. It currently renders `visibleIngredients.map(...)`. Replace that entire items section with:

  ```tsx
  {stockedIngredients.length === 0 ? (
    <div className={styles.emptyHint}>Nothing prepped yet — start cooking!</div>
  ) : (
    <div className={`${styles.items} ${showNames ? styles.itemsWithNames : styles.itemsCompact}`}>
      {stockedIngredients.map(item => {
        const count = counts[item] || 0
        const filled = count > 0
        return (
          <div key={item} className={`${styles.tray} ${filled ? styles.trayFilled : styles.trayEmpty}`}>
            <FoodIcon icon={INGREDIENT_EMOJI[item] || '?'} size={22} className={styles.emoji} />
            {showNames && <span className={styles.name}>{item.replace(/_/g, ' ')}</span>}
            <span className={styles.count}>×{count}</span>
          </div>
        )
      })}
    </div>
  )}
  ```

  Note: The `trayEmpty` branch can never be reached in this render (since `stockedIngredients` only contains items with count > 0), but the ternary keeps the tray structure consistent and avoids type errors.

- [ ] **Step 3: Update palette and sizing in `PreparedItems.module.css`**

  Apply these changes to `src/components/PreparedItems.module.css`:

  **Change `.prep` border-bottom:**
  ```css
  .prep {
    padding: 8px 48px 8px 12px;
    border-bottom: 2px solid rgba(216, 116, 40, 0.2);
    flex-shrink: 0;
  }
  ```

  **Change `.trayFilled`:**
  ```css
  .trayFilled {
    background: rgba(196, 160, 32, 0.14);
    border: 2px solid rgba(196, 160, 32, 0.6);
    box-shadow: 0 0 8px rgba(196, 160, 32, 0.1);
  }
  ```

  **Change `.emoji` size:**
  ```css
  .emoji {
    font-size: 28px;
    line-height: 1;
    flex-shrink: 0;
  }
  ```

  **Change `.tray` padding:**
  ```css
  .tray {
    display: flex;
    align-items: center;
    gap: 7px;
    border-radius: 10px;
    padding: 8px 12px 8px 10px;
    transition: background 0.2s, border-color 0.2s, opacity 0.2s;
  }
  ```

  **Change `.pvpDivider` background:**
  ```css
  .pvpDivider {
    width: 1px;
    background: rgba(216, 116, 40, 0.15);
    margin: 0 12px;
    flex-shrink: 0;
  }
  ```

  **Add `.emptyHint` (new class)** — insert after `.trayEmpty`:
  ```css
  .emptyHint {
    font-family: 'Space Mono', monospace;
    font-size: 14px;
    color: #4e4038;
    font-style: italic;
    padding: 4px 2px;
  }
  ```

- [ ] **Step 4: Verify build**

  ```bash
  cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen" && npm run build 2>&1 | tail -5
  ```

  Expected: `✓ built in` with no type errors.

- [ ] **Step 5: Verify visually**

  Start the game (Free Play → Western Diner → Let's Cook). The PreparedItems bar should show "Nothing prepped yet — start cooking!" with no ingredient pills. Type `!chop lettuce` in the local chat input; after cooking completes a "Chopped Lettuce ×1" pill should appear with the dungeon-gold border glow.

- [ ] **Step 6: Commit**

  ```bash
  cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen" && git add src/components/PreparedItems.tsx src/components/PreparedItems.module.css && git commit -m "$(cat <<'EOF'
  feat(PreparedItems): show only stocked ingredients, larger pills, empty hint

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 2: Station — idle command hint + bar and border colours

**Files:**
- Modify: `src/components/Station.tsx`
- Modify: `src/components/Station.module.css`

- [ ] **Step 1: Update `barColor` in `SlotRow` to dungeon palette**

  In `src/components/Station.tsx`, find the `SlotRow` function (~line 15). The `barColor` variable currently reads:

  ```tsx
  const barColor = progress > 0.85
    ? 'rgba(217,79,79,0.55)'
    : progress > 0.65
      ? 'rgba(232,148,58,0.55)'
      : 'rgba(92,184,92,0.42)'
  ```

  Replace with:

  ```tsx
  const barColor = progress > 0.85
    ? 'rgba(192, 56, 48, 0.6)'
    : progress > 0.65
      ? 'rgba(224, 112, 48, 0.6)'
      : 'rgba(66, 160, 94, 0.55)'
  ```

- [ ] **Step 2: Update `heatBorderColor` to dungeon palette**

  In `src/components/Station.tsx`, find the `heatBorderColor` function (~line 53):

  ```tsx
  function heatBorderColor(heat: number, overheated: boolean): string {
    if (overheated) return '#cc2200'
    if (heat > 70)  return '#e07030'
    if (heat > 40)  return '#d4c43a'
    return '#42a05e'
  }
  ```

  Replace with:

  ```tsx
  function heatBorderColor(heat: number, overheated: boolean): string {
    if (overheated) return '#c03830'
    if (heat > 70)  return '#e07030'
    if (heat > 40)  return '#c4a020'
    return '#42a05e'
  }
  ```

- [ ] **Step 3: Replace idle text with command hint JSX**

  In `src/components/Station.tsx`, find the idle state render (~line 148):

  ```tsx
  } : station.slots.length === 0 ? (
    <div className={styles.idleStatus}>idle</div>
  ) : (
  ```

  Replace with:

  ```tsx
  } : station.slots.length === 0 ? (
    <div className={styles.idleStatus}>
      <div className={styles.idleCmd}>!{def.actions[0]} &lt;ingredient&gt;</div>
      <div className={styles.idleHint}>available</div>
    </div>
  ) : (
  ```

- [ ] **Step 4: Update CSS in `Station.module.css`**

  **Update `.idleStatus`** — change from single-line text to a container:

  ```css
  .idleStatus {
    text-align: center;
    padding: 8px 4px;
  }
  ```

  **Add `.idleCmd`** (new — insert after `.idleStatus`):

  ```css
  .idleCmd {
    font-family: 'Space Mono', monospace;
    font-size: 14px;
    color: #3a3028;
    letter-spacing: 0.3px;
  }
  ```

  **Add `.idleHint`** (new — insert after `.idleCmd`):

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

- [ ] **Step 5: Verify build**

  ```bash
  cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen" && npm run build 2>&1 | tail -5
  ```

  Expected: `✓ built in` with no type errors.

- [ ] **Step 6: Verify visually**

  Start the game. Each idle station should show `!chop <ingredient>` (or `!grill`, `!fry`, `!toast`) in very faint text with `AVAILABLE` below. The text should be barely visible — dark grey on dark background — not competing with active slot content.

- [ ] **Step 7: Commit**

  ```bash
  cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen" && git add src/components/Station.tsx src/components/Station.module.css && git commit -m "$(cat <<'EOF'
  style(Station): idle command hint, dungeon palette bar and heat colours

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3: BottomBar — taller, dungeon colours, bigger numbers

**Files:**
- Modify: `src/components/BottomBar.tsx`
- Modify: `src/components/BottomBar.module.css`

- [ ] **Step 1: Update stat colours in `BottomBar.tsx`**

  In `src/components/BottomBar.tsx`, find the three `style={{ color: ... }}` inline values on the stat value spans and update them:

  ```tsx
  <span className={styles.value} style={{ color: '#c4a020' }}>${money}</span>
  ```
  ```tsx
  <span className={styles.value} style={{ color: '#42a05e' }}>{served}</span>
  ```
  ```tsx
  <span className={styles.value} style={{ color: '#c03830' }}>{lost}</span>
  ```

- [ ] **Step 2: Update CSS in `BottomBar.module.css`**

  Apply all of these changes to `src/components/BottomBar.module.css`:

  **`.bar`:**
  ```css
  .bar {
    height: 56px;
    background: #1a1512;
    border-top: 2px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 0;
    flex-shrink: 0;
  }
  ```

  **`.value`:**
  ```css
  .value {
    font-family: 'Lilita One', cursive;
    font-size: 28px;
    line-height: 1;
  }
  ```

  **`.label`:**
  ```css
  .label {
    font-family: 'Space Mono', monospace;
    font-size: 12px;
    color: #7a6555;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  ```

  **`.divider`:**
  ```css
  .divider {
    width: 1px;
    height: 28px;
    background: var(--border);
    flex-shrink: 0;
  }
  ```

  **`.hint`:**
  ```css
  .hint {
    font-family: 'Space Mono', monospace;
    font-size: var(--base-fs);
    color: #4e4038;
  }
  ```

- [ ] **Step 3: Verify build**

  ```bash
  cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen" && npm run build 2>&1 | tail -5
  ```

  Expected: `✓ built in` with no type errors.

- [ ] **Step 4: Commit**

  ```bash
  cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen" && git add src/components/BottomBar.tsx src/components/BottomBar.module.css && git commit -m "$(cat <<'EOF'
  style(BottomBar): dungeon palette colours, taller bar, larger stat numbers

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 4: DiningRoom — orders panel palette alignment

**Files:**
- Modify: `src/components/DiningRoom.module.css`

- [ ] **Step 1: Update `.dining` block**

  Find `.dining` (~line 6). Change `background` and `border-right`:

  ```css
  .dining {
    width: 260px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface-4);
    border-right: 3px solid var(--border);
  }
  ```

- [ ] **Step 2: Update `.timeBlock`**

  Find `.timeBlock` (~line 17):

  ```css
  .timeBlock {
    background: linear-gradient(180deg, #231e19 0%, #1a1512 100%);
    border-bottom: 2px solid var(--border);
    padding: 10px 12px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
  }
  ```

- [ ] **Step 3: Update `.timeLabel`, `.timeValue`, and `.urgent`**

  Find `.timeLabel` and replace `color`:
  ```css
  .timeLabel {
    font-family: 'Space Mono', monospace;
    font-size: var(--base-fs);
    color: #d87428;
    text-transform: uppercase;
    letter-spacing: 2px;
  }
  ```

  Find `.timeValue` and update `text-shadow`:
  ```css
  .timeValue {
    font-family: 'Lilita One', cursive;
    font-size: 52px;
    color: #c4a020;
    text-shadow: 0 0 24px rgba(196, 160, 32, 0.35);
    line-height: 1;
  }
  ```

  Find `.urgent` and update both `color` and `text-shadow`:
  ```css
  .urgent {
    color: #c03830 !important;
    animation: tick-pulse 0.5s ease-in-out infinite alternate;
    text-shadow: 0 0 24px rgba(192, 56, 48, 0.5) !important;
  }
  ```

- [ ] **Step 4: Update `.ordersHeader`, `.ordersTitle`, `.ordersCount`, `.viewToggle`**

  Find `.ordersHeader`:
  ```css
  .ordersHeader {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--surface-3);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  ```

  Find `.ordersTitle`:
  ```css
  .ordersTitle {
    font-family: 'Lilita One', cursive;
    font-size: 20px;
    color: var(--text);
  }
  ```

  Find `.ordersCount`:
  ```css
  .ordersCount {
    background: #d87428;
    color: #f5ead8;
    font-family: 'Lilita One', cursive;
    font-size: var(--base-fs);
    border-radius: 12px;
    padding: 1px 11px;
    min-width: 28px;
    text-align: center;
    box-shadow: 0 2px 0 #8e4e18;
  }
  ```

  Find `.viewToggle:hover`:
  ```css
  .viewToggle:hover {
    color: #d87428;
    background: rgba(216, 116, 40, 0.08);
    border-color: rgba(216, 116, 40, 0.3);
  }
  ```

- [ ] **Step 5: Update `.empty`**

  Find `.empty`:
  ```css
  .empty {
    font-family: 'Fredoka', sans-serif;
    font-size: var(--base-fs);
    color: var(--text-faint);
    font-style: italic;
    text-align: center;
    padding: 16px 0;
  }
  ```

- [ ] **Step 6: Verify build**

  ```bash
  cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen" && npm run build 2>&1 | tail -5
  ```

  Expected: `✓ built in` with no type errors.

- [ ] **Step 7: Verify visually**

  Start the game. The left orders panel should have: the torch-flame "TIME LEFT" label, dungeon-gold timer, updated orders badge (torch-flame with press shadow), and the overall panel background matching the dungeon cave stone theme.

- [ ] **Step 8: Commit**

  ```bash
  cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen" && git add src/components/DiningRoom.module.css && git commit -m "$(cat <<'EOF'
  style(DiningRoom): dungeon palette alignment for orders panel

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```
