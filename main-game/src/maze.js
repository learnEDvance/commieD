// Deterministic procedural maze for commieD.
// Pass 1 places team spawn rooms, pass 2 carves the maze, pass 3 scatters items.
// Tiles live in one flat array: row-major, fixed square size for now.

export const TILE = Object.freeze({
  FREE: 0,
  WALL: 1,
});

export const ITEM_TYPES = Object.freeze([
  'bomb',
  'hp',
  'speed',
  'gunPlus',
  'phaseless',
  'coat',
]);

export const MAZE_DEFAULTS = Object.freeze({
  width: 61,
  height: 61,
  teams: 2,
  playersPerTeam: 8,
  itemsPerTeam: 4,
  seed: 1,
});

const ITEM_WEIGHTS = Object.freeze({
  bomb: 20,
  hp: 25,
  speed: 20,
  gunPlus: 15,
  phaseless: 10,
  coat: 10,
});

/** Small, fast, deterministic 32-bit PRNG. */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    int(max) {
      return Math.floor(next() * max);
    },
    pick(list) {
      return list[this.int(list.length)];
    },
    shuffle(list) {
      for (let index = list.length - 1; index > 0; index -= 1) {
        const swap = this.int(index + 1);
        [list[index], list[swap]] = [list[swap], list[index]];
      }
      return list;
    },
  };
}

/**
 * Convert an area into the rectangle with the closest matching sides.
 * 16 -> 4x4, 12 -> 4x3, 7 -> 7x1.
 */
export function bestRectangle(area) {
  if (!Number.isInteger(area) || area <= 0) {
    throw new RangeError('area must be a positive integer');
  }

  let best = null;

  for (let height = 1; height * height <= area; height += 1) {
    if (area % height !== 0) {
      continue;
    }

    const width = area / height;
    const diff = width - height;

    if (best === null || diff < best.diff) {
      best = { width, height, diff };
    }
  }

  return { width: best.width, height: best.height };
}

export function tileIndex(maze, x, y) {
  return y * maze.width + x;
}

export function isWall(maze, x, y) {
  if (x < 0 || y < 0 || x >= maze.width || y >= maze.height) {
    return true;
  }
  return maze.tiles[y * maze.width + x] === TILE.WALL;
}

/** Team index at a tile, or -1 for normal maze space. */
export function spawnTeamAt(maze, x, y) {
  if (x < 0 || y < 0 || x >= maze.width || y >= maze.height) {
    return -1;
  }
  return maze.spawnZones[y * maze.width + x];
}

export function generateMaze(options = {}) {
  const config = { ...MAZE_DEFAULTS, ...options };

  if (!Number.isInteger(config.width) || config.width < 9 || config.width % 2 === 0) {
    throw new RangeError('width must be an odd integer >= 9');
  }
  if (!Number.isInteger(config.height) || config.height < 9 || config.height % 2 === 0) {
    throw new RangeError('height must be an odd integer >= 9');
  }
  if (!Number.isInteger(config.teams) || config.teams < 2) {
    throw new RangeError('teams must be an integer >= 2');
  }
  if (!Number.isInteger(config.playersPerTeam) || config.playersPerTeam < 1) {
    throw new RangeError('playersPerTeam must be a positive integer');
  }
  if (!Number.isInteger(config.itemsPerTeam) || config.itemsPerTeam < 0) {
    throw new RangeError('itemsPerTeam must be a non-negative integer');
  }

  const rng = makeRng(config.seed);
  const { width, height } = config;
  const tiles = new Uint8Array(width * height).fill(TILE.WALL);
  const spawnZones = new Int16Array(width * height).fill(-1);

  const spawns = placeSpawnZones(rng, width, height, config.teams, config.playersPerTeam);
  carveMaze(rng, tiles, width, height);

  for (const zone of spawns) {
    carveRoom(tiles, width, zone);
    for (let y = zone.y; y < zone.y + zone.height; y += 1) {
      for (let x = zone.x; x < zone.x + zone.width; x += 1) {
        spawnZones[y * width + x] = zone.teamId;
      }
    }
  }

  // A corridor between every pair of rooms guarantees the spawns connect
  // even when the maze pass leaves a room sealed by walls.
  for (let index = 1; index < spawns.length; index += 1) {
    connectRooms(tiles, width, height, spawns[index - 1], spawns[index]);
  }

  const items = scatterItems(rng, {
    tiles,
    spawnZones,
    width,
    height,
    count: config.teams * config.itemsPerTeam,
  });

  return {
    width,
    height,
    tiles,
    spawnZones,
    spawns,
    items,
    seed: config.seed,
  };
}

function placeSpawnZones(rng, width, height, teams, playersPerTeam) {
  // Every room is at least 2x2 so no player ever stands in a one-tile pocket.
  const area = Math.max(4, playersPerTeam * 2);
  const { width: roomWidth, height: roomHeight } = bestRectangle(area);
  const zones = [];

  if (roomWidth + 2 >= width || roomHeight + 2 >= height) {
    throw new RangeError('map is too small for the spawn room size');
  }

  for (let teamId = 0; teamId < teams; teamId += 1) {
    let placed = null;

    for (let attempt = 0; attempt < 600 && !placed; attempt += 1) {
      const x = 1 + rng.int(width - roomWidth - 2);
      const y = 1 + rng.int(height - roomHeight - 2);

      if (x + roomWidth > width - 1 || y + roomHeight > height - 1) {
        continue;
      }

      const candidate = { x, y, width: roomWidth, height: roomHeight };

      if (zones.some((zone) => rectsOverlap(candidate, zone, 3))) {
        continue;
      }

      placed = candidate;
    }

    if (!placed) {
      throw new RangeError('map is too small for every spawn room');
    }

    zones.push({ teamId, ...placed });
  }

  return zones;
}

function rectsOverlap(a, b, padding) {
  return (
    a.x - padding < b.x + b.width &&
    a.x + a.width + padding > b.x &&
    a.y - padding < b.y + b.height &&
    a.y + a.height + padding > b.y
  );
}

function carveMaze(rng, tiles, width, height) {
  // Cells are 2x2 open rooms separated by one-tile walls, so every corridor
  // and junction is two tiles wide. Cell starts sit on 1 + 3 * index.
  const CELL_STEP = 3;
  const CELL_SIZE = 2;
  const cols = Math.floor((width - 4) / CELL_STEP) + 1;
  const rows = Math.floor((height - 4) / CELL_STEP) + 1;
  const cellX = (col) => 1 + col * CELL_STEP;
  const cellY = (row) => 1 + row * CELL_STEP;
  const keyOf = (col, row) => row * cols + col;
  const visited = new Set([keyOf(0, 0)]);
  const stack = [[0, 0]];

  const carveCell = (col, row) => {
    const startX = cellX(col);
    const startY = cellY(row);

    for (let y = 0; y < CELL_SIZE; y += 1) {
      for (let x = 0; x < CELL_SIZE; x += 1) {
        tiles[(startY + y) * width + startX + x] = TILE.FREE;
      }
    }
  };

  carveCell(0, 0);

  while (stack.length > 0) {
    const [col, row] = stack[stack.length - 1];
    const options = [];

    for (const [dc, dr] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      const nextCol = col + dc;
      const nextRow = row + dr;

      if (nextCol < 0 || nextRow < 0 || nextCol >= cols || nextRow >= rows) {
        continue;
      }
      if (visited.has(keyOf(nextCol, nextRow))) {
        continue;
      }
      options.push([nextCol, nextRow, dc, dr]);
    }

    if (options.length === 0) {
      stack.pop();
      continue;
    }

    const [nextCol, nextRow, dc, dr] = options[rng.int(options.length)];

    // Remove the one-tile wall between the two 2x2 cells. Because the wall is
    // carved for both rows (or both columns), the opening stays two tiles wide.
    if (dc === 1) {
      for (let y = 0; y < CELL_SIZE; y += 1) {
        tiles[(cellY(row) + y) * width + cellX(col) + CELL_SIZE] = TILE.FREE;
      }
    } else if (dc === -1) {
      for (let y = 0; y < CELL_SIZE; y += 1) {
        tiles[(cellY(row) + y) * width + cellX(col) - 1] = TILE.FREE;
      }
    } else if (dr === 1) {
      for (let x = 0; x < CELL_SIZE; x += 1) {
        tiles[(cellY(row) + CELL_SIZE) * width + cellX(col) + x] = TILE.FREE;
      }
    } else if (dr === -1) {
      for (let x = 0; x < CELL_SIZE; x += 1) {
        tiles[(cellY(row) - 1) * width + cellX(col) + x] = TILE.FREE;
      }
    }

    carveCell(nextCol, nextRow);
    visited.add(keyOf(nextCol, nextRow));
    stack.push([nextCol, nextRow]);
  }
}

function carveRoom(tiles, width, room) {
  for (let y = room.y; y < room.y + room.height; y += 1) {
    for (let x = room.x; x < room.x + room.width; x += 1) {
      tiles[y * width + x] = TILE.FREE;
    }
  }
}

/** First index of a 2-wide band that still contains `center`, keeping a wall at the border. */
function bandStart(center, size) {
  return Math.min(Math.max(center, 1), size - 3);
}

function connectRooms(tiles, width, height, from, to) {
  const fromX = from.x + Math.floor(from.width / 2);
  const fromY = from.y + Math.floor(from.height / 2);
  const toX = to.x + Math.floor(to.width / 2);
  const toY = to.y + Math.floor(to.height / 2);

  // Both arms are two tiles thick. The horizontal arm spans the source room to
  // the destination column band, the vertical arm spans the horizontal band to
  // the destination room, and the overlap is a 2x2 corner.
  const row = bandStart(fromY, height);
  const column = bandStart(toX, width);
  const left = Math.min(fromX, column);
  const right = Math.max(fromX, column) + 1;
  const top = Math.min(row, toY);
  const bottom = Math.max(row + 1, toY);

  carveRectangle(tiles, width, left, row, right, row + 1);
  carveRectangle(tiles, width, column, top, column + 1, bottom);
}

function carveRectangle(tiles, width, left, top, right, bottom) {
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      tiles[y * width + x] = TILE.FREE;
    }
  }
}

export function rollItemType(rng) {
  const total = ITEM_TYPES.reduce((sum, type) => sum + ITEM_WEIGHTS[type], 0);
  let roll = rng.next() * total;

  for (const type of ITEM_TYPES) {
    roll -= ITEM_WEIGHTS[type];
    if (roll < 0) {
      return type;
    }
  }

  return ITEM_TYPES[ITEM_TYPES.length - 1];
}

function scatterItems(rng, { tiles, spawnZones, width, height, count }) {
  const candidates = [];

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (tiles[index] === TILE.FREE && spawnZones[index] === -1) {
        candidates.push({ x, y });
      }
    }
  }

  rng.shuffle(candidates);

  const items = [];
  const limit = Math.min(count, candidates.length);

  for (let index = 0; index < limit; index += 1) {
    items.push({
      id: index + 1,
      type: rollItemType(rng),
      x: candidates[index].x,
      y: candidates[index].y,
      taken: false,
    });
  }

  return items;
}
