import {
  generateMaze,
  isWall,
  makeRng,
  rollItemType,
  spawnTeamAt,
} from './maze.js';

export const TEAM_HP_PER_PLAYER = 100;
export const PLAYER_RADIUS = 0.42;
export const MOVE_SPEED = 4.2;
export const MOVE_ACCELERATION = 26;
export const MOVE_FRICTION = 20;
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
export const ITEM_RESPAWN_MIN_MS = 15_000;
export const ITEM_RESPAWN_MAX_MS = 60_000;
export const ENEMY_COLOR = '#e23b3b';
export const TEAM_REGEN = Object.freeze({
  ammoPerSecond: 10,
  hpPerSecond: 2,
  dashSecondsPerSecond: 1,
});

/** Ten distinct teammate colours. None of them are the enemy red. */
export const PLAYER_COLORS = Object.freeze([
  '#f2c94c',
  '#5bc0be',
  '#b07cf0',
  '#e08a3c',
  '#7fc96a',
  '#8fb8e0',
  '#c8d06a',
  '#6ad0a0',
  '#d0a0f0',
  '#f0c8a0',
]);

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
  { name: 'Collective', color: '#f2c94c' },
  { name: 'Proletariat', color: '#5bc0be' },
  { name: 'Politburo', color: '#b07cf0' },
  { name: 'Komsomol', color: '#e08a3c' },
  { name: 'Soviet', color: '#7fc96a' },
  { name: 'Commune', color: '#8fb8e0' },
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
      regenMs: 0,
    }));
    this.bullets = [];
    this.bombs = [];
    this.playersById = new Map();
    this.nextPlayerId = 1;
    this.nextProjectileId = 1;
    this.nextItemId = this.maze.items.length + 1;
    this.timeMs = 0;
    this.winnerTeamId = null;
    this.itemRespawnMs = this.#nextItemRespawnMs();

    if (autoJoin) {
      for (const team of this.teams) {
        for (let index = 0; index < playersPerTeam; index += 1) {
          this.join({ teamId: team.id });
        }
      }
    }
  }

  join({ teamId, name, isBot = false, color } = {}) {
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
      color: this.#pickPlayerColor(team.id, color),
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
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
      this.#tickTeamRegen(team, dt);
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
    this.#tickItemRespawn(dt);

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

  /**
   * Host integration point for the ghost minigames.
   * Soul Clicker sends HP, Bullet Press sends ammo, Dash Factory sends seconds.
   * Values are additive, non-negative, and shared by the whole team.
   */
  contribute(teamId, resources = {}) {
    const team = this.teams[teamId];
    if (!team || team.eliminated) {
      return { accepted: false, reason: 'eliminated' };
    }

    const hp = Number(resources.hp ?? 0);
    const ammo = Number(resources.ammo ?? 0);
    const dashSeconds = Number(resources.dashSeconds ?? 0);

    for (const value of [hp, ammo, dashSeconds]) {
      if (!Number.isFinite(value) || value < 0) {
        throw new RangeError('contributions must be finite and non-negative');
      }
    }

    if (hp === 0 && ammo === 0 && dashSeconds === 0) {
      return { accepted: true, hp: 0, ammo: 0, dashSeconds: 0 };
    }

    team.hp += hp;
    team.ammo += ammo;
    team.dashSeconds += dashSeconds;

    return { accepted: true, hp, ammo, dashSeconds };
  }

  /**
   * Host integration point for the Soul Clicker's low-CPS penalty.
   * Unlike combat damage this is a direct drain, so a coat cannot absorb it.
   * Returns the events caused by the drain so the host can relay a team-down.
   */
  drainHp(teamId, amount) {
    const team = this.teams[teamId];
    if (!team || team.eliminated) {
      return { accepted: false, reason: 'eliminated', events: [] };
    }

    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError('drain amount must be finite and non-negative');
    }
    if (value === 0) {
      return { accepted: true, hp: 0, events: [] };
    }

    const events = [];
    team.hp = Math.max(0, team.hp - value);
    events.push({
      type: 'damage',
      teamId,
      sourceTeamId: null,
      source: 'soul-clicker',
      amount: value,
      hp: team.hp,
    });

    if (team.hp <= 0) {
      this.#downTeam(team, undefined, events);
    }

    return { accepted: true, hp: value, events };
  }

  snapshot() {
    return {
      timeMs: this.timeMs,
      winnerTeamId: this.winnerTeamId,
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
        color: player.color,
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

    if (moving) {
      const length = Math.hypot(move.x, move.y);
      move.x /= length;
      move.y /= length;
    }

    // Dash is only spent while the player is actually trying to move.
    if (input.dash && moving && player.dashMs <= 0 && team.dashSeconds >= DASH_COST_SECONDS) {
      player.dashMs = DASH_DURATION_MS;
      team.dashSeconds = Math.max(0, team.dashSeconds - DASH_COST_SECONDS);
      player.vx = move.x * DASH_SPEED;
      player.vy = move.y * DASH_SPEED;
      events.push({ type: 'dash', teamId: team.id, playerId: player.id });
    }

    let speed = player.dashMs > 0 ? DASH_SPEED : MOVE_SPEED;
    if (this.#hasEffect(team, 'coat')) {
      speed *= COAT_SPEED_FACTOR;
    }

    const targetVx = moving ? move.x * speed : 0;
    const targetVy = moving ? move.y * speed : 0;
    const acceleration = (moving ? MOVE_ACCELERATION : MOVE_FRICTION) * dtSec;
    player.vx = approach(player.vx, targetVx, acceleration);
    player.vy = approach(player.vy, targetVy, acceleration);

    if (Math.abs(player.vx) > 0.0001 || Math.abs(player.vy) > 0.0001) {
      const beforeX = player.x;
      const beforeY = player.y;
      this.#movePlayer(player, player.vx * dtSec, player.vy * dtSec);

      if (Math.abs(player.x - beforeX) < 1e-9) {
        player.vx = 0;
      }
      if (Math.abs(player.y - beforeY) < 1e-9) {
        player.vy = 0;
      }
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

    if (this.#hasEffect(team, 'coat')) {
      events.push({
        type: 'damage-blocked',
        teamId,
        sourceTeamId,
        amount,
        effect: 'coat',
      });
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
    const keepCount = Math.floor(living.length / 2);

    if (sourceTeamId !== undefined && sourceTeamId !== team.id) {
      this.teams[sourceTeamId].kills += 1;
    }

    for (const player of living) {
      player.alive = false;
      player.isGhost = true;
      player.dashMs = 0;
    }

    events.push({ type: 'team-downed', teamId: team.id, wasAlive: living.length });

    // A team that would come back with a single player is eliminated instead:
    // the spec ends a team when its living count reaches one.
    if (keepCount < 2) {
      team.eliminated = true;
      team.hp = 0;
      team.maxHp = 0;
      team.activeEffect = null;
      events.push({ type: 'team-eliminated', teamId: team.id });
      this.#checkWinner(events);
      return;
    }

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

  #checkWinner(events) {
    if (this.winnerTeamId !== null) {
      return;
    }

    const remaining = this.teams.filter((team) => !team.eliminated);

    if (remaining.length === 1 && this.teams.length > 1) {
      this.winnerTeamId = remaining[0].id;
      events.push({ type: 'match-over', winnerTeamId: this.winnerTeamId });
    }
  }

  #pickPlayerColor(teamId, requested) {
    const teammates = this.players.filter((player) => player.teamId === teamId);
    const used = new Set(teammates.map((player) => player.color));

    if (PLAYER_COLORS.includes(requested) && !used.has(requested)) {
      return requested;
    }

    return PLAYER_COLORS.find((color) => !used.has(color)) ?? PLAYER_COLORS[0];
  }

  #nextItemRespawnMs() {
    return (
      ITEM_RESPAWN_MIN_MS +
      this.rng.int(ITEM_RESPAWN_MAX_MS - ITEM_RESPAWN_MIN_MS + 1)
    );
  }

  #tickItemRespawn(dt) {
    this.itemRespawnMs -= dt;

    if (this.itemRespawnMs > 0) {
      return;
    }

    this.itemRespawnMs = this.#nextItemRespawnMs();
    this.#spawnRandomItem();
  }

  #spawnRandomItem() {
    const occupied = new Set(
      this.maze.items
        .filter((item) => !item.taken)
        .map((item) => `${item.x},${item.y}`),
    );

    for (const player of this.players) {
      occupied.add(`${Math.floor(player.x)},${Math.floor(player.y)}`);
    }

    const candidates = [];

    for (let y = 1; y < this.maze.height - 1; y += 1) {
      for (let x = 1; x < this.maze.width - 1; x += 1) {
        if (isWall(this.maze, x, y) || spawnTeamAt(this.maze, x, y) !== -1) {
          continue;
        }
        if (!occupied.has(`${x},${y}`)) {
          candidates.push({ x, y });
        }
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    const spot = candidates[this.rng.int(candidates.length)];
    const item = {
      id: this.nextItemId,
      type: rollItemType(this.rng),
      x: spot.x,
      y: spot.y,
      taken: false,
    };

    this.nextItemId += 1;
    this.maze.items.push(item);
    return item;
  }

  #tickTeamRegen(team, dt) {
    if (team.eliminated || team.maxHp <= 0) {
      team.regenMs = 0;
      return;
    }

    const teammates = this.players.filter((player) => player.teamId === team.id);

    if (teammates.length === 0 || teammates.some((player) => !player.alive)) {
      // Any ghost on the team replaces normal regeneration with the ghost
      // minigames. A revived team starts the normal timer from zero.
      team.regenMs = 0;
      return;
    }

    team.regenMs += dt;

    while (team.regenMs >= 1000) {
      team.regenMs -= 1000;
      team.hp = Math.min(team.maxHp, team.hp + TEAM_REGEN.hpPerSecond);
      team.ammo += TEAM_REGEN.ammoPerSecond;
      team.dashSeconds += TEAM_REGEN.dashSecondsPerSecond;
    }
  }

  #tickEffect(team, dt, events) {
    if (!team.activeEffect) {
      return;
    }

    team.activeEffect.msLeft -= dt;

    if (team.activeEffect.msLeft <= 0) {
      const type = team.activeEffect.type;
      team.activeEffect = null;

      if (type === 'phaseless') {
        this.#recoverFromPhaseless(team, events);
      }

      events.push({ type: 'effect-ended', teamId: team.id, effect: type });
    }
  }

  #recoverFromPhaseless(team, events) {
    for (const player of this.players) {
      if (player.teamId !== team.id || !player.alive) {
        continue;
      }
      if (!this.#circleHitsSolid(team.id, player.x, player.y)) {
        continue;
      }

      const free = this.#nearestFreeTile(player.x, player.y, team.id);

      if (!free) {
        continue;
      }

      player.x = free.x;
      player.y = free.y;
      player.vx = 0;
      player.vy = 0;
      events.push({
        type: 'phase-recovered',
        teamId: team.id,
        playerId: player.id,
        x: free.x,
        y: free.y,
      });
    }
  }

  #nearestFreeTile(x, y, teamId) {
    const limit = Math.max(this.maze.width, this.maze.height);

    for (let ring = 0; ring <= limit; ring += 1) {
      for (let dy = -ring; dy <= ring; dy += 1) {
        for (let dx = -ring; dx <= ring; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) {
            continue;
          }

          const tileX = Math.floor(x) + dx;
          const tileY = Math.floor(y) + dy;

          if (isWall(this.maze, tileX, tileY)) {
            continue;
          }

          const centerX = tileX + 0.5;
          const centerY = tileY + 0.5;

          if (!this.#circleHitsSolid(teamId, centerX, centerY)) {
            return { x: centerX, y: centerY };
          }
        }
      }
    }

    return null;
  }

  #hasEffect(team, type) {
    return team.activeEffect !== null && team.activeEffect.type === type;
  }
}

function approach(value, target, maxDelta) {
  if (value < target) {
    return Math.min(target, value + maxDelta);
  }
  if (value > target) {
    return Math.max(target, value - maxDelta);
  }
  return value;
}
