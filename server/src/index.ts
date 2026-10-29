import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import { MsgType, TICK_RATE, TILE, MAZE_W, MAZE_H } from '@co-up/shared';
import { generateMaze, mazeToWalls, getPathCenters } from './maze.js';

const fastify = Fastify({ logger: false });
await fastify.register(websocket);

type Player = {
  id: string;
  ws: WebSocket;
  name: string;
  x: number; y: number;
  angle: number;
  alive: boolean;
  inputs: any;
};

const mazeGrid = generateMaze(MAZE_W, MAZE_H);
const walls = mazeToWalls(mazeGrid, MAZE_W, MAZE_H);
const pathCenters = getPathCenters(mazeGrid, MAZE_W, MAZE_H);

const state = {
  players: new Map<string, Player>(),
  tick: 0
};

function circleRect(cx:number,cy:number,r:number,rx:number,ry:number,rw:number,rh:number){
  const testX = Math.max(rx, Math.min(cx, rx+rw));
  const testY = Math.max(ry, Math.min(cy, ry+rh));
  const dx = cx-testX, dy = cy-testY;
  return (dx*dx+dy*dy) < r*r;
}

fastify.register(async function (f) {
  f.get('/ws', { websocket: true }, (connection: any) => {
    const ws = connection.socket || connection;
    ws.on('message', (raw: any) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.t === MsgType.JOIN) {
          const id = nanoid();
          const start = pathCenters[0] || { x: TILE*2, y: TILE*2 };
          const p: Player = { id, ws, name: msg.name || 'p', x: start.x, y: start.y, angle: 0, alive: true, inputs: {} };
          state.players.set(id, p);
          ws.send(JSON.stringify({ t: MsgType.EVENT, kind: 'joined', id }));
        } else if (msg.t === MsgType.INPUT) {
          const p = Array.from(state.players.values()).find(pl => pl.ws === ws);
          if (p && p.alive) {
            p.inputs = msg;
            if ((msg.mx !== 0 || msg.my !== 0)) p.angle = Math.atan2(msg.my, msg.mx);
          }
        }
      } catch(e) {}
    });
  });
});

setInterval(() => {
  state.tick++;
  const dt = 1/TICK_RATE;
  const spd = 220;
  for (const p of state.players.values()) {
    if (!p.alive) continue;
    let ix = p.inputs.mx || 0;
    let iy = p.inputs.my || 0;
    const len = Math.hypot(ix,iy) || 1;
    ix/=len; iy/=len;
    let nx = p.x + ix*spd*dt;
    let ny = p.y + iy*spd*dt;
    const r = 7;
    // try to move with wall sliding
    let canX = true, canY = true;
    for (const w of walls) {
      if (circleRect(nx, p.y, r, w.x, w.y, w.w, w.h)) canX = false;
      if (circleRect(p.x, ny, r, w.x, w.y, w.w, w.h)) canY = false;
    }
    if (canX) p.x = nx; else {
      // slide along y
      let nx2 = p.x; let ny2 = p.y + iy*spd*dt;
      let ok = true;
      for (const w of walls) if (circleRect(nx2, ny2, r, w.x,w.y,w.w,w.h)) { ok=false; break; }
      if (ok) p.y = ny2;
    }
    if (canY) p.y = ny;
  }
  const snap = {
    t: MsgType.SNAPSHOT,
    tick: state.tick,
    time: Date.now(),
    players: Array.from(state.players.values()).filter(p=>p.alive).map(p => ({
      id: p.id, name: p.name, x: p.x, y: p.y, angle: p.angle, alive: p.alive
    })),
    bullets: [],
    items: [],
    teams: [],
    walls
  };
  const data = JSON.stringify(snap);
  for (const p of state.players.values()) {
    if (p.ws.readyState === WebSocket.OPEN) p.ws.send(data);
  }
}, 1000/TICK_RATE);

fastify.listen({ port: 8080, host: '0.0.0.0' }).then(() => console.log('co-up on :8080'));
