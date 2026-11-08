# commieD — Minigame Checklist

Tick only verified work. One small step at a time.

## Soul Clicker

- [x] Save the Soul Clicker spec and open questions in `minigames.md`
- [x] Pure core rules: rolling 10-second CPS window
- [x] HP gain at `0.2 × CPS` HP/s for 5+ CPS; `−0.2 HP/s` below 5
- [x] HP settles immediately on each click so the rate switches with CPS at the click moment
- [x] No maximum HP cap
- [x] HP bands: red below baseline, yellow through baseline + 90, green above
- [x] Unit tests for bands, CPS thresholds, no-cap, bonus, teammate changes, click expiry
- [x] Random shape plan helpers (type, position, size, delay, lifetime) with tests
- [x] Browser shell: half-screen HP bar with numeric HP, central soul sprite, shape layer
- [x] Dummy soul asset at `soul-clicker/assets/soul-placeholder.svg`
- [x] Shape spawn loop every 10–30 seconds; click grants `+5 HP`
- [x] Q pauses/resumes; HP, CPS window, and shape timers freeze
- [x] Run instructions and URL parameters documented in `soul-clicker/README.md`
- [ ] Integrate with the host team HP/resource API (waiting on host game)
- [ ] Replace dummy assets with final art

## Bullet Press

- [x] Resolve sequence/perfect-run rules in `minigames.md`
- [x] One sequence fills one magazine (10 slots)
- [x] Full-width magazine line with feed lines running from below the screen up to it
- [x] Magazine line centered horizontally and vertically
- [x] Magazine, slots, and sequence objects scaled up 5%
- [x] Upward arrowheads on every feed line
- [x] Two empty magazines queued left of current; previous magazine kept on the right
- [x] Feed lines fill upward when a slot is loaded (green correct, red wrong)
- [x] Feed bullets centered on their lines and sized to the slots
- [x] Sequence presenter sits above the magazine line
- [x] Instruction hint removed from the playfield
- [x] Letters-only sequences and input (no digits or punctuation)
- [x] Vertical presenter → magazine → bullet-feed layout
- [x] Correct keys pull green bullets up; wrong keys leave red slots
- [x] Magazine ejects right and the next enters from the left
- [x] Broken magazines stay until all slots fill
- [x] Whole-number speed multipliers (`x1`–`x5`) from average time per key
- [x] Unit tests for sequences, slots, broken magazines, speed multipliers, production
- [x] Browser smoke test: centered rail, queue positions, arrows, feed fills, perfect magazine, ejection, next magazine, broken magazine
- [x] Run instructions and rules documented in `bullet-press/README.md`
- [ ] Tune the speed thresholds through playtesting
- [ ] Confirm broken magazines should award `x0`
- [ ] Integrate `takeMagazines()` with the host magazine/resource API (waiting on host game)
- [ ] Replace placeholder rectangles with final art

## Stewed Luck

- [ ] Define power-up list, weights, and spin cost
- [ ] Implement spin rules
- [ ] Browser shell and dummy assets

## Dash Supplement Factory

- [ ] Confirm bottling math (1 pot = 20 × 1-second bottles)
- [ ] Define stirring/heating hold durations
- [ ] Implement exact-order batch rules and failure reset
- [ ] Browser shell and dummy assets
