# Adventure Content Variety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 10 new Adventure-mode content pieces (3 commons + 3 rares + 2 bosses + 2 path variants) and rebalance Big Tab so the risk pool no longer contains a strict upgrade.

**Architecture:** Data-only PR with targeted reducer additions. New mechanics use existing GameState fields where possible (`orderPatienceBonus` for the Hangry Mob boss) and add 6 new optional GameState fields for the rest (`heatDecayAboveThreshold`, `heatDecayRate`, `autoExtinguishCharges`, `apprenticeTimerMs`, `repeatCustomerStreak`, `lostOrderPenalty`). Garnish/boss effects compose through the existing `applyAllGarnishes` / `applyBossDebuff` pipelines and land in the RESET action.

**Tech Stack:** React 18 + TypeScript (strict), Vite 5. No new dependencies. No UI changes. No audio assets.

**Branch:** `feat/adventure-content-variety` (off `origin/release/adventure-roguelike`). Spec at `docs/superpowers/specs/2026-05-24-adventure-content-variety-design.md`.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/state/types.ts` | Modify | 6 new optional `GameState` fields + extend RESET action shape |
| `src/state/gameReducer.ts` | Modify | TICK additions (heat decay, apprentice timer), SERVE additions (long_memory, repeat_customer), OVERHEAT intercept (phoenix_wing), TICK ORDER_EXPIRED branch (bad_reviews), SPAWN_ORDER addition (side_salad), RESET wiring |
| `src/data/adventureGarnishes.ts` | Modify | 6 new entries; extend `GarnishField` union with 2 new fields; aggregation cases in `applyAllGarnishes` |
| `src/data/adventureBosses.ts` | Modify | 2 new entries; extend `BossId` union + `BossDelta.state` Pick set; 2 new cases in `applyBossDebuff`; extend `getBossPool` return |
| `src/data/adventurePathCards.ts` | Modify | 2 new variants + Big Tab number tweak |
| `src/hooks/useAdventureRun.ts` | Modify | `buildShiftReset` threads new garnish-driven and boss-driven fields into RESET |

No new files. ~250 lines added across 6 existing files.

---

## Task 1: Type & state plumbing

**Files:**
- Modify: `src/state/types.ts`
- Modify: `src/state/gameReducer.ts` (RESET action shape only — handlers come in Task 2)

This task lays the type foundation so subsequent tasks compile cleanly.

### Step 1: Add new optional fields to `GameState`

- [ ] **Step 1.1:** Open `src/state/types.ts`. Find the existing `GameState` interface (starts at line 240). Locate the block of "Adventure-mode garnish/debuff knobs" comments (~line 264). After the existing `overheatThreshold?: number` line (~line 282), and BEFORE the `teams?: Record<...>` line, insert these new optional fields:

```typescript
  // ── Adventure content variety (Sub-project C) — new optional fields ──
  heatDecayAboveThreshold?: number    // Loose Lid garnish — heat above this dissipates passively
  heatDecayRate?: number               // Loose Lid garnish — points/sec decayed (e.g. 4)
  autoExtinguishCharges?: number       // Phoenix Wing garnish — first overheat per shift auto-restores
  apprenticeTimerMs?: number           // The Apprentice garnish — TICK accumulator for periodic ingredient drip
  repeatCustomerStreak?: {             // Repeat Customer garnish — per-shift streak tracker
    user: string
    recipe: string
    count: number
  }
  lostOrderPenalty?: number            // Bad Reviews boss — $ deducted per ORDER_EXPIRED
```

These fields are all optional — `undefined` means "no behaviour change" so Free Play and pre-PR saved runs are unaffected.

### Step 2: Extend the RESET action shape

- [ ] **Step 2.1:** Open `src/state/gameReducer.ts`. Find the `RESET` case in `GameAction` (line 16-37). After the existing `activeBossDebuff?: string` field (line 36) and BEFORE the closing `}`, insert these new fields:

```typescript
      // ── Adventure content variety (Sub-project C) — new RESET fields ──
      heatDecayAboveThreshold?: number   // Loose Lid garnish
      heatDecayRate?: number              // Loose Lid garnish
      autoExtinguishCharges?: number      // Phoenix Wing garnish (set to 1 each shift if owned)
      apprenticeTimerMs?: number          // The Apprentice garnish (set to 0 each shift if owned)
      lostOrderPenalty?: number           // Bad Reviews boss
```

### Step 3: Thread the new RESET fields into the reducer's RESET handler return

- [ ] **Step 3.1:** Still in `src/state/gameReducer.ts`, find the RESET case body (starts at line 159). Locate the `return { ...base, ... }` block (line 172-195). Insert the new fields into that object — add them just before the closing `}`, after `rouletteNextAt: undefined,` (line 194):

Find this block:

```typescript
        rouletteNextAt: undefined,
      }
    }
```

Replace with:

```typescript
        rouletteNextAt: undefined,
        // ── Sub-project C — content variety fields ──
        heatDecayAboveThreshold: action.heatDecayAboveThreshold,
        heatDecayRate: action.heatDecayRate,
        autoExtinguishCharges: action.autoExtinguishCharges,
        apprenticeTimerMs: action.apprenticeTimerMs,
        lostOrderPenalty: action.lostOrderPenalty,
        repeatCustomerStreak: undefined,
      }
    }
```

(`repeatCustomerStreak` is always undefined at RESET — it's populated mid-shift by the SERVE handler when Repeat Customer is owned.)

### Step 4: Build check

- [ ] **Step 4.1:** Run `npm run build`. Expected: build succeeds with no TypeScript errors.

### Step 5: Commit

- [ ] **Step 5.1:**

```bash
git add src/state/types.ts src/state/gameReducer.ts
git commit -m "feat(adventure): add type plumbing for content-variety mechanics

Adds 6 new optional GameState fields (heatDecayAboveThreshold/Rate,
autoExtinguishCharges, apprenticeTimerMs, repeatCustomerStreak,
lostOrderPenalty) and extends the RESET action shape with the
corresponding inputs. All fields are optional; existing modes
(Free Play, pre-PR saves) see no behaviour change.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Reducer logic for new mechanics

**Files:**
- Modify: `src/state/gameReducer.ts` (TICK, SERVE, ORDER_EXPIRED branch inside TICK, SPAWN_ORDER, and add an OVERHEAT intercept inside TICK)

Six small additions threaded into the existing handlers. After this task the code paths exist but trigger nothing until Task 3 adds garnish/boss data that actually sets the fields.

### Step 1: Add Loose Lid heat decay to TICK

- [ ] **Step 1.1:** Open `src/state/gameReducer.ts`. Find the TICK case (line 499). Inside the per-station for-loop (starts ~line 557), find the slot loop and the spot where `currentHeat` is recomputed after the slot loop. Look for this block (around line 654-657):

```typescript
        if (!newStations[id].overheated) {
          newStations[id] = { ...newStations[id], heat: currentHeat, slots: updatedSlots }
        }
```

Replace it with this — add a passive-decay step that runs after the slot loop but before commit, only if the threshold and rate are set:

```typescript
        if (!newStations[id].overheated) {
          // Loose Lid garnish — heat above threshold dissipates passively.
          let heatAfterDecay = currentHeat
          if (
            state.heatDecayAboveThreshold !== undefined &&
            state.heatDecayRate !== undefined &&
            !HEAT_EXEMPT_STATIONS.has(id) &&
            currentHeat > state.heatDecayAboveThreshold
          ) {
            const decay = state.heatDecayRate * (delta / 1000)
            heatAfterDecay = Math.max(state.heatDecayAboveThreshold, currentHeat - decay)
          }
          newStations[id] = { ...newStations[id], heat: heatAfterDecay, slots: updatedSlots }
        }
```

### Step 2: Add Phoenix Wing overheat intercept

- [ ] **Step 2.1:** Still in the TICK case, find the overheat block inside the slot loop (around line 581-607). The current block penalises chefs, frees active users, marks the station overheated, pushes a chat message, and conditionally awards Bloodhound money.

Find this exact line at the start of the overheat branch (around line 581):

```typescript
          if (currentHeat >= overheatLimit) {
```

Insert a Phoenix Wing intercept block immediately after that `if`, before the existing penalty logic. The full updated block should read:

```typescript
          if (currentHeat >= overheatLimit) {
            // ── Phoenix Wing garnish — first overheat per shift is auto-extinguished ──
            // Slots are still destroyed, but the station restores instantly (heat=0, not overheated).
            // We still penalise firesCaused on the chefs whose slots tipped the station — those
            // bonuses already exist below; we just skip the overheat *side-effects* (chat
            // message, locked state, Bloodhound payout).
            const phoenixCharges = state.autoExtinguishCharges ?? 0
            if (phoenixCharges > 0) {
              // Decrement charges on the live state-out (we don't mutate `state` directly;
              // pass via the TICK return value). Track in a local so the bottom-of-handler
              // return can pick it up.
              autoExtinguishChargesOut = phoenixCharges - 1
              // Still penalise the chefs (matches normal overheat penalty)
              for (const s of station.slots) {
                const statSnap = addStat({ ...state, playerStats: newPlayerStats }, s.user, 'firesCaused', 1)
                newPlayerStats = statSnap.playerStats
              }
              for (const s of newStations[id].slots) delete newActiveUsers[s.user]
              newStations[id] = { ...newStations[id], slots: [], heat: 0, overheated: false, extinguishVotes: [] }
              messages.push({
                id: nextMsgId++,
                username: 'KITCHEN',
                text: `🪶 Phoenix Wing saved the ${STATION_DEFS[id].name}! Slots lost, station restored.`,
                type: 'success',
              })
              break // station handled, skip remaining slots
            }
            // ── End Phoenix Wing intercept ──

            // Penalise every player cooking at this station, not just the one whose slot tipped it over
            for (const s of station.slots) {
              const statSnap = addStat({ ...state, playerStats: newPlayerStats }, s.user, 'firesCaused', 1)
              newPlayerStats = statSnap.playerStats
            }
```

- [ ] **Step 2.2:** Phoenix Wing decrements `autoExtinguishCharges`. We need a local `autoExtinguishChargesOut` variable. Add it right after the existing `let bloodhoundMoney = 0` line (around line 512). Find:

```typescript
      let nextMsgId = state.nextMessageId
      const newPreparedItems = [...state.preparedItems]
      const newPreparedItemSources = [...state.preparedItemSources]
      const newRedPreparedItems = [...(state.redPreparedItems ?? [])]
      const newBluePreparedItems = [...(state.bluePreparedItems ?? [])]
      const newRedPreparedItemSources = state.teams ? [...(state.redPreparedItemSources ?? [])] : []
      const newBluePreparedItemSources = state.teams ? [...(state.bluePreparedItemSources ?? [])] : []
      let newPlayerStats = { ...state.playerStats }
      let bloodhoundMoney = 0
```

Replace the last line with these two:

```typescript
      let bloodhoundMoney = 0
      let autoExtinguishChargesOut = state.autoExtinguishCharges  // unchanged unless Phoenix Wing fires
```

- [ ] **Step 2.3:** Thread `autoExtinguishChargesOut` into the TICK return value. Find the existing return block at the end of TICK (around line 701-724). Add the field. Replace:

```typescript
        teaBreakNextAt,
        patiencePausedUntil,
        rouletteNextAt,
      }
    }
```

with:

```typescript
        teaBreakNextAt,
        patiencePausedUntil,
        rouletteNextAt,
        autoExtinguishCharges: autoExtinguishChargesOut,
      }
    }
```

### Step 3: Add Apprentice ingredient drip to TICK

- [ ] **Step 3.1:** Still in TICK. The Apprentice garnish runs OUTSIDE the per-station loop — it ticks a timer in state. Find the spot AFTER the per-station for-loop ends and BEFORE the order patience update. Look for this block (around line 657-660):

```typescript
      // Update order patience + expire (Tea Break can freeze patience drain temporarily)
      const compostActive = (state.activeGarnishes ?? []).includes('compost_bin')
```

Insert this block immediately BEFORE that comment:

```typescript
      // ── The Apprentice garnish — drip a random prepped ingredient every 35s ──
      let apprenticeTimerOut = state.apprenticeTimerMs
      if (state.apprenticeTimerMs !== undefined) {
        let timer = state.apprenticeTimerMs + delta
        while (timer >= 35_000) {
          // Pick a random `produces` from the active recipes' steps
          const pool: string[] = []
          for (const key of state.enabledRecipes) {
            const r = RECIPES[key]
            if (!r) continue
            for (const step of r.steps) pool.push(step.produces)
          }
          if (pool.length > 0) {
            const pick = pool[Math.floor(Math.random() * pool.length)]
            newPreparedItems.push(pick)
            newPreparedItemSources.push('')
            messages.push({
              id: nextMsgId++,
              username: 'KITCHEN',
              text: `👨‍🍳 The Apprentice prepped ${pick.replace(/_/g, ' ')}.`,
              type: 'system',
            })
          }
          timer -= 35_000
        }
        apprenticeTimerOut = timer
      }

```

- [ ] **Step 3.2:** Thread `apprenticeTimerOut` into the TICK return value. Update the same return block from Step 2.3:

Find:

```typescript
        teaBreakNextAt,
        patiencePausedUntil,
        rouletteNextAt,
        autoExtinguishCharges: autoExtinguishChargesOut,
      }
    }
```

Replace with:

```typescript
        teaBreakNextAt,
        patiencePausedUntil,
        rouletteNextAt,
        autoExtinguishCharges: autoExtinguishChargesOut,
        apprenticeTimerMs: apprenticeTimerOut,
      }
    }
```

### Step 4: Add Bad Reviews penalty to ORDER_EXPIRED branch (inside TICK)

- [ ] **Step 4.1:** The ORDER_EXPIRED logic lives inside TICK's order-patience update (around line 663-687). Find this block:

```typescript
        if (newPatience <= 0) {
          lost++
          messages.push({ id: nextMsgId++, username: 'CUSTOMER', text: `Order #${order.id} expired! Lost a ${RECIPES[order.dish].emoji}!`, type: 'error' })
          // Compost Bin garnish: turn the lost order into 1 random prepped ingredient
          if (compostActive) {
```

Insert the Bad Reviews penalty AFTER the `lost++` and the expired message push, but BEFORE the Compost Bin check. Update the block to:

```typescript
        if (newPatience <= 0) {
          lost++
          messages.push({ id: nextMsgId++, username: 'CUSTOMER', text: `Order #${order.id} expired! Lost a ${RECIPES[order.dish].emoji}!`, type: 'error' })
          // Bad Reviews boss — flat $ deducted per expired order.
          // Lost orders aren't team-tagged, so PvP charges BOTH teams equally.
          if (state.lostOrderPenalty !== undefined) {
            badReviewsPenaltyTotal += state.lostOrderPenalty
            messages.push({
              id: nextMsgId++,
              username: 'KITCHEN',
              text: `⭐ Bad Reviews · −$${state.lostOrderPenalty}`,
              type: 'error',
            })
          }
          // Compost Bin garnish: turn the lost order into 1 random prepped ingredient
          if (compostActive) {
```

- [ ] **Step 4.2:** Declare `badReviewsPenaltyTotal` next to `bloodhoundMoney`. Find:

```typescript
      let bloodhoundMoney = 0
      let autoExtinguishChargesOut = state.autoExtinguishCharges  // unchanged unless Phoenix Wing fires
```

Replace with:

```typescript
      let bloodhoundMoney = 0
      let autoExtinguishChargesOut = state.autoExtinguishCharges  // unchanged unless Phoenix Wing fires
      let badReviewsPenaltyTotal = 0
```

- [ ] **Step 4.3:** Apply the penalty in the TICK return. Find:

```typescript
        money: state.money + bloodhoundMoney,
```

Replace with:

```typescript
        money: state.money + bloodhoundMoney - badReviewsPenaltyTotal,
        redMoney: state.teams && state.redMoney !== undefined
          ? state.redMoney - badReviewsPenaltyTotal
          : state.redMoney,
        blueMoney: state.teams && state.blueMoney !== undefined
          ? state.blueMoney - badReviewsPenaltyTotal
          : state.blueMoney,
```

This pattern: in coop, `state.money` is decremented; in PvP, BOTH `redMoney` and `blueMoney` are decremented (each team takes the full hit — matches the spec).

### Step 5: Add Side Salad seeding to SPAWN_ORDER

- [ ] **Step 5.1:** Find the SPAWN_ORDER case (line 472). Locate the existing `return addMsg(...)` at the bottom of that case (around line 493-496):

```typescript
      return addMsg(
        { ...state, orders: [...state.orders, order], nextOrderId: state.nextOrderId + 1 },
        'CUSTOMER', `Order #${order.id}: ${recipe.emoji} ${recipe.name}!`, 'system'
      )
    }
```

Replace with:

```typescript
      // ── Side Salad garnish — seed 1 free prepped ingredient from this order's recipe ──
      let sideSaladPreparedItems = state.preparedItems
      let sideSaladPreparedItemSources = state.preparedItemSources
      if ((state.activeGarnishes ?? []).includes('side_salad') && recipe.steps.length > 0) {
        const step = recipe.steps[Math.floor(Math.random() * recipe.steps.length)]
        sideSaladPreparedItems = [...sideSaladPreparedItems, step.produces]
        sideSaladPreparedItemSources = [...sideSaladPreparedItemSources, '']
      }

      return addMsg(
        {
          ...state,
          orders: [...state.orders, order],
          nextOrderId: state.nextOrderId + 1,
          preparedItems: sideSaladPreparedItems,
          preparedItemSources: sideSaladPreparedItemSources,
        },
        'CUSTOMER', `Order #${order.id}: ${recipe.emoji} ${recipe.name}!`, 'system'
      )
    }
```

(Side Salad seeds to the global `preparedItems`. In PvP this falls back to the global pool — only matters in coop where teams aren't used.)

### Step 6: Add Long Memory + Repeat Customer to SERVE

- [ ] **Step 6.1:** Find the SERVE case (line 262). Locate the existing reward-computation block around line 318-336 (after Combo Plate handling, before the final reward computation). The existing line you need to find is:

```typescript
      const reward = Math.round(baseReward * multiplier) + tip + comboBonus
```

Replace it (and add the new bonuses) with:

```typescript
      // ── Long Memory garnish — every 5th dish served (shift-wide) earns +$40 ──
      let longMemoryBonus = 0
      if (active.includes('long_memory') && (state.served + 1) % 5 === 0) {
        longMemoryBonus = 40
      }

      // ── Repeat Customer garnish — every 3rd consecutive same-recipe by same user earns +$25 ──
      let repeatCustomerBonus = 0
      let nextRepeatCustomerStreak = state.repeatCustomerStreak
      if (active.includes('repeat_customer')) {
        const cur = state.repeatCustomerStreak
        if (cur && cur.user === user && cur.recipe === order.dish) {
          const nextCount = cur.count + 1
          if (nextCount >= 3) {
            repeatCustomerBonus = 25
            nextRepeatCustomerStreak = { user, recipe: order.dish, count: 0 }
          } else {
            nextRepeatCustomerStreak = { user, recipe: order.dish, count: nextCount }
          }
        } else {
          nextRepeatCustomerStreak = { user, recipe: order.dish, count: 1 }
        }
      }

      const reward = Math.round(baseReward * multiplier) + tip + comboBonus + longMemoryBonus + repeatCustomerBonus
```

- [ ] **Step 6.2:** Thread `nextRepeatCustomerStreak` into the SERVE return. Find the existing return block at the bottom of SERVE (around line 355-369):

```typescript
      return addMsg(
        {
          ...afterPool,
          orders: newOrders,
          money: afterPool.money + reward,
          served: afterPool.served + 1,
          firstOrderServedThisShift: true,
          recentServes,
        },
        'KITCHEN',
        comboBonus > 0
          ? `${user} served ${recipe.emoji} ${recipe.name}! +$${reward} (Combo Plate +$${comboBonus}!)`
          : `${user} served ${recipe.emoji} ${recipe.name}! +$${reward}`,
        'success',
      )
    }
```

Replace with:

```typescript
      // Compose a chat message that mentions any of the new triggered bonuses that fired.
      const bonusTags: string[] = []
      if (comboBonus > 0) bonusTags.push(`Combo Plate +$${comboBonus}`)
      if (longMemoryBonus > 0) bonusTags.push(`Long Memory +$${longMemoryBonus}`)
      if (repeatCustomerBonus > 0) bonusTags.push(`Repeat Customer +$${repeatCustomerBonus}`)
      const bonusSuffix = bonusTags.length > 0 ? ` (${bonusTags.join(', ')}!)` : ''

      return addMsg(
        {
          ...afterPool,
          orders: newOrders,
          money: afterPool.money + reward,
          served: afterPool.served + 1,
          firstOrderServedThisShift: true,
          recentServes,
          repeatCustomerStreak: nextRepeatCustomerStreak,
        },
        'KITCHEN',
        `${user} served ${recipe.emoji} ${recipe.name}! +$${reward}${bonusSuffix}`,
        'success',
      )
    }
```

### Step 7: Build check

- [ ] **Step 7.1:** Run `npm run build`. Expected: build succeeds.

### Step 8: Lint check

- [ ] **Step 8.1:** Run `npm run lint`. Expected: no new warnings or errors.

### Step 9: Commit

- [ ] **Step 9.1:**

```bash
git add src/state/gameReducer.ts
git commit -m "feat(adventure): reducer hooks for content-variety mechanics

Adds the runtime logic for the 6 new garnishes + 2 new bosses, all
gated by state field presence so they're no-ops in Free Play and
pre-PR saves. TICK gains a heat-decay branch (Loose Lid), an apprentice
ingredient timer (The Apprentice), a Phoenix Wing overheat intercept,
and Bad Reviews lost-order penalty plumbing. SERVE gains Long Memory
and Repeat Customer triggered bonuses. SPAWN_ORDER seeds Side Salad
prep when active.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Garnish + boss data files

**Files:**
- Modify: `src/data/adventureGarnishes.ts`
- Modify: `src/data/adventureBosses.ts`

Adds the 6 new garnishes + 2 new bosses. With Tasks 1+2 in place, this is where the data registers the IDs that the reducer code checks for.

### Step 1: Extend `GarnishField` union

- [ ] **Step 1.1:** Open `src/data/adventureGarnishes.ts`. Find the `GarnishField` type alias (line 24-33). Replace it with:

```typescript
export type GarnishField =
  | 'cookingSpeed'
  | 'orderSpeed'
  | 'orderSpawnRate'
  | 'coolAmountBonus'
  | 'heatPerCookMultiplier'
  | 'choppingCookTimeMultiplier'    // Precise Cuts — multiplies chop-board cook time (0.6 = 40% faster)
  | 'flatTipPerOrder'
  | 'orderPatienceBonus'   // Friendly Faces — +ms to each new order's patienceMax/patienceLeft
  | 'overheatThresholdDelta'   // Insulation +10, Glass Kitchen -40 (additive to base 100)
  // ── Sub-project C — content variety ──
  | 'heatDecayAboveThreshold'   // Loose Lid — heat above this threshold dissipates
  | 'heatDecayRate'              // Loose Lid — heat points per second dissipated
```

### Step 2: Add 6 new garnish entries

- [ ] **Step 2.1:** Still in `adventureGarnishes.ts`. Find the closing `}` of the `GARNISHES` object (around line 245). Insert the 6 new garnishes before it. Specifically, find the end of the legendary section:

```typescript
  glass_kitchen: {
    id: 'glass_kitchen',
    name: 'Glass Kitchen',
    description: 'Stations overheat at 60 instead of 100, but every dish pays +50%.',
    tier: 'legendary',
    basePrice: 460,
    icon: '💎',
    effects: [{ field: 'overheatThresholdDelta', value: -40, mode: 'add' }],
    // +50% money is handled inline in SERVE via activeGarnishes check
  },
}
```

Replace with (preserving Glass Kitchen, inserting the 6 new garnishes before the closing `}`):

```typescript
  glass_kitchen: {
    id: 'glass_kitchen',
    name: 'Glass Kitchen',
    description: 'Stations overheat at 60 instead of 100, but every dish pays +50%.',
    tier: 'legendary',
    basePrice: 460,
    icon: '💎',
    effects: [{ field: 'overheatThresholdDelta', value: -40, mode: 'add' }],
    // +50% money is handled inline in SERVE via activeGarnishes check
  },

  // ── Sub-project C: new commons ──
  loose_lid: {
    id: 'loose_lid',
    name: 'Loose Lid',
    description: 'Heat above 75 dissipates passively at 4/sec.',
    tier: 'common',
    basePrice: 110,
    icon: '🥘',
    effects: [
      { field: 'heatDecayAboveThreshold', value: 75, mode: 'add' },
      { field: 'heatDecayRate', value: 4, mode: 'add' },
    ],
  },
  repeat_customer: {
    id: 'repeat_customer',
    name: 'Repeat Customer',
    description: 'Every 3rd consecutive dish of the same recipe earns +$25.',
    tier: 'common',
    basePrice: 130,
    icon: '🔁',
  },
  side_salad: {
    id: 'side_salad',
    name: 'Side Salad',
    description: 'Each new order arrives with 1 free prepped ingredient.',
    tier: 'common',
    basePrice: 120,
    icon: '🥗',
  },

  // ── Sub-project C: new rares ──
  phoenix_wing: {
    id: 'phoenix_wing',
    name: 'Phoenix Wing',
    description: 'The first station overheat each shift is auto-extinguished (slots still lost).',
    tier: 'rare',
    basePrice: 240,
    icon: '🪶',
  },
  apprentice: {
    id: 'apprentice',
    name: 'The Apprentice',
    description: 'Every 35 seconds, one random prepped ingredient appears in the tray.',
    tier: 'rare',
    basePrice: 260,
    icon: '👨‍🍳',
  },
  long_memory: {
    id: 'long_memory',
    name: 'Long Memory',
    description: 'Every 5th dish served each shift earns +$40.',
    tier: 'rare',
    basePrice: 220,
    icon: '📖',
  },
}
```

### Step 3: Aggregate the 2 new garnish-effect fields in `applyAllGarnishes`

- [ ] **Step 3.1:** Still in `adventureGarnishes.ts`. Find the `applyAllGarnishes` function (line 306). Inside the effect-aggregation for-loop (around line 322-360), find the existing `case 'overheatThresholdDelta':` branch:

```typescript
        case 'overheatThresholdDelta':
          overheatThreshold += effect.value
          break
      }
    }
  }
```

Replace with:

```typescript
        case 'overheatThresholdDelta':
          overheatThreshold += effect.value
          break
        case 'heatDecayAboveThreshold':
          heatDecayAboveThreshold = effect.value
          break
        case 'heatDecayRate':
          heatDecayRate = effect.value
          break
      }
    }
  }
```

- [ ] **Step 3.2:** Add the two new aggregation variables near the top of the function. Find this block (around line 311-319):

```typescript
  let cookingMul = 1
  let orderSpeedMul = 1
  let orderSpawnMul = 1
  let coolAmountBonus = 0
  let heatPerCookMul = 1
  let choppingCookTimeMul = 1
  let flatTipPerOrder = 0
  let orderPatienceBonus = 0
  let overheatThreshold = OVERHEAT_THRESHOLD_BASE
```

Replace with:

```typescript
  let cookingMul = 1
  let orderSpeedMul = 1
  let orderSpawnMul = 1
  let coolAmountBonus = 0
  let heatPerCookMul = 1
  let choppingCookTimeMul = 1
  let flatTipPerOrder = 0
  let orderPatienceBonus = 0
  let overheatThreshold = OVERHEAT_THRESHOLD_BASE
  let heatDecayAboveThreshold: number | undefined = undefined
  let heatDecayRate: number | undefined = undefined
```

- [ ] **Step 3.3:** Include the two new fields in the returned `GarnishDelta.state`. Find the existing `state` block (around line 376-386):

```typescript
    state: {
      coolAmountBonus:            coolAmountBonus       === 0 ? undefined : coolAmountBonus,
      heatPerCookMultiplier:      heatPerCookMul        === 1 ? undefined : heatPerCookMul,
      choppingCookTimeMultiplier: choppingCookTimeMul   === 1 ? undefined : choppingCookTimeMul,
      flatTipPerOrder:            flatTipPerOrder       === 0 ? undefined : flatTipPerOrder,
      orderPatienceBonus:         orderPatienceBonus    === 0 ? undefined : orderPatienceBonus,
      overheatThreshold:          overheatThreshold     === OVERHEAT_THRESHOLD_BASE ? undefined : overheatThreshold,
    },
  }
}
```

Replace with:

```typescript
    state: {
      coolAmountBonus:            coolAmountBonus       === 0 ? undefined : coolAmountBonus,
      heatPerCookMultiplier:      heatPerCookMul        === 1 ? undefined : heatPerCookMul,
      choppingCookTimeMultiplier: choppingCookTimeMul   === 1 ? undefined : choppingCookTimeMul,
      flatTipPerOrder:            flatTipPerOrder       === 0 ? undefined : flatTipPerOrder,
      orderPatienceBonus:         orderPatienceBonus    === 0 ? undefined : orderPatienceBonus,
      overheatThreshold:          overheatThreshold     === OVERHEAT_THRESHOLD_BASE ? undefined : overheatThreshold,
      heatDecayAboveThreshold,
      heatDecayRate,
    },
  }
}
```

- [ ] **Step 3.4:** Extend the `GarnishDelta.state` type to include the two new fields. Find the `GarnishDelta` interface inside `adventureGarnishes.ts` (around line 299):

```typescript
interface GarnishDelta {
  options: Partial<GameOptions>
  state: Partial<GameState>
}
```

This already covers anything in `GameState` via `Partial<GameState>` — no change needed. Verify it still compiles.

### Step 4: Extend `BossId` union and add 2 new bosses

- [ ] **Step 4.1:** Open `src/data/adventureBosses.ts`. Find the `BossId` type (line 4). Replace it with:

```typescript
export type BossId = 'picky_critic' | 'rush_hour' | 'health_inspector' | 'understaffed' | 'heatwave' | 'chaos_mode' | 'recipe_roulette' | 'hangry_mob' | 'bad_reviews'
```

- [ ] **Step 4.2:** Add the 2 new boss entries to `BOSSES`. Find the closing `}` of the `BOSSES` object (around line 58). Insert the two new entries before it. Specifically, find:

```typescript
  recipe_roulette: {
    id: 'recipe_roulette',
    name: 'Recipe Roulette',
    description: 'Every 45 seconds, one of your active recipes is swapped for a random dish from the catalog.',
    icon: '🎲',
  },
}
```

Replace with:

```typescript
  recipe_roulette: {
    id: 'recipe_roulette',
    name: 'Recipe Roulette',
    description: 'Every 45 seconds, one of your active recipes is swapped for a random dish from the catalog.',
    icon: '🎲',
  },
  // ── Sub-project C: new bosses ──
  hangry_mob: {
    id: 'hangry_mob',
    name: 'Hangry Mob',
    description: 'Every order arrives with 30% less patience — same volume of orders, sharply less time to serve each.',
    icon: '😤',
  },
  bad_reviews: {
    id: 'bad_reviews',
    name: 'Bad Reviews',
    description: 'Every lost or expired order deducts $20 from the run bank.',
    icon: '⭐',
  },
}
```

### Step 5: Extend `BossDelta.state` Pick set and add `applyBossDebuff` cases

- [ ] **Step 5.1:** Still in `adventureBosses.ts`. Find the `BossDelta` interface (line 60-63):

```typescript
export interface BossDelta {
  options: Partial<Pick<GameOptions, 'orderSpeed' | 'orderSpawnRate'>>
  state: Partial<Pick<GameState, 'bossMoneyMultiplier' | 'cooldownMultiplier' | 'disabledStations' | 'heatPerCookMultiplier' | 'coolAmountBonus'>>
}
```

Replace with:

```typescript
export interface BossDelta {
  options: Partial<Pick<GameOptions, 'orderSpeed' | 'orderSpawnRate'>>
  state: Partial<Pick<GameState,
    | 'bossMoneyMultiplier' | 'cooldownMultiplier' | 'disabledStations'
    | 'heatPerCookMultiplier' | 'coolAmountBonus'
    | 'orderPatienceBonus' | 'lostOrderPenalty'
  >>
}
```

- [ ] **Step 5.2:** Add the two new cases to the `applyBossDebuff` switch. Find this block (around line 88-96):

```typescript
    case 'recipe_roulette':
      // Effect lives in the TICK loop (driven by state.activeBossDebuff which
      // useAdventureRun copies from the chosen path card into RESET).
      return { options: {}, state: {} }
  }
}
```

Replace with:

```typescript
    case 'recipe_roulette':
      // Effect lives in the TICK loop (driven by state.activeBossDebuff which
      // useAdventureRun copies from the chosen path card into RESET).
      return { options: {}, state: {} }
    case 'hangry_mob':
      // -15000 ms approximates -30% on a ~50s baseline patience across the recipe roster.
      return { options: {}, state: { orderPatienceBonus: -15000 } }
    case 'bad_reviews':
      return { options: {}, state: { lostOrderPenalty: 20 } }
  }
}
```

### Step 6: Add the new bosses to `getBossPool`

- [ ] **Step 6.1:** Find `getBossPool` (around line 115-117):

```typescript
export function getBossPool(): BossId[] {
  return ['picky_critic', 'rush_hour', 'health_inspector', 'understaffed', 'heatwave', 'chaos_mode', 'recipe_roulette']
}
```

Replace with:

```typescript
export function getBossPool(): BossId[] {
  return ['picky_critic', 'rush_hour', 'health_inspector', 'understaffed', 'heatwave', 'chaos_mode', 'recipe_roulette', 'hangry_mob', 'bad_reviews']
}
```

### Step 7: Build check

- [ ] **Step 7.1:** Run `npm run build`. Expected: build succeeds.

### Step 8: Lint check

- [ ] **Step 8.1:** Run `npm run lint`. Expected: no new warnings or errors.

### Step 9: Commit

- [ ] **Step 9.1:**

```bash
git add src/data/adventureGarnishes.ts src/data/adventureBosses.ts
git commit -m "feat(adventure): add 6 garnishes + 2 bosses

Garnishes (commons): Loose Lid, Repeat Customer, Side Salad.
Garnishes (rares): Phoenix Wing, The Apprentice, Long Memory.
Bosses: Hangry Mob (-30% order patience), Bad Reviews (-\$20 per
expired order). Adds bosses to getBossPool(). Extends GarnishField,
BossId, and BossDelta type sets accordingly.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Path-card variants + Big Tab rebalance

**Files:**
- Modify: `src/data/adventurePathCards.ts`

Adds 1 easy + 1 risk variant and tweaks Big Tab's numbers.

### Step 1: Add Friend of the House to easy pool

- [ ] **Step 1.1:** Open `src/data/adventurePathCards.ts`. Find the `EASY_VARIANTS` array (line 42-46):

```typescript
const EASY_VARIANTS: readonly CardVariant[] = [
  { key: 'slow_day',  label: 'Slow Day',        icon: '😴', goalDelta: -0.15, cashBonus: 0,  flavor: 'A breather shift. Lower goal, no reward.' },
  { key: 'steady',    label: 'Steady Service',  icon: '🍵', goalDelta: -0.08, cashBonus: 20, flavor: 'Smaller break on goal — but a small tip on pass.' },
  { key: 'prep_day',  label: 'Prep Day',        icon: '📋', goalDelta: -0.20, cashBonus: 0,  flavor: 'Big goal cut. Save your cash for the Pantry.' },
]
```

Replace with:

```typescript
const EASY_VARIANTS: readonly CardVariant[] = [
  { key: 'slow_day',             label: 'Slow Day',             icon: '😴', goalDelta: -0.15, cashBonus: 0,  flavor: 'A breather shift. Lower goal, no reward.' },
  { key: 'steady',               label: 'Steady Service',       icon: '🍵', goalDelta: -0.08, cashBonus: 20, flavor: 'Smaller break on goal — but a small tip on pass.' },
  { key: 'prep_day',             label: 'Prep Day',             icon: '📋', goalDelta: -0.20, cashBonus: 0,  flavor: 'Big goal cut. Save your cash for the Pantry.' },
  { key: 'friend_of_the_house',  label: 'Friend of the House',  icon: '🤝', goalDelta: -0.12, cashBonus: 30, flavor: 'A regular tips the chef. Smaller goal, modest reward on pass.' },
]
```

### Step 2: Rebalance Big Tab + add All-In to risk pool

- [ ] **Step 2.1:** Find the `RISK_VARIANTS` array (line 48-52):

```typescript
const RISK_VARIANTS: readonly CardVariant[] = [
  { key: 'big_tab',     label: 'Big Tab',       icon: '💰', goalDelta: 0,    cashBonus: 60,  flavor: 'Same goal, cash bonus on pass.' },
  { key: 'high_roller', label: 'High Roller',   icon: '🎲', goalDelta: 0.10, cashBonus: 120, flavor: 'Harder goal — bigger payday on pass.' },
  { key: 'gambit',      label: 'Chef’s Gambit', icon: '🎯', goalDelta: 0.05, cashBonus: 90,  flavor: 'Modest goal hike for a sizeable tip.' },
]
```

Replace with:

```typescript
const RISK_VARIANTS: readonly CardVariant[] = [
  { key: 'big_tab',     label: 'Big Tab',       icon: '💰', goalDelta: 0.05, cashBonus: 80,  flavor: 'Small risk for a solid tip on pass.' },
  { key: 'high_roller', label: 'High Roller',   icon: '🎲', goalDelta: 0.10, cashBonus: 120, flavor: 'Harder goal — bigger payday on pass.' },
  { key: 'gambit',      label: 'Chef’s Gambit', icon: '🎯', goalDelta: 0.05, cashBonus: 90,  flavor: 'Modest goal hike for a sizeable tip.' },
  { key: 'all_in',      label: 'All-In',        icon: '🃏', goalDelta: 0.20, cashBonus: 200, flavor: 'Push every chip in. Toughest goal of the run — biggest payday.' },
]
```

### Step 3: Build check

- [ ] **Step 3.1:** Run `npm run build`. Expected: build succeeds.

### Step 4: Lint check

- [ ] **Step 4.1:** Run `npm run lint`. Expected: no new warnings or errors.

### Step 5: Commit

- [ ] **Step 5.1:**

```bash
git add src/data/adventurePathCards.ts
git commit -m "feat(adventure): new path variants + rebalance Big Tab

Adds Friend of the House (easy: -12% goal / +\$30) and All-In
(risk: +20% goal / +\$200). Rebalances Big Tab from a strict
upgrade (0% goal / +\$60) to a genuine risk card (+5% goal / +\$80)
so the risk pool no longer has a dominant choice.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: `useAdventureRun.buildShiftReset` wiring

**Files:**
- Modify: `src/hooks/useAdventureRun.ts`

Threads the new garnish/boss-driven fields into the RESET action so the reducer code from Task 2 actually receives them.

### Step 1: Update `buildShiftReset` to seed the new fields

- [ ] **Step 1.1:** Open `src/hooks/useAdventureRun.ts`. Find the `buildShiftReset` function (line 89-132). Locate the existing logic that composes boss + garnish deltas (line 93-110), then the return block (line 111-131).

Find the entire return block:

```typescript
  return {
    type: 'RESET',
    shiftDuration: ADVENTURE_SHIFT_DURATION,
    cookingSpeed: delta.options.cookingSpeed ?? 1,
    orderSpeed: delta.options.orderSpeed ?? baseOrderSpeed,
    orderSpawnRate: delta.options.orderSpawnRate ?? baseOrderSpawn,
    enabledRecipes: run.currentRecipes,
    teams: undefined,
    participantCount: 0,
    heatPerCookMultiplier: heatMul === 1 ? undefined : heatMul,
    coolAmountBonus: coolBonus === 0 ? undefined : coolBonus,
    flatTipPerOrder: delta.state.flatTipPerOrder,
    choppingCookTimeMultiplier: delta.state.choppingCookTimeMultiplier,
    orderPatienceBonus: delta.state.orderPatienceBonus,
    overheatThreshold: delta.state.overheatThreshold,
    bossMoneyMultiplier: boss.state.bossMoneyMultiplier,
    cooldownMultiplier: boss.state.cooldownMultiplier,
    disabledStations: boss.state.disabledStations,
    activeGarnishes: run.ownedGarnishes.map(g => g.garnishId),
    activeBossDebuff: pathCard?.bossDebuffId,
  }
}
```

Replace with:

```typescript
  // ── Sub-project C — garnish-driven seeds ──
  const ownsPhoenixWing = run.ownedGarnishes.some(g => g.garnishId === 'phoenix_wing')
  const ownsApprentice  = run.ownedGarnishes.some(g => g.garnishId === 'apprentice')

  // ── Sub-project C — combined orderPatienceBonus (garnish + boss can both contribute) ──
  // Friendly Faces (+ms) and Hangry Mob (-ms) compose additively.
  const orderPatienceBonusCombined =
    (delta.state.orderPatienceBonus ?? 0) + (boss.state.orderPatienceBonus ?? 0)

  return {
    type: 'RESET',
    shiftDuration: ADVENTURE_SHIFT_DURATION,
    cookingSpeed: delta.options.cookingSpeed ?? 1,
    orderSpeed: delta.options.orderSpeed ?? baseOrderSpeed,
    orderSpawnRate: delta.options.orderSpawnRate ?? baseOrderSpawn,
    enabledRecipes: run.currentRecipes,
    teams: undefined,
    participantCount: 0,
    heatPerCookMultiplier: heatMul === 1 ? undefined : heatMul,
    coolAmountBonus: coolBonus === 0 ? undefined : coolBonus,
    flatTipPerOrder: delta.state.flatTipPerOrder,
    choppingCookTimeMultiplier: delta.state.choppingCookTimeMultiplier,
    orderPatienceBonus: orderPatienceBonusCombined === 0 ? undefined : orderPatienceBonusCombined,
    overheatThreshold: delta.state.overheatThreshold,
    bossMoneyMultiplier: boss.state.bossMoneyMultiplier,
    cooldownMultiplier: boss.state.cooldownMultiplier,
    disabledStations: boss.state.disabledStations,
    activeGarnishes: run.ownedGarnishes.map(g => g.garnishId),
    activeBossDebuff: pathCard?.bossDebuffId,
    // ── Sub-project C — new RESET seeds ──
    heatDecayAboveThreshold: delta.state.heatDecayAboveThreshold,
    heatDecayRate: delta.state.heatDecayRate,
    autoExtinguishCharges: ownsPhoenixWing ? 1 : undefined,
    apprenticeTimerMs: ownsApprentice ? 0 : undefined,
    lostOrderPenalty: boss.state.lostOrderPenalty,
  }
}
```

### Step 2: Build check

- [ ] **Step 2.1:** Run `npm run build`. Expected: build succeeds.

### Step 3: Lint check

- [ ] **Step 3.1:** Run `npm run lint`. Expected: no new warnings or errors.

### Step 4: Commit

- [ ] **Step 4.1:**

```bash
git add src/hooks/useAdventureRun.ts
git commit -m "feat(adventure): wire new content-variety fields through buildShiftReset

Threads garnish-driven (heatDecay*, autoExtinguishCharges,
apprenticeTimerMs) and boss-driven (lostOrderPenalty) fields into
the RESET action. orderPatienceBonus is now composed additively from
garnish (Friendly Faces) + boss (Hangry Mob) contributions so they
can offset each other on the same shift.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Manual verification

**Files:** none — eyes-only verification.

> Use the `superpowers:verification-before-completion` skill to gate completion. Every check must be eyeballed in a real browser; do not claim done without observing the result.

### Step 1: Start dev server

- [ ] **Step 1.1:** Run `npm run dev` and open the printed URL.

### Step 2: Build + lint baseline

- [ ] **Step 2.1:** Run `npm run build`. Expected: zero TypeScript errors, bundle succeeds.
- [ ] **Step 2.2:** Run `npm run lint`. Expected: zero new warnings or errors compared to the base branch.

### Step 3: Regression sanity (vanilla Adventure run)

- [ ] **Step 3.1:** Start a fresh Adventure run, buy NO garnishes from the Pantry, complete shift 1. Verify everything plays identically to the pre-PR base: no extra ingredients spawn, no surprise money tips, no system chat from new garnishes.
- [ ] **Step 3.2:** Start a Free Play round. Verify no Adventure-specific behaviour leaks into Free Play (no auto-extinguishes, no apprentice drips, etc.).

### Step 4: Verify each common garnish

- [ ] **Step 4.1: Loose Lid.** Buy in Pantry. Cook on any non-exempt station (e.g. Grill) until heat goes above 75. Stop cooking. Heat should visibly tick down toward 75 over the next several seconds. Stops at exactly 75 (clamps).
- [ ] **Step 4.2: Repeat Customer.** Buy in Pantry. Have the same user serve the same recipe 3 times in a row → on the 3rd serve, the system chat should append `(Repeat Customer +$25!)` and money goes up by +$25. Serve a different recipe / have a different user serve in between → no bonus, streak resets.
- [ ] **Step 4.3: Side Salad.** Buy in Pantry. Wait for a new order to spawn. The tray (`preparedItems`) should gain 1 random ingredient from that order's recipe at spawn time. Multiple back-to-back orders each add one item.

### Step 5: Verify each rare garnish

- [ ] **Step 5.1: Phoenix Wing.** Buy in Pantry. Force an overheat on any station. The chat should show `🪶 Phoenix Wing saved the {station}! Slots lost, station restored.`; station goes back to heat 0, not locked. Force a SECOND overheat in the same shift → normal overheat (no auto-restore). Next shift → another free save available.
- [ ] **Step 5.2: The Apprentice.** Buy in Pantry. Wait 35 seconds with the game unpaused. The tray gets a new prep item with chat `👨‍🍳 The Apprentice prepped X.`. Pause the game → timer pauses. Verify it fires periodically (every 35s).
- [ ] **Step 5.3: Long Memory.** Buy in Pantry. Serve dishes. On the 5th, 10th, 15th serves of the shift, the chat message includes `(Long Memory +$40!)` and money goes up by +$40. Counter resets on shift end.

### Step 6: Verify each new boss

- [ ] **Step 6.1: Hangry Mob.** Reach S4 or S8 path-pick. If Hangry Mob doesn't appear, replay until it shows (the path-pair is seeded). Pick it. In-shift: new orders should have noticeably shorter patience timers compared to a vanilla shift (you can compare the time-bar fill rate visually).
- [ ] **Step 6.2: Bad Reviews.** Reach S4 or S8 path-pick. If Bad Reviews doesn't appear, replay. Pick it. Deliberately let one order expire. Money goes DOWN by $20 and chat shows `⭐ Bad Reviews · −$20`.

### Step 7: Verify each new path variant

- [ ] **Step 7.1: Friend of the House.** Play multiple non-boss shifts. Eventually `friend_of_the_house` appears as the easy slot. Briefing chip shows `-12% goal` and `+$30 cashBonus`. Pass the shift → +$30 to run bank.
- [ ] **Step 7.2: All-In.** Play multiple non-boss shifts. Eventually `all_in` appears as the risk slot. Briefing chip shows `+20% goal` and `+$200 cashBonus`. Pass the shift → +$200 to run bank.
- [ ] **Step 7.3: Big Tab rebalance.** Play multiple non-boss shifts. When `big_tab` appears, briefing chip shows `+5% goal` and `+$80 cashBonus`.

### Step 8: Verify PvP behaviour for Bad Reviews

- [ ] **Step 8.1:** Start a PvP run. Force Bad Reviews on a boss shift. Let one order expire. BOTH `redMoney` and `blueMoney` decrease by $20 (both team scores go down equally — Bad Reviews charges both teams since lost orders aren't team-tagged).

### Step 9: Verify saved-run resume

- [ ] **Step 9.1:** Start a run, buy 1 garnish from this PR (e.g. Phoenix Wing), complete a shift to hit a save boundary, close the browser tab.
- [ ] **Step 9.2:** Reopen — the Resume Adventure pill should appear on Main Menu. Click Resume. Game state should restore correctly with the new garnish still active on the next shift.

### Step 10: Verify Friendly Faces + Hangry Mob interaction

- [ ] **Step 10.1:** Buy Friendly Faces (+10000ms patience) on an earlier shift, then take Hangry Mob (-15000ms) on a boss shift. Result: net `-5000ms` patience per new order. Orders should still feel sharper than baseline but less brutal than vanilla Hangry Mob alone — confirms additive composition works.

### Step 11: Verify no console errors

- [ ] **Step 11.1:** Throughout all the above, the browser dev console should show ZERO errors related to the new fields (e.g. `Cannot read property of undefined`). Warnings related to existing features are not a regression and can be ignored.

---

## Self-review

Cross-checking the plan against the spec:

| Spec section | Covered by |
|--------------|-----------|
| Loose Lid garnish | Task 1 (fields), Task 2 Step 1 (TICK decay), Task 3 Step 2.1 (data) + Step 3.1-3.3 (effect aggregation), Task 5 Step 1.1 (RESET seed) |
| Repeat Customer garnish | Task 1 (`repeatCustomerStreak` field), Task 2 Step 6 (SERVE), Task 3 Step 2.1 (data) |
| Side Salad garnish | Task 2 Step 5 (SPAWN_ORDER), Task 3 Step 2.1 (data) |
| Phoenix Wing garnish | Task 1 (`autoExtinguishCharges` field + RESET), Task 2 Step 2 (TICK intercept), Task 3 Step 2.1 (data), Task 5 Step 1.1 (RESET seed) |
| The Apprentice garnish | Task 1 (`apprenticeTimerMs` field + RESET), Task 2 Step 3 (TICK timer), Task 3 Step 2.1 (data), Task 5 Step 1.1 (RESET seed) |
| Long Memory garnish | Task 2 Step 6.1 (SERVE), Task 3 Step 2.1 (data) — uses existing `state.served` counter (no new field needed) |
| Hangry Mob boss | Task 3 Step 4 (BossId + data), Step 5 (BossDelta + applyBossDebuff case), Step 6 (getBossPool), Task 5 Step 1.1 (orderPatienceBonus combined) |
| Bad Reviews boss | Task 1 (`lostOrderPenalty` field + RESET), Task 2 Step 4 (TICK ORDER_EXPIRED branch), Task 3 Step 4 (BossId + data), Step 5 (BossDelta + applyBossDebuff), Step 6 (getBossPool), Task 5 Step 1.1 (RESET seed) |
| Friend of the House path variant | Task 4 Step 1 |
| All-In path variant | Task 4 Step 2 |
| Big Tab rebalance | Task 4 Step 2 |
| PvP penalty distribution (Bad Reviews) | Task 2 Step 4.3 (TICK return both teams) + Task 6 Step 8 (manual verify) |
| Friendly Faces + Hangry Mob additive composition | Task 5 Step 1.1 (`orderPatienceBonusCombined`) + Task 6 Step 10 (manual verify) |
| Saved-run resume safety | Spec note — saved-run payload only stores garnish IDs and current boss debuff, both routed through string lookups that no-op for unknown IDs. Task 6 Step 9 verifies. |
| Free Play / pre-PR save behaviour unchanged | All new fields are optional + default undefined → no behaviour change. Task 6 Step 3 verifies. |
| Build + lint clean | Each task ends with build + lint check |

**Placeholder scan:** searched for TBD / TODO / "implement later" / "handle edge cases" — none found.

**Type consistency:** `repeatCustomerStreak` shape matches between Task 1 (definition) and Task 2 Step 6 (usage). `autoExtinguishCharges` is `number | undefined` in both places. `lostOrderPenalty` is `number | undefined` everywhere. `GarnishField` extensions in Task 3.1 line up with the `case` branches in Task 3.3.

---

## Execution notes

- **Project rule:** every plan goes through `superpowers:writing-plans` then `superpowers:subagent-driven-development` (or `executing-plans`). This plan was produced via writing-plans.
- **PR strategy:** branch is `feat/adventure-content-variety` off `release/adventure-roguelike` — matches the chained PR pattern (PR #84 for Sub-project A is also off release).
- **Out of scope for this PR:** Sub-project B (Shareable run summary) was skipped. Sub-project D (Ascension difficulty) will reference this fuller content pool.
- **Manual verification only.** No automated tests because the repo has no test framework. Use the per-item test plan in Task 6.
