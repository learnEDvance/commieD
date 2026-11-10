# commieD — Agent Notes

## Scope
- This repository contains the ghost minigames and the main-game prototype.
  The minigames are self-contained modules; the main game is in `main-game/`.
- Minigames:
  - Soul Clicker (Soul Contribution / HP clicker)
  - Bullet Press
  - Stewed Luck (power-up spin)
  - Dash Supplement Factory
- `minigames.md` holds the working specs, pseudocode notes, and unresolved questions. Read it before implementing.
- `idea.md` is the product source of truth. Never edit it.
- `checklist.md` tracks verified minigame and main-game work. Add only real tasks and tick items only after verification.

## Current state
- The minigames are self-contained; there is no root `package.json` or shared tooling. Each uses vanilla ES modules + `node --test`.
- Soul Clicker, Bullet Press, and Dash Supplement Factory are implemented. Stewed Luck is not started.
- The main game is a local browser prototype in `main-game/`: deterministic three-pass maze, shared team HP/ammo/dash, movement, combat, special items, ghosts, revival, elimination, winner detection, bots, and HUD.
- Authoritative multiplayer networking, city sharding, and lobby are not built yet.
- The `.py` files and `dash supplement factory` notes are user-written draft pseudocode, not production implementations.

## Integration contract
- Build each minigame as a self-contained module with a narrow interface: explicit inputs/state in, resources/events out.
- The host game integrates minigame modules through explicit resource contributions; minigames do not own the main loop, networking, or global game state.
- Keep game logic deterministic and testable; avoid wall-clock time inside rules.
- Use placeholder assets until real assets arrive, and keep asset paths centralized.
- The main-game core (`main-game/src/game.js`) is deterministic; rendering, input, and networking stay outside it.

## Minigame rules to follow
- **Soul Clicker:** at 5 CPS generate +1 HP/s, banked until needed; below 5 CPS lose 0.2 HP/s. No HP cap for teams with ghosts. Normal team regen is disabled while ghosts exist. HP bar is red below `100 × living teammates`, yellow through `+90`, green above. Random shapes spawn every 10–30 s for a small HP bonus.
- **Bullet Press:** players follow keyboard sequences to make magazines. Imperfect magazines are rejected and the sequence restarts. Mistakes drop the production multiplier toward 0.5x; a long clean streak raises it slowly to 5x.
- **Stewed Luck:** live-player kills earn killmit; spend it to spin the pot for a special power-up.
- **Dash Supplement Factory:** follow the pot-preparation order exactly; any mistake destroys the whole batch. 1 pot = 20 seconds of speed, 1 bottle = 1 second.

## Rules
- One small step at a time; do not scaffold the whole system at once.
- Commit after each completed step; never include unrelated or user changes.
- Test as you go, with only the minimal tooling a minigame needs.
- Do not reintroduce ghost shooting.
- Update `checklist.md` at the end of each request when work is completed.
