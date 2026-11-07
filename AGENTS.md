# commieD — Minigame Agent Notes

## Scope
- This repository is now **only for ghost minigames**. Another developer owns the main game: maze, movement, combat, teams, death/revival, and multiplayer.
- Do not build or modify main-game systems here, and do not restore the old client/server/shared implementation.
- Minigames:
  - Soul Contribution (HP clicker)
  - Bullet Press
  - Voodoo Magicania (power-up spin)
  - Dash Supplement Factory
- `idea.md` is the product source of truth. Never edit it.
- `checklist.md` is intentionally empty. Add only minigame tasks and tick items only after verification.

## Current state
- The workspace was intentionally cleared: no `package.json`, source, tests, or tooling. Do not assume npm commands exist.
- Previous code was deleted on purpose. Do not recover it from git history.

## Integration contract
- Build each minigame as a self-contained module with a narrow interface: explicit inputs/state in, resources/events out.
- Do not own the main game loop, networking, or global game state. The host game will integrate the module.
- Keep game logic deterministic and testable; avoid wall-clock time inside rules.
- Use placeholder assets until real assets arrive, and keep asset paths centralized.

## Minigame rules to follow
- **Soul:** at 5 CPS generate +1 HP/s, banked until needed; below 5 CPS lose 0.2 HP/s. Normal team regen is disabled while ghosts exist.
- **Bullet Press:** players follow keyboard sequences to make magazines. Imperfect magazines are rejected and the sequence restarts. Mistakes drop the production multiplier toward 0.5x; a long clean streak raises it slowly to 5x.
- **Voodoo Magicania:** live-player kills earn killmit; spend it to spin for a weighted random power-up.
- **Dash Factory:** click factory machines to produce dash seconds.

## Rules
- One small step at a time; do not scaffold the whole system at once.
- Commit after each completed step; never include unrelated or user changes.
- Test as you go, with only the minimal tooling a minigame needs.
- Do not reintroduce ghost shooting.
- Update `checklist.md` at the end of each request when work is completed.
