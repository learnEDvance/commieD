import { FIXED_DT, SIM } from './constants.js';
import type { InputMap, PlayerInput, World } from './types.js';

const NO_INPUT: PlayerInput = {
  moveX: 0,
  moveY: 0,
  aim: 0,
  shoot: false,
  dash: false,
  use: false,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/**
 * Advances the world by exactly one fixed step.
 * Mutates `world`; callers own the tick loop and must pass a fixed `dt`.
 */
export function stepWorld(world: World, inputs: InputMap, dt: number = FIXED_DT): void {
  if (!Number.isFinite(dt) || dt <= 0) {
    throw new RangeError('dt must be a positive finite number');
  }

  world.tick += 1;
  world.elapsedSeconds += dt;

  const minX = SIM.playerRadius;
  const maxX = Math.max(minX, world.bounds.width - SIM.playerRadius);
  const minY = SIM.playerRadius;
  const maxY = Math.max(minY, world.bounds.height - SIM.playerRadius);

  for (const player of world.players) {
    if (!player.alive) {
      player.velocity.x = 0;
      player.velocity.y = 0;
      continue;
    }

    const input = inputs[player.id] ?? NO_INPUT;
    let moveX = finiteOrZero(input.moveX);
    let moveY = finiteOrZero(input.moveY);
    const moveLength = Math.hypot(moveX, moveY);

    if (moveLength > 1) {
      moveX /= moveLength;
      moveY /= moveLength;
    }

    player.velocity.x = moveX * SIM.playerSpeed;
    player.velocity.y = moveY * SIM.playerSpeed;
    player.position.x = clamp(player.position.x + player.velocity.x * dt, minX, maxX);
    player.position.y = clamp(player.position.y + player.velocity.y * dt, minY, maxY);

    if (Number.isFinite(input.aim)) {
      player.angle = input.aim;
    }
  }
}
