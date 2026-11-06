# commieD

Browser-based multiplayer maze shooter where teams share HP, ammo, and dashes. Teams win by being the last one standing; dead players become ghosts and produce resources through minigames.

## Status

Foundation only. The workspace builds, typechecks, lints, and tests; the client renders a placeholder and the server exposes a health check.

Development is **local-first**: build and finish a playable offline match, then add networking around the same deterministic simulation. See [`checklist.md`](checklist.md).

## Stack

- npm workspaces: `client`, `server`, `shared`
- Strict TypeScript 6 with ES2022 modules
- Client: Vite 8 on `:5173`
- Server: Fastify 5 on `:8080`, authoritative simulation
- Tests: Vitest
- Lint/format: ESLint 10 + Prettier

Package scope: `@commied/*` (npm scope is lowercase; the product name is **commieD**).

## Requirements

- Node.js >= 22
- npm >= 10

## Quickstart

```bash
cp .env.example .env   # optional; defaults match the values below
npm install
npm run dev
```

Endpoints:

- Client: `http://localhost:5173`
- Server health: `http://localhost:8080/health`
- WebSocket: `/ws` (proxied by Vite in development)

Production build:

```bash
npm run build   # shared -> server -> client
npm start
```

## Commands

| Command                 | Purpose                                         |
| ----------------------- | ----------------------------------------------- |
| `npm run dev`           | Watch `shared`, server, and client together     |
| `npm run build`         | Build in dependency order                       |
| `npm start`             | Run the built server                            |
| `npm run typecheck`     | Typecheck every workspace (builds `shared` first) |
| `npm run lint`          | ESLint                                          |
| `npm test`              | Vitest across all workspaces                    |
| `npm run format`        | Prettier write                                  |
| `npm run format:check`  | Prettier check                                  |
| `npm run verify`        | typecheck -> lint -> test -> build              |

## Repository layout

```
client/    Browser client: input, rendering, interpolation, HUD
server/    Authoritative game server: rooms, simulation, snapshots
shared/    Message types, validation, constants, shared math
idea.md    Product source of truth
checklist.md  Phased implementation tracker
```

## Architecture

Gameplay lives in a deterministic, environment-agnostic simulation in `shared`. During local development the client drives that simulation directly. When multiplayer lands, the server runs the same simulation authoritatively; clients send sequenced inputs and render snapshots with interpolation and local prediction. The `shared` package also owns the protocol and tunable constants so client and server cannot drift.

For the target scale (thousands of concurrent players across many cities), the server must use rooms/shards and interest-managed snapshots rather than broadcasting full state to every player.

## Documentation

- [`idea.md`](idea.md) — game design source of truth
- [`checklist.md`](checklist.md) — implementation phases and verification gates
- [`AGENTS.md`](AGENTS.md) — instructions for coding agents
