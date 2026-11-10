import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ITEM_TYPES,
  TILE,
  bestRectangle,
  generateMaze,
  isWall,
  spawnTeamAt,
} from '../src/maze.js';

function reachableFreeTiles(maze, startX, startY) {
  const seen = new Uint8Array(maze.width * maze.height);
  const queue = [[startX, startY]];
  seen[startY * maze.width + startX] = 1;

  while (queue.length > 0) {
    const [x, y] = queue.pop();
    const neighbours = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];

    for (const [nx, ny] of neighbours) {
      if (nx < 0 || ny < 0 || nx >= maze.width || ny >= maze.height) {
        continue;
      }
      const index = ny * maze.width + nx;
      if (seen[index] || maze.tiles[index] === TILE.WALL) {
        continue;
      }
      seen[index] = 1;
      queue.push([nx, ny]);
    }
  }

  return seen;
}

test('bestRectangle finds the squarest whole-tile rectangle', () => {
  assert.deepEqual(bestRectangle(16), { width: 4, height: 4 });
  assert.deepEqual(bestRectangle(12), { width: 4, height: 3 });
  assert.deepEqual(bestRectangle(2), { width: 2, height: 1 });
  assert.deepEqual(bestRectangle(7), { width: 7, height: 1 });
  assert.throws(() => bestRectangle(0), RangeError);
  assert.throws(() => bestRectangle(1.5), RangeError);
});

test('the same seed generates the same maze', () => {
  const options = { width: 41, height: 41, teams: 3, playersPerTeam: 4, seed: 99 };
  const first = generateMaze(options);
  const second = generateMaze(options);

  assert.deepEqual(first.tiles, second.tiles);
  assert.deepEqual(first.spawnZones, second.spawnZones);
  assert.deepEqual(first.spawns, second.spawns);
  assert.deepEqual(first.items, second.items);
});

test('different seeds generate different mazes', () => {
  const first = generateMaze({ width: 41, height: 41, seed: 1 });
  const second = generateMaze({ width: 41, height: 41, seed: 2 });

  assert.notDeepEqual(first.tiles, second.tiles);
});

test('the map is square, row-major, and walled at the border', () => {
  const maze = generateMaze({ width: 51, height: 51, teams: 2, playersPerTeam: 8 });
  assert.equal(maze.tiles.length, 51 * 51);

  for (let x = 0; x < maze.width; x += 1) {
    assert.ok(isWall(maze, x, 0));
    assert.ok(isWall(maze, x, maze.height - 1));
  }
  for (let y = 0; y < maze.height; y += 1) {
    assert.ok(isWall(maze, 0, y));
    assert.ok(isWall(maze, maze.width - 1, y));
  }
});

test('spawn rooms use two tiles per player and stay clear of each other', () => {
  const playersPerTeam = 6;
  const maze = generateMaze({
    width: 61,
    height: 61,
    teams: 4,
    playersPerTeam,
  });

  for (const room of maze.spawns) {
    assert.equal(room.width * room.height, playersPerTeam * 2);
    assert.ok(room.x >= 1 && room.y >= 1);
    assert.ok(room.x + room.width <= maze.width - 1);
    assert.ok(room.y + room.height <= maze.height - 1);

    for (let y = room.y; y < room.y + room.height; y += 1) {
      for (let x = room.x; x < room.x + room.width; x += 1) {
        assert.equal(maze.tiles[y * maze.width + x], TILE.FREE);
        assert.equal(spawnTeamAt(maze, x, y), room.teamId);
      }
    }
  }

  for (let a = 0; a < maze.spawns.length; a += 1) {
    for (let b = a + 1; b < maze.spawns.length; b += 1) {
      const first = maze.spawns[a];
      const second = maze.spawns[b];
      const overlaps =
        first.x < second.x + second.width &&
        first.x + first.width > second.x &&
        first.y < second.y + second.height &&
        first.y + first.height > second.y;
      assert.equal(overlaps, false);
    }
  }
});

test('every spawn room is reachable through the maze', () => {
  const maze = generateMaze({
    width: 61,
    height: 61,
    teams: 4,
    playersPerTeam: 4,
    seed: 7,
  });
  const start = maze.spawns[0];
  const reachable = reachableFreeTiles(
    maze,
    start.x + Math.floor(start.width / 2),
    start.y + Math.floor(start.height / 2),
  );

  for (const room of maze.spawns) {
    for (let y = room.y; y < room.y + room.height; y += 1) {
      for (let x = room.x; x < room.x + room.width; x += 1) {
        assert.equal(
          reachable[y * maze.width + x],
          1,
          `spawn tile ${x},${y} is cut off`,
        );
      }
    }
  }
});

test('every free tile belongs to a two-by-two open block', () => {
  for (const options of [
    { width: 61, height: 61, teams: 2, playersPerTeam: 1, seed: 3 },
    { width: 51, height: 51, teams: 3, playersPerTeam: 4, seed: 11 },
    { width: 71, height: 71, teams: 4, playersPerTeam: 8, seed: 21 },
  ]) {
    const maze = generateMaze(options);

    for (let y = 0; y < maze.height; y += 1) {
      for (let x = 0; x < maze.width; x += 1) {
        if (maze.tiles[y * maze.width + x] !== TILE.FREE) {
          continue;
        }

        const hasBlock =
          (x + 1 < maze.width &&
            y + 1 < maze.height &&
            maze.tiles[y * maze.width + x + 1] === TILE.FREE &&
            maze.tiles[(y + 1) * maze.width + x] === TILE.FREE &&
            maze.tiles[(y + 1) * maze.width + x + 1] === TILE.FREE) ||
          (x > 0 &&
            y + 1 < maze.height &&
            maze.tiles[y * maze.width + x - 1] === TILE.FREE &&
            maze.tiles[(y + 1) * maze.width + x] === TILE.FREE &&
            maze.tiles[(y + 1) * maze.width + x - 1] === TILE.FREE) ||
          (x + 1 < maze.width &&
            y > 0 &&
            maze.tiles[y * maze.width + x + 1] === TILE.FREE &&
            maze.tiles[(y - 1) * maze.width + x] === TILE.FREE &&
            maze.tiles[(y - 1) * maze.width + x + 1] === TILE.FREE) ||
          (x > 0 &&
            y > 0 &&
            maze.tiles[y * maze.width + x - 1] === TILE.FREE &&
            maze.tiles[(y - 1) * maze.width + x] === TILE.FREE &&
            maze.tiles[(y - 1) * maze.width + x - 1] === TILE.FREE);

        assert.ok(hasBlock, `tile ${x},${y} is not part of a 2x2 open block`);
      }
    }
  }
});

test('a one-player spawn room is still two-by-two', () => {
  const maze = generateMaze({ width: 31, height: 31, teams: 2, playersPerTeam: 1, seed: 5 });

  for (const room of maze.spawns) {
    assert.ok(room.width >= 2);
    assert.ok(room.height >= 2);
  }
});

test('special items spawn on free maze tiles outside spawn rooms', () => {
  const itemsPerTeam = 5;
  const teams = 3;
  const maze = generateMaze({
    width: 71,
    height: 71,
    teams,
    playersPerTeam: 4,
    itemsPerTeam,
    seed: 42,
  });

  assert.equal(maze.items.length, teams * itemsPerTeam);

  const used = new Set();
  for (const item of maze.items) {
    assert.ok(ITEM_TYPES.includes(item.type));
    assert.equal(item.taken, false);
    assert.equal(maze.tiles[item.y * maze.width + item.x], TILE.FREE);
    assert.equal(spawnTeamAt(maze, item.x, item.y), -1);
    const key = `${item.x},${item.y}`;
    assert.equal(used.has(key), false);
    used.add(key);
  }
});

test('invalid maze options are rejected', () => {
  assert.throws(() => generateMaze({ width: 40 }), RangeError);
  assert.throws(() => generateMaze({ height: 40 }), RangeError);
  assert.throws(() => generateMaze({ width: 8 }), RangeError);
  assert.throws(() => generateMaze({ teams: 1 }), RangeError);
  assert.throws(() => generateMaze({ playersPerTeam: 0 }), RangeError);
  assert.throws(() => generateMaze({ itemsPerTeam: -1 }), RangeError);
  assert.throws(
    () => generateMaze({ width: 9, height: 9, teams: 8, playersPerTeam: 8 }),
    RangeError,
  );
});
