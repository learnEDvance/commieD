import { describe, expect, it } from 'vitest';
import { FIXED_DT, SIM } from './constants.js';
import { createRngState, nextRandom } from './rng.js';
import { stepWorld } from './step.js';
import type { InputMap } from './types.js';
import { createPlayer, createWorld } from './world.js';

function makeWorld() {
  const player = createPlayer({
    id: 'p1',
    name: 'Player 1',
    teamId: 'red',
    position: { x: 100, y: 100 },
  });
  const world = createWorld({ seed: 1234, players: [player] });

  return { player, world };
}

function moveRight(): InputMap {
  return {
    p1: {
      moveX: 1,
      moveY: 0,
      aim: 0,
      shoot: false,
      dash: false,
      use: false,
    },
  };
}

describe('stepWorld', () => {
  it('replays deterministically from the same seed and inputs', () => {
    const a = makeWorld();
    const b = makeWorld();

    for (let i = 0; i < 120; i += 1) {
      stepWorld(a.world, moveRight(), FIXED_DT);
      stepWorld(b.world, moveRight(), FIXED_DT);
    }

    expect(b.world).toEqual(a.world);
  });

  it('does not move a player with no input', () => {
    const { player, world } = makeWorld();
    const start = { ...player.position };

    for (let i = 0; i < 60; i += 1) {
      stepWorld(world, {}, FIXED_DT);
    }

    expect(player.position).toEqual(start);
    expect(world.tick).toBe(60);
    expect(world.elapsedSeconds).toBeCloseTo(1, 10);
  });

  it('produces the same displacement for different step sizes', () => {
    const a = makeWorld();
    const b = makeWorld();

    for (let i = 0; i < 60; i += 1) {
      stepWorld(a.world, moveRight(), FIXED_DT);
    }
    for (let i = 0; i < 30; i += 1) {
      stepWorld(b.world, moveRight(), 1 / 30);
    }

    expect(b.player.position.x).toBeCloseTo(a.player.position.x, 6);
    expect(b.player.position.y).toBeCloseTo(a.player.position.y, 6);
  });

  it('clamps players inside the arena', () => {
    const { player, world } = makeWorld();

    for (let i = 0; i < 600; i += 1) {
      stepWorld(
        world,
        {
          p1: {
            moveX: -1,
            moveY: -1,
            aim: 0,
            shoot: false,
            dash: false,
            use: false,
          },
        },
        FIXED_DT,
      );
    }

    expect(player.position.x).toBeGreaterThanOrEqual(SIM.playerRadius);
    expect(player.position.y).toBeGreaterThanOrEqual(SIM.playerRadius);
  });

  it('rejects invalid timesteps', () => {
    const { world } = makeWorld();

    expect(() => stepWorld(world, {}, 0)).toThrow(RangeError);
    expect(() => stepWorld(world, {}, Number.NaN)).toThrow(RangeError);
  });
});

describe('nextRandom', () => {
  it('is reproducible and returns values in [0, 1)', () => {
    let a = createRngState(42);
    let b = createRngState(42);

    for (let i = 0; i < 32; i += 1) {
      const nextA = nextRandom(a);
      const nextB = nextRandom(b);

      expect(nextA.value).toBe(nextB.value);
      expect(nextA.value).toBeGreaterThanOrEqual(0);
      expect(nextA.value).toBeLessThan(1);
      a = nextA.state;
      b = nextB.state;
    }
  });
});
