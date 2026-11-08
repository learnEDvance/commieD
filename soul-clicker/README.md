# Soul Clicker (Soul Contribution)

A ghost minigame for **commieD**. Click your soul to contribute HP to the living teammates.

This module is intentionally small and self-contained:

- `src/soulClickerCore.js` — pure rules and state (CPS window, HP gain/loss, color bands). No DOM, no timers.
- `src/shapes.js` — random shape plans (type, position, size, delay, lifetime).
- `src/main.js` — browser wiring: HUD, soul clicks, shape spawning.
- `assets/soul-placeholder.svg` — dummy central soul sprite. Replace with real art later.

All assets are placeholders and paths are kept in one place (`index.html` + `main.js`). Visual polish is intentionally deferred until real art arrives.

## Rules implemented

- CPS is measured over a rolling 10-second window.
- At `CPS >= 5`, HP changes at `0.2 × CPS` HP/s (so 5 CPS = `+1 HP/s`).
- Below 5 CPS, HP drops by `0.2 HP/s`.
- Team HP has **no maximum cap**.
- HP bar bands, with `baseline = 100 × living teammates`:
  - **red** below baseline,
  - **yellow** from baseline through `baseline + 90`,
  - **green** above `baseline + 90`.
- Random shapes appear every 10–30 seconds at random screen positions. Clicking one grants `+5 HP`. Missing it has no penalty.
- The HP bar fill is scaled to `baseline + 90` and clamps at 100%; the numeric HP keeps growing past that.

## Run

ES modules need an HTTP server (opening `index.html` directly will not load the module).

```bash
cd soul-clicker
python3 -m http.server 8000
```

Then open <http://localhost:8000/>.

### URL parameters

| Param        | Default | Meaning                                      |
| ------------ | ------- | -------------------------------------------- |
| `teammates`  | `1`     | Living teammates; sets the HP baseline        |
| `hp`         | baseline| Starting team HP                              |
| `shapeMinMs` | `10000` | Minimum delay between shapes (ms)             |
| `shapeMaxMs` | `30000` | Maximum delay between shapes (ms)             |

Example: `http://localhost:8000/?teammates=4&hp=450&shapeMinMs=3000&shapeMaxMs=6000`

## Test

Uses Node's built-in test runner; no dependencies.

```bash
cd soul-clicker
npm test
```

or directly:

```bash
node --test
```

## Integration notes

- The core exposes `SoulClicker` with `click(nowMs)`, `advanceTo(nowMs)`, `tick(nowMs, deltaSeconds)`, `cpsAt(nowMs)`, `band`, `hp`, `baseline`, `fillRatio`, `addShapeBonus()`, and `setLivingTeammates(count)`.
- `click(nowMs)` settles the pending HP change immediately, then records the click. `advanceTo(nowMs)` does the same on every frame, so HP add/subtract follows the CPS counter without waiting.
- `nowMs` is host-supplied; rules never read the wall clock. The browser layer owns `performance.now()` and `requestAnimationFrame`.
- The host game should feed the team's living-player count and consume the resulting HP value/resources.
