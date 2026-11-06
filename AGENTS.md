# commieD — Agent Notes

## Current state
- Phase 1 workspace is scaffolded: npm workspaces, strict TS, Vite client, Fastify server, shared package, tests, lint, and CI.
- Phase 2 local simulation is in place: deterministic fixed-step world under `shared/src/sim`, seeded RNG, and an offline client driver with interpolated rendering.
- Development is local-first: finish a playable offline match before adding multiplayer. The current client is an empty arena with placeholder movement only.
- `idea.md` is the product source of truth. Never edit it.
- `checklist.md` is the execution tracker. Tick boxes only for work actually completed in the current request, and update it at the end of every request.

## Naming and scope
- Product name: **commieD**. Do not reintroduce `co-up` or `netshoot` in new files.
- npm package scope: `@commied/*` — npm scopes must be lowercase. Apply it to all workspace packages.

## Commands and build order
- `npm run dev` — prebuilds `shared`, then watches `shared`, `server`, and `client` together.
- `npm run build` — `shared` → `server` → `client`; order is mandatory.
- `npm run typecheck` — builds `shared` first because server/client resolve its `dist` types.
- `npm run verify` — typecheck → lint → test → build. Use this before claiming completion.
- `npm start` — runs the built server (`server/dist`), not the dev server.
- Tests: `npm test` or `npm run test -w @commied/<pkg>`. Run one file with `npx vitest run <path>` from that package.
- Node >= 22 is required. This workspace was verified on Node 26 / npm 12.

## Architecture notes
- Local-first: all gameplay rules belong in a deterministic, environment-agnostic simulation under `shared/src/sim`. The client drives it locally now; the server will drive the same simulation later.
- Read `shared/src/sim/README.md` before changing simulation code. Keep it free of DOM, network, timers, and storage APIs, and use seeded RNG instead of `Math.random()`.
- `shared/src` owns types and constants; client/server import `@commied/shared`, never duplicate definitions.
- `shared` is consumed from `dist`, so rebuild it (or keep `dev` running) after changing its source.
- Client dev server is Vite on `:5173`; `/ws`, `/api`, and `/health` proxy to `SERVER_URL` (default `http://localhost:8080`).
- Env defaults live in `.env.example`; the server reads root `.env` via `--env-file-if-exists`. Never commit `.env`.
- Keep generated `dist/` ignored; never commit build output.

## Non-negotiables
- One small task at a time. Don't scaffold the whole game in one pass.
- Commit after each completed step; never include unrelated/user changes (e.g. uncommitted `idea.md` edits).
- Test as we go; add tests with each gameplay system.
- Real assets arrive later. Use dummy/placeholder assets for now and keep asset paths centralized so they can be swapped without touching game logic.
- Design for 1000s of concurrent players across ~200 cities: server-authoritative, no full-state broadcast to every player; add rooms/interest management early.
- Ghost shooting was intentionally removed from `idea.md`. Do not reintroduce it without confirmation.

## Before marking checklist work done
- [ ] `npm run verify` passes
- [ ] Relevant focused test or manual check done
- [ ] No generated output, secrets, or unrelated files staged
- [ ] `checklist.md` updated
