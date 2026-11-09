# commieD — Minigame Specs

Status: Soul Clicker implemented under `soul-clicker/`; Bullet Press implemented under `bullet-press/`; Stewed Luck and Dash Supplement Factory not started. `idea.md` is still the product source of truth; this file records the working details and open questions for the ghost minigames.

## Shared contract

- Minigames are self-contained modules: explicit state/input in, resources/events out.
- Do not own the main game loop, networking, or global game state.
- Rules must be deterministic and testable; avoid wall-clock time.
- Use dummy/placeholder assets everywhere for now; keep asset paths centralized.

## 1. Soul Clicker (Soul Contribution)

Purpose: a ghost contributes their soul to increase the team's HP.

Implemented: `soul-clicker/` (ES modules, no dependencies). Tests run with `node --test`.

Rules as implemented:

- Click the central soul sprite to contribute.
- CPS is measured over a rolling 10-second window.
- At `CPS >= 5`: add HP at `0.2 × CPS` per second. At exactly 5 CPS this is the specified `+1 HP/s`.
- At `CPS < 5`: lose `0.2 HP/s` continuously.
- HP is settled immediately on every click (and every frame), so crossing 5 CPS switches from loss to gain at the click itself.
- Team HP has **no maximum cap**.
- HP bar spans half the screen at the top and shows the numeric HP.
- With `baseline = 100 × living teammates`, the bar is:
  - **red** when `hp < baseline`,
  - **yellow** when `baseline <= hp <= baseline + 90`,
  - **green** when `hp > baseline + 90`.
- The bar fill is scaled to `baseline + 90`, clamped at 100%; the numeric HP keeps growing beyond it.
- Random shapes appear every 10–30 seconds at random screen positions. Clicking one grants `+5 HP`; missing it has no penalty.
- Shape types: circle, square, triangle, diamond, star.
- Press **Q** to pause/resume. Pausing freezes HP gain/loss, the CPS window, and shape timers; pause duration is removed from game time.
- Visual effects and polish are deferred; the UI is intentionally minimal and uses placeholder assets (flat shapes, no fades, glows, or transitions).

Confirmed by user:

- Central clickable soul creates team HP.
- Revived teams with ghosts have no HP cap because they cannot regenerate.
- Red / yellow / green band thresholds above.

Assumed (change if wrong):

- HP gain keeps scaling above 5 CPS (`0.2 × CPS`) rather than capping at `1 HP/s`.
- Each collected shape gives `+5 HP`; missed shapes have no penalty.
- The minimum HP floor is `0`.
- Ghost stacking behaviour is deferred to the host game; the module tracks one ghost's contribution.

Open questions:

- Define the bank cap/decay once the host team economy exists.
- Define how multiple ghosts on one team stack.
- Confirm the `+5 HP` shape bonus and whether missing should hurt.

## 2. Bullet Press

Purpose: ghosts produce magazines that living teammates load into their guns.

Implemented: `bullet-press/` (ES modules, no dependencies). Tests run with `node --test`.

Layout (top to bottom): sequence presenter → centered full-width magazine line → branch lines → single horizontal feeder. The current magazine sits at the center of the screen, with two empty magazines queued to its left and the previous magazine to its right. The feeder enters from the right and stops at the leftmost branch, so it serves only this station. It sits above the 10 branch layers. Ten vertical branch lines rise from it, one per slot, each carrying a column of bullets up to the magazine. The feeder is clogged while the branches are full: loading a slot pulls the top bullet from its branch into the magazine, refills that branch from the feeder, and indexes the feeder forward by exactly one bullet. Bullets and feed lines are centered on their slots. Magazine and sequence objects use a 5% larger scale.

Rules as implemented:

- One sequence fills one magazine. The sequence is 10 characters drawn from `A–Z`.
- The player types the sequence in order; lowercase input is accepted.
- A correct key pulls the top bullet from that slot's branch into the magazine, refills the branch from the feeder, indexes the feeder by one bullet, and fills the slot green.
- A wrong key pulls the top bullet in red, refills the branch, indexes the feeder, fills the slot red, and marks the whole magazine broken.
- A broken magazine **cannot be discarded immediately**. It stays until every slot is filled.
- When all slots are filled, the line shifts right: the current magazine becomes the previous one, a waiting magazine moves to the center, and a new empty magazine enters from the left. Older previous magazines slide farther right and fade out.
- A perfect magazine produces `multiplier` magazines.
- A broken magazine produces nothing and increments the broken count.
- The multiplier is a **whole number from 1 to 5**, based on average time per key across the completed magazine:
  - `≤ 400 ms/key` → `x5`
  - `≤ 600 ms/key` → `x4`
  - `≤ 800 ms/key` → `x3`
  - `≤ 1100 ms/key` → `x2`
  - slower → `x1`
- The timer starts when the magazine docks, not while it slides in.
- Production is an integer; `takeMagazines()` returns whole magazines to the host.
- Sequences come from a seeded RNG (or an injected RNG), never `Math.random()`.

Assumed (change if wrong):

- The sequence length and the number of magazine slots are the same value.
- Letters only (no digits or punctuation), to avoid confusion such as `0` vs `O`.
- Input is keyboard-only; no on-screen keypad yet.
- Speed is the only multiplier input; accuracy only decides perfect vs broken.
- A broken magazine awards `x0` because it produces nothing.
- The speed thresholds are placeholders for playtesting.
- No Q pause; `Q` is a valid sequence character.

Open questions:

- Tune the speed thresholds to the real feel of the game.
- Confirm that a broken magazine should award `x0` rather than a low whole multiplier.
- Confirm whether production should stay whole magazines in the host economy.

## 3. Stewed Luck

Purpose: spend killmit earned by live-player kills to spin the communist stew pot for a special item/power-up.

Rules:

- Each live-player kill grants killmit to the team.
- Spend killmit to spin the pot.
- The spin returns a random special power-up.
- The pot is a "stewed luck" / communist pot edition wheel.

Open questions:

- Define the power-up list and spin weights.
- Define spin cost, duplicate handling, duration, and whether one player can spam spins.

## 4. Dash Supplement Factory

Purpose: a clicky factory minigame that produces dash seconds.

Implemented: `dash-supplement-factory/src/dashSupplementFactoryCore.js` (pure rules, no DOM or wall-clock), `test/dashSupplementFactoryCore.test.js` (28 tests), and a browser shell in `dash-supplement-factory/` (`index.html`, `styles.css`, `src/main.js`, `src/assets.js`, `assets/bottle.svg`). Run it with `python3 -m http.server 8002` from the module folder.

Source process:

1. Take a pot — maximum 5 pots in a batch.
2. Add vodka.
3. Hold to stir.
4. Add national spirit.
5. Heat by holding the mouse.
6. Take the pot from the main station to the bottling station.
7. Click the machine to bottle the potions.

Default extended recipe (the source process plus two extra factory steps):

1. Add vodka.
2. Add beet extract.
3. Hold to stir (`1800 ms`).
4. Add national spirit.
5. Hold to heat (`2200 ms`).
6. Hold to filter (`1400 ms`).

`BASE_RECIPE` keeps the shorter source process; `DEFAULT_RECIPE` is the extended version.

Rules as implemented:

- A batch holds 1–5 pots. Taking a sixth pot is rejected without failing the batch.
- Adding the first ingredient locks the batch; no more pots can be taken.
- The recipe must be followed exactly, in order.
- Stirring, heating, and filtering are holds. The browser passes elapsed milliseconds to `advanceHold(deltaMs)`; the core never reads a clock.
- Releasing a hold before it finishes wastes the batch.
- After the recipe, every pot must be moved from the main station to the bottling station.
- The bottling machine bottles one pot per click.
- `1 pot = 20 bottles`; `1 bottle = 1 second` of speed. A full five-pot batch is 100 seconds.
- Pending bottles are not committed until every pot in the batch is bottled.
- Any order mistake wastes the **entire batch**: all pots are marked wasted, pending bottles are discarded, and no output is awarded.
- A failed batch must be destroyed with `destroyBatch()` before another batch can start.
- Taking a pot after a completed batch starts a new batch without discarding produced output.
- The core is deterministic and replayable from the same action sequence.

Core interface:

- Mutations: `takePot()`, `startBatch()`, `addIngredient(id)`, `beginHold(stepId)`, `advanceHold(deltaMs)`, `releaseHold()`, `movePot(potId)`, `moveNextPot()`, `bottleNextPot()`, `destroyBatch()`, `newBatch()`.
- Output: `takeBottles()`, `takeSeconds()`.
- State: `phase`, `batchSize`, `pots`, `currentStep`, `stepIndex`, `nextAction`, `canTakePot`, `canStartBatch`, `hold`, `holdProgress`, `batchBottles`, `batchSeconds`, `bottlesProduced`, `secondsProduced`, `failureReason`, `lastBatch`, `batchesCompleted`, `batchesFailed`.
- Action results are plain events (`pot-taken`, `hold-progress`, `bottled`, `batch-failed`, `rejected`, and so on).

Browser shell as built:

- Main station on the left: five pot slots, `TAKE POT`, and one button per recipe step.
- Bottling station on the right: arrived pots, the bottling machine, a batch bottle bar, and the running dash total.
- Hold buttons fill while held; the pots simmer during a hold.
- Clicking a pot moves it; a ghost pot flies across the transfer rail.
- Bottling streams bottle sprites into the batch bar and pulses the machine.
- Failure blurs the floor, stamps every pot `WASTED`, and asks for `DESTROY BATCH`.
- Completion banks the bottles in a `BATCH COMPLETE` card with `NEW BATCH`.
- Pot clicks outside the moving phase are harmless and `TAKE POT` is disabled when unusable; ingredient, hold, and machine clicks stay live so order mistakes remain possible.

Open questions:

- Confirm that each pot should yield 20 one-second bottles rather than a different split.
- Tune the stir, heat, and filter hold durations.
- Confirm whether the bottling machine should bottle one pot per click or all pots at once.
- Decide whether bottled pots should stay click-to-move or gain drag-and-drop.
- Decide whether the extra beet-extract and filter steps stay in the final game.
- Integrate `takeBottles()` / `takeSeconds()` with the host speed resource.
