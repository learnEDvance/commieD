# commieD

A collaborative communist-themed maze shooter. Two collectives share one HP
pool, one ammo reserve, and one dash reserve. Players who fall become ghosts and
work the minigames that keep their living comrades supplied.

## Play

```sh
node server/server.js
```

Open `http://localhost:8080/main-game/`. Pick a name and a collective, then join.
The server owns the match, the bots, and one shared factory per team.

Local practice without the server:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/main-game/?local=1`.

## How the pieces connect

- **Main game** (`main-game/`) renders the maze and sends inputs to the server.
  In local mode it runs the same deterministic `Game` in the browser.
- **Soul Clicker** (`soul-clicker/`) pays the team HP over time based on CPS.
  Low CPS is a signed negative contribution routed through `Game#drainHp`.
- **Bullet Press** (`bullet-press/`) turns clean magazines into `10 × multiplier`
  rounds of shared team ammo.
- **Dash Supplement Factory** (`dash-supplement-factory/`) is one shared floor
  per team. Every ghost sees the same pots, claims, cursors, and bottling line;
  each bottled pot awards 20 seconds of team dash.
- **Server** (`server/`) is dependency-free Node. It serves the static pages,
  speaks raw WebSocket, runs the authoritative room, replaces bots with humans,
  and resets the match.

The host embeds one minigame at a time in the ghost console so background tabs
never generate resources. Minigames only talk to the host; the host is the only
thing that talks to the server.

## Test

```sh
(cd main-game && npm test)
(cd soul-clicker && npm test)
(cd dash-supplement-factory && npm test)
(cd server && npm test)
```

Bullet Press still has three failing multiplier tests that predate the
integration; its rendering and key handling are unchanged.

## Layout

| Path | Purpose |
| --- | --- |
| `main-game/` | Maze client, HUD, lobby, ghost console, local fallback |
| `server/` | HTTP static host, WebSocket codec, authoritative room |
| `soul-clicker/` | HP ghost minigame |
| `bullet-press/` | Ammo ghost minigame |
| `dash-supplement-factory/` | Shared dash ghost minigame |
| `shared/theme.css` | One palette for all pages |
| `assets-needed.md` | Every image, video, audio, and font asset still needed |
| `checklist.md` | Verified work |
| `minigames.md` | Working specs and open questions |

`idea.md` is the product source of truth and is never edited. Stewed Luck is
still unimplemented.
