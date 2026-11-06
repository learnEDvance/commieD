# Simulation contract

The simulation in this directory is the single source of gameplay truth. The offline client drives it now; the future server will drive the same code authoritatively.

## Environment rules

- No DOM, network, timers, storage, or platform APIs.
- No `Math.random()`. Use `world.rngState` with `nextRandom()`.
- No rendering or input-device code.
- Deterministic: same world + same inputs + same `dt` sequence ⇒ same world.

## Units and coordinates

- Time: seconds (`elapsedSeconds`, `dt`, lifetimes, cooldowns).
- Distance: world pixels.
- Direction: radians, with `0` pointing along `+x`.
- Coordinates: origin at top-left, `+x` right, `+y` down.
- HP, ammo, and resources: abstract points.

## Stepping

- `stepWorld(world, inputs, dt)` advances exactly one tick and mutates `world`.
- Default `dt` is `FIXED_DT` = `1 / SIM.tickRate` (60 Hz).
- Callers own the loop and must call it with a fixed timestep.
- `inputs` is keyed by player id. A missing player entry is a no-op.
- `moveX`/`moveY` are analog; magnitude above 1 is normalized. `aim` is radians.

## Client boundary

`client/src/game/localDriver.ts` accumulates real frame time, runs zero or more fixed steps, and interpolates the previous/current poses for rendering. Rendering never changes simulation state. A future network driver should replace the local driver without changing `stepWorld`.

## Adding gameplay

Put rules and tunables in `shared/src/sim`. Update the state types, add unit tests for deterministic outcomes, and only then expose the result through rendering or, later, the network protocol.
