# Dash Supplement Factory

A ghost **management** minigame for **commieD**. Empty pots arrive at a top-left intake. Drag each one through twelve numbered processes spread across six reusable stations, move it before its ready window expires, then drop it into the bottom-right bottler. Each finished pot produces 20 one-second vials of dash.

This module has a pure rules layer and a browser shell:

- `src/dashSupplementFactoryCore.js` — deterministic station/process state machine. No DOM or wall clock.
- `src/main.js` — browser shell: drag-and-drop, station slots, timers, arrows, bottling FX, and the bottom-left info panel.
- `styles.css` — industrial placeholder art for the floor, stations, pots, vials, and arrows.
- `assets/bottle.svg`, `assets/vial.svg` — placeholder sprites; paths live in `src/assets.js`.
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
| Collect an empty pot | `TAKE POT` in the top-left intake (no limit) |
| Move a pot | Drag it from the intake or a station and drop it on a station |
| Start a process | Drop a ready pot on the station for its current numbered process |
| Finish a pot | After process 12, drag it into the bottom-right bottler |
| Bank output | Vials leave the bottler automatically; `DASH` tracks seconds |

Stations process pots automatically. A pot turns **ready** when its process finishes, then a timer starts. Drag it to the next station before the timer empties or it spoils and is lost.

## Floor

- **Intake** — top left, unlimited empty pots.
- **Six stations** — grain mill, mash vat, agitator press, spirit still, purity filter, and plan bureau. Every station has a 2×2 grid of four slots plus a machine protrusion.
- **Bottler** — bottom right. Four slots. Vials stream off the right edge; emptied pots fall off the bottom edge.
- **Info panel** — bottom left. Title, live stats, all twelve numbered processes, and the current hint.
- **Arrows** — drawn from each pot's station to its next required station, labelled with the process number. Bright gold arrows are ready to follow; dashed arrows are still processing.

## Process plan

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

The vat is used three times; the still, filter, bureau, and press twice; the mill once. The bottler is the final destination.

## Rules implemented

- The intake has no pot limit; `TAKE POT` always works.
- Each station holds four pots at once. A fifth drop is rejected and stays in its source.
- A pot can only enter the station required by its current process. A wrong station is rejected; the pot stays where it was.
- Stations process automatically. A working pot cannot be picked up.
- When work finishes the pot becomes ready and a window timer starts.
- If the window expires, the pot spoils, leaves the station, and frees its slot.
- After process 12, the pot can enter the bottler. Earlier drops are rejected.
- The bottler holds four pots and bottles each for `bottlingMs`.
- Each pot yields 20 vials; each vial is 1 second of dash.
- Vials are awarded when bottling finishes. The emptied pot leaves the floor.
- The core is deterministic and replayable from the same action sequence. The browser passes frame deltas to `advance()`.

## Core API

```js
import {
  DashSupplementFactory,
  POT_STATUS,
  PROCESSES,
  STATIONS,
} from './src/dashSupplementFactoryCore.js';

const factory = new DashSupplementFactory();

factory.takePot();                    // unlimited intake pot
factory.dropPot(1, 'mill');           // starts process 1
factory.advance(1500);                // tick: returns process-complete
factory.dropPot(1, 'vat');            // starts process 2
factory.advance(1400);
// ...continue through the plan...
factory.dropPot(1, 'bottler');        // only after process 12
factory.advance(900);                 // tick: returns pot-bottled
factory.takeVials();                  // 20, then resets
factory.takeSeconds();                // 20, then resets
```

Useful getters: `processes`, `stations`, `pots`, `activePots`, `intakePots`, `occupancy`, `vialsProduced`, `secondsProduced`, `potsBottled`, `potsSpoiled`, `elapsedMs`, `stationCapacity`, and `bottlerCapacity`.

`dropPot()` returns `pot-dropped` or `rejected` with a reason such as `wrong-station`, `station-full`, `bottler-full`, `pot-busy`, `processes-remaining`, or `pot-gone`.

`advance(deltaMs)` returns `{ type: 'tick', events, elapsedMs, ... }`. Events can include `process-complete`, `pot-spoiled`, and `pot-bottled` in the same tick.

## Configuration

| Option | Default | Meaning |
| --- | --- | --- |
| `stations` | `STATIONS` | Six station definitions |
| `processes` | `PROCESSES` | Ordered numbered process list |
| `stationCapacity` | `4` | Pots per station |
| `bottlerCapacity` | `4` | Pots in the bottler |
| `vialsPerPot` | `20` | Vials produced by one pot |
| `secondsPerVial` | `1` | Dash duration of one vial |
| `bottlingMs` | `900` | Bottling time per pot |

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

- The host owns the clock and calls `advance(deltaMs)`; the core never reads time.
- `takeVials()` returns whole vials and resets the counter.
- `takeSeconds()` returns the speed duration and resets the counter.
- `takeBottles()` is a backwards-compatible alias for `takeVials()`.
- `dropPot()` is the drag/drop entry point. The host may also drive the same API from another input scheme.
- If the host has fewer or more stations, pass custom `stations` and `processes`; every process station id must exist.

## Assumptions

- One pot yields 20 one-second vials.
- Stations always process automatically after a valid drop.
- Wrong-station drops are rejected without losing the pot; the time pressure comes from the ready window.
- The 12-process plan and hold windows are placeholders for playtesting.
- The shell uses CSS placeholder art and SVG sprites until final art arrives.
