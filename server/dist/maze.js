import { TILE } from '@co-up/shared';
export function generateMaze(w, h) {
    const grid = Array(h).fill(0).map((_, y) => Array(w).fill(0).map((_, x) => ({ wN: true, wE: true, wS: true, wW: true, visited: false })));
    const stack = [];
    let cx = Math.floor(Math.random() * w), cy = Math.floor(Math.random() * h);
    grid[cy][cx].visited = true;
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    function carve() {
        const neighbors = [];
        for (let i = 0; i < 4; i++) {
            const nx = cx + dirs[i][0], ny = cy + dirs[i][1];
            if (nx >= 0 && nx < w && ny >= 0 && ny < h && !grid[ny][nx].visited)
                neighbors.push([nx, ny, i]);
        }
        if (neighbors.length) {
            const [nx, ny, di] = neighbors[Math.floor(Math.random() * neighbors.length)];
            if (di === 0) {
                grid[cy][cx].wN = false;
                grid[ny][nx].wS = false;
            }
            if (di === 1) {
                grid[cy][cx].wE = false;
                grid[ny][nx].wW = false;
            }
            if (di === 2) {
                grid[cy][cx].wS = false;
                grid[ny][nx].wN = false;
            }
            if (di === 3) {
                grid[cy][cx].wW = false;
                grid[ny][nx].wE = false;
            }
            stack.push([cx, cy]);
            cx = nx;
            cy = ny;
            grid[cy][cx].visited = true;
        }
        else if (stack.length) {
            [cx, cy] = stack.pop();
        }
    }
    let steps = 0;
    const limit = w * h * 50;
    while ((stack.length > 0 || steps < w * h) && steps < limit) {
        carve();
        steps++;
    }
    // open up more to create large open spaces - remove some internal walls randomly
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            if (Math.random() < 0.3) {
                const r = Math.floor(Math.random() * 4);
                if (r === 0 && grid[y][x].wN) {
                    grid[y][x].wN = false;
                    if (y > 0)
                        grid[y - 1][x].wS = false;
                }
                if (r === 1 && grid[y][x].wE) {
                    grid[y][x].wE = false;
                    if (x < w - 1)
                        grid[y][x + 1].wW = false;
                }
                if (r === 2 && grid[y][x].wS) {
                    grid[y][x].wS = false;
                    if (y < h - 1)
                        grid[y + 1][x].wN = false;
                }
                if (r === 3 && grid[y][x].wW) {
                    grid[y][x].wW = false;
                    if (x > 0)
                        grid[y][x - 1].wE = false;
                }
            }
        }
    }
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
            if (!grid[y][x].visited)
                grid[y][x].visited = true;
    return grid;
}
export function mazeToWalls(grid, w, h) {
    const walls = [];
    const tw = TILE;
    const wallThick = 6; // 3x wider than before
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const c = grid[y][x];
            const px = x * tw, py = y * tw;
            if (c.wN)
                walls.push({ x: px, y: py, w: tw, h: wallThick });
            if (c.wS)
                walls.push({ x: px, y: py + tw - wallThick, w: tw, h: wallThick });
            if (c.wW)
                walls.push({ x: px, y: py, w: wallThick, h: tw });
            if (c.wE)
                walls.push({ x: px + tw - wallThick, y: py, w: wallThick, h: tw });
        }
    }
    return walls;
}
export function getPathCenters(grid, w, h) {
    const centers = [];
    const tw = TILE;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            centers.push({ x: x * tw + tw / 2, y: y * tw + tw / 2 });
        }
    }
    return centers;
}
