# commieD — Minigame Specs

Status: Soul Clicker, Bullet Press, and Dash Supplement Factory are implemented under their own folders; Stewed Luck is not started. `idea.md` is still the product source of truth; this file records the working details and open questions for the ghost minigames.

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

Purpose: a station-management factory game that produces dash seconds.

Implemented: `dash-supplement-factory/src/dashSupplementFactoryCore.js` (pure rules, no DOM or wall-clock), `test/dashSupplementFactoryCore.test.js` (21 tests), and a browser shell in `dash-supplement-factory/` (`index.html`, `styles.css`, `src/main.js`, `src/assets.js`, `assets/bottle.svg`, `assets/vial.svg`). Run it with `python3 -m http.server 8002` from the module folder.

Flow:

1. Take unlimited empty pots from the top-left intake.
2. Drag each pot into the station for its current numbered process.
3. The station processes automatically. Move the pot before its ready window expires.
4. Repeat through twelve processes over six reusable stations.
5. After process 12, drag the pot into the bottom-right bottler.
6. Bottling produces 20 vials of one-second dash; vials leave right, emptied pots leave bottom.

Layout:

- Intake top left.
- Six separate stations with 2×2 slot grids and machine protrusions: mill, vat, press, still, filter, bureau.
- Bottler bottom right.
- Info panel bottom left with title, live stats, the full numbered process plan, and the current hint.
- Dynamic route arrows run from each pot's station to its next required station and are labelled with the process number.

Processes as implemented:

| # | Process | Station | Work | Window |
| --- | --- | --- | --- | --- |
| 1 | Seize the Harvest | Mill | 1500 ms | 7000 ms |
| 2 | Nationalize the Mash | Vat | 1400 ms | 7000 ms |
| 3 | Agitate the Masses | Press | 1200 ms | 6500 ms |
| 4 | Distill the Spirit | Still | 1900 ms | 6500 ms |
| 5 | Collectivize the Vat | Vat | 1500 ms | 7000 ms |
| 6 | Purge Deviations | Filter | 1400 ms | 6500 ms |
| 7 | Ratify the Plan | Bureau | 1200 ms | 7000 ms |
| 8 | Five-Year Ferment | Still | 2100 ms | 6500 ms |
| 9 | Commissar's Blend | Vat | 1500 ms | 7000 ms |
| 10 | Inspect the Cadre | Bureau | 1300 ms | 6500 ms |
| 11 | Filter the Line | Filter | 1700 ms | 6500 ms |
| 12 | Seal the Revolution | Press | 1400 ms | 7000 ms |

The vat is used three times; the still, filter, bureau, and press twice; the mill once.

Rules as implemented:

- The intake is unlimited.
- Each station holds four pots in a 2×2 grid. A fifth drop is rejected and stays at its source.
- A pot can only enter the station for its current process. Wrong-station drops are rejected without losing the pot.
- Stations process automatically; a working pot cannot leave.
- A finished process opens a ready window. If the window empties, the pot spoils, leaves the station, and frees its slot.
- Process 12 must finish before the bottler accepts the pot.
- The bottler holds four pots and bottles one pot every `900 ms`.
- One pot produces 20 vials; one vial is one second of dash.
- Vials are only awarded when bottling finishes.
- The core is deterministic and replayable; the browser owns the clock and reports deltas.

Core interface:

- Mutations: `takePot()`, `dropPot(potId, targetId)`, `advance(deltaMs)`.
- Output: `takeVials()`, `takeSeconds()`, `takeBottles()` alias.
- State: `processes`, `stations`, `pots`, `activePots`, `intakePots`, `occupancy`, `vialsProduced`, `secondsProduced`, `potsBottled`, `potsSpoiled`, `elapsedMs`, `stationCapacity`, `bottlerCapacity`.
- `dropPot()` returns `pot-dropped` or `rejected` (`wrong-station`, `station-full`, `bottler-full`, `pot-busy`, `processes-remaining`, `pot-gone`).
- `advance()` returns a tick with ordered `events` (`process-complete`, `pot-spoiled`, `pot-bottled`).

Browser shell as built:

- Separate station cards, no belt. Each card has a machine protrusion and four slots.
- Pointer drag-and-drop from the intake or a ready station to the next station or bottler.
- Gold arrows show the next hop for ready pots; dashed arrows show the hop still processing.
- The bottom-left panel shows title, IN PLAY / VIALS / DASH / SPOILED, all twelve numbered processes, and a live hint.
- Pots show a process badge, fill level, work progress, and a ready-window timer.
- Bottling streams vial sprites off the right edge; emptied pots fall off the bottom edge.
- Wrong drops raise a toast; spoiled pots are removed and counted.
- The line never ends or batches; play continues as long as the player takes pots.

Open questions:

- Confirm one pot should yield 20 one-second vials.
- Tune the process durations and ready windows through playtesting.
- Confirm wrong-station drops should be free rather than spoiling or delaying the pot.
- Decide whether the six-station, twelve-process plan is the final route.
- Integrate `takeVials()` / `takeSeconds()` with the host speed resource.
