import test from 'node:test';
import assert from 'node:assert/strict';

import { BotDirector } from '../src/bots.js';
import { Game } from '../src/game.js';
import { TILE } from '../src/maze.js';

function clearMaze(game) {
  const { width, height } = game.maze;
  game.maze.tiles.fill(TILE.FLOOR);
  game.maze.spawnZones.fill(-1);
  for (let x = 0; x < width; x += 1) {
    game.maze.tiles[x] = TILE.WALL;
    game.maze.tiles[(height - 1) * width + x] = TILE.WALL;
  }
  for (let y = 0; y < height; y += 1) {
    game.maze.tiles[y * width] = TILE.WALL;
    game.maze.tiles[y * width + width - 1] = TILE.WALL;
  }
}

test('bots aim and fire at visible enemies instead of wasting their magazines', () => {
  const game = new Game({ seed: 31, teams: 2, playersPerTeam: 2, width: 41, height: 41 });
  clearMaze(game);
  const bot = game.join({ teamId: 0, isBot: true });
  const enemy = game.join({ teamId: 1 });
  bot.x = 5.5;
  bot.y = 5.5;
  enemy.x = 10.5;
  enemy.y = 5.5;
  game.timeMs = 1000;

  const input = new BotDirector(game, { seed: 99 }).inputs().get(bot.id);

  assert.equal(input.shoot, true);
  assert.equal(input.aimX, enemy.x);
  assert.equal(input.aimY, enemy.y);
});

test('bots route around walls instead of steering into their target', () => {
  const game = new Game({ seed: 32, teams: 2, playersPerTeam: 2, width: 41, height: 41 });
  clearMaze(game);
  for (let y = 1; y < game.maze.height - 1; y += 1) {
    if (y !== 10) game.maze.tiles[y * game.maze.width + 7] = TILE.WALL;
  }
  const bot = game.join({ teamId: 0, isBot: true });
  const enemy = game.join({ teamId: 1 });
  bot.x = 5.5;
  bot.y = 5.5;
  enemy.x = 10.5;
  enemy.y = 5.5;

  const bots = new BotDirector(game, { seed: 100 });
  for (let tick = 0; tick < 240; tick += 1) {
    game.step(16, bots.inputs());
  }

  assert.ok(bot.x > 6.5);
  assert.ok(bot.y > 5.5);
  assert.ok(!(Math.floor(bot.x) === 7 && Math.floor(bot.y) !== 10));
});

