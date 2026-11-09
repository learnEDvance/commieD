# Dash Supplement Factory

A ghost minigame for **commieD**. Build batches of dash supplement, bottle them, and turn pots into speed. A full batch is 1–5 pots; each pot yields 20 one-second bottles, so five pots produce 100 seconds of dash.

This module is currently the pure rules layer:

- `src/dashSupplementFactoryCore.js` — deterministic state machine. No DOM, mouse events, or wall-clock timers.
- `test/dashSupplementFactoryCore.test.js` — `node --test` suite.

The browser shell is still to be built.

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
- After the recipe, every pot must be moved from the main station to the bottling station.
- The bottling machine bottles one pot per click.
- Each pot produces 20 bottles; each bottle is 1 second of speed.
- A batch completes only after every pot is bottled. Pending bottles are not committed before then.
- Any order mistake fails the batch. Every pot is marked wasted, pending bottles are discarded, and no output is awarded.
- A failed batch must be destroyed with `destroyBatch()` before a new batch can start.
- Taking a pot after a completed batch starts a new batch without discarding produced output.
- The core is deterministic and replayable from the same action sequence.

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

Useful getters: `phase`, `batchSize`, `pots`, `currentStep`, `nextAction`, `canTakePot`, `canStartBatch`, `hold`, `holdProgress`, `batchBottles`, `batchSeconds`, `bottlesProduced`, `secondsProduced`, `failureReason`, `lastBatch`, `batchesCompleted`, and `batchesFailed`.

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

## Assumptions

- One pot yields 20 bottles, and one bottle is one second of speed.
- The bottling machine bottles one pot per click.
- The extra beet-extract and filter steps are optional additions, not part of the original source process.
- Hold durations are placeholders and should be tuned with playtesting.
- The browser shell, drag/drop movement, and final art are not implemented yet.
