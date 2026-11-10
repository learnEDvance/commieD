# commieD — Main Game Prototype

Local browser prototype of the commieD maze shooter. It runs a deterministic
game core with bots so the rules can be played and tested before authoritative
multiplayer exists.

## Run

```sh
cd main-game
python3 -m http.server 8000
```

Open `http://localhost:8000/`. No build step or dependencies are required.

## Test

```sh
cd main-game
npm test
```

The suite covers the three-pass maze generator, shared team resources, combat,
special items, ghost tasks, revival, elimination, and winner detection.

## Controls

| Input | Action |
| --- | --- |
| `WASD` / arrows | Move |
| Mouse | Aim |
| Click / hold | Shoot |
| `Shift` | Dash |
| `Space` | Trigger the team special item |
| `X` | Cycle minimap: nearby → full maze → comrats |
| `↑` / `↓` in comrats | Select a teammate and draw a route |
| `1` / `2` / `3` | Ghost task: clicker / ammo / dash |
| `R` | New match |

## Structure

- `src/maze.js` — deterministic three-pass maze: spawn rooms, carved maze, items.
- `src/game.js` — pure rules: shared HP/ammo/dash, movement, combat, specials,
  ghosts, revival, elimination, winner. It does not read wall-clock time.
- `src/bots.js` — deterministic local bot inputs.
- `src/main.js` — canvas renderer, HUD, input, and local demo shell.
- `styles.css` / `index.html` — HUD layout and entry point.

## Integration

`Game#contribute(teamId, { hp, ammo, dashSeconds })` is the host hook for the
ghost minigames. Contributions are additive, non-negative, and shared by the
whole team. `Game#snapshot()` exposes state for a future network adapter.

## Known limits

- This is a local single-player prototype with bots; the authoritative
  multiplayer server, city sharding, and lobby are not implemented yet.
- The minigame apps are not embedded in the main game yet; `contribute()` is the
  narrow bridge they will use.
