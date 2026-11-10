# commieD — Main Game

The main game is the authoritative maze match. It runs as a browser client,
optionally against the dependency-free Node server in `../server/`, and embeds
the ghost minigames in an iframe console.

## Run

Multiplayer (recommended):

```sh
node server/server.js
```

Open `http://localhost:8080/main-game/`, pick a name and a collective, and join.
The server owns the maze, both teams, the bots, and one shared Dash Supplement
Factory per team.

Local practice:

```sh
# from the repository root
python3 -m http.server 8000
```

Open `http://localhost:8000/main-game/?local=1`. This runs the deterministic
game in the browser with bots and local minigame contributions. Without
`?local=1` the page expects the WebSocket server.

## Test

```sh
cd main-game && npm test
cd ../server && npm test
```

The main-game suite covers the three-pass maze generator, shared team resources,
combat, special items, ghost tasks, revival, elimination, winner detection, and
contributions. The server suite covers the WebSocket codec, room joining, bot
replacement, ghost-only contributions, shared factories, ownership, cursors,
snapshots, and match resets.

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
| `1` / `2` / `3` | Ghost task: soul / ammo / dash |
| `R` | New match (local) or request a rematch (online) |

Ghosts get a **GHOST SHIFT** console. It loads one minigame at a time so a
hidden tab never generates resources.

## Structure

- `src/maze.js` — deterministic three-pass maze. Every corridor and connector is
  two tiles wide, and spawn rooms are at least 2×2.
- `src/game.js` — pure rules: shared HP/ammo/dash, movement, combat, specials,
  ghosts, revival, elimination, winner. It never reads wall-clock time.
- `src/bots.js` — deterministic local bot inputs; the server reuses them for
  bot-filled slots.
- `src/net.js` — small reconnecting browser WebSocket client.
- `src/ghost-console.js` — iframe host, tab switching, `postMessage` bridge, and
  contribution relay.
- `src/main.js` — renderer, HUD, input, lobby, snapshot interpolation, and the
  local fallback shell.
- `styles.css` / `index.html` — HUD, lobby, and ghost console layout.
- `../server/` — static host, raw WebSocket server, authoritative `Room`, bot
  roster, shared factories, and match reset.
- `../shared/theme.css` — one communist palette shared by every page.

## Minigame contract

The host and the embedded minigames exchange JSON through `postMessage`; only
the host talks to the server.

- Minigame → host: `{ type: 'minigame-ready', game }` on boot.
- Host → minigame: `{ type: 'state', hp, ammo, factory, livingTeammates, ... }`
  at snapshot speed.
- Soul Clicker → host: `{ type: 'contribute', game: 'soul-clicker', resources:
  { hp } }`. Low CPS is a negative value; the server routes it through
  `Game#drainHp` and skips the coat.
- Bullet Press → host: `{ type: 'contribute', game: 'bullet-press', resources:
  { ammo: 10 × multiplier } }` for each clean magazine.
- Dash Supplement Factory → host: `{ type: 'factory-action', action, potId,
  targetId }` and `{ type: 'pointer', x, y, active }`. The server owns the
  factory, so every ghost on a team works the same floor and sees the other
  ghosts' cursors and claimed pots.

## Known limits

- Authoritative matching and the lobby are implemented; city sharding and
  large-scale load testing are not.
- Stewed Luck is not started.
- Bots are deterministic and simple; they are placeholders for human teammates.
- The browser client interpolates snapshots but does not predict local
  movement, so very high latency will feel soft.
- Placeholder art remains until the assets in `../assets-needed.md` arrive.
