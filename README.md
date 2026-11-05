# commieD

Browser-based multiplayer maze shooter where teams share HP, ammo, and dashes. Teams win by being the last one standing; dead players become ghosts and produce resources through minigames.

## Status

Pre-implementation. The repository currently contains design and planning docs only — there is no source, `package.json`, or runnable app yet.

## Planned stack

- npm workspaces: `client`, `server`, `shared`
- Strict TypeScript with ES2022 modules
- Client: Vite on `:5173`, rendering to canvas
- Server: Fastify + `@fastify/websocket` on `:8080`, authoritative simulation
- Shared: wire types, runtime validation, and gameplay constants

Package scope: `@commied/*` (npm scope is lowercase; the product name is **commieD**).

## Repository layout

```
client/    Browser client: input, rendering, interpolation, HUD
server/    Authoritative game server: rooms, simulation, snapshots
shared/    Message types, validation, constants, shared math
idea.md    Product source of truth
checklist.md  Phased implementation tracker
```

## Quickstart (available after phase 1)

```bash
npm install
npm run dev
```

Expected local endpoints:

- Client: `http://localhost:5173`
- Server: `http://localhost:8080`
- WebSocket: `/ws` (proxied by Vite in development)

Build order is `shared` → `server` → `client`:

```bash
npm run build
npm start
```

## Architecture

The server is authoritative: clients send sequenced inputs, the server advances a fixed-timestep simulation, and clients render snapshots with interpolation and local prediction. The `shared` package owns the protocol and tunable constants so client and server cannot drift.

For the target scale (thousands of concurrent players across many cities), the server must use rooms/shards and interest-managed snapshots rather than broadcasting full state to every player.

## Documentation

- [`idea.md`](idea.md) — game design source of truth
- [`checklist.md`](checklist.md) — implementation phases and verification gates
- [`AGENTS.md`](AGENTS.md) — instructions for coding agents
