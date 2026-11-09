import {
  generateMaze,
  isWall,
  makeRng,
  spawnTeamAt,
} from './maze.js';

export const TEAM_HP_PER_PLAYER = 100;
export const PLAYER_RADIUS = 0.42;
export const MOVE_SPEED = 4.2;
export const DASH_SPEED = 10.5;
export const DASH_DURATION_MS = 180;
export const DASH_COST_SECONDS = 1;
export const FIRE_INTERVAL_MS = 100;
export const BULLET_SPEED = 20;
export const BULLET_RADIUS = 0.12;
export const BULLET_LIFE_MS = 1400;
export const START_AMMO = 240;
export const START_DASH_SECONDS = 30;
export const PICKUP_RADIUS = 0.62;
export const BOMB_SPEED = 8;
export const BOMB_FUSE_MS = 850;
export const BOMB_RADIUS_TILES = 2;
export const BOMB_DAMAGE = 100;
export const DEFAULT_GUN_DAMAGE = 1;
export const GUN_PLUS_DAMAGE = 2;
export const COAT_SPEED_FACTOR = 0.4;

export const SPECIAL_DURATIONS = Object.freeze({
  gunPlus: 120000,
  phaseless: 20000,
  coat: 20000,
});

export const GAME_DEFAULTS = Object.freeze({
  seed: 1,
  teams: 2,
  playersPerTeam: 8,
  width: 61,
  height: 61,
  itemsPerTeam: 4,
});

export const GHOST_TASKS = Object.freeze(['clicker', 'ammo', 'dash']);

export const EMPTY_INPUT = Object.freeze({
  up: false,
  down: false,
  left: false,
  right: false,
  aimX: null,
  aimY: null,
  shoot: false,
  dash: false,
  useSpecial: false,
  ghostTask: null,
});

const TEAM_PRESETS = Object.freeze([
  { name: 'Vanguard', color: '#e23b3b' },
  { name: 'Collective', color: '#f2c94c' },
  { name: 'Proletariat', color: '#5bc0be' },
  { name: 'Politburo', color: '#b07cf0' },
  { name: 'Komsomol', color: '#e08a3c' },
  { name: 'Soviet', color: '#7fc96a' },
]);

const COMRADE_NAMES = Object.freeze([
  'Lenin',
  'Trotsky',
  'Stalin',
  'Krupskaya',
  'Dzerzhinsky',
  'Kollontai',
  'Luxemburg',
  'Gramsci',
  'Ho Chi Minh',
  'Mao',
  'Tito',
  'Dimitrov',
  'Zhdanov',
  'Kirov',
  'Ordzhonikidze',
  'Bukharin',
]);

export class Game {
  constructor({
    seed = 1,
    teams = 2,
    playersPerTeam = 8,
    width = 61,
    height = 61,
    itemsPerTeam = 4,
    autoJoin = false,
  } = {}) {
    this.seed = seed;
    this.playersPerTeam = playersPerTeam;
    this.maze = generateMaze({ seed, teams, playersPerTeam, width, height, itemsPerTeam });
    this.rng = makeRng((seed ^ 0x9e3779b9) >>> 0);
    this.players = [];
    this.teams = this.maze.spawns.map((spawn, id) => ({
      id,
      name: TEAM_PRESETS[id % TEAM_PRESETS.length].name,
      color: TEAM_PRESETS[id % TEAM_PRESETS.length].color,
      spawn,
      hp: 0,
      maxHp: 0,
      ammo: START_AMMO,
      dashSeconds: START_DASH_SECONDS,
      specials: [],
      activeEffect: null,
      kills: 0,
      eliminated: false,
    }));
    this.bullets = [];
    this.bombs = [];
    this.playersById = new Map();
    this.nextPlayerId = 1;
    this.nextProjectileId = 1;
    this.timeMs = 0;

    if (autoJoin) {
      for (const team of this.teams) {
        for (let index = 0; index < playersPerTeam; index += 1) {
          this.join({ teamId: team.id });
        }
      }
    }
  }

  join({ teamId, name, isBot = false } = {}) {
    const team = teamId === undefined ? this.#teamWithFewestPlayers() : this.#teamById(teamId);

    if (!team) {
      throw new RangeError('no open team');
    }
    if (team.eliminated) {
      throw new RangeError('team is eliminated');
    }
    if (this.players.filter((player) => player.teamId === team.id).length >= this.playersPerTeam) {
      throw new RangeError('team is full');
    }

    const player = {
      id: this.nextPlayerId,
      teamId: team.id,
      name: name ?? this.#nextName(),
      isBot,
      x: 0,
      y: 0,
      angle: 0,
      alive: true,
      isGhost: false,
      ghostTask: 'clicker',
      dashMs: 0,
      fireCooldownMs: 0,
      input: { ...EMPTY_INPUT },
    };
    this.nextPlayerId += 1;

    this.#placeAtSpawn(player);
    this.players.push(player);
    this.playersById.set(player.id, player);

    const previousMax = team.maxHp;
    team.maxHp = this.#livingCount(team.id) * TEAM_HP_PER_PLAYER;
    team.hp = Math.min(team.maxHp, team.hp + (team.maxHp - previousMax));

    return player;
  }

  leave(playerId) {
    const player = this.playersById.get(playerId);
    if (!player) {
      return false;
    }

    this.players = this.players.filter((entry) => entry.id !== playerId);
    this.playersById.delete(playerId);

    const team = this.teams[player.teamId];
    if (!team.eliminated) {
      team.maxHp = this.#livingCount(team.id) * TEAM_HP_PER_PLAYER;
      team.hp = Math.min(team.hp, team.maxHp);
    }

    return true;
  }

  step(dtMs, inputs = new Map()) {
    const dt = Math.max(0, Math.min(dtMs, 100));
    const dtSec = dt / 1000;
    const events = [];

    this.timeMs += dt;

    for (const team of this.teams) {
      this.#tickEffect(team, dt, events);
    }

    for (const player of this.players) {
      const input = inputs.get(player.id) ?? player.input ?? EMPTY_INPUT;
      player.input = input;

      const team = this.teams[player.teamId];
      if (team.eliminated) {
        continue;
      }

      if (player.alive) {
        this.#stepAlive(player, team, input, dt, dtSec, events);
      } else {
        this.#stepGhost(player, input, dt, dtSec, events);
      }
    }

    this.#stepBullets(dt, dtSec, events);
    this.#stepBombs(dt, dtSec, events);
    this.#collectItems(events);

    return {
      timeMs: this.timeMs,
      events,
    };
  }

  useSpecial(teamId, playerId) {
    const team = this.teams[teamId];
    if (!team || team.eliminated) {
      return { used: false, reason: 'eliminated' };
    }
    if (team.activeEffect) {
      return { used: false, reason: 'effect-active' };
    }

    const type = team.specials[team.specials.length - 1];
    if (!type) {
      return { used: false, reason: 'empty' };
    }

    const player = this.playersById.get(playerId);
    if (!player || !player.alive) {
      return { used: false, reason: 'not-alive' };
    }

    team.specials.pop();
    const result = { used: true, type, current: team.specials.at(-1) ?? null };

    if (type === 'bomb') {
      const direction = { x: Math.cos(player.angle), y: Math.sin(player.angle) };
      this.bombs.push({
        id: this.nextProjectileId,
        teamId,
        x: player.x + direction.x * (PLAYER_RADIUS + 0.15),
        y: player.y + direction.y * (PLAYER_RADIUS + 0.15),
        vx: direction.x * BOMB_SPEED,
        vy: direction.y * BOMB_SPEED,
        lifeMs: BOMB_FUSE_MS,
      });
      this.nextProjectileId += 1;
    } else if (SPECIAL_DURATIONS[type]) {
      team.activeEffect = { type, msLeft: SPECIAL_DURATIONS[type] };
    }

    return result;
  }

  snapshot() {
    return {
      timeMs: this.timeMs,
      teams: this.teams.map((team) => ({
        id: team.id,
        name: team.name,
        color: team.color,
        hp: team.hp,
        maxHp: team.maxHp,
        ammo: team.ammo,
        dashSeconds: team.dashSeconds,
        specials: [...team.specials],
        activeEffect: team.activeEffect ? { ...team.activeEffect } : null,
        kills: team.kills,
        eliminated: team.eliminated,
      })),
      players: this.players.map((player) => ({
        id: player.id,
        teamId: player.teamId,
        name: player.name,
        isBot: player.isBot,
        x: player.x,
        y: player.y,
        angle: player.angle,
        alive: player.alive,
        isGhost: player.isGhost,
        ghostTask: player.ghostTask,
      })),
      bullets: this.bullets.map((bullet) => ({ ...bullet })),
      bombs: this.bombs.map((bomb) => ({ ...bomb })),
      items: this.maze.items.map((item) => ({ ...item })),
    };
  }

  getTeam(teamId) {
    return this.teams[teamId] ?? null;
  }

  getPlayer(playerId) {
    return this.playersById.get(playerId) ?? null;
  }

  #teamById(teamId) {
    return this.teams[teamId] ?? null;
  }

  #teamWithFewestPlayers() {
    const open = this.teams
      .filter((team) => !team.eliminated)
      .filter(
        (team) =>
          this.players.filter((player) => player.teamId === team.id).length <
          this.playersPerTeam,
      )
      .sort((a, b) => {
        const countA = this.players.filter((player) => player.teamId === a.id).length;
        const countB = this.players.filter((player) => player.teamId === b.id).length;
        return countA - countB || a.id - b.id;
      });

    return open[0] ?? null;
  }

  #nextName() {
    const used = new Set(this.players.map((player) => player.name));
    for (const base of COMRADE_NAMES) {
      if (!used.has(base)) {
        return base;
      }
    }
    return `Comrade ${this.nextPlayerId}`;
  }

  #livingCount(teamId) {
    return this.players.filter((player) => player.teamId === teamId && player.alive).length;
  }

  #placeAtSpawn(player) {
    const team = this.teams[player.teamId];
    const room = team.spawn;

    for (let attempt = 0; attempt < 200; attempt += 1) {
      const x = room.x + this.rng.int(room.width);
      const y = room.y + this.rng.int(room.height);
      const occupied = this.players.some(
        (other) =>
          Math.abs(other.x - (x + 0.5)) < 0.6 &&
          Math.abs(other.y - (y + 0.5)) < 0.6,
      );
      if (!occupied) {
        player.x = x + 0.5;
        player.y = y + 0.5;
        return;
      }
    }

    player.x = room.x + room.width / 2;
    player.y = room.y + room.height / 2;
  }

  #stepAlive(player, team, input, dt, dtSec, events) {
    player.dashMs = Math.max(0, player.dashMs - dt);
    player.fireCooldownMs = Math.max(0, player.fireCooldownMs - dt);

    const move = {
      x: (input.right ? 1 : 0) - (input.left ? 1 : 0),
      y: (input.down ? 1 : 0) - (input.up ? 1 : 0),
    };
    const moving = move.x !== 0 || move.y !== 0;

    if (input.dash && player.dashMs <= 0 && team.dashSeconds >= DASH_COST_SECONDS) {
      player.dashMs = DASH_DURATION_MS;
      team.dashSeconds = Math.max(0, team.dashSeconds - DASH_COST_SECONDS);
      events.push({ type: 'dash', teamId: team.id, playerId: player.id });
    }

    let speed = player.dashMs > 0 ? DASH_SPEED : MOVE_SPEED;
    if (this.#hasEffect(team, 'coat')) {
      speed *= COAT_SPEED_FACTOR;
    }

    if (moving) {
      const length = Math.hypot(move.x, move.y);
      move.x /= length;
      move.y /= length;
      this.#movePlayer(player, move.x * speed * dtSec, move.y * speed * dtSec);
    }

    if (Number.isFinite(input.aimX) && Number.isFinite(input.aimY)) {
      player.angle = Math.atan2(input.aimY - player.y, input.aimX - player.x);
    } else if (moving) {
      player.angle = Math.atan2(move.y, move.x);
    }

    if (input.useSpecial) {
      const result = this.useSpecial(team.id, player.id);
      if (result.used) {
        events.push({ type: 'special-used', teamId: team.id, playerId: player.id, ...result });
      }
    }

    if (input.shoot && player.fireCooldownMs <= 0 && team.ammo >= 1) {
      this.#fireBullet(player, team, events);
      player.fireCooldownMs += FIRE_INTERVAL_MS;
    }
  }

  #stepGhost(player, input, dt, dtSec, events) {
    if (input.ghostTask && GHOST_TASKS.includes(input.ghostTask)) {
      if (player.ghostTask !== input.ghostTask) {
        player.ghostTask = input.ghostTask;
        events.push({
          type: 'ghost-task',
          teamId: player.teamId,
          playerId: player.id,
          task: input.ghostTask,
        });
      }
    }

    const move = {
      x: (input.right ? 1 : 0) - (input.left ? 1 : 0),
      y: (input.down ? 1 : 0) - (input.up ? 1 : 0),
    };
    if (move.x !== 0 || move.y !== 0) {
      const length = Math.hypot(move.x, move.y);
      player.x = Math.max(0.5, Math.min(this.maze.width - 0.5, player.x + (move.x / length) * MOVE_SPEED * 0.8 * dtSec));
      player.y = Math.max(0.5, Math.min(this.maze.height - 0.5, player.y + (move.y / length) * MOVE_SPEED * 0.8 * dtSec));
    }
  }

  #movePlayer(player, dx, dy) {
    const team = this.teams[player.teamId];
    const phaseless = this.#hasEffect(team, 'phaseless');

    if (phaseless) {
      player.x = Math.max(0.5, Math.min(this.maze.width - 0.5, player.x + dx));
      player.y = Math.max(0.5, Math.min(this.maze.height - 0.5, player.y + dy));
      return;
    }

    const nextX = player.x + dx;
    if (!this.#circleHitsSolid(player.teamId, nextX, player.y)) {
      player.x = nextX;
    }

    const nextY = player.y + dy;
    if (!this.#circleHitsSolid(player.teamId, player.x, nextY)) {
      player.y = nextY;
    }
  }

  #circleHitsSolid(teamId, x, y) {
    const minX = Math.floor(x - PLAYER_RADIUS);
    const maxX = Math.floor(x + PLAYER_RADIUS);
    const minY = Math.floor(y - PLAYER_RADIUS);
    const maxY = Math.floor(y + PLAYER_RADIUS);

    for (let tileY = minY; tileY <= maxY; tileY += 1) {
      for (let tileX = minX; tileX <= maxX; tileX += 1) {
        if (isWall(this.maze, tileX, tileY)) {
          return true;
        }
        const owner = spawnTeamAt(this.maze, tileX, tileY);
        if (owner !== -1 && owner !== teamId) {
          return true;
        }
      }
    }

    return false;
  }

  #fireBullet(player, team, events) {
    team.ammo -= 1;
    const direction = { x: Math.cos(player.angle), y: Math.sin(player.angle) };
    const gunPlus = this.#hasEffect(team, 'gunPlus');
    const damage = gunPlus ? GUN_PLUS_DAMAGE : DEFAULT_GUN_DAMAGE;

    this.bullets.push({
      id: this.nextProjectileId,
      teamId: team.id,
      ownerId: player.id,
      x: player.x + direction.x * (PLAYER_RADIUS + 0.18),
      y: player.y + direction.y * (PLAYER_RADIUS + 0.18),
      vx: direction.x * BULLET_SPEED,
      vy: direction.y * BULLET_SPEED,
      lifeMs: BULLET_LIFE_MS,
      damage,
    });
    this.nextProjectileId += 1;

    events.push({
      type: 'shot',
      teamId: team.id,
      playerId: player.id,
      damage,
      ammo: team.ammo,
    });
  }

  #stepBullets(dt, dtSec, events) {
    const survivors = [];

    for (const bullet of this.bullets) {
      bullet.lifeMs -= dt;

      if (bullet.lifeMs <= 0) {
        continue;
      }

      const distance = Math.hypot(bullet.vx, bullet.vy) * dtSec;
      const substeps = Math.max(1, Math.ceil(distance / 0.2));
      let removed = false;

      for (let step = 0; step < substeps; step += 1) {
        bullet.x += (bullet.vx * dtSec) / substeps;
        bullet.y += (bullet.vy * dtSec) / substeps;

        if (this.#projectileHitsSolid(bullet.teamId, bullet.x, bullet.y)) {
          events.push({ type: 'bullet-wall', teamId: bullet.teamId });
          removed = true;
          break;
        }

        const victim = this.#enemyPlayerAt(
          bullet.teamId,
          bullet.x,
          bullet.y,
          BULLET_RADIUS,
        );

        if (victim) {
          this.#damageTeam(victim.teamId, bullet.damage, bullet.teamId, events);
          events.push({
            type: 'bullet-hit',
            teamId: victim.teamId,
            sourceTeamId: bullet.teamId,
            playerId: victim.id,
            damage: bullet.damage,
          });
          removed = true;
          break;
        }
      }

      if (!removed) {
        survivors.push(bullet);
      }
    }

    this.bullets = survivors;
  }

  #stepBombs(dt, dtSec, events) {
    const survivors = [];

    for (const bomb of this.bombs) {
      bomb.lifeMs -= dt;

      const distance = Math.hypot(bomb.vx, bomb.vy) * dtSec;
      const substeps = Math.max(1, Math.ceil(distance / 0.2));
      let exploded = false;

      for (let step = 0; step < substeps; step += 1) {
        bomb.x += (bomb.vx * dtSec) / substeps;
        bomb.y += (bomb.vy * dtSec) / substeps;

        const hitWall = this.#projectileHitsSolid(bomb.teamId, bomb.x, bomb.y);
        const hitEnemy = this.#enemyPlayerAt(bomb.teamId, bomb.x, bomb.y, 0.35);

        if (hitWall || hitEnemy) {
          this.#explodeBomb(bomb, events);
          exploded = true;
          break;
        }
      }

      if (exploded) {
        continue;
      }

      if (bomb.lifeMs <= 0) {
        this.#explodeBomb(bomb, events);
        continue;
      }

      survivors.push(bomb);
    }

    this.bombs = survivors;
  }

  #explodeBomb(bomb, events) {
    const hitTeams = new Set();

    for (const player of this.players) {
      if (player.teamId === bomb.teamId || !player.alive) {
        continue;
      }
      if (hitTeams.has(player.teamId)) {
        continue;
      }
      if (Math.hypot(player.x - bomb.x, player.y - bomb.y) <= BOMB_RADIUS_TILES) {
        hitTeams.add(player.teamId);
      }
    }

    events.push({
      type: 'bomb',
      teamId: bomb.teamId,
      x: bomb.x,
      y: bomb.y,
      radius: BOMB_RADIUS_TILES,
      hitTeams: [...hitTeams],
    });

    for (const teamId of hitTeams) {
      this.#damageTeam(teamId, BOMB_DAMAGE, bomb.teamId, events);
    }
  }

  #projectileHitsSolid(teamId, x, y) {
    const tileX = Math.floor(x);
    const tileY = Math.floor(y);

    if (isWall(this.maze, tileX, tileY)) {
      return true;
    }

    const owner = spawnTeamAt(this.maze, tileX, tileY);
    return owner !== -1 && owner !== teamId;
  }

  #enemyPlayerAt(teamId, x, y, extraRadius) {
    for (const player of this.players) {
      if (!player.alive || player.teamId === teamId) {
        continue;
      }
      if (Math.hypot(player.x - x, player.y - y) <= PLAYER_RADIUS + extraRadius) {
        return player;
      }
    }
    return null;
  }

  #collectItems(events) {
    for (const item of this.maze.items) {
      if (item.taken) {
        continue;
      }

      for (const player of this.players) {
        const team = this.teams[player.teamId];
        if (team.eliminated) {
          continue;
        }

        if (Math.hypot(player.x - (item.x + 0.5), player.y - (item.y + 0.5)) > PICKUP_RADIUS) {
          continue;
        }

        item.taken = true;
        const result = this.#applyPickup(team, item.type);
        events.push({
          type: 'item-collected',
          teamId: team.id,
          playerId: player.id,
          itemType: item.type,
          ...result,
        });
        break;
      }
    }
  }

  #applyPickup(team, itemType) {
    if (itemType === 'hp') {
      team.hp += 300;
      return { immediate: true };
    }
    if (itemType === 'speed') {
      team.dashSeconds += 40;
      return { immediate: true };
    }

    if (team.specials.includes(itemType)) {
      return { duplicate: true };
    }

    team.specials.push(itemType);
    return { immediate: false, current: team.specials.at(-1) };
  }

  #damageTeam(teamId, amount, sourceTeamId, events) {
    const team = this.teams[teamId];
    if (!team || team.eliminated || team.hp <= 0) {
      return;
    }

    team.hp = Math.max(0, team.hp - amount);
    events.push({
      type: 'damage',
      teamId,
      sourceTeamId,
      amount,
      hp: team.hp,
    });

    if (team.hp <= 0) {
      this.#downTeam(team, sourceTeamId, events);
    }
  }

  #downTeam(team, sourceTeamId, events) {
    const living = this.players.filter(
      (player) => player.teamId === team.id && player.alive,
    );

    if (sourceTeamId !== undefined && sourceTeamId !== team.id) {
      this.teams[sourceTeamId].kills += 1;
    }

    for (const player of living) {
      player.alive = false;
      player.isGhost = true;
      player.dashMs = 0;
    }

    events.push({ type: 'team-downed', teamId: team.id, wasAlive: living.length });

    if (living.length <= 2) {
      team.eliminated = true;
      team.hp = 0;
      team.activeEffect = null;
      events.push({ type: 'team-eliminated', teamId: team.id });
      return;
    }

    const keepCount = Math.floor(living.length / 2);
    const shuffled = this.rng.shuffle([...living]);
    const kept = shuffled.slice(0, keepCount);

    for (const player of kept) {
      player.alive = true;
      player.isGhost = false;
      player.dashMs = 0;
      this.#placeAtSpawn(player);
    }

    team.maxHp = keepCount * TEAM_HP_PER_PLAYER;
    team.hp = Math.round(team.maxHp * 0.5);
    team.activeEffect = null;

    events.push({
      type: 'team-revived',
      teamId: team.id,
      living: keepCount,
      ghosts: living.length - keepCount,
      hp: team.hp,
      maxHp: team.maxHp,
    });
  }

  #tickEffect(team, dt, events) {
    if (!team.activeEffect) {
      return;
    }

    team.activeEffect.msLeft -= dt;

    if (team.activeEffect.msLeft <= 0) {
      const type = team.activeEffect.type;
      team.activeEffect = null;
      events.push({ type: 'effect-ended', teamId: team.id, effect: type });
    }
  }

  #hasEffect(team, type) {
    return team.activeEffect !== null && team.activeEffect.type === type;
  }
}
