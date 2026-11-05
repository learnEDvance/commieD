# commieD (netshoot) — Agent Notes

## Current state
- Working tree is docs-only: no `package.json`, source, tests, lint, or CI. Do not assume npm scripts exist; inspect before claiming a build works.
- `idea.md` is the product source of truth. Never edit it.
- `checklist.md` is the execution tracker. Tick boxes only for work actually completed in the current request, and update it at the end of every request.

## Naming
- Project is being renamed `co-up` / `netshoot` → `commieD`. Apply it consistently in package names (`@commieD/*`), titles, and docs when touching them.

## Recoverable prototype — read before restarting
- A TypeScript prototype was deleted in `a4c9ebb`. Recover files with `git show a4c9ebb^:<path>` (e.g. `server/src/index.ts`, `shared/src/index.ts`).
- Stack: npm workspaces `client` / `server` / `shared`; strict TS ES2022; Vite 5 on :5173 proxying `/ws` to :8080; Fastify 4 + `@fastify/websocket` on :8080; `tsx watch` for server dev; 60 Hz authoritative JSON snapshots using a numeric `MsgType` enum.
- Root scripts were `npm run dev | build | start`. Build order matters: `shared` → `server` → `client`.
- Gotcha: root `dev` did not watch `shared`. Run `npm run dev -w shared` alongside it when changing wire types.
- `shared/src/index.ts` owns wire types and gameplay constants; client and server must import them, never duplicate.
- The old prototype committed `dist/`; don't repeat that. Keep generated `dist/` ignored.

## Non-negotiables
- One small task at a time. Don't scaffold the whole game in one pass.
- Commit after each completed step; never include unrelated/user changes (e.g. uncommitted `idea.md` edits).
- Test as we go. Add a real test runner before gameplay grows (the prototype had none).
- Design for 1000s of concurrent players across ~200 cities: server-authoritative, no full-state broadcast to every player; add rooms/interest management early.
- `idea.md` line 23 still mentions "ghost shooting", but commit `de2255b` intentionally removed that feature. Do not reintroduce it without confirmation.

## Before marking checklist work done
- [ ] Code builds / typechecks
- [ ] Relevant test or manual verification done
- [ ] No generated output, secrets, or unrelated files staged
- [ ] `checklist.md` updated
