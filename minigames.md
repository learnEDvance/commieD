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

Layout (top to bottom): sequence presenter → centered full-width magazine line → branch lines → single horizontal feeder. The current magazine sits at the center of the screen, with two empty magazines queued to its left and the previous magazine to its right. The feeder enters from the right and stops at the leftmost branch, so it serves only this station. It sits above the 10 branch layers. Ten vertical branch lines rise from it, one per slot, each carrying a column of bullets up to the magazine. The feeder is clogged while the branches are full. The bullet aligned with the used branch rises from the main feeder into that branch, while the remaining feeder bullets advance to fill its gap. The top branch bullet, closest to the magazine, loads into the magazine; the rest move up and a new bullet enters at the bottom from the main feeder. Bullets and feed lines are centered on their slots. Magazine and sequence objects use a 5% larger scale.

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
- The timer starts on the first valid keypress, not while the magazine waits or slides in. Q pauses and resumes the minigame.
- Production is an integer; `takeMagazines()` returns whole magazines to the host.
- Sequences come from a seeded RNG (or an injected RNG), never `Math.random()`.

Assumed (change if wrong):

- The sequence length and the number of magazine slots are the same value.
- Letters only (no digits or punctuation), to avoid confusion such as `0` vs `O`.
- Input is keyboard-only; no on-screen keypad yet.
- Speed is the only multiplier input; accuracy only decides perfect vs broken.
- A broken magazine awards `x0` because it produces nothing.
- The speed thresholds are placeholders for playtesting.
- The timer excludes paused time; Q is not in the A�Z sequence.

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

Purpose: ghosts produce dash seconds for their team's shared reserve.

Implemented: deterministic rules in `dash-supplement-factory/src/dashSupplementFactoryCore.js` with a browser shell in `dash-supplement-factory/`. Run its tests with `node --test` from that module folder.

Flow and stations:

- Take unlimited empty batches from the depot and drag each batch through twelve numbered processes across six reusable stations: Commie Mill, National Spirit Fermenter, Vodka Mixer, Propaganda Addition, Capitalist Hate Infuser, and Inspection.
- Each processing station holds four batches. A batch must visit the station for its current process. Work is automatic; a wrong-station drop is rejected.
- Each process completion opens a ready window, shown by a circular timer that shifts from green to yellow to red. If the timer expires, the batch becomes waste and remains at its station until manually moved to disposal.
- After process 12 finishes, the batch can be moved to the bottler. The bottler holds four batches and empties them one at a time over ten seconds.
- Wasted batches can be moved to disposal. Disposal empties batches one at a time and sends the empty container away on the conveyor.
- A bottled batch contributes 20 seconds of dash. The factory panel displays the team's currently available dash seconds, not a lifetime production total.
- The interface shows PROCESSING, DASH AVAILABLE, and WASTED; it does not show vials or a production log.
- The six processing stations are aligned, display no 2�2 label, and the floor is titled DASUP FACTORY.
- The core uses an explicit host clock and returns resource events; it does not own the main-game loop or global state.

Process work durations and ready windows remain adjustable playtesting values. The main game integrates the factory output with the shared team dash reserve.
