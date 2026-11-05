# commieD — Implementation Checklist

Work in phase order; keep one phase in progress. Tick only verified work.
Current tree has no code. Start fresh in phase 1 — do not restore the deleted prototype.

## 0. Naming & repo hygiene
- [x] Rename `co-up` / `netshoot` → `commieD` in docs; use `commieD` for future package/client names
- [x] Decide and record the package scope: `@commied/*` (lowercase npm scope)
- [x] Add root `.gitignore`: `node_modules`, `dist`, `.env*`, `coverage`, logs
- [x] Add a README quickstart + architecture overview
- [x] Resolve the stale "ghost shooting" line in `idea.md` — owner removed it

## 1. Workspace foundation
- [ ] Restore npm workspaces root `package.json` (`client`, `server`, `shared`) + lockfile
- [ ] Add a shared strict TS config; keep ES2022 modules per package
- [ ] Add lint + format tooling and scripts
- [ ] Add a test runner (e.g. Vitest) with per-package scripts
- [ ] Add `typecheck` (`tsc --noEmit`) scripts
- [ ] Add CI: install → typecheck → lint → test → build
- [ ] Fix build order: `shared` → `server` → `client`
- [ ] Make `dev` watch all three packages (including `shared`)
- [ ] Add `.env.example` for ports/URLs; keep secrets server-side
- [ ] Verify from scratch: clean install, dev, build, test

## 2. Shared protocol & simulation primitives
- [ ] Define IDs, `Vec2`, player/team/bullet/resource/ghost state types
- [ ] Define message envelope + `MsgType` (`JOIN`, `INPUT`, `SNAPSHOT`, `EVENT`, …)
- [ ] Add protocol versioning and runtime validation for all inbound messages
- [ ] Centralize tunables in shared constants (tick rate, speeds, HP, damage, minigame rates)
- [ ] Document time convention (`dt`, server tick) and units
- [ ] Unit-test serialization/validation round trips

## 3. Authoritative server core
- [ ] Fastify + WebSocket server exposing `/ws` and `/health`
- [ ] Fixed-timestep simulation loop decoupled from snapshot send rate
- [ ] Session lifecycle: join, reconnect grace, disconnect cleanup
- [ ] Input queue with sequence numbers + last-processed acknowledgement
- [ ] Delta/interest-managed snapshots instead of full-state broadcasts
- [ ] Document lag-compensation approach (or explicitly accept client-side tradeoffs)
- [ ] Basic metrics: tick time, players, rooms, message rates
- [ ] Load-test harness with N simulated clients
- [ ] Room/shard model for ~200 cities + city/region matchmaking
- [ ] Graceful shutdown and restart

## 4. Client foundation
- [ ] Vite + TS client shell with resize/DPR-safe canvas renderer
- [ ] Connect over same-origin `/ws` proxy; URL configurable per environment
- [ ] Capture input and send sequenced inputs at a fixed rate
- [ ] Snapshot interpolation + local prediction/reconciliation
- [ ] Render maze, players, bullets, resources, teams, and HUD
- [ ] Connection/reconnect UX (connecting, lost, reconnected)
- [ ] Browser smoke test: no console errors, stable frame rate

## 5. Maze & movement
- [ ] Deterministic seeded maze generation + wall extraction
- [ ] Shared circle-vs-rect collision used by the server
- [ ] Valid spawn points and team separation
- [ ] Movement with wall sliding; shared speed/dash constants
- [ ] Team-shared dash charges
- [ ] Unit tests: determinism, collision edges, spawn validity

## 6. Teams, shared resources, combat
- [ ] Uniform team assignment at match start
- [ ] Team state: members, shared HP pool, shared ammo, shared dashes
- [ ] Implement/document team HP formula: live players × HP per player
- [ ] Route all damage into the shared HP pool; handle simultaneous deaths
- [ ] Ammo pool consumption/reload; remove personal ammo
- [ ] Bullet spawn, travel, hit detection, damage, cleanup
- [ ] Win condition: last team standing
- [ ] Kill credit / killmit accrual from live-player kills
- [ ] Tests: shared-pool math, wipe detection, win condition

## 7. Death, revival, elimination
- [ ] On team HP reaching 0: mark team dead and halve team HP
- [ ] Select the best `n/2` players for revival (define the ranking metric)
- [ ] Revive with correct HP/ammo/reset state
- [ ] Non-revived players enter ghost mode
- [ ] Eliminate a team when live members reach 1 (define interaction with revival)
- [ ] HUD/event feed for death, revival, and elimination
- [ ] Tests: odd `n`, `n = 1`, repeated wipes, deterministic selection

## 8. Ghost mode & soul economy
- [ ] Ghost state, visibility, and spectator camera
- [ ] Ghosts collect world resources
- [ ] Ghost chooses which resource to contribute
- [ ] Soul clicker with rolling CPS measurement
- [ ] At 5 CPS: +1 HP/s to the team, banked until needed
- [ ] Below 5 CPS: −0.2 HP/s
- [ ] Define bank cap/decay to prevent infinite stockpiles
- [ ] Regen gating: no ghosts → normal regen; ghosts → ghost HP only
- [ ] Anti-autoclicker and fairness checks
- [ ] Tests: CPS thresholds, regen gating, banked HP consumption

## 9. Minigames
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

## 10. Scale, reliability, security
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

## 11. Observability & operations
- [ ] Structured logs with request/player/room IDs
- [ ] Metrics: CCU, rooms, tick duration, messages/s, errors
- [ ] Dashboards and alerts
- [ ] Health/readiness endpoints
- [ ] Deploy pipeline with rollback
- [ ] Privacy/security review; no secrets in client bundles

## 12. Verification gates
- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm test` green
- [ ] `npm run build` succeeds in dependency order
- [ ] Manual 2-client match: join → fight → wipe → revive/ghost → minigame → win
- [ ] Load test meets tick/bandwidth budget
- [ ] README + checklist updated, step committed
