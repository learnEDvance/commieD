# commieD — Implementation Checklist

Work in phase order; keep one phase in progress. Tick only verified work.

Plan principle: **local-first**. Build a playable offline game, then add networking around the same deterministic simulation. Gameplay rules live in `shared`, never in client rendering or server request handlers.

## 0. Naming & repo hygiene
- [x] Rename `co-up` / `netshoot` → `commieD` in docs; use `commieD` for future package/client names
- [x] Decide and record the package scope: `@commied/*` (lowercase npm scope)
- [x] Add root `.gitignore`: `node_modules`, `dist`, `.env*`, `coverage`, logs
- [x] Add a README quickstart + architecture overview
- [x] Resolve the stale "ghost shooting" line in `idea.md` — owner removed it

## 1. Workspace foundation
- [x] Create npm workspaces root `package.json` (`client`, `server`, `shared`) + lockfile
- [x] Add a shared strict TS config; keep ES2022 modules per package
- [x] Add lint + format tooling and scripts
- [x] Add a test runner (Vitest) with per-package scripts
- [x] Add `typecheck` (`tsc --noEmit`) scripts
- [x] Add CI: install → typecheck → lint → test → build
- [x] Fix build order: `shared` → `server` → `client`
- [x] Make `dev` watch all three packages (including `shared`)
- [x] Add `.env.example` for ports/URLs; keep secrets server-side
- [x] Verify from scratch: clean install, dev, build, test

## 2. Local simulation core
Goal: one deterministic offline game, before multiplayer integration:
-create a background
-make a movable player.
-give player the ability to shoot
-
## 2. Local simulation core
Goal: one deterministic simulation both the offline client and future server can run.
- [x] Define environment-agnostic state types (`World`, `Player`, `Team`, `Bullet`, `Resource`, `Ghost`, `Input`)
- [x] Implement fixed-step `step(world, inputs, dt)` in `shared/src/sim`
- [x] Use a seeded RNG; never call `Math.random()` inside the simulation
- [x] Centralize tunables (speed, HP, damage, dash, regen, minigame rates)
- [x] Keep the simulation free of DOM, network, timers, and storage APIs
- [x] Add a local driver: fixed-step accumulator + interpolated rendering
- [x] Unit-test deterministic replay, no-op input, and dt stability
- [x] Document time/units and the client ↔ simulation boundary

## 3. Maze & movement (local)
- [ ] Deterministic seeded maze generation + wall extraction
- [ ] Shared circle-vs-rect collision used by the simulation
- [ ] Valid spawn points / path centers
- [ ] Movement with wall sliding
- [ ] Team-shared dash charges with cooldown
- [ ] Unit tests: determinism, collision edges, spawn validity
- [ ] Playable slice: move through the maze with a following camera

## 4. Local combat & teams
- [ ] Team model: members, shared HP pool, shared ammo, shared dashes
- [ ] Uniform team assignment (temporary local bots/dummies are fine)
- [ ] Team HP formula: live players × HP per player
- [ ] Bullet spawn, travel, hit detection, damage, cleanup
- [ ] Route all damage into the shared HP pool; handle simultaneous deaths
- [ ] Shared ammo consumption/reload; no personal ammo
- [ ] Kill credit / killmit accrual
- [ ] Last-team-standing win condition
- [ ] Playable slice: shoot opponents and watch the team HP pool react
- [ ] Unit tests: pool math, hit detection, wipe/win conditions

## 5. Death, revival, elimination (local)
- [ ] On team HP reaching 0: mark the team dead and halve its HP
- [ ] Select the best `n/2` players for revival (define the ranking metric)
- [ ] Revive with correct HP/ammo/reset state
- [ ] Non-revived players enter ghost mode
- [ ] Eliminate a team when live members reach 1 (define revival interaction)
- [ ] HUD/event feed for death, revival, and elimination
- [ ] Unit tests: odd `n`, `n = 1`, repeated wipes, deterministic selection

## 6. Ghost mode & soul economy (local)
- [ ] Ghost state, visibility, and spectator camera
- [ ] Ghosts collect world resources
- [ ] Ghost chooses which resource to contribute
- [ ] Soul clicker with rolling CPS measurement
- [ ] At 5 CPS: +1 HP/s to the team, banked until needed
- [ ] Below 5 CPS: −0.2 HP/s
- [ ] Define bank cap/decay to prevent infinite stockpiles
- [ ] Regen gating: no ghosts → normal regen; ghosts → ghost HP only
- [ ] Anti-autoclicker and fairness checks
- [ ] Unit tests: CPS thresholds, regen gating, banked HP consumption

## 7. Minigames (local)
### Bullet Press
- [ ] Furnace hold 5 s → stays heated 20 s
- [ ] Press molten iron into sheets
- [ ] Cutter requires 5 s of clicking → runs 25 s → produces bullets
- [ ] Load magazines; release when full
- [ ] Sync multi-ghost co-op state
- [ ] Output feeds the team ammo pool
- [ ] Tests: timers, co-op races, output accounting

### Voodoo Magicania
- [ ] Killmit currency from live-player kills
- [ ] Spin the pot for a weighted random power-up
- [ ] Apply/expire power-ups and expose them to the team
- [ ] Tests: weights, duplicate/illegal-state prevention

### Speed Supplement Factory
- [ ] Mouse-wheel spin input → speed seconds
- [ ] Team consumes the speed resource
- [ ] Rate-limit/anti-cheat the input
- [ ] Tests: conversion + caps

### Playable slice
- [ ] Complete offline match: live combat → wipe → revival/ghost → minigame → win
- [ ] Verify with placeholder assets only

## 8. Multiplayer foundation
Only start after the offline match is playable.
- [ ] Define message envelope + `MsgType` (`JOIN`, `INPUT`, `SNAPSHOT`, `EVENT`, …)
- [ ] Add protocol versioning and runtime validation for all inbound messages
- [ ] Run the same `shared` simulation on the server; no duplicate rules
- [ ] Fastify WebSocket server exposing `/ws` and `/health`
- [ ] Session lifecycle: join, reconnect grace, disconnect cleanup
- [ ] Input queue with sequence numbers + last-processed acknowledgement
- [ ] Snapshot serialization; start full-state, then delta/interest-managed
- [ ] Client networking driver replaces the local driver; keep offline mode working
- [ ] Snapshot interpolation + local prediction/reconciliation
- [ ] Desync detection / simulation checksum in development
- [ ] Tests: protocol validation round trips, reconnect, two-client smoke test

## 9. Scale, reliability, security
- [ ] Interest management: send only relevant entities
- [ ] Compress/binarize snapshots; budget bytes per client
- [ ] Backpressure and drop policy for slow clients
- [ ] Object pooling / allocation budget in the hot loop
- [ ] Stateless gateways + room workers with a shared registry
- [ ] Region/city routing with failover
- [ ] Rate limits, message-size caps, strict input validation
- [ ] Server-authoritative checks for every resource and minigame
- [ ] Load test 1k and 10k simulated players; record tick/bandwidth budget
- [ ] Chaos tests: disconnects, slow clients, worker restart

## 10. Observability & operations
- [ ] Structured logs with request/player/room IDs
- [ ] Metrics: CCU, rooms, tick duration, messages/s, errors
- [ ] Dashboards and alerts
- [ ] Health/readiness endpoints
- [ ] Deploy pipeline with rollback
- [ ] Privacy/security review; no secrets in client bundles

## 11. Verification gates
### Local game gate
- [ ] Offline match completes end-to-end with placeholder assets
- [ ] Deterministic simulation tests pass
- [ ] `npm run verify` passes
- [ ] Single-player performance is stable

### Multiplayer gate
- [ ] Two real clients complete a match through the server
- [ ] Reconnect and disconnect paths verified
- [ ] Load test meets tick/bandwidth budget
- [ ] `npm run verify` passes
- [ ] README + checklist updated, step committed
