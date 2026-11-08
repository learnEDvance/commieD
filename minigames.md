# commieD — Minigame Specs

Status: Soul Clicker implemented under `soul-clicker/`; Bullet Press, Stewed Luck, and Dash Supplement Factory not started. `idea.md` is still the product source of truth; this file records the working details and open questions for the ghost minigames.

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

Intended rules from `idea.md`:

- The player follows a keyboard instruction sequence to make a magazine.
- A magazine is rejected if the sequence is not perfect.
- The whole sequence must be completed before the next manufacturing run starts.
- Mistakes control a production multiplier: it falls toward `0.5x` on every mistake and rises slowly toward `5x` during a long clean streak.

Draft pseudocode (`bulletpress.py`) currently:

- Generates a 10-character sequence.
- A correct key adds one bullet.
- A wrong key removes one bullet (not below zero).
- Every 5 bullets creates one magazine.
- Advances by removing the first sequence entry.

Open questions to resolve before building:

- Should one mistake reject the magazine immediately (idea) or only reduce the bullet count (pseudocode)?
- Is the sequence fixed at 10 entries, and how many bullets/magazines should one run produce?
- Define exact multiplier values, increments, decay, and the clean-streak duration.
- Handle shifted punctuation and keyboard layout differences.
- Use the simulation's seeded RNG, not `Math.random()`.

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

Process:

1. Take a pot — maximum 5 pots in a batch.
2. Add vodka.
3. Hold to stir.
4. Add national spirit.
5. Heat by holding the mouse.
6. Take the pot from the main station to the bottling station.
7. Click the machine to bottle the potions.

Rules:

- The order must be followed exactly.
- Any mistake wastes the **entire batch**; it must be destroyed.
- `1 pot = 20 seconds` of speed.
- `1 bottle = 1 second` of speed.

Open questions:

- Confirm that each pot yields 20 one-second bottles.
- Define hold durations for stirring and heating.
- Define the bottling click rate and whether all pots in a batch bottle together.
- Define how drag/take/bottling interactions work and how failure is shown.
