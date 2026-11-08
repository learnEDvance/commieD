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
- [x] Run instructions and URL parameters documented in `soul-clicker/README.md`
- [ ] Integrate with the host team HP/resource API (waiting on host game)
- [ ] Replace dummy assets with final art

## Bullet Press

- [ ] Resolve sequence/perfect-run rules with the user
- [ ] Implement core sequence + magazine rules
- [ ] Implement production multiplier
- [ ] Browser shell and dummy assets

## Stewed Luck

- [ ] Define power-up list, weights, and spin cost
- [ ] Implement spin rules
- [ ] Browser shell and dummy assets

## Dash Supplement Factory

- [ ] Confirm bottling math (1 pot = 20 × 1-second bottles)
- [ ] Define stirring/heating hold durations
- [ ] Implement exact-order batch rules and failure reset
- [ ] Browser shell and dummy assets
