# Bullet Press

A ghost minigame for **commieD**. Type the displayed sequence to press bullets into magazines. Wrong keys break the magazine, and a broken magazine cannot be discarded until it fills or the sequence ends.

This module is self-contained:

- `src/bulletPressCore.js` — pure rules: sequences, magazines, broken magazines, multiplier, production. No DOM or timers.
- `src/main.js` — browser wiring: keyboard input, code display, magazine slots, flying typed rectangles.
- `index.html` + `styles.css` — minimal placeholder UI using plain rectangles. No image assets yet.

## Rules implemented

- A run is a 10-character sequence drawn from `A–Z` and `0–9`.
- The player types the sequence in order.
- A correct key loads 1 bullet into the current magazine.
- A magazine holds 5 bullets.
  - A perfect magazine adds `multiplier` magazines to production.
  - A broken magazine produces nothing and increments the broken count.
- A wrong key:
  - marks the current magazine broken,
  - advances to the next sequence character,
  - lowers the multiplier by `0.1`, down to `0.5x`.
- A broken magazine **cannot be discarded immediately**. It stays until:
  - it fills 5 bullets and is ejected as broken, or
  - the run ends, at which point a partial broken magazine is discarded.
- A clean partial magazine carries into the next run.
- The multiplier starts at `1.0x`, rises by `0.1` per perfect magazine, and caps at `5.0x`.
- Production is accumulated as a float; `takeMagazines()` returns whole magazines and leaves the remainder.

## Controls

- Type the highlighted character with the keyboard.
- Alphanumeric keys only; modifiers and other keys are ignored.

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

- `BulletPress` exposes `sequence`, `typed`, `index`, `filled`, `magazineBroken`, `runComplete`, `multiplier`, `production`, `magazinesProduced`, and `brokenMagazines`.
- `press(char)` returns an event with `type` (`correct` / `wrong` / `ignored`), `magazineCompleted` (`perfect` / `broken` / `null`), `runComplete`, `discardedBroken`, and the current stats.
- `nextRun()` starts the next sequence only after the current run is complete.
- `takeMagazines()` is the resource-out call for the host game.
- Sequences are deterministic from a seed or an injected RNG.

## Assumptions

- The sequence uses letters and digits only (no punctuation), to avoid layout/shift issues from the draft pseudocode.
- A 10-character run yields up to 2 magazines at 5 bullets each.
- The multiplier applies to magazines produced per perfect magazine.
- Broken magazines are cleared automatically at the end of a run, never mid-run.
