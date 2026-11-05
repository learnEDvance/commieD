# commieD — Agent Notes

## Current state
- Working tree is docs-only: no `package.json`, source, tests, lint, or CI. Do not assume npm scripts exist; inspect before claiming a build works.
- This is a fresh start. Do not restore or revive code from deleted commits (e.g. `a4c9ebb`).
- `idea.md` is the product source of truth. Never edit it.
- `checklist.md` is the execution tracker. Tick boxes only for work actually completed in the current request, and update it at the end of every request.

## Naming and scope
- Product name: **commieD**. Do not reintroduce `co-up` or `netshoot` in new files.
- npm package scope: `@commied/*` — npm scopes must be lowercase. Apply it to all workspace packages.

## Planned baseline (phase 1, not implemented yet)
- npm workspaces `client` / `server` / `shared`; strict TS ES2022 modules.
- Client: Vite on `:5173`, proxying `/ws` to the server.
- Server: Fastify 4 + `@fastify/websocket` on `:8080`; authoritative fixed-timestep loop.
- Shared: protocol types, runtime validation, and gameplay constants; client/server must import them, never duplicate.
- Build order: `shared` → `server` → `client`. `dev` must watch all three packages.
- Keep generated `dist/` ignored; never commit build output.

## Non-negotiables
- One small task at a time. Don't scaffold the whole game in one pass.
- Commit after each completed step; never include unrelated/user changes (e.g. uncommitted `idea.md` edits).
- Test as we go. Add a real test runner in phase 1.
- Real assets arrive later. Use dummy/placeholder assets for now and keep asset paths centralized so they can be swapped without touching game logic.
- Design for 1000s of concurrent players across ~200 cities: server-authoritative, no full-state broadcast to every player; add rooms/interest management early.
- Ghost shooting was intentionally removed from `idea.md`. Do not reintroduce it without confirmation.

## Before marking checklist work done
- [ ] Code builds / typechecks
- [ ] Relevant test or manual verification done
- [ ] No generated output, secrets, or unrelated files staged
- [ ] `checklist.md` updated
