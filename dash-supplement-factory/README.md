# Dash Supplement Factory

A ghost minigame for **commieD**. Build batches of dash supplement, bottle them, and turn pots into speed. A full batch is 1–5 pots; each pot yields 20 one-second bottles, so five pots produce 100 seconds of dash.

This module has a pure rules layer and a browser shell:

- `src/dashSupplementFactoryCore.js` — deterministic state machine. No DOM, mouse events, or wall-clock timers.
- `src/main.js` — browser shell: stations, pots, ingredient buttons, hold controls, movement, bottling, and failure UI.
- `styles.css` — industrial placeholder art for pots, the machine, and the bottle stream.
- `assets/bottle.svg` — placeholder bottle sprite; paths live in `src/assets.js`.
- `test/dashSupplementFactoryCore.test.js` — `node --test` suite.

## Run

```bash
cd dash-supplement-factory
python3 -m http.server 8002
```

Then open <http://localhost:8002/>.

## Controls

| Action | Input |
| --- | --- |
| Take a pot | `TAKE POT` (enabled while collecting and under 5) |
| Add an ingredient | Click its button |
| Stir / heat / filter | Press and hold the matching hold button until the bar fills |
| Bottle the batch | After the belt loads the bottler, click `BOTTLE BATCH` once |
| Clear a wasted batch | `DESTROY BATCH` |
| Start the next batch | `NEW BATCH`, or take a pot |

The line highlights the current station, the matching action glows, and the hint line explains what to do next. Clicking an ingredient, a hold, or the bottler out of order wastes the whole batch: the pots are stamped `WASTED`, pending bottles are discarded, and the batch must be destroyed.


## Process

The source process is:

1. Take a pot — maximum 5 in a batch.
2. Add vodka.
3. Hold to stir.
4. Add national spirit.
5. Heat by holding the mouse.
6. Take the pot from the main station to the bottling station.
7. Click the machine to bottle the potions.

The default recipe adds two extra factory steps so a batch takes longer:

1. Add vodka.
2. Add beet extract.
3. Hold to stir.
4. Add national spirit.
5. Hold to heat.
6. Hold to filter.

Pass `recipe: BASE_RECIPE` to play the shorter source recipe.

## Rules implemented

- A batch holds 1–5 pots.
- Adding the first ingredient locks the batch; no more pots can be taken.
- The recipe must be followed exactly, in order.
- Stirring, heating, and filtering are holds. The browser reports elapsed hold time with `advanceHold(deltaMs)`; the core never reads a clock.
- Releasing a hold before it finishes wastes the batch.
- After the recipe, the belt carries every pot to the bottler automatically.
- The bottler runs the whole batch from one click; the shell bottles one pot at a time.
- Each pot produces 20 bottles; each bottle is 1 second of speed.
- A batch completes only after every pot is bottled. Pending bottles are not committed before then.
- Any order mistake fails the batch. Every pot is marked wasted, pending bottles are discarded, and no output is awarded.
- A failed batch must be destroyed with `destroyBatch()` before a new batch can start.
- Taking a pot after a completed batch starts a new batch without discarding produced output.
- The core is deterministic and replayable from the same action sequence.
- The shell keeps pot clicks harmless outside the moving phase, so a stray click never wastes a batch. `TAKE POT` is disabled when it cannot be used. Every ingredient, hold, and bottling-machine click is still live at all times, so an out-of-order click is a real mistake.

## Browser shell

- One-way conveyor with eight stations: pot hopper, vodka, beet extract, stir, national spirit, heat, filter, and bottler.
- A batch tray rides the belt and stops at the glowing station; the belt animates while the tray travels.
- Ingredient and hold controls stay live at inactive stations, so order mistakes remain possible; take-pot and bottler actions are gated to their phases.
- The batch number increments when the first pot is taken and appears on both the tray and the HUD.
- After the filter, the belt auto-carries the tray to the bottler and loads every pot.
- `BOTTLE BATCH` runs the batch once, bottling one pot at a time with a crate progress bar.
- Pots fill with colour as the recipe advances and simmer while a hold is active.
- Bottling streams bottle sprites into the crate; the machine shows the current batch bottle count.
- Completion and failure use a focused outcome card with the next action. `NEW BATCH` and `DESTROY BATCH` fade the tray and reset the line.
- The pendant lamps, glowing station, and hint line teach the order without a separate tutorial.

## Core API

```js
import {
  BASE_RECIPE,
  DEFAULT_RECIPE,
  DashSupplementFactory,
} from './src/dashSupplementFactoryCore.js';

const factory = new DashSupplementFactory();

factory.takePot();                    // collect up to maxPotsPerBatch
factory.addIngredient('vodka');       // starts the batch
factory.beginHold('stir');
factory.advanceHold(900);             // returns hold-progress
factory.advanceHold(900);             // returns hold-completed
factory.addIngredient('national-spirit');
factory.beginHold('heat');
factory.advanceHold(2200);
factory.beginHold('filter');
factory.advanceHold(1400);
factory.moveNextPot();                // repeat for each pot
factory.bottleNextPot();              // repeat for each pot
factory.takeBottles();                // bottles produced, then resets
factory.takeSeconds();                // seconds produced, then resets
```

Useful getters: `phase`, `batchSize`, `pots`, `currentStep`, `stepIndex`, `nextAction`, `canTakePot`, `canStartBatch`, `hold`, `holdProgress`, `batchBottles`, `batchSeconds`, `bottlesProduced`, `secondsProduced`, `failureReason`, `lastBatch`, `batchesCompleted`, and `batchesFailed`.

Action results are plain events: `pot-taken`, `batch-started`, `ingredient-added`, `hold-started`, `hold-progress`, `hold-completed`, `pot-moved`, `bottled`, `batch-complete`, `batch-failed`, `batch-destroyed`, `new-batch`, and `rejected`.

## Configuration

| Option | Default | Meaning |
| --- | --- | --- |
| `maxPotsPerBatch` | `5` | Maximum pots in one batch |
| `bottlesPerPot` | `20` | Bottles produced by one pot |
| `secondsPerBottle` | `1` | Speed duration of one bottle |
| `recipe` | `DEFAULT_RECIPE` | Ordered add/hold steps |
| `DEFAULT_RECIPE` holds | stir `1800ms`, heat `2200ms`, filter `1400ms` | Hold durations |

## Test

```bash
cd dash-supplement-factory
npm test
```

or directly:

```bash
node --test
```

## Integration notes

- `takeBottles()` returns whole bottles and resets the counter.
- `takeSeconds()` returns the speed duration and resets the counter.
- The host should stop calling `advanceHold()` when the mouse is released and call `releaseHold()` once.
- The browser owns the rAF clock and passes frame deltas; the core stays deterministic.
- `BASE_RECIPE` preserves the shorter source process; `DEFAULT_RECIPE` is the extended version.
- The host drives the batch: take 1–5 pots, complete the recipe, transfer the pots, then bottle. The shell only batches the bottling presentation; `bottleNextPot()` remains per pot.

## Assumptions

- One pot yields 20 bottles, and one bottle is one second of speed.
- The bottler is triggered once per batch; the core still bottles one pot at a time.
- The extra beet-extract and filter steps are optional additions, not part of the original source process.
- Hold durations are placeholders and should be tuned with playtesting.
- The belt transfer is automatic in the shell; the core still exposes `movePot()` / `moveNextPot()` for the host.
- The shell uses CSS placeholders and one bottle sprite until final art arrives.
- `takeSeconds()` / `takeBottles()` are not wired to the host game yet.
