# co-up — agent notes

## What this repo is
- Design-only repo: `co-up.md` is the game concept document (multiplayer maze shooter with player-connection teams, distributed treasury with time-based repayment, endgame team division). Name: **co-up**.
- No code, build/test/lint configs, CI, or dependencies are present.

## Where to look
- Read `co-up.md` first for mechanics, terminology (connections/teams/treasury/network delays/regeneration tax/division/Time currency), and the explicit list of unresolved decisions (sections 9).

## Rules for changes
- Do **not** invent or implement mechanics before they are defined. Treat the "Unresolved Decisions" (co-up.md §9) as open questions - follow the designer's intent, not common defaults.
- When editing `co-up.md`, preserve the structure/terminology (connections form teams; treasury distributed across players; delays by hop count; time-based repayment/tax; Time = universal currency earned 1/sec, auto-converted by treasury to depleted resources).
- If adding files (code/specs), keep them consistent with the existing design vocabulary rather than introducing new terms for the same concepts.
- Verified behavior: on death, player is out of the current game (not respawned); killer gets a random drop. End goal: last player standing (when 1 team remains, divide uniformly into teams repeatedly until 1 remains). Time currency added (1/sec). Repayment: 0.4 Time/sec to treasury until debt repaid, rest used by player; no extra 5% tax. If all resources full, extra Time goes to treasury. If treasury lacks resources, player gets nothing. Max 3 connections per player. Connections cannot be broken until death (if transfer in progress and path breaks, resources lost; hop delay 0.2s). Resources: HP+, Speed+ (15s boost, 30s regen), Rounds+ (3 rounds of 10 bullets, no regen), Shield (10s invuln), Bomb (80 to enemy, 40 to nearest 5 linked). Collected from rainbow triangles or on kill. Visual: simple circles/lines/basic shapes, simple colors, minimal UI. Division: LCM rule favoring big teams, split treasury per head, connections broken on division.
