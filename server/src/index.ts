import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import { MsgType, TICK_RATE, MAX_CONNECTIONS, HOP_DELAY, TIME_PER_SEC, REPAY_RATE, BULLET_DMG, BULLETS_PER_SEC } from '@co-up/shared';

const fastify = Fastify({ logger: false });
await fastify.register(websocket);

type Player = {
  id: string;
  ws: WebSocket;
  name: string;
  x: number; y: number;
  vx: number; vy: number;
  hp: number; maxHp: number;
  teamId: string | null;
  connectedTo: string[];
  alive: boolean;
  ammo: number;
  timeBank: number;
  debt: number;
  speedBoostLeft: number;
  shieldLeft: number;
  lastShot: number;
  inputs: any;
};

type Bullet = { id: string; x: number; y: number; vx: number; vy: number; ownerId: string; life: number };
type Item = { id: string; x: number; y: number; kind: string };

const state = {
  players: new Map<string, Player>(),
  teams: new Map<string, any>(),
  bullets: [] as Bullet[],
  items: [] as Item[],
  tick: 0
};

function createTeam(): string {
  const id = nanoid();
  state.teams.set(id, { id, members: [], connections: [] });
  return id;
}

// spawn some items
for (let i = 0; i < 30; i++) {
  const kinds = ['hp+', 'speed+', 'rounds+', 'shield', 'bomb'];
  state.items.push({ id: nanoid(), x: Math.random()*2000-1000, y: Math.random()*1500-750, kind: kinds[Math.floor(Math.random()*kinds.length)] });
}

fastify.register(async function (f) {
  f.get('/ws', { websocket: true }, (connection) => {
    const ws = connection.socket;
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.t === MsgType.JOIN) {
          const id = nanoid();
          const p: Player = {
            id, ws, name: msg.name || 'p',
            x: (Math.random()*2000)-1000, y: (Math.random()*1500)-750,
            vx: 0, vy: 0, hp: 100, maxHp: 100,
            teamId: null, connectedTo: [], alive: true,
            ammo: 30, timeBank: 0, debt: 0,
            speedBoostLeft: 0, shieldLeft: 0, lastShot: 0, inputs: {}
          };
          state.players.set(id, p);
          ws.send(JSON.stringify({ t: MsgType.EVENT, kind: 'joined', id }));
        } else if (msg.t === MsgType.INPUT) {
          const p = Array.from(state.players.values()).find(pl => pl.ws === ws);
          if (p && p.alive) {
            p.inputs = msg;
            // shooting
            if (msg.shoot && p.ammo > 0) {
              const now = Date.now();
              if (now - p.lastShot > 100) { // 10/sec
                p.lastShot = now;
                p.ammo -= 1;
                const angle = Math.atan2(msg.my, msg.mx);
                state.bullets.push({ id: nanoid(), x: p.x, y: p.y, vx: Math.cos(angle)*400, vy: Math.sin(angle)*400, ownerId: p.id, life: 1.0 });
              }
            }
            // try to connect if touching another unconnected
            if (p.connectedTo.length < MAX_CONNECTIONS) {
              for (const other of state.players.values()) {
                if (other.id === p.id || !other.alive) continue;
                const dx = other.x-p.x, dy = other.y-p.y;
                if (dx*dx+dy*dy < 400 && p.connectedTo.length < MAX_CONNECTIONS && other.connectedTo.length < MAX_CONNECTIONS) {
                  // connect if either unconnected or can join team
                  if (!p.teamId && !other.teamId) {
                    const tid = createTeam();
                    p.teamId = tid; other.teamId = tid;
                    p.connectedTo.push(other.id); other.connectedTo.push(p.id);
                    state.teams.get(tid)!.members = [p.id, other.id];
                    state.teams.get(tid)!.connections = [[p.id,other.id]];
                    break;
                  } else if (p.teamId && !other.teamId) {
                    other.teamId = p.teamId;
                    p.connectedTo.push(other.id); other.connectedTo.push(p.id);
                    const t = state.teams.get(p.teamId)!;
                    t.members.push(other.id);
                    t.connections.push([p.id,other.id]);
                    break;
                  } else if (!p.teamId && other.teamId) {
                    p.teamId = other.teamId;
                    p.connectedTo.push(other.id); other.connectedTo.push(p.id);
                    const t = state.teams.get(other.teamId)!;
                    t.members.push(p.id);
                    t.connections.push([p.id,other.id]);
                    break;
                  }
                }
              }
            }
          }
        }
      } catch(e) {}
    });
    ws.on('close', () => {
      // disconnect handling TODO as per design
    });
  });
});

setInterval(() => {
  state.tick++;
  const dt = 1/TICK_RATE;
  for (const p of state.players.values()) {
    if (!p.alive) continue;
    p.timeBank += TIME_PER_SEC * dt;
    if (p.debt > 0) {
      const pay = Math.min(p.debt, REPAY_RATE * dt);
      p.debt -= pay;
    }
    if (p.speedBoostLeft > 0) p.speedBoostLeft -= dt;
    if (p.shieldLeft > 0) p.shieldLeft -= dt;
    // movement
    const spd = p.speedBoostLeft > 0 ? 200 * 1.5 : 200;
    if (p.inputs.mx !== undefined) p.vx = p.inputs.mx * spd;
    if (p.inputs.my !== undefined) p.vy = p.inputs.my * spd;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    // item pickup
    for (let i = state.items.length-1; i >= 0; i--) {
      const it = state.items[i];
      const dx = it.x-p.x, dy = it.y-p.y;
      if (dx*dx+dy*dy < 100) {
        // apply item
        if (it.kind === 'hp+') { p.hp = Math.min(p.maxHp, p.hp+10); }
        if (it.kind === 'speed+') { p.speedBoostLeft = 15; }
        if (it.kind === 'rounds+') { p.ammo += 30; }
        if (it.kind === 'shield') { p.shieldLeft = 10; }
        if (it.kind === 'bomb') {
          // damage enemy and nearest 5 linked
          for (const other of state.players.values()) {
            if (!other.alive || other.id === p.id) continue;
            const ddx = other.x-p.x, ddy = other.y-p.y;
            if (ddx*ddx+ddy*ddy < 40000) { // nearby
              const dmg = other.teamId && p.teamId && other.teamId === p.teamId ? 40 : 80;
              if (other.shieldLeft <= 0) other.hp -= dmg;
              if (other.hp <= 0 && other.alive) {
                other.alive = false;
                // killer gets random drop effect
              }
            }
          }
        }
        state.items.splice(i,1);
        // respawn item
        const kinds = ['hp+', 'speed+', 'rounds+', 'shield', 'bomb'];
        state.items.push({ id: nanoid(), x: Math.random()*2000-1000, y: Math.random()*1500-750, kind: kinds[Math.floor(Math.random()*kinds.length)] });
      }
    }
  }
  // bullets
  for (let i = state.bullets.length-1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) { state.bullets.splice(i,1); continue; }
    for (const p of state.players.values()) {
      if (!p.alive || p.id === b.ownerId) continue;
      const dx = p.x-b.x, dy = p.y-b.y;
      if (dx*dx+dy*dy < 36) {
        if (p.shieldLeft <= 0) p.hp -= BULLET_DMG;
        state.bullets.splice(i,1);
        if (p.hp <= 0 && p.alive) {
          p.alive = false; // out of game
        }
        break;
      }
    }
  }
  // snapshots
  const snap = {
    t: MsgType.SNAPSHOT,
    tick: state.tick,
    time: Date.now(),
    players: Array.from(state.players.values()).filter(p=>p.alive).map(p => ({
      id: p.id, name: p.name, x: p.x, y: p.y, vx: p.vx, vy: p.vy,
      hp: p.hp, maxHp: p.maxHp, teamId: p.teamId, connectedTo: p.connectedTo,
      alive: p.alive, ammo: p.ammo, speedBoostLeft: p.speedBoostLeft, shieldLeft: p.shieldLeft
    })),
    bullets: state.bullets,
    items: state.items,
    teams: Array.from(state.teams.values())
  };
  const data = JSON.stringify(snap);
  for (const p of state.players.values()) {
    if (p.ws.readyState === WebSocket.OPEN) p.ws.send(data);
  }
}, 1000/TICK_RATE);

fastify.listen({ port: 8080, host: '0.0.0.0' }).then(() => {
  console.log('co-up server on :8080');
});
