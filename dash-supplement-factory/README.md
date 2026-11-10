# Dash Supplement Factory

A ghost management minigame for **commieD**. Take empty batches from the depot, drag each batch through twelve numbered processes at six reusable stations, and move it before its ready timer expires. Finished batches go to the bottler; wasted batches remain on the floor until moved to disposal.

The rules core is deterministic and owns no DOM or wall clock. The browser shell handles dragging, station displays, timers, route arrows, bottling and disposal animations, and the info panel.

## Run

```bash
cd dash-supplement-factory
python3 -m http.server 8002
```

Open <http://localhost:8002/>.

## Controls

- Select **TAKE BATCH** in the depot to add an empty batch.
- Drag an empty or ready batch to its next station.
- After process 12 finishes, drag the batch to the bottler.
- Drag a wasted batch to disposal. It is emptied there and carried away on the conveyor.

Stations work automatically. Each station holds four batches. A batch becomes ready when a process finishes; its timer counts down from green through yellow to red. If the timer expires, the batch becomes waste and stays in place until manually moved to disposal. The bottler and disposal each empty one batch at a time over ten seconds.

## Stations

- Batch depot: top left, unlimited empty batches.
- Commie mill, National Spirit Fermenter, Vodka Mixer, Propaganda Addition, Capitalist Hate Infuser, and Inspection: six aligned processing stations.
- Bottler: accepts batches after process 12 and contributes 20 seconds of dash to the shared reserve when emptying finishes.
- Disposal: accepts wasted batches, empties them, then carries them away on the lower conveyor.
- The info panel shows current processing, the team's dash seconds available, wasted batches, the process plan, and a live hint.

## Process plan

| # | Process | Station | Work | Ready window |
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

## Core API

```js
import { DashSupplementFactory, POT_STATUS, PROCESSES, STATIONS } from './src/dashSupplementFactoryCore.js';

const factory = new DashSupplementFactory();
factory.takePot();
factory.dropPot(1, 'mill');
factory.advance(1500);
// Continue through the ordered process plan.
factory.dropPot(1, 'bottler');
factory.advance(10000);
factory.takeSeconds();
```

`dropPot()` is the rules core's action API. It returns `pot-dropped` or `rejected`. `advance(deltaMs)` returns ordered events, including process completion, spoilage, bottling, and disposal. `takeSeconds()` returns produced dash seconds and resets the output counter. The core also exposes `processes`, `stations`, `pots`, `activePots`, `intakePots`, `occupancy`, `secondsProduced`, `potsBottled`, `potsSpoiled`, and station capacities. The host owns the clock and supplies deterministic time deltas.

## Test

```bash
node --test
```

The process durations and ready windows are placeholders for playtesting.
