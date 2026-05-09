# Main Menu Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-width banner title to the main menu, demote "How To Play" to a ghost button, and tighten the left column — matching the dungeon fantasy direction in DESIGN.md.

**Architecture:** Pure CSS + JSX structure change. No logic, props, state, or other components touched. `.screen` switches from a two-column grid to a column flexbox; a new `.body` wrapper holds the existing two-column grid below the banner.

**Tech Stack:** React 18, TypeScript, CSS Modules, Vite 5. No test framework — verification is visual via `npm run dev`.

---

## Files

| File | Change |
|------|--------|
| `src/components/MainMenu.module.css` | Add banner classes, update `.screen` layout, add `.body`, add `.modeHowToPlay`, remove unused `.title`/`.subtitle` |
| `src/components/MainMenu.tsx` | Add banner JSX, wrap body in `.body`, remove title/subtitle divs, update "How To Play" button class |

---

### Task 1: Update `.screen` layout and add `.body` + banner CSS classes

**Files:**
- Modify: `src/components/MainMenu.module.css`

- [ ] **Step 1: Replace `.screen` grid with flex column and add `.body` two-column grid**

  In `src/components/MainMenu.module.css`, replace the `.screen` block (lines 3–10):

  ```css
  .screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg);
    overflow: hidden;
    box-sizing: border-box;
  }

  .body {
    display: grid;
    grid-template-columns: 420px 1fr;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  ```

- [ ] **Step 2: Add banner CSS classes**

  Insert directly after the `.body` block added in Step 1:

  ```css
  /* ── Banner ── */

  .banner {
    background: linear-gradient(180deg, #231e19 0%, #1e1915 100%);
    border-bottom: 2px solid var(--border);
    padding: 28px 48px 22px;
    position: relative;
    flex-shrink: 0;
    overflow: hidden;
  }

  .banner::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 60% 80% at 30% 50%, rgba(216, 116, 40, 0.08) 0%, transparent 70%);
    pointer-events: none;
  }

  .bannerTitle {
    font-family: 'Fredoka', sans-serif;
    font-size: 72px;
    font-weight: 700;
    color: #f5ead8;
    line-height: 0.92;
    letter-spacing: -2px;
    position: relative;
    text-shadow:
      0 5px 0 #8e4e18,
      -2px -2px 0 #d87428,
       2px -2px 0 #d87428,
      -2px  2px 0 #d87428,
       2px  2px 0 #d87428;
  }

  .bannerTagline {
    font-family: 'Space Mono', monospace;
    font-size: 12px;
    font-weight: 400;
    color: #c4a020;
    text-transform: uppercase;
    letter-spacing: 3px;
    margin-top: 10px;
    position: relative;
  }
  ```

- [ ] **Step 3: Verify build is clean**

  ```bash
  cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen" && npm run build 2>&1 | tail -6
  ```

  Expected: `✓ built in` with no errors. (The new CSS classes aren't wired to JSX yet so they have no visual effect — that's fine.)

- [ ] **Step 4: Commit**

  ```bash
  cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen" && git add src/components/MainMenu.module.css && git commit -m "$(cat <<'EOF'
  style(MainMenu): add banner + body layout CSS classes

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 2: Add `.modeHowToPlay` ghost button style and remove unused `.title`/`.subtitle`

**Files:**
- Modify: `src/components/MainMenu.module.css`

- [ ] **Step 1: Add `.modeHowToPlay` after the existing `.modeTutorial` block**

  Find the `.modeTutorial` block in `MainMenu.module.css`. It currently reads:

  ```css
  .modeTutorial {
    background: #c4a020;
    border: none;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex: 1;
    transition: filter 0.15s;
    font-family: 'Fredoka', sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #1a1512;
  }

  .modeTutorial:hover {
    filter: brightness(1.07);
  }
  ```

  Insert immediately after the `.modeTutorial:hover` block:

  ```css
  .modeHowToPlay {
    background: transparent;
    border: 1.5px solid var(--border);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex: 1;
    transition: border-color 0.15s, color 0.15s;
    font-family: 'Fredoka', sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: var(--text-muted);
  }

  .modeHowToPlay:hover {
    border-color: #524538;
    color: var(--text-secondary);
  }
  ```

- [ ] **Step 2: Delete the now-unused `.title` and `.subtitle` CSS blocks**

  These blocks are in the `/* ── Left panel — title ── */` section. Remove them entirely (they will be dead code once the JSX is updated):

  ```css
  /* DELETE these blocks: */

  .title { ... }   /* ~12 lines starting with font-family: 'Fredoka' */
  .subtitle { ... } /* ~4 lines */
  ```

  The section comment `/* ── Left panel — title ── */` can be removed too.

- [ ] **Step 3: Add `margin-bottom: 8px` to `.sectionLabel`**

  Find `.sectionLabel` and add the property:

  ```css
  .sectionLabel {
    font-family: 'Fredoka', sans-serif;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
  ```

- [ ] **Step 4: Verify build is clean**

  ```bash
  cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen" && npm run build 2>&1 | tail -6
  ```

  Expected: `✓ built in` with no errors.

- [ ] **Step 5: Commit**

  ```bash
  cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen" && git add src/components/MainMenu.module.css && git commit -m "$(cat <<'EOF'
  style(MainMenu): add modeHowToPlay ghost style, remove unused title/subtitle CSS

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3: Update `MainMenu.tsx` — add banner, restructure JSX, fix button class

**Files:**
- Modify: `src/components/MainMenu.tsx`

- [ ] **Step 1: Add banner and wrap body in `.body`**

  Replace the entire `return` statement in `MainMenu.tsx`. The new JSX structure is:

  ```tsx
  return (
    <div className={styles.screen}>

      {/* ── BANNER ── */}
      <div className={styles.banner}>
        <div className={styles.bannerTitle}>Let Chat Cook</div>
        <div className={styles.bannerTagline}>⚔&nbsp;&nbsp;Dungeon Kitchen &nbsp;·&nbsp; Twitch Chat Restaurant Game</div>
      </div>

      {/* ── BODY ── */}
      <div className={styles.body}>

        {/* ── LEFT PANEL ── */}
        <div className={styles.leftCol}>

          <div className={styles.steps}>
            <div className={styles.sectionLabel}>How to play</div>

            <div className={styles.step}>
              <div className={styles.stepNum}>1</div>
              <div className={styles.stepContent}>
                <div className={styles.stepTitle}>Connect to your Twitch channel</div>
                <div className={styles.stepDesc}>Your chat becomes the kitchen crew</div>
              </div>
            </div>

            <div className={styles.step}>
              <div className={styles.stepNum}>2</div>
              <div className={styles.stepContent}>
                <div className={styles.stepTitle}>Type commands from the recipe</div>
                <div className={styles.stepDesc}>e.g. chop lettuce · grill patty · serve 1</div>
              </div>
            </div>

            <div className={styles.step}>
              <div className={styles.stepNum}>3</div>
              <div className={styles.stepContent}>
                <div className={styles.stepTitle}>Serve orders before time's up</div>
                <div className={styles.stepDesc}>Earn money, climb the leaderboard</div>
              </div>
            </div>
          </div>

          <div className={styles.divider} />

          <div className={styles.streamerSection}>
            <p className={styles.streamerDesc}>
              Enable <strong>Auto-Restart</strong> in Free Play to loop rounds automatically.
              Mods can control the session live from chat:
            </p>
            <div className={styles.cheatsheet}>
              <span className={styles.csCmd}>!start</span>
              <span className={styles.csDesc}>begin next round</span>
              <span className={styles.csCmd}>!exit</span>
              <span className={styles.csDesc}>end the current round</span>
              <span className={styles.csCmd}>!onAutoRestart</span>
              <span className={styles.csDesc}>enable auto-restart</span>
              <span className={styles.csCmd}>!offAutoRestart</span>
              <span className={styles.csDesc}>disable auto-restart</span>
            </div>
          </div>

          <div className={styles.divider} />

          <div className={styles.leftFooter}>
            created by THIANzeren &nbsp;·&nbsp; work in progress
          </div>

        </div>

        {/* ── RIGHT PANEL ── */}
        <div className={styles.rightCol}>

          {/* Twitch Connect Card */}
          <div className={styles.twitchCard}>
            <div className={styles.twitchLabel}>TWITCH CONNECT</div>
            <div className={styles.twitchForm}>
              <input
                className={styles.twitchInput}
                value={twitchInput}
                onChange={e => setTwitchInput(e.target.value)}
                placeholder="channel name"
                disabled={isConnecting || isConnected}
                onKeyDown={e => e.key === 'Enter' && handleConnect()}
              />
              {isConnected ? (
                <button className={styles.twitchDisconnectBtn} onClick={onTwitchDisconnect}>
                  Disconnect
                </button>
              ) : (
                <button
                  className={styles.twitchConnectBtn}
                  onClick={handleConnect}
                  disabled={isConnecting || !twitchInput.trim()}
                >
                  {isConnecting ? '...' : 'Connect'}
                </button>
              )}
            </div>
            {isConnected && twitchChannel && (
              <div className={styles.twitchStatus}>
                <span className={styles.twitchDot} />
                Welcome <span className={styles.twitchChannel}>{twitchChannel}</span> and your community!
              </div>
            )}
            {!isConnected && twitchStatus === 'error' && (
              <div className={`${styles.twitchStatus} ${styles.twitchStatusWarning}`}>
                <span className={`${styles.twitchDot} ${styles.twitchDotWarning}`} />
                {twitchError || 'Connection failed'}
              </div>
            )}
          </div>

          {/* Game modes */}
          <div className={styles.modes}>

            <div className={styles.modeBottomRow}>
              <button className={styles.modeTutorial} onClick={onStartTutorial}>Tutorial</button>
              <button className={styles.modeHowToPlay} onClick={onTutorial}>How To Play</button>
            </div>

            <button className={styles.modeFreePlay} onClick={onPlay}>
              <div>
                <div className={styles.fpName}>Free Play</div>
                <div className={styles.fpDesc}>Pick recipes, set duration &amp; difficulty</div>
              </div>
              <div className={styles.fpArrow}>▶</div>
            </button>

            <div className={styles.modeRow}>
              <button className={styles.modeAdventures} onClick={onAdventure}>
                <div>
                  <div className={styles.lvName}>Adventure</div>
                  <div className={styles.lvDesc}>Roguelike runs — how many shifts can you survive?</div>
                </div>
                <div className={styles.lvArrow}>→</div>
              </button>

              <button className={styles.modePvp} onClick={onPvp}>
                <div>
                  <div className={styles.lvName}>PvP</div>
                  <div className={styles.lvDesc}>Two teams compete — most money wins!</div>
                </div>
                <div className={styles.lvArrow}>⚔️</div>
              </button>
            </div>

            <div className={styles.modeBottomRow}>
              <button className={styles.modeOptions} onClick={onOptions}>Options</button>
              <button className={styles.modeOptions} onClick={onFeedback}>Feedback</button>
              <button className={styles.modeOptions} onClick={onCredits}>Credits</button>
            </div>

          </div>

        </div>

      </div>
    </div>
  )
  ```

- [ ] **Step 2: Verify TypeScript build is clean**

  ```bash
  cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen" && npm run build 2>&1 | tail -8
  ```

  Expected: `✓ built in` with no type errors. If `styles.modeHowToPlay` causes a type error (CSS Modules strict mode), confirm the class name in `MainMenu.module.css` matches exactly.

- [ ] **Step 3: Verify visually in the browser**

  Dev server should already be running at `http://localhost:5174/`. Hard-refresh and confirm:
  - The "Let Chat Cook" title spans full width at the top in a banner section
  - Gold tagline "⚔ Dungeon Kitchen · Twitch Chat Restaurant Game" appears below the title
  - The left column below the banner shows the 3 steps + cheatsheet (no title/subtitle)
  - "Tutorial" button is gold with press shadow; "How To Play" is a ghost outline
  - Free Play, Adventure, PvP, Options/Feedback/Credits are unchanged

- [ ] **Step 4: Commit**

  ```bash
  cd "/Users/nicholasthian/Desktop/Code Repo/ChatsKitchen" && git add src/components/MainMenu.tsx && git commit -m "$(cat <<'EOF'
  feat(MainMenu): full-width banner title, ghost How To Play button

  Moves title into a spanning banner section, demotes How To Play
  to a ghost outline button, removes title/subtitle from left column.

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```
