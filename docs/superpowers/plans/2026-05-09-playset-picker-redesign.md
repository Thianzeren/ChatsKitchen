# PlaysetPicker Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve PlaysetPicker readability and dungeon-fantasy alignment: bold coloured-header selection state, stripped card body, and palette token alignment.

**Architecture:** Pure CSS + minimal JSX changes. No logic, state, or prop modifications. Task 1 rewrites the card selection styles. Task 2 cleans up palette colours and sizing. Task 3 removes the two JSX elements made redundant by the design.

**Tech Stack:** React 18, TypeScript, CSS Modules, Vite 5. No test framework — verification is build pass + visual inspection in the dev server at `http://localhost:5174/`.

---

## Files

| File | Change |
|------|--------|
| `src/components/PlaysetPicker.module.css` | Tasks 1 + 2 |
| `src/components/PlaysetPicker.tsx` | Task 3 |

---

### Task 1: Card selection state — coloured header fill

**Files:**
- Modify: `src/components/PlaysetPicker.module.css`

- [ ] **Step 1: Add `background` and `transition` to `.cardHeader`**

  Find the `.cardHeader` block (currently at ~line 146). Add two properties:

  ```css
  .cardHeader {
    padding: 13px 16px 10px;
    border-bottom: 2px solid var(--border);
    flex-shrink: 0;
    background: var(--surface-2);
    transition: background 0.18s, border-bottom-color 0.18s;
  }
  ```

- [ ] **Step 2: Replace `.cardHovered` — remove glow, add header tint**

  Find the existing `.cardHovered` block:

  ```css
  .cardHovered {
    border-color: var(--card-color);
    box-shadow: 0 0 14px -6px var(--card-color);
  }
  ```

  Replace it with:

  ```css
  .cardHovered {
    border-color: var(--card-color);
  }

  .cardHovered .cardHeader {
    background: color-mix(in srgb, var(--card-color) 15%, var(--surface-2));
    border-bottom-color: color-mix(in srgb, var(--card-color) 30%, var(--border));
  }
  ```

- [ ] **Step 3: Replace `.cardSelected` — remove glow, add full header fill + text overrides**

  Find the existing `.cardSelected` block:

  ```css
  .cardSelected {
    border-color: var(--card-color);
    box-shadow: 0 0 24px -4px var(--card-color);
  }
  ```

  Replace it with:

  ```css
  .cardSelected {
    border-color: var(--card-color);
  }

  .cardSelected .cardHeader {
    background: var(--card-color);
    border-bottom-color: transparent;
  }

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

- [ ] **Step 4: Verify build**

  ```bash
  cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen" && npm run build 2>&1 | tail -5
  ```

  Expected: `✓ built in` with no errors.

- [ ] **Step 5: Verify visually**

  Open `http://localhost:5174/`, navigate to Free Play → Continue Anyway. Click a playset card. The card header should fill solid with that card's theme colour. Hovering an unselected card should show a faint header tint.

- [ ] **Step 6: Commit**

  ```bash
  cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen" && git add src/components/PlaysetPicker.module.css && git commit -m "$(cat <<'EOF'
  style(PlaysetPicker): coloured header fill for selected card state

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 2: Palette alignment + cook button shadow + item row sizing

**Files:**
- Modify: `src/components/PlaysetPicker.module.css`

- [ ] **Step 1: Fix section label colours**

  Find `.sectionLabelRecipes` and `.sectionLabelEvents`:

  ```css
  .sectionLabelRecipes { color: #5a9ab0; }
  .sectionLabelEvents  { color: #c49820; }
  ```

  Replace with:

  ```css
  .sectionLabelRecipes { color: #7858cc; }
  .sectionLabelEvents  { color: #c4a020; }
  ```

- [ ] **Step 2: Fix difficulty toggle active colours**

  Find `.diffBtnNormal.active` and `.diffBtnHard.active`:

  ```css
  .diffBtnNormal.active {
    background: var(--surface);
    color: #5cb85c;
  }

  .diffBtnHard.active {
    background: var(--surface);
    color: #e05050;
  }
  ```

  Replace with:

  ```css
  .diffBtnNormal.active {
    background: var(--surface);
    color: #42a05e;
  }

  .diffBtnHard.active {
    background: var(--surface);
    color: #c03830;
  }
  ```

- [ ] **Step 3: Fix event badge colours in cards (`.evtBadgeHazard` and `.evtBadgeOpportunity`)**

  Find both blocks:

  ```css
  .evtBadgeHazard {
    background: rgba(208, 64, 64, 0.15);
    color: #d06060;
    border: 1px solid rgba(208, 64, 64, 0.25);
  }

  .evtBadgeOpportunity {
    background: rgba(92, 184, 92, 0.12);
    color: #5cb85c;
    border: 1px solid rgba(92, 184, 92, 0.25);
  }
  ```

  Replace with:

  ```css
  .evtBadgeHazard {
    background: rgba(192, 56, 48, 0.15);
    color: #c03830;
    border: 1px solid rgba(192, 56, 48, 0.3);
  }

  .evtBadgeOpportunity {
    background: rgba(66, 160, 94, 0.12);
    color: #42a05e;
    border: 1px solid rgba(66, 160, 94, 0.25);
  }
  ```

- [ ] **Step 4: Fix breakdown badge colours (`.bdBadgeHazard` and `.bdBadgeOpportunity`)**

  Find both blocks:

  ```css
  .bdBadgeHazard {
    background: rgba(208, 64, 64, 0.15);
    color: #d06060;
    border: 1px solid rgba(208, 64, 64, 0.25);
  }

  .bdBadgeOpportunity {
    background: rgba(92, 184, 92, 0.12);
    color: #5cb85c;
    border: 1px solid rgba(92, 184, 92, 0.25);
  }
  ```

  Replace with:

  ```css
  .bdBadgeHazard {
    background: rgba(192, 56, 48, 0.15);
    color: #c03830;
    border: 1px solid rgba(192, 56, 48, 0.3);
  }

  .bdBadgeOpportunity {
    background: rgba(66, 160, 94, 0.12);
    color: #42a05e;
    border: 1px solid rgba(66, 160, 94, 0.25);
  }
  ```

- [ ] **Step 5: Fix step chip colours in breakdown**

  Find `.stepChip`:

  ```css
  .stepChip {
    font-family: 'Space Mono', monospace;
    font-size: 14px;
    font-weight: 700;
    color: #c4a020;
    background: rgba(240, 200, 80, 0.1);
    border: 1px solid rgba(240, 200, 80, 0.25);
    border-radius: 5px;
    padding: 2px 8px;
    white-space: nowrap;
  }
  ```

  Replace with:

  ```css
  .stepChip {
    font-family: 'Space Mono', monospace;
    font-size: 14px;
    font-weight: 700;
    color: #c4a020;
    background: rgba(196, 160, 32, 0.1);
    border: 1px solid rgba(196, 160, 32, 0.25);
    border-radius: 5px;
    padding: 2px 8px;
    white-space: nowrap;
  }
  ```

- [ ] **Step 6: Add tactile press shadow to `.cookBtn`**

  Find `.cookBtn`, `.cookBtn:hover:not(:disabled)`, and `.cookBtn:active:not(:disabled)`:

  ```css
  .cookBtn {
    background: var(--ps-accent);
    color: #fff;
    border: none;
    border-radius: 14px;
    padding: 14px 0;
    font-family: 'Fredoka', sans-serif;
    font-size: 22px;
    font-weight: 700;
    cursor: pointer;
    transition: filter 0.1s, transform 0.1s;
    width: 100%;
    letter-spacing: 0.5px;
  }

  .cookBtn:hover:not(:disabled) {
    filter: brightness(1.15);
    transform: scale(1.02);
  }

  .cookBtn:active:not(:disabled) {
    transform: scale(0.98);
  }
  ```

  Replace with:

  ```css
  .cookBtn {
    background: var(--ps-accent);
    color: #f5ead8;
    border: none;
    border-radius: 14px;
    padding: 14px 0;
    font-family: 'Fredoka', sans-serif;
    font-size: 22px;
    font-weight: 700;
    cursor: pointer;
    transition: filter 0.1s, transform 0.1s, box-shadow 0.1s;
    width: 100%;
    letter-spacing: 0.5px;
    box-shadow: 0 4px 0 #8e4e18;
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

- [ ] **Step 7: Increase item row padding and emoji size**

  Find `.itemRow` and `.itemEmoji`:

  ```css
  .itemRow {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 7px;
    border-radius: 8px;
  }

  .itemEmoji {
    font-size: var(--base-fs);
    width: 22px;
    text-align: center;
    flex-shrink: 0;
  }
  ```

  Replace with:

  ```css
  .itemRow {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 8px;
  }

  .itemEmoji {
    font-size: 22px;
    width: 26px;
    text-align: center;
    flex-shrink: 0;
  }
  ```

- [ ] **Step 8: Verify build**

  ```bash
  cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen" && npm run build 2>&1 | tail -5
  ```

  Expected: `✓ built in` with no errors.

- [ ] **Step 9: Commit**

  ```bash
  cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen" && git add src/components/PlaysetPicker.module.css && git commit -m "$(cat <<'EOF'
  style(PlaysetPicker): palette alignment, cook button shadow, item row sizing

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3: JSX cleanup — remove station labels and recipe prices

**Files:**
- Modify: `src/components/PlaysetPicker.tsx`

- [ ] **Step 1: Remove the station labels div from the card header**

  In `PlaysetPicker.tsx`, find the card header JSX inside the `visiblePlaysets.map(...)` block. It currently contains:

  ```tsx
  <div className={styles.cardHeader}>
    <div className={styles.cardTitleRow}>
      <span className={styles.cardFlag}>{ps.flag}</span>
      <span className={styles.cardName}>{ps.name}</span>
      {ps.tag && <span className={styles.cardTag}>{ps.tag}</span>}
    </div>
    <div className={styles.cardStations}>{ps.stationsLabel}</div>
  </div>
  ```

  Remove the `<div className={styles.cardStations}>` line:

  ```tsx
  <div className={styles.cardHeader}>
    <div className={styles.cardTitleRow}>
      <span className={styles.cardFlag}>{ps.flag}</span>
      <span className={styles.cardName}>{ps.name}</span>
      {ps.tag && <span className={styles.cardTag}>{ps.tag}</span>}
    </div>
  </div>
  ```

- [ ] **Step 2: Remove the recipe price span from the card body**

  In the same `visiblePlaysets.map(...)` block, find the recipe `itemRow`:

  ```tsx
  <div key={key} className={styles.itemRow}>
    <span className={styles.itemEmoji}>{recipe.emoji}</span>
    <span className={styles.itemName}>{recipe.name}</span>
    <span className={styles.itemMeta}>${recipe.reward}</span>
  </div>
  ```

  Remove the `itemMeta` span:

  ```tsx
  <div key={key} className={styles.itemRow}>
    <span className={styles.itemEmoji}>{recipe.emoji}</span>
    <span className={styles.itemName}>{recipe.name}</span>
  </div>
  ```

- [ ] **Step 3: Verify TypeScript build is clean**

  ```bash
  cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen" && npm run build 2>&1 | tail -5
  ```

  Expected: `✓ built in` with no type errors.

- [ ] **Step 4: Verify visually**

  Open `http://localhost:5174/`, navigate to Free Play → Continue Anyway. Confirm:
  - Card headers show only flag + name + optional tag badge (no station list below)
  - Recipe rows inside cards show only emoji + name (no `$65` price)
  - Prices still appear in the bottom breakdown panel when a card is selected
  - Difficulty Normal active = green, Hard active = red
  - Event hazard badges = dark red, opportunity badges = green
  - Cook button has a visible press shadow and lifts on hover

- [ ] **Step 5: Commit**

  ```bash
  cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen" && git add src/components/PlaysetPicker.tsx && git commit -m "$(cat <<'EOF'
  feat(PlaysetPicker): remove station labels and recipe prices from cards

  Cards now show emoji + name only. Detail lives in the bottom breakdown.

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```
