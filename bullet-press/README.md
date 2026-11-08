# Bullet Press

A ghost minigame for **commieD**. One sequence fills one magazine. Type the displayed characters to pull bullets up into the magazine; wrong keys leave red slots. When every slot is filled, the magazine rolls out to the right and the next one enters from the left.

This module is self-contained:

- `src/bulletPressCore.js` — pure rules: sequences, slots, speed multiplier, production. No DOM or timers.
- `src/main.js` — browser wiring: keyboard input, assembly-line animation, bullet feeds, elapsed timer.
- `index.html` + `styles.css` — minimal placeholder UI. No image assets yet.

## Layout

From top to bottom:

1. **Sequence presenter** — the characters to type; the next one is highlighted. It sits above the magazine line.
2. **Magazine line** — a full-width conveyor centered in the middle of the screen. The current 10-slot magazine sits on the line, with two empty magazines queued to its left and the previous magazine (if any) to its right.
3. **Bullet feeds** — one vertical feed line per slot. Each line runs from below the bottom of the screen up to the magazine line and has an upward arrowhead, with its bullet centered at the lower end. A correct key fills that feed upward in green and pulls its bullet up into the magazine; a wrong key fills it red.
4. When all slots are filled, the line shifts right: the current magazine becomes the previous one, a waiting magazine slides into the center, and a fresh empty magazine enters from the left. Older previous magazines slide farther right and fade out.
5. Magazine and sequence objects use a 5% larger scale than the base layout.

## Rules implemented

- One sequence is 10 characters drawn from `A–Z`.
- A correct key fills the next magazine slot green, consumes that feed’s bullet, and fills the feed line upward.
- A wrong key fills the next slot red, fills that feed line red, and marks the whole magazine broken.
- A broken magazine **cannot be discarded immediately**. It stays until every slot is filled.
- Once all slots are filled, the magazine shifts right, becomes the previous magazine, and a waiting magazine moves into the center.
- A perfect magazine produces `multiplier` magazines.
- A broken magazine produces nothing and increments the broken count.
- The multiplier is a **whole number from 1 to 5**, based on typing speed across the completed magazine:

| Average time per key | Multiplier |
| -------------------- | ---------- |
| ≤ 400 ms             | x5         |
| ≤ 600 ms             | x4         |
| ≤ 800 ms             | x3         |
| ≤ 1100 ms            | x2         |
| slower               | x1         |

- A broken magazine awards `x0` because it produces nothing.
- Production is an integer; `takeMagazines()` returns the whole magazines produced and resets the counter.
- The timer starts when a magazine reaches the center (`start(nowMs)`), not while it is sliding in.
- Sequences come from a seeded RNG (or an injected RNG), never `Math.random()`.
- There is no Q pause; `Q` is a valid sequence character.

## Controls

- Type the highlighted character with the keyboard.
- Letter keys only; digits, punctuation, and modifiers are ignored.

## Run

ES modules need an HTTP server:

```bash
cd bullet-press
python3 -m http.server 8001
```

Open <http://localhost:8001/>.

## Test

Uses Node's built-in test runner; no dependencies.

```bash
cd bullet-press
npm test
```

or directly:

```bash
node --test
```

## Integration notes

- `BulletPress` exposes `sequence`, `slots`, `index`, `filled`, `complete`, `brokenMagazine`, `multiplierForDuration(durationMs)`, `lastMultiplier`, `lastDurationMs`, `production`, `magazinesProduced`, and `brokenMagazines`.
- `start(nowMs)` begins the current magazine’s timer once it is docked.
- `press(char, nowMs)` returns an event with `type` (`correct` / `wrong` / `ignored` / `not-ready`), `slotIndex`, `complete`, `broken`, `multiplier`, `durationMs`, and the current production.
- `nextMagazine(nowMs)` starts a fresh sequence only after the current magazine is complete. Omit `nowMs` and call `start(nowMs)` when the magazine docks.
- `takeMagazines()` is the resource-out call for the host game.
- Sequences are deterministic from a seed or an injected RNG.

## Assumptions

- Letters only (no digits or punctuation), to avoid confusion such as `0` vs `O`.
- The sequence length and magazine slots are the same value (`sequenceLength`).
- Speed is the only multiplier input; accuracy only decides whether the magazine is perfect or broken.
- The speed thresholds are placeholders and should be tuned with playtesting.
- A broken magazine is counted once, when it finishes and is ejected.
