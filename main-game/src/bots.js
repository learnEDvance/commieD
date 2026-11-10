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

    const rankedEnemies = enemies
      .map((enemy) => ({
        enemy,
        distance: Math.hypot(enemy.x - player.x, enemy.y - player.y),
        visible: lineOfSight(this.game, player.x, player.y, enemy.x, enemy.y) &&
          spawnTeamAt(this.game.maze, Math.floor(enemy.x), Math.floor(enemy.y)) === -1,
      }))
      .sort((a, b) => Number(b.visible) - Number(a.visible) || a.distance - b.distance);
    const targetInfo = rankedEnemies[0] ?? null;
    const target = targetInfo?.enemy ?? null;
    const targetDistance = targetInfo?.distance ?? Infinity;
    const visibleTarget = targetInfo?.visible ? target : null;

    let desiredAngle = state.wanderAngle;
    let shoot = false;

    if (visibleTarget) {
      desiredAngle = Math.atan2(target.y - player.y, target.x - player.x);
      if (targetDistance < 2.4) {
        desiredAngle += Math.PI;
      } else if (targetDistance < 7) {
        desiredAngle += state.strafeSign * Math.PI / 2;
      }
      if (targetDistance < 11 && team.ammo > 0 && this.game.timeMs >= state.fireAt) {
        shoot = true;
        state.fireAt = this.game.timeMs + 170 + this.rng.next() * 180;
      }
    } else if (target) {
      desiredAngle = this.#routeAngle(player, target.x, target.y, state);
    } else {
      const item = this.#nearestItem(player);
      if (item) {
        desiredAngle = this.#routeAngle(player, item.x + 0.5, item.y + 0.5, state);
      }
    }

    if (this.rng.next() < 0.02) {
      state.strafeSign *= -1;
      state.wanderAngle = this.rng.next() * Math.PI * 2;
    }

    const dangerAngle = this.#evadeAngle(player);
    if (dangerAngle !== null) desiredAngle = dangerAngle;
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

  #routeAngle(player, targetX, targetY, state) {
    const now = this.game.timeMs;
    const targetKey = `${Math.floor(targetX)},${Math.floor(targetY)}`;
    if (state.routeTarget !== targetKey || now >= state.routeAt) {
      state.routeTarget = targetKey;
      state.routeAt = now + 400;
      state.routePoint = this.#firstPathStep(player, targetX, targetY);
    }
    if (!state.routePoint) {
      return Math.atan2(targetY - player.y, targetX - player.x);
    }
    return Math.atan2(state.routePoint.y - player.y, state.routePoint.x - player.x);
  }

  #firstPathStep(player, targetX, targetY) {
    const { width, height } = this.game.maze;
    const startX = Math.floor(player.x);
    const startY = Math.floor(player.y);
    const start = startY * width + startX;
    const cameFrom = new Int32Array(width * height).fill(-2);
    const queue = new Int32Array(width * height);
    const goals = new Set();

    for (let radius = 0; radius <= 2; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const x = Math.floor(targetX) + dx;
          const y = Math.floor(targetY) + dy;
          if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1 || blocked(this.game, player.teamId, x + 0.5, y + 0.5)) continue;
          goals.add(y * width + x);
        }
      }
      if (goals.size) break;
    }
    if (!goals.size) return null;

    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    cameFrom[start] = -1;
    let reached = -1;
    const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];

    while (head < tail) {
      const current = queue[head++];
      if (goals.has(current)) {
        reached = current;
        break;
      }
      const x = current % width;
      const y = Math.floor(current / width);
      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 1 || ny < 1 || nx >= width - 1 || ny >= height - 1) continue;
        const next = ny * width + nx;
        if (cameFrom[next] !== -2 || blocked(this.game, player.teamId, nx + 0.5, ny + 0.5)) continue;
        cameFrom[next] = current;
        queue[tail++] = next;
      }
    }
    if (reached < 0 || reached === start) return null;
    let step = reached;
    while (cameFrom[step] !== start && cameFrom[step] >= 0) step = cameFrom[step];
    return { x: step % width + 0.5, y: Math.floor(step / width) + 0.5 };
  }

  #evadeAngle(player) {
    let nearest = null;
    let nearestDistance = 0.85;
    for (const bullet of this.game.bullets) {
      if (bullet.teamId === player.teamId) continue;
      const dx = player.x - bullet.x;
      const dy = player.y - bullet.y;
      const distance = Math.hypot(dx, dy);
      const closing = bullet.vx * dx + bullet.vy * dy;
      if (distance < nearestDistance && closing > 0) {
        nearest = { dx, dy };
        nearestDistance = distance;
      }
    }
    if (!nearest) return null;
    const side = nearest.dx * nearest.dy >= 0 ? 1 : -1;
    return Math.atan2(nearest.dy * side, -nearest.dx * side);
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
        routeTarget: null,
        routeAt: 0,
        routePoint: null,
      };
      this.state.set(player.id, state);
    }

    return state;
  }
}
