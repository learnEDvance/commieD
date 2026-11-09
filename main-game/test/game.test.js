import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EMPTY_INPUT,
  GAME_DEFAULTS,
  Game,
  MOVE_SPEED,
  PLAYER_RADIUS,
  START_AMMO,
  START_DASH_SECONDS,
  TEAM_HP_PER_PLAYER,
} from '../src/game.js';
import { TILE, isWall, spawnTeamAt } from '../src/maze.js';

function input(overrides = {}) {
  return { ...EMPTY_INPUT, ...overrides };
}

function stepWith(game, player, overrides = {}, dt = 16) {
  return game.step(dt, new Map([[player.id, input(overrides)]]));
}

function findOpenTile(maze) {
  for (let y = 1; y < maze.height - 1; y += 1) {
    for (let x = 1; x < maze.width - 1; x += 1) {
      if (
        maze.tiles[y * maze.width + x] === TILE.FREE &&
        spawnTeamAt(maze, x, y) === -1
      ) {
        return { x, y };
      }
    }
  }
  throw new Error('no open tile');
}

test('joining adds players to a team and shares one HP pool', () => {
  const game = new Game({ seed: 2, teams: 2, playersPerTeam: 4, width: 41, height: 41 });
  const first = game.join({ teamId: 0, name: 'A' });
  const second = game.join({ teamId: 0, name: 'B' });

  assert.equal(game.players.length, 2);
  assert.equal(game.teams[0].maxHp, 2 * TEAM_HP_PER_PLAYER);
  assert.equal(game.teams[0].hp, 2 * TEAM_HP_PER_PLAYER);
  assert.equal(game.teams[0].ammo, START_AMMO);
  assert.equal(game.teams[0].dashSeconds, START_DASH_SECONDS);
  assert.notEqual(first.x, undefined);
  assert.notEqual(second.y, undefined);
});

test('movement is clamped by walls and enemy spawn rooms', () => {
  const game = new Game({ seed: 5, teams: 2, playersPerTeam: 4, width: 41, height: 41 });
  const player = game.join({ teamId: 0 });

  let wallSpot = null;
  for (let y = 1; y < game.maze.height - 1 && !wallSpot; y += 1) {
    for (let x = 1; x < game.maze.width - 2 && !wallSpot; x += 1) {
      if (
        isWall(game.maze, x + 1, y) &&
        !isWall(game.maze, x, y) &&
        spawnTeamAt(game.maze, x, y) === -1
      ) {
        wallSpot = { x, y };
      }
    }
  }
  assert.ok(wallSpot);

  player.x = wallSpot.x + 0.5;
  player.y = wallSpot.y + 0.5;
  for (let step = 0; step < 30; step += 1) {
    stepWith(game, player, { right: true }, 50);
  }

  assert.ok(player.x <= wallSpot.x + 1 - PLAYER_RADIUS + 0.001);
  assert.equal(game.maze.tiles[Math.floor(player.y) * game.maze.width + Math.floor(player.x)], TILE.FREE);

  const enemyRoom = game.maze.spawns[1];
  let door = null;
  for (let y = 1; y < game.maze.height - 1 && !door; y += 1) {
    for (let x = 1; x < game.maze.width - 1 && !door; x += 1) {
      if (spawnTeamAt(game.maze, x, y) !== -1) {
        continue;
      }
      if (game.maze.tiles[y * game.maze.width + x] !== TILE.FREE) {
        continue;
      }
      const neighbours = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ];
      if (neighbours.some(([nx, ny]) => spawnTeamAt(game.maze, nx, ny) === enemyRoom.teamId)) {
        door = { x, y };
      }
    }
  }
  assert.ok(door);

  player.x = door.x + 0.5;
  player.y = door.y + 0.5;
  const centerX = enemyRoom.x + enemyRoom.width / 2;
  const centerY = enemyRoom.y + enemyRoom.height / 2;

  for (let step = 0; step < 60; step += 1) {
    stepWith(
      game,
      player,
      {
        right: centerX > player.x,
        left: centerX < player.x,
        down: centerY > player.y,
        up: centerY < player.y,
      },
      33,
    );
  }

  assert.equal(spawnTeamAt(game.maze, Math.floor(player.x), Math.floor(player.y)), -1);
});

test('shooting spends shared ammo and damages the enemy team', () => {
  const game = new Game({ seed: 8, teams: 2, playersPerTeam: 2, width: 41, height: 41 });
  const shooter = game.join({ teamId: 0 });
  const target = game.join({ teamId: 1 });

  const room = game.maze.spawns[0];
  shooter.x = room.x + 1.5;
  shooter.y = room.y + 1.5;
  target.x = shooter.x + 1;
  target.y = shooter.y;

  stepWith(game, shooter, { shoot: true, aimX: target.x, aimY: target.y }, 16);

  assert.equal(game.teams[0].ammo, START_AMMO - 1);
  assert.equal(game.teams[1].hp, TEAM_HP_PER_PLAYER - 1);
  assert.equal(game.teams[0].kills, 0);
});

test('the gun-plus effect doubles bullet damage', () => {
  const game = new Game({ seed: 9, teams: 2, playersPerTeam: 2, width: 41, height: 41 });
  const shooter = game.join({ teamId: 0 });
  const target = game.join({ teamId: 1 });

  const room = game.maze.spawns[0];
  shooter.x = room.x + 1.5;
  shooter.y = room.y + 1.5;
  target.x = shooter.x + 1;
  target.y = shooter.y;
  game.teams[0].activeEffect = { type: 'gunPlus', msLeft: 5000 };

  stepWith(game, shooter, { shoot: true, aimX: target.x, aimY: target.y }, 16);

  assert.equal(game.teams[1].hp, TEAM_HP_PER_PLAYER - 2);
});

test('dashing spends the shared dash reserve', () => {
  const game = new Game({ seed: 10, teams: 2, playersPerTeam: 2, width: 41, height: 41 });
  const player = game.join({ teamId: 0 });

  const room = game.maze.spawns[0];
  player.x = room.x + 1.5;
  player.y = room.y + 1.5;

  stepWith(game, player, { dash: true }, 16);

  assert.equal(game.teams[0].dashSeconds, START_DASH_SECONDS - 1);
  assert.ok(player.dashMs > 0);
});

test('immediate pickups add HP and dash, and triggered items join the team stack', () => {
  const game = new Game({ seed: 11, teams: 2, playersPerTeam: 2, width: 41, height: 41 });
  const player = game.join({ teamId: 0 });
  const [hpItem, speedItem, gunItem] = game.maze.items;

  hpItem.type = 'hp';
  hpItem.taken = false;
  player.x = hpItem.x + 0.5;
  player.y = hpItem.y + 0.5;
  game.step(16);

  assert.equal(game.teams[0].hp, TEAM_HP_PER_PLAYER + 300);

  speedItem.type = 'speed';
  speedItem.taken = false;
  player.x = speedItem.x + 0.5;
  player.y = speedItem.y + 0.5;
  game.step(16);

  assert.equal(game.teams[0].dashSeconds, START_DASH_SECONDS + 40);

  gunItem.type = 'gunPlus';
  gunItem.taken = false;
  player.x = gunItem.x + 0.5;
  player.y = gunItem.y + 0.5;
  game.step(16);

  assert.deepEqual(game.teams[0].specials, ['gunPlus']);

  const used = game.useSpecial(0, player.id);
  assert.equal(used.used, true);
  assert.equal(game.teams[0].activeEffect.type, 'gunPlus');
  assert.deepEqual(game.teams[0].specials, []);

  const blocked = game.useSpecial(0, player.id);
  assert.equal(blocked.used, false);
  assert.equal(blocked.reason, 'effect-active');

  game.teams[0].activeEffect.msLeft = 10;
  game.step(20);
  assert.equal(game.teams[0].activeEffect, null);
});

test('duplicate triggered items are not stacked', () => {
  const game = new Game({ seed: 12, teams: 2, playersPerTeam: 2, width: 41, height: 41 });
  const player = game.join({ teamId: 0 });
  const item = game.maze.items[0];

  item.type = 'coat';
  item.taken = false;
  player.x = item.x + 0.5;
  player.y = item.y + 0.5;
  game.step(16);

  const second = game.maze.items[1];
  second.type = 'coat';
  second.taken = false;
  player.x = second.x + 0.5;
  player.y = second.y + 0.5;
  game.step(16);

  assert.deepEqual(game.teams[0].specials, ['coat']);
});

test('a bomb damages every enemy team inside its two-tile radius', () => {
  const game = new Game({ seed: 13, teams: 2, playersPerTeam: 2, width: 41, height: 41 });
  const thrower = game.join({ teamId: 0 });
  const target = game.join({ teamId: 1 });

  const spot = findOpenTile(game.maze);
  thrower.x = spot.x + 0.5;
  thrower.y = spot.y + 0.5;
  target.x = spot.x + 0.5;
  target.y = spot.y + 0.5;
  thrower.angle = 0;
  game.teams[0].specials.push('bomb');

  const used = game.useSpecial(0, thrower.id);
  assert.equal(used.used, true);
  assert.equal(game.bombs.length, 1);

  game.bombs[0].lifeMs = 1;
  game.bombs[0].vx = 0;
  game.bombs[0].vy = 0;
  game.step(16);

  assert.equal(game.bombs.length, 0);
  assert.equal(game.teams[1].hp, TEAM_HP_PER_PLAYER - 100);
});

test('team wipe revives half the living players and turns the rest into ghosts', () => {
  const game = new Game({ seed: 14, teams: 2, playersPerTeam: 6, width: 41, height: 41 });
  const teamPlayers = [];
  for (let index = 0; index < 4; index += 1) {
    teamPlayers.push(game.join({ teamId: 0 }));
  }
  const enemy = game.join({ teamId: 1 });

  const spot = findOpenTile(game.maze);
  const target = teamPlayers[0];
  target.x = spot.x + 0.5;
  target.y = spot.y + 0.5;
  game.teams[0].hp = 1;

  game.bullets.push({
    id: 999,
    teamId: 1,
    ownerId: enemy.id,
    x: target.x,
    y: target.y,
    vx: 0,
    vy: 0,
    lifeMs: 500,
    damage: 1,
  });

  const result = game.step(16);
  const alive = game.players.filter((player) => player.teamId === 0 && player.alive);

  assert.equal(alive.length, 2);
  assert.equal(game.players.filter((player) => player.teamId === 0 && player.isGhost).length, 2);
  assert.equal(game.teams[0].maxHp, 2 * TEAM_HP_PER_PLAYER);
  assert.equal(game.teams[0].hp, TEAM_HP_PER_PLAYER);
  assert.ok(result.events.some((event) => event.type === 'team-revived'));
});

test('a team at two players is eliminated instead of revived', () => {
  const game = new Game({ seed: 15, teams: 2, playersPerTeam: 4, width: 41, height: 41 });
  const first = game.join({ teamId: 0 });
  game.join({ teamId: 0 });
  const enemy = game.join({ teamId: 1 });

  const spot = findOpenTile(game.maze);
  first.x = spot.x + 0.5;
  first.y = spot.y + 0.5;
  game.teams[0].hp = 1;

  game.bullets.push({
    id: 999,
    teamId: 1,
    ownerId: enemy.id,
    x: first.x,
    y: first.y,
    vx: 0,
    vy: 0,
    lifeMs: 500,
    damage: 1,
  });

  game.step(16);

  assert.equal(game.teams[0].eliminated, true);
  assert.equal(game.teams[0].hp, 0);
  assert.equal(game.players.filter((player) => player.teamId === 0 && player.alive).length, 0);
});

test('ghosts ignore walls and can switch tasks', () => {
  const game = new Game({ seed: 16, teams: 2, playersPerTeam: 4, width: 41, height: 41 });
  const ghost = game.join({ teamId: 0 });

  ghost.alive = false;
  ghost.isGhost = true;

  let wallSpot = null;
  for (let y = 1; y < game.maze.height - 1 && !wallSpot; y += 1) {
    for (let x = 1; x < game.maze.width - 2 && !wallSpot; x += 1) {
      if (isWall(game.maze, x, y)) {
        wallSpot = { x, y };
      }
    }
  }

  ghost.x = wallSpot.x + 0.5;
  ghost.y = wallSpot.y + 0.5;
  const startX = ghost.x;

  stepWith(game, ghost, { right: true, ghostTask: 'dash' }, 100);

  assert.ok(ghost.x > startX);
  assert.equal(ghost.ghostTask, 'dash');
});

test('the same seed and input sequence replay the same match', () => {
  function play() {
    const game = new Game({ seed: 77, teams: 2, playersPerTeam: 3, width: 41, height: 41 });
    const player = game.join({ teamId: 0, name: 'A' });
    game.join({ teamId: 1, name: 'B' });

    for (let step = 0; step < 40; step += 1) {
      stepWith(
        game,
        player,
        {
          right: step % 3 === 0,
          down: step % 5 === 0,
          shoot: step % 7 === 0,
          aimX: player.x + 1,
          aimY: player.y,
        },
        16,
      );
    }

    return game.snapshot();
  }

  assert.deepEqual(play(), play());
});

test('game defaults are exposed', () => {
  assert.equal(GAME_DEFAULTS.teams, 2);
  assert.ok(MOVE_SPEED > 0);
});
