# commieD

A browser based team maze game with three ghost minigames that contribute to shared team resources. The root `index.html` is the single entry point; the main game hosts the minigames in its ghost console.

## Run the integrated game

Install Node.js, then from the repository root run:

```sh
npm --prefix server start
```

Open <http://localhost:8080/>. The server serves the site and its WebSocket match service from the same origin. For deployment, host this Node server on a service that supports long running processes and WebSocket upgrades; a static-only host cannot run multiplayer matches.

If the WebSocket server is unreachable, the game automatically starts a local
bot match. To launch local practice directly without Node:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000/?local=1>. Both local and hosted matches use eight
players per collective, with bots filling any open seats.

## How the pieces connect

- **Main game** (`main-game/`) renders the maze and HUD. It connects to the authoritative Node server when available and falls back to a local bot match when it is not.
- **Soul Clicker** (`soul-clicker/`) contributes HP.
- **Bullet Press** (`bullet-press/`) contributes ammunition from clean magazines.
- **Dash Supplement Factory** (`dash-supplement-factory/`) contributes dash seconds from bottled batches; wasted batches can be disposed of manually.
- **Server** (`server/`) serves the integrated app and owns the match, team resources, bots, and shared factory state.

The ghost console loads one minigame at a time. Minigames return contributions or actions to the host; they do not own the match loop or global team state. Stewed Luck is specified but not implemented. City sharding and large scale multiplayer remain future work.

## Verify

Run the module suites from their folders with `node --test`. The current suites cover the game core, server, Bullet Press, and Dash Supplement Factory.

## Layout

| Path | Purpose |
| --- | --- |
| `index.html` | Integrated site entry point |
| `main-game/` | Maze client, HUD, lobby, ghost console, local mode |
| `server/` | Static host, WebSocket service, authoritative room |
| `soul-clicker/` | HP contribution minigame |
| `bullet-press/` | Ammunition contribution minigame |
| `dash-supplement-factory/` | Dash contribution minigame |
| `shared/theme.css` | Shared visual theme |
| `idea.md` | Product idea and gameplay specification |
| `checklist.md` | Verified work |
