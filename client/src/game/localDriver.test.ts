import { describe, expect, it } from 'vitest';
import { createPlayer, createWorld, FIXED_DT, SIM, type InputMap } from '@commied/shared';
import { LocalDriver } from './localDriver.js';

function makeDriver() {
  const player = createPlayer({
    id: 'p1',
    name: 'Player 1',
    teamId: 'red',
    position: { x: 100, y: 100 },
  });
  const world = createWorld({ seed: 1, players: [player] });
  const driver = new LocalDriver(world);

  return { driver, player, world };
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

describe('LocalDriver', () => {
  it('runs the simulation at a fixed timestep', () => {
    const { driver, world } = makeDriver();

    driver.advance(FIXED_DT, {});

    expect(world.tick).toBe(1);
    expect(driver.alpha).toBeCloseTo(0, 10);
  });

  it('interpolates between simulation steps', () => {
    const { driver } = makeDriver();

    driver.advance(FIXED_DT, moveRight());
    const atStep = driver.getRenderState().players[0];

    driver.advance(FIXED_DT / 2, moveRight());
    const betweenSteps = driver.getRenderState().players[0];

    expect(betweenSteps?.x).toBeGreaterThan(atStep?.x ?? 0);
  });

  it('caps catch-up work after a long frame', () => {
    const { driver, world } = makeDriver();

    driver.advance(1, moveRight());

    expect(world.tick).toBe(SIM.maxCatchUpSteps);
  });

  it('does not move without input', () => {
    const { driver } = makeDriver();

    driver.advance(FIXED_DT * 10, {});

    const state = driver.getRenderState();
    expect(state.players[0]?.x).toBe(100);
    expect(state.players[0]?.y).toBe(100);
  });
});
