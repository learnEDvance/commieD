import { EMPTY_INPUT } from './game.js';
import { isWall, makeRng, spawnTeamAt } from './maze.js';

const OCT = Math.PI / 4;

function blocked(game, teamId, x, y) {
  if (isWall(game.maze, Math.floor(x), Math.floor(y))) {
    return true;
  }
  const owner = spawnTeamAt(game.maze, Math.floor(x), Math.floor(y));
  return owner !== -1 && owner !== teamId;
}

function lineOfSight(game, fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(distance / 0.2));

  for (let step = 1; step < steps; step += 1) {
    const x = fromX + (dx * step) / steps;
    const y = fromY + (dy * step) / steps;
    if (isWall(game.maze, Math.floor(x), Math.floor(y))) {
      return false;
    }
  }

  return true;
}

function directionInput(angle) {
  const octant = Math.round(angle / OCT);
  const x = Math.cos(octant * OCT);
  const y = Math.sin(octant * OCT);

  return {
    right: x > 0.4,
    left: x < -0.4,
    down: y > 0.4,
    up: y < -0.4,
  };
}

export class BotDirector {
  constructor(game, { seed = 1 } = {}) {
    this.game = game;
    this.rng = makeRng(seed >>> 0);
    this.state = new Map();
  }

  inputs() {
    const inputs = new Map();

    for (const player of this.game.players) {
      if (!player.isBot) {
        continue;
      }
      inputs.set(player.id, this.#inputFor(player));
    }

    return inputs;
  }

  #inputFor(player) {
    const state = this.#stateFor(player);
    const team = this.game.teams[player.teamId];

    if (!player.alive) {
      return this.#ghostInput(player, state);
    }

    const enemies = this.game.players.filter(
      (other) => other.alive && other.teamId !== player.teamId,
    );

    let target = null;
    let targetDistance = Infinity;

    for (const enemy of enemies) {
      const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (distance < targetDistance) {
        target = enemy;
        targetDistance = distance;
      }
    }

    let desiredAngle = state.wanderAngle;
    let shoot = false;

    if (target) {
      desiredAngle = Math.atan2(target.y - player.y, target.x - player.x);
      const visible = lineOfSight(this.game, player.x, player.y, target.x, target.y);

      if (visible && targetDistance < 9 && team.ammo > 40 && this.game.timeMs >= state.fireAt) {
        shoot = true;
        state.fireAt = this.game.timeMs + 260 + this.rng.next() * 260;
      }

      if (targetDistance < 2.2) {
        desiredAngle += Math.PI;
      } else if (targetDistance <= 4.5) {
        desiredAngle += state.strafeSign * (Math.PI / 2);
      }
    } else {
      const item = this.#nearestItem(player);
      if (item) {
        desiredAngle = Math.atan2(item.y + 0.5 - player.y, item.x + 0.5 - player.x);
      }
    }

    if (this.rng.next() < 0.02) {
      state.strafeSign *= -1;
      state.wanderAngle = this.rng.next() * Math.PI * 2;
    }

    const angle = this.#safeAngle(player, desiredAngle);
    const move = directionInput(angle);

    return {
      ...EMPTY_INPUT,
      ...move,
      aimX: target ? target.x : player.x + Math.cos(angle) * 4,
      aimY: target ? target.y : player.y + Math.sin(angle) * 4,
      shoot,
    };
  }

  #ghostInput(player, state) {
    const item = this.#nearestItem(player);
    let angle = state.wanderAngle;

    if (item) {
      angle = Math.atan2(item.y + 0.5 - player.y, item.x + 0.5 - player.x);
    } else if (this.rng.next() < 0.03) {
      state.wanderAngle = this.rng.next() * Math.PI * 2;
    }

    if (this.rng.next() < 0.004) {
      const tasks = ['clicker', 'ammo', 'dash'];
      state.ghostTask = tasks[this.rng.int(tasks.length)];
    }

    return {
      ...EMPTY_INPUT,
      ...directionInput(angle),
      ghostTask: state.ghostTask,
    };
  }

  #safeAngle(player, desired) {
    const offsets = [0, OCT, -OCT, OCT * 2, -OCT * 2, OCT * 3, -OCT * 3, Math.PI];

    for (const offset of offsets) {
      const angle = desired + offset;
      const x = player.x + Math.cos(angle) * 0.95;
      const y = player.y + Math.sin(angle) * 0.95;
      if (!blocked(this.game, player.teamId, x, y)) {
        return angle;
      }
    }

    return desired;
  }

  #nearestItem(player) {
    let best = null;
    let bestDistance = Infinity;

    for (const item of this.game.maze.items) {
      if (item.taken) {
        continue;
      }
      const distance = Math.hypot(item.x + 0.5 - player.x, item.y + 0.5 - player.y);
      if (distance < bestDistance) {
        best = item;
        bestDistance = distance;
      }
    }

    return best;
  }

  #stateFor(player) {
    let state = this.state.get(player.id);

    if (!state) {
      state = {
        wanderAngle: this.rng.next() * Math.PI * 2,
        strafeSign: this.rng.next() < 0.5 ? -1 : 1,
        fireAt: 0,
        ghostTask: 'clicker',
      };
      this.state.set(player.id, state);
    }

    return state;
  }
}
