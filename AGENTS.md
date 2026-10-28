# netshoot — agent notes

## What this repo is
- Design-only repo: `netshoot.md` is the game concept document (multiplayer maze shooter with player-connection teams, distributed treasury with time-based repayment, endgame team division).
- No code, build/test/lint configs, CI, or dependencies are present.

## Where to look
- Read `netshoot.md` first for mechanics, terminology (connections/teams/treasury/network delays/regeneration tax/division), and the explicit list of unresolved decisions (sections 9).

## Rules for changes
- Do **not** invent or implement mechanics before they are defined. Treat the "Unresolved Decisions" (netshoot.md §9) as open questions - follow the designer's intent, not common defaults.
- When editing `netshoot.md`, preserve the structure/terminology (connections form teams; treasury distributed across players; delays by hop count; time-based repayment/tax) and only add concrete details if the user explicitly specifies them.
- If adding files (code/specs), keep them consistent with the existing design vocabulary rather than introducing new terms for the same concepts.
