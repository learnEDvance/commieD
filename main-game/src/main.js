import { BotDirector } from './bots.js';
import { EMPTY_INPUT, Game, PLAYER_RADIUS } from './game.js';
import { TILE, isWall, spawnTeamAt } from './maze.js';

const TILE_PX = 30;
const MINIMAP_SIZE = 180;
const LOCAL_TEAM = 0;
const PLAYERS_PER_TEAM = 4;
const LOCAL_AMMO = 900;
const ITEMS_PER_TEAM = 8;
const MINIMAP_MODES = ['NEARBY', 'FULL', 'COMRATS'];

const ITEM_META = Object.freeze({
  bomb: { label: 'B', name: 'BOMB', color: '#e23b3b' },
  hp: { label: '+', name: '+HP', color: '#7fc96a' },
  speed: { label: '»', name: '+SPEED', color: '#f2c94c' },
  gunPlus: { label: 'G', name: 'GUN+', color: '#e08a3c' },
  phaseless: { label: 'Φ', name: 'PHASELESS', color: '#5bc0be' },
  coat: { label: 'C', name: 'COAT', color: '#8fb8e0' },
});

const EFFECT_NAMES = Object.freeze({
  gunPlus: 'GUN+',
  phaseless: 'PHASELESS',
  coat: '+COAT',
});

const TASK_NAMES = Object.freeze({
  clicker: 'CLICKER',
  ammo: 'AMMO',
  dash: 'DASH',
});

const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');
const minimap = document.getElementById('minimap');
const minimapCtx = minimap.getContext('2d');

const ui = {
  minimapMode: document.getElementById('minimap-mode'),
  comratsCount: document.getElementById('comrats-count'),
  comrats: document.getElementById('comrats'),
  teamName: document.getElementById('team-name'),
  ammo: document.getElementById('ammo'),
  dash: document.getElementById('dash'),
  special: document.getElementById('special'),
  specialQueue: document.getElementById('special-queue'),
  healthTeam: document.getElementById('health-team'),
  hpLabel: document.getElementById('hp-label'),
  hpFill: document.getElementById('hp-fill'),
  effectLabel: document.getElementById('effect-label'),
  statusLabel: document.getElementById('status-label'),
  toasts: document.getElementById('toasts'),
  banner: document.getElementById('banner'),
  bannerTitle: document.getElementById('banner-title'),
  bannerText: document.getElementById('banner-text'),
  stats: {
    fps: document.querySelector('[data-stat="fps"]'),
    frame: document.querySelector('[data-stat="frame"]'),
    conn: document.querySelector('[data-stat="conn"]'),
    alive: document.querySelector('[data-stat="alive"]'),
  },
};

const keys = new Set();
const mouse = { x: 0, y: 0, down: false };

let game;
let me;
let bots;
let mazeBitmap;
let minimapModeIndex = 0;
let camera = { x: 0, y: 0 };
let viewWidth = window.innerWidth;
let viewHeight = window.innerHeight;
let specialRequested = false;
let ghostTaskKey = null;
let effects = [];
let routeTargetId = null;
let routePath = [];
let lastFrame = 0;
let fpsFrames = 0;
let fpsTime = 0;
let fps = 0;
let frameMs = 0;
let hudNext = 0;
let comratsNext = 0;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  viewWidth = window.innerWidth;
  viewHeight = window.innerHeight;
  canvas.width = Math.round(viewWidth * dpr);
  canvas.height = Math.round(viewHeight * dpr);
  canvas.style.width = `${viewWidth}px`;
  canvas.style.height = `${viewHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function startMatch(seed) {
  game = new Game({
    seed,
    teams: 2,
    playersPerTeam: PLAYERS_PER_TEAM,
    width: 61,
    height: 61,
    itemsPerTeam: ITEMS_PER_TEAM,
  });

  me = game.join({ teamId: LOCAL_TEAM, name: 'YOU' });
  for (let index = 1; index < PLAYERS_PER_TEAM; index += 1) {
    game.join({ teamId: LOCAL_TEAM, isBot: true });
  }
  for (let index = 0; index < PLAYERS_PER_TEAM; index += 1) {
    game.join({ teamId: 1, isBot: true });
  }

  // The local demo keeps a larger reserve than a real match would receive
  // from the ghost minigames.
  for (const team of game.teams) {
    team.ammo = LOCAL_AMMO;
  }

  bots = new BotDirector(game, { seed: (seed ^ 0x5f3759df) >>> 0 });
  buildMazeBitmap();
  camera = { x: me.x, y: me.y };
  effects = [];
  mouse.down = false;
  specialRequested = false;
  ghostTaskKey = null;
  routeTargetId = me.id;
  routePath = [];
  ui.banner.hidden = true;
  ui.banner.className = 'banner';
  comratsNext = 0;
  hudNext = 0;
}

function buildMazeBitmap() {
  const { width, height, tiles, spawnZones } = game.maze;
  mazeBitmap = document.createElement('canvas');
  mazeBitmap.width = width;
  mazeBitmap.height = height;
  const bitmapCtx = mazeBitmap.getContext('2d');
  const image = bitmapCtx.createImageData(width, height);
  const data = image.data;
  const teamColors = game.teams.map((team) => hexToRgb(team.color));

  for (let index = 0; index < tiles.length; index += 1) {
    const offset = index * 4;
    const owner = spawnZones[index];

    if (tiles[index] === TILE.WALL) {
      data[offset] = 56;
      data[offset + 1] = 49;
      data[offset + 2] = 39;
    } else if (owner >= 0) {
      const color = teamColors[owner];
      data[offset] = Math.round(12 + color[0] * 0.32);
      data[offset + 1] = Math.round(10 + color[1] * 0.32);
      data[offset + 2] = Math.round(8 + color[2] * 0.32);
    } else {
      data[offset] = 14;
      data[offset + 1] = 12;
      data[offset + 2] = 10;
    }
    data[offset + 3] = 255;
  }

  bitmapCtx.putImageData(image, 0, 0);
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function worldToScreen(x, y) {
  return [
    (x - camera.x) * TILE_PX + viewWidth / 2,
    (y - camera.y) * TILE_PX + viewHeight / 2,
  ];
}

function screenToWorld(x, y) {
  return {
    x: camera.x + (x - viewWidth / 2) / TILE_PX,
    y: camera.y + (y - viewHeight / 2) / TILE_PX,
  };
}

function playerInput() {
  const aim = screenToWorld(mouse.x, mouse.y);

  return {
    ...EMPTY_INPUT,
    up: keys.has('KeyW') || keys.has('ArrowUp'),
    down: keys.has('KeyS') || keys.has('ArrowDown'),
    left: keys.has('KeyA') || keys.has('ArrowLeft'),
    right: keys.has('KeyD') || keys.has('ArrowRight'),
    aimX: aim.x,
    aimY: aim.y,
    shoot: mouse.down,
    dash: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    useSpecial: specialRequested,
    ghostTask: ghostTaskKey,
  };
}

function frame(now) {
  requestAnimationFrame(frame);

  const delta = lastFrame === 0 ? 16 : Math.min(100, now - lastFrame);
  lastFrame = now;

  fpsFrames += 1;
  fpsTime += delta;
  if (fpsTime >= 500) {
    fps = (fpsFrames * 1000) / fpsTime;
    frameMs = fpsTime / fpsFrames;
    fpsFrames = 0;
    fpsTime = 0;
  }

  if (!document.hidden && game) {
    const inputs = bots.inputs();
    if (me) {
      inputs.set(me.id, playerInput());
    }

    const result = game.step(delta, inputs);
    handleEvents(result.events);
    specialRequested = false;
  }

  if (me) {
    const follow = me.isGhost ? 0.12 : 0.2;
    camera.x += (me.x - camera.x) * follow;
    camera.y += (me.y - camera.y) * follow;
  }

  render(now);
  updateHud(now, delta);
}

function handleEvents(events) {
  for (const event of events) {
    switch (event.type) {
      case 'bomb':
        effects.push({
          type: 'blast',
          x: event.x,
          y: event.y,
          radius: event.radius,
          life: 620,
          total: 620,
        });
        toast('BOMB — COMMUNAL DEMOLITION', 'bad');
        break;
      case 'shot':
        effects.push({
          type: 'flash',
          x: event.x ?? null,
          y: event.y ?? null,
          playerId: event.playerId,
          life: 90,
          total: 90,
        });
        break;
      case 'item-collected': {
        const meta = ITEM_META[event.itemType];
        if (event.duplicate) {
          toast(`${meta.name} — ALREADY HELD`);
        } else if (event.immediate) {
          toast(`${meta.name} ADDED TO TEAM RESERVES`, 'good');
        } else {
          toast(`${meta.name} — PRESS SPACE TO SHARE`, 'good');
        }
        break;
      }
      case 'special-used': {
        const meta = ITEM_META[event.type];
        toast(`${meta.name} TRIGGERED FOR THE TEAM`, 'good');
        break;
      }
      case 'team-downed': {
        const team = game.teams[event.teamId];
        if (event.teamId === me.teamId) {
          toast('TEAM DOWN — HALF WILL RETURN', 'bad');
        } else {
          toast(`${team.name.toUpperCase()} DOWN`, 'good');
        }
        break;
      }
      case 'team-revived': {
        const team = game.teams[event.teamId];
        if (event.teamId === me.teamId) {
          toast(`REVIVED ${event.living} COMRADES — ${event.hp} HP`, 'good');
        } else {
          toast(`${team.name.toUpperCase()} REVIVED ${event.living}`, 'bad');
        }
        break;
      }
      case 'team-eliminated': {
        const team = game.teams[event.teamId];
        if (event.teamId === me.teamId) {
          showBanner('ELIMINATED', 'Press R for a new match');
        } else {
          toast(`${team.name.toUpperCase()} ELIMINATED`, 'good');
        }
        break;
      }
      case 'effect-ended':
        if (event.teamId === me.teamId) {
          toast(`${EFFECT_NAMES[event.effect] ?? event.effect} EXPIRED`);
        }
        break;
      case 'damage-blocked':
        if (event.teamId === me.teamId) {
          toast('+COAT ABSORBED THE HIT', 'good');
        }
        break;
      case 'ghost-task':
        if (event.playerId === me.id) {
          toast(`GHOST TASK — ${TASK_NAMES[event.task] ?? event.task}`, 'good');
        }
        break;
      case 'match-over': {
        const won = event.winnerTeamId === me.teamId;
        showBanner(
          won ? 'VICTORY' : 'DEFEAT',
          won ? 'LAST TEAM STANDING' : `${game.teams[event.winnerTeamId].name.toUpperCase()} HOLDS THE MAZE`,
          won ? 'good' : 'bad',
        );
        break;
      }
      default:
        break;
    }
  }
}

function showBanner(title, text, tone = 'bad') {
  ui.bannerTitle.textContent = title;
  ui.bannerText.textContent = text;
  ui.banner.className = `banner${tone === 'good' ? ' is-good' : ''}`;
  ui.banner.hidden = false;
}

function toast(message, tone = '') {
  const element = document.createElement('div');
  element.className = `toast${tone ? ` is-${tone}` : ''}`;
  element.textContent = message;
  ui.toasts.append(element);

  while (ui.toasts.children.length > 4) {
    ui.toasts.firstElementChild.remove();
  }

  window.setTimeout(() => element.remove(), 2600);
}

/* ---------- Render ---------- */

function render(now) {
  ctx.clearRect(0, 0, viewWidth, viewHeight);
  ctx.fillStyle = '#070605';
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  drawTiles();
  drawSpawnZones();
  drawRoute();
  drawItems(now);
  drawBombs(now);
  drawBullets();
  drawPlayers(now);
  drawEffects();
  drawCrosshair();

  if (game.teams[me.teamId].eliminated) {
    ctx.fillStyle = 'rgba(6, 4, 4, 0.45)';
    ctx.fillRect(0, 0, viewWidth, viewHeight);
  }
}

function drawTiles() {
  const halfWidth = viewWidth / (2 * TILE_PX) + 1;
  const halfHeight = viewHeight / (2 * TILE_PX) + 1;
  const minX = Math.max(0, Math.floor(camera.x - halfWidth));
  const maxX = Math.min(game.maze.width - 1, Math.ceil(camera.x + halfWidth));
  const minY = Math.max(0, Math.floor(camera.y - halfHeight));
  const maxY = Math.min(game.maze.height - 1, Math.ceil(camera.y + halfHeight));

  const wallShades = ['#3b2a22', '#35241d', '#433026'];

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const [screenX, screenY] = worldToScreen(x, y);
      const wall = game.maze.tiles[y * game.maze.width + x] === TILE.WALL;

      if (wall) {
        const shade = wallShades[(x * 31 + y * 17) % wallShades.length];
        ctx.fillStyle = shade;
        ctx.fillRect(screenX, screenY, TILE_PX + 0.5, TILE_PX + 0.5);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.fillRect(screenX, screenY + TILE_PX - 5, TILE_PX + 0.5, 5);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(screenX, screenY, TILE_PX + 0.5, 2);
      } else {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#0d0a08' : '#0b0806';
        ctx.fillRect(screenX, screenY, TILE_PX + 0.5, TILE_PX + 0.5);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.018)';
        ctx.fillRect(screenX + TILE_PX - 1, screenY, 1, TILE_PX);
        ctx.fillRect(screenX, screenY + TILE_PX - 1, TILE_PX, 1);
      }

      const owner = spawnTeamAt(game.maze, x, y);
      if (owner >= 0 && !wall) {
        ctx.fillStyle = withAlpha(game.teams[owner].color, 0.07);
        ctx.fillRect(screenX, screenY, TILE_PX + 0.5, TILE_PX + 0.5);
      }
    }
  }
}

function drawSpawnZones() {
  for (const spawn of game.maze.spawns) {
    const team = game.teams[spawn.teamId];
    const [x, y] = worldToScreen(spawn.x, spawn.y);
    ctx.strokeStyle = withAlpha(team.color, 0.45);
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(x, y, spawn.width * TILE_PX, spawn.height * TILE_PX);
    ctx.setLineDash([]);

    ctx.fillStyle = withAlpha(team.color, 0.6);
    ctx.font = '700 9px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${team.name.toUpperCase()} SPAWN`, x + 3, y - 4);
  }
}

function drawRoute() {
  if (
    MINIMAP_MODES[minimapModeIndex] !== 'COMRATS' ||
    routeTargetId === null ||
    routeTargetId === me.id ||
    routePath.length < 2
  ) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(242, 201, 76, 0.72)';
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 7]);
  ctx.beginPath();

  routePath.forEach((point, index) => {
    const [x, y] = worldToScreen(point.x, point.y);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();
  ctx.setLineDash([]);

  const target = game.playersById.get(routeTargetId);
  if (target) {
    const [x, y] = worldToScreen(target.x, target.y);
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(242, 201, 76, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.restore();
}

function drawItems(now) {
  const pulse = 1 + Math.sin(now / 240) * 0.08;

  for (const item of game.maze.items) {
    if (item.taken) {
      continue;
    }

    const [x, y] = worldToScreen(item.x + 0.5, item.y + 0.5);
    if (x < -40 || y < -40 || x > viewWidth + 40 || y > viewHeight + 40) {
      continue;
    }

    const meta = ITEM_META[item.type];
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(8, 6, 5, 0.85)';
    ctx.strokeStyle = meta.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-9, -9, 18, 18, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = meta.color;
    ctx.font = '700 10px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(meta.label, 0, 0.5);
    ctx.restore();
  }
}

function drawBombs(now) {
  for (const bomb of game.bombs) {
    const [x, y] = worldToScreen(bomb.x, bomb.y);
    const flicker = 0.6 + Math.sin(now / 60) * 0.4;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#2a0f0f';
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 90, 80, ${flicker})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 4, y - 7, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#f2c94c';
    ctx.fill();
  }
}

function drawBullets() {
  ctx.lineCap = 'round';

  for (const bullet of game.bullets) {
    const [x, y] = worldToScreen(bullet.x, bullet.y);
    const length = Math.hypot(bullet.vx, bullet.vy) || 1;
    const trailX = (bullet.vx / length) * 10;
    const trailY = (bullet.vy / length) * 10;

    ctx.strokeStyle = '#f8e7ab';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - trailX, y - trailY);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(242, 201, 76, 0.25)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - trailX, y - trailY);
    ctx.stroke();
  }

  ctx.lineCap = 'butt';
}

function drawPlayers(now) {
  for (const player of game.players) {
    const team = game.teams[player.teamId];
    const [x, y] = worldToScreen(player.x, player.y);
    const radius = PLAYER_RADIUS * TILE_PX;
    const isMe = player.id === me.id;

    ctx.save();
    ctx.globalAlpha = player.alive ? 1 : 0.4;

    if (!player.alive) {
      ctx.strokeStyle = withAlpha(team.color, 0.8);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(x, y, radius + 4 + Math.sin(now / 300 + player.id) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Gun barrel
    const gunLength = radius * 1.7;
    const gunX = Math.cos(player.angle);
    const gunY = Math.sin(player.angle);
    const perpX = -gunY;
    const perpY = gunX;
    ctx.beginPath();
    ctx.moveTo(x + gunX * gunLength, y + gunY * gunLength);
    ctx.lineTo(x + perpX * 3, y + perpY * 3);
    ctx.lineTo(x - perpX * 3, y - perpY * 3);
    ctx.closePath();
    ctx.fillStyle = player.alive ? '#e9dfc5' : withAlpha('#e9dfc5', 0.5);
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = team.color;
    ctx.fill();
    ctx.lineWidth = isMe ? 2.5 : 1.5;
    ctx.strokeStyle = isMe ? '#ffffff' : '#100d09';
    ctx.stroke();

    if (isMe) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(242, 201, 76, 0.7)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (player.teamId === me.teamId) {
      ctx.globalAlpha = player.alive ? 0.85 : 0.5;
      ctx.fillStyle = '#d7cfb9';
      ctx.font = '700 7.5px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(isMe ? 'YOU' : player.name.toUpperCase(), x, y - radius - 5);
    }

    ctx.restore();
  }
}

function drawEffects() {
  for (const effect of effects) {
    const progress = 1 - effect.life / effect.total;

    if (effect.type === 'blast') {
      const [x, y] = worldToScreen(effect.x, effect.y);
      const radius = effect.radius * TILE_PX * progress;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(242, 120, 60, ${0.28 * (1 - progress)})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 210, 140, ${0.8 * (1 - progress)})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (effect.type === 'flash') {
      const player = game.playersById.get(effect.playerId);
      if (!player) {
        continue;
      }
      const [x, y] = worldToScreen(player.x, player.y);
      const muzzleX = x + Math.cos(player.angle) * PLAYER_RADIUS * TILE_PX * 1.9;
      const muzzleY = y + Math.sin(player.angle) * PLAYER_RADIUS * TILE_PX * 1.9;
      ctx.beginPath();
      ctx.arc(muzzleX, muzzleY, 5 * (1 - progress) + 1, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 236, 160, ${1 - progress})`;
      ctx.fill();
    }
  }
}

function drawCrosshair() {
  ctx.strokeStyle = 'rgba(242, 201, 76, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(mouse.x, mouse.y, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(mouse.x - 11, mouse.y);
  ctx.lineTo(mouse.x - 3, mouse.y);
  ctx.moveTo(mouse.x + 3, mouse.y);
  ctx.lineTo(mouse.x + 11, mouse.y);
  ctx.moveTo(mouse.x, mouse.y - 11);
  ctx.lineTo(mouse.x, mouse.y - 3);
  ctx.moveTo(mouse.x, mouse.y + 3);
  ctx.lineTo(mouse.x, mouse.y + 11);
  ctx.stroke();
}

/* ---------- HUD ---------- */

function updateHud(now, delta) {
  updateEffects(delta);

  if (now >= hudNext) {
    hudNext = now + 120;
    updateStats();
    updateReserves();
    updateHealth();
    updateMinimap();
  }

  if (now >= comratsNext) {
    comratsNext = now + 260;
    updateComrats();
  }
}

function updateEffects(delta) {
  effects = effects.filter((effect) => {
    effect.life -= delta;
    return effect.life > 0;
  });
}

function updateStats() {
  ui.stats.fps.textContent = `FPS ${Math.round(fps)}`;
  ui.stats.fps.className = `stat ${fps >= 50 ? '' : fps >= 30 ? 'is-ok' : 'is-bad'}`;

  ui.stats.frame.textContent = `${frameMs.toFixed(1)} ms`;
  ui.stats.frame.className = `stat ${frameMs <= 20 ? '' : frameMs <= 33 ? 'is-ok' : 'is-bad'}`;

  ui.stats.conn.textContent = 'LOCAL';
  ui.stats.conn.className = 'stat is-dim';

  const aliveA = game.teams[0].eliminated ? 0 : countAlive(0);
  const aliveB = game.teams[1].eliminated ? 0 : countAlive(1);
  ui.stats.alive.textContent = `${aliveA} / ${aliveB}`;
  ui.stats.alive.className = 'stat is-dim';
}

function countAlive(teamId) {
  return game.players.filter((player) => player.teamId === teamId && player.alive).length;
}

function updateReserves() {
  const team = game.teams[me.teamId];
  ui.teamName.textContent = team.name.toUpperCase();
  ui.ammo.textContent = String(team.ammo);
  ui.dash.textContent = `${Math.floor(team.dashSeconds)}s`;
  ui.special.textContent = team.specials.length
    ? ITEM_META[team.specials[team.specials.length - 1]].name
    : '—';

  const queue = team.specials.map((type, index) => {
    const span = document.createElement('span');
    const current = index === team.specials.length - 1;
    span.textContent = ITEM_META[type].name;
    if (current) {
      span.className = 'is-current';
    }
    return span;
  });
  ui.specialQueue.replaceChildren(...queue);
}

function updateHealth() {
  const team = game.teams[me.teamId];
  const maxHp = Math.max(1, team.maxHp);
  const ratio = Math.max(0, Math.min(1, team.hp / maxHp));

  ui.healthTeam.textContent = team.name.toUpperCase();
  ui.hpLabel.textContent = `${Math.round(team.hp)} / ${Math.round(team.maxHp)}`;
  ui.hpFill.style.width = `${ratio * 100}%`;
  ui.hpFill.className = `health__fill${
    ratio <= 0.34 ? ' is-low' : ratio <= 0.67 ? ' is-mid' : ''
  }`;

  if (team.activeEffect) {
    const seconds = Math.max(0, team.activeEffect.msLeft / 1000);
    ui.effectLabel.textContent = `${EFFECT_NAMES[team.activeEffect.type] ?? team.activeEffect.type} ${seconds.toFixed(0)}s`;
  } else {
    ui.effectLabel.textContent = 'NO EFFECT';
  }

  if (game.winnerTeamId !== null) {
    const won = game.winnerTeamId === me.teamId;
    ui.statusLabel.textContent = won ? 'VICTORY' : 'DEFEAT';
    showBanner(
      won ? 'VICTORY' : 'DEFEAT',
      won ? 'LAST TEAM STANDING' : `${game.teams[game.winnerTeamId].name.toUpperCase()} HOLDS THE MAZE`,
      won ? 'good' : 'bad',
    );
  } else if (team.eliminated) {
    ui.statusLabel.textContent = 'ELIMINATED';
    showBanner('ELIMINATED', 'Press R for a new match');
  } else if (!me.alive) {
    ui.statusLabel.textContent = `GHOST · ${TASK_NAMES[me.ghostTask] ?? 'CLICKER'}`;
    ui.banner.hidden = true;
  } else {
    ui.statusLabel.textContent = 'LIVE';
    ui.banner.hidden = true;
  }
}

function updateComrats() {
  const teamPlayers = game.players
    .filter((player) => player.teamId === me.teamId)
    .sort((a, b) => Number(b.alive) - Number(a.alive) || a.id - b.id);

  const rows = teamPlayers.map((player) => {
    const item = document.createElement('li');
    if (player.id === me.id) {
      item.className = 'is-me';
    } else if (!player.alive) {
      item.className = 'is-dead';
    }

    const name = document.createElement('span');
    name.textContent = player.id === me.id ? 'YOU' : player.name.toUpperCase();

    const state = document.createElement('span');
    state.className = `comrat__state ${
      !player.alive ? 'is-ghost' : 'is-live'
    }`;
    state.textContent = player.alive ? 'LIVE' : 'GHOST';

    item.append(name, state);
    return item;
  });

  if (game.teams[me.teamId].eliminated) {
    const item = document.createElement('li');
    item.className = 'is-dead';
    const name = document.createElement('span');
    name.textContent = 'TEAM ELIMINATED';
    item.append(name);
    rows.unshift(item);
  }

  ui.comrats.replaceChildren(...rows);
  ui.comratsCount.textContent = `${countAlive(me.teamId)} LIVE`;
}

function updateMinimap() {
  ui.minimapMode.textContent = MINIMAP_MODES[minimapModeIndex];
  const size = MINIMAP_SIZE;
  minimapCtx.clearRect(0, 0, size, size);

  if (!mazeBitmap) {
    return;
  }

  const mode = MINIMAP_MODES[minimapModeIndex];

  if (mode === 'COMRATS') {
    refreshRoute();
    drawTeamMap();
    return;
  }

  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = game.maze.width;
  let sourceHeight = game.maze.height;

  if (mode === 'NEARBY') {
    const span = 25;
    sourceWidth = span;
    sourceHeight = span;
    sourceX = clamp(me.x - span / 2, 0, game.maze.width - span);
    sourceY = clamp(me.y - span / 2, 0, game.maze.height - span);
  }

  minimapCtx.imageSmoothingEnabled = false;
  minimapCtx.drawImage(
    mazeBitmap,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    size,
    size,
  );

  const project = (x, y) => [
    ((x - sourceX) / sourceWidth) * size,
    ((y - sourceY) / sourceHeight) * size,
  ];

  for (const item of game.maze.items) {
    if (item.taken) {
      continue;
    }
    const [x, y] = project(item.x + 0.5, item.y + 0.5);
    minimapCtx.fillStyle = '#f2c94c';
    minimapCtx.fillRect(x - 1, y - 1, 2, 2);
  }

  for (const player of game.players) {
    const [x, y] = project(player.x, player.y);
    const team = game.teams[player.teamId];
    minimapCtx.globalAlpha = player.alive ? 1 : 0.45;
    minimapCtx.beginPath();
    minimapCtx.arc(x, y, player.id === me.id ? 2.6 : 2, 0, Math.PI * 2);
    minimapCtx.fillStyle = team.color;
    minimapCtx.fill();
    if (player.id === me.id) {
      minimapCtx.strokeStyle = '#ffffff';
      minimapCtx.lineWidth = 1;
      minimapCtx.stroke();
    }
  }
  minimapCtx.globalAlpha = 1;

  if (mode === 'FULL') {
    const viewTilesX = viewWidth / TILE_PX;
    const viewTilesY = viewHeight / TILE_PX;
    const [x, y] = project(camera.x - viewTilesX / 2, camera.y - viewTilesY / 2);
    minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    minimapCtx.lineWidth = 1;
    minimapCtx.strokeRect(
      x,
      y,
      (viewTilesX / sourceWidth) * size,
      (viewTilesY / sourceHeight) * size,
    );
  }
}

function sortedTeamPlayers() {
  return game.players
    .filter((player) => player.teamId === me.teamId)
    .sort((a, b) => Number(b.alive) - Number(a.alive) || a.id - b.id);
}

function selectComrat(delta) {
  const teamPlayers = sortedTeamPlayers();
  if (teamPlayers.length === 0) {
    return;
  }

  let index = teamPlayers.findIndex((player) => player.id === routeTargetId);
  if (index === -1) {
    index = 0;
  }
  index = (index + delta + teamPlayers.length) % teamPlayers.length;
  routeTargetId = teamPlayers[index].id;
  refreshRoute();

  const target = game.playersById.get(routeTargetId);
  toast(
    routeTargetId === me.id
      ? 'ROUTE — YOU'
      : `ROUTE → ${target.name.toUpperCase()}${target.alive ? '' : ' (GHOST)'}`,
    'good',
  );
}

function refreshRoute() {
  const target = game.playersById.get(routeTargetId);
  routePath = target ? findRoute(me, target) : [];
}

function findRoute(from, to) {
  if (!from || !to || from.id === to.id) {
    return [];
  }

  // Ghosts pass through walls, so a straight line is the honest route.
  if (from.isGhost) {
    return [
      { x: from.x, y: from.y },
      { x: to.x, y: to.y },
    ];
  }

  const { width, height } = game.maze;
  const startX = clamp(Math.floor(from.x), 0, width - 1);
  const startY = clamp(Math.floor(from.y), 0, height - 1);
  let goalX = clamp(Math.floor(to.x), 0, width - 1);
  let goalY = clamp(Math.floor(to.y), 0, height - 1);

  if (isWall(game.maze, goalX, goalY)) {
    const near = nearestFreeTile(goalX, goalY, 3);
    if (!near) {
      return [];
    }
    goalX = near.x;
    goalY = near.y;
  }

  const keyOf = (x, y) => y * width + x;
  const startKey = keyOf(startX, startY);
  const goalKey = keyOf(goalX, goalY);
  const cameFrom = new Map([[startKey, null]]);
  const queue = [[startX, startY]];
  let head = 0;
  let found = startKey === goalKey;

  while (head < queue.length && !found) {
    const [x, y] = queue[head];
    head += 1;

    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nextX = x + dx;
      const nextY = y + dy;
      const key = keyOf(nextX, nextY);

      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
        continue;
      }
      if (cameFrom.has(key)) {
        continue;
      }
      if (isWall(game.maze, nextX, nextY)) {
        continue;
      }

      const owner = spawnTeamAt(game.maze, nextX, nextY);
      if (owner !== -1 && owner !== from.teamId) {
        continue;
      }

      cameFrom.set(key, keyOf(x, y));

      if (key === goalKey) {
        found = true;
        break;
      }

      queue.push([nextX, nextY]);
    }
  }

  if (!found) {
    return [];
  }

  const path = [];
  let cursor = goalKey;

  while (cursor !== null) {
    const x = cursor % width;
    const y = Math.floor(cursor / width);
    path.push({ x: x + 0.5, y: y + 0.5 });
    cursor = cameFrom.get(cursor);
  }

  path.reverse();
  path[0] = { x: from.x, y: from.y };
  path[path.length - 1] = { x: to.x, y: to.y };
  return path;
}

function nearestFreeTile(x, y, radius) {
  for (let ring = 0; ring <= radius; ring += 1) {
    for (let dy = -ring; dy <= ring; dy += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) {
          continue;
        }
        const nextX = x + dx;
        const nextY = y + dy;
        if (!isWall(game.maze, nextX, nextY)) {
          return { x: nextX, y: nextY };
        }
      }
    }
  }
  return null;
}

function drawTeamMap() {
  const size = MINIMAP_SIZE;
  minimapCtx.fillStyle = '#0b0906';
  minimapCtx.fillRect(0, 0, size, size);

  const rows = sortedTeamPlayers();

  minimapCtx.font = '8px "Trebuchet MS", sans-serif';
  minimapCtx.textAlign = 'left';
  minimapCtx.textBaseline = 'middle';

  rows.forEach((player, index) => {
    const y = 36 + index * 17;
    const selected = player.id === routeTargetId;

    if (selected) {
      minimapCtx.fillStyle = 'rgba(242, 201, 76, 0.13)';
      minimapCtx.fillRect(5, y - 8, size - 10, 16);
      minimapCtx.fillStyle = '#f2c94c';
      minimapCtx.fillText('>', 7, y);
    }

    minimapCtx.fillStyle = player.alive ? '#d7cfb9' : '#5f5a4c';
    const label = player.id === me.id ? 'YOU' : player.name.toUpperCase();
    minimapCtx.fillText(label, selected ? 15 : 10, y);

    minimapCtx.fillStyle = player.alive ? '#7fc96a' : '#5bc0be';
    minimapCtx.textAlign = 'right';
    minimapCtx.fillText(
      player.alive ? 'LIVE' : `GHOST · ${TASK_NAMES[player.ghostTask] ?? 'CLICKER'}`,
      size - 10,
      y,
    );
    minimapCtx.textAlign = 'left';
  });

  minimapCtx.strokeStyle = 'rgba(242, 201, 76, 0.2)';
  minimapCtx.beginPath();
  minimapCtx.moveTo(8, 27);
  minimapCtx.lineTo(size - 8, 27);
  minimapCtx.stroke();

  minimapCtx.fillStyle = '#706b5b';
  minimapCtx.font = '7px "Trebuchet MS", sans-serif';
  minimapCtx.fillText('↑ ↓ SELECT ROUTE', 10, size - 10);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function withAlpha(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ---------- Input ---------- */

window.addEventListener('resize', resize);

window.addEventListener('keydown', (event) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
    event.preventDefault();
  }

  if (
    minimapModeIndex === 2 &&
    (event.code === 'ArrowUp' || event.code === 'ArrowDown')
  ) {
    selectComrat(event.code === 'ArrowDown' ? 1 : -1);
    return;
  }

  keys.add(event.code);

  if (event.code === 'Space') {
    specialRequested = true;
  } else if (event.code === 'KeyX') {
    minimapModeIndex = (minimapModeIndex + 1) % MINIMAP_MODES.length;
    if (minimapModeIndex === 2) {
      if (!game.playersById.has(routeTargetId)) {
        routeTargetId = me.id;
      }
      refreshRoute();
      toast('COMRATS — ↑ ↓ SELECT ROUTE', 'good');
    }
  } else if (event.code === 'KeyR') {
    startMatch(Math.floor(Math.random() * 1_000_000_000));
  } else if (event.code === 'Digit1') {
    ghostTaskKey = 'clicker';
  } else if (event.code === 'Digit2') {
    ghostTaskKey = 'ammo';
  } else if (event.code === 'Digit3') {
    ghostTaskKey = 'dash';
  }
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
});

window.addEventListener('blur', () => {
  keys.clear();
  mouse.down = false;
});

canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = event.clientX - rect.left;
  mouse.y = event.clientY - rect.top;
});

canvas.addEventListener('mousedown', (event) => {
  if (event.button === 0) {
    mouse.down = true;
  }
});

window.addEventListener('mouseup', () => {
  mouse.down = false;
});

canvas.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('contextmenu', (event) => {
  if (event.target === canvas) {
    event.preventDefault();
  }
});

/* ---------- Boot ---------- */

resize();
startMatch(20261110);
requestAnimationFrame(frame);
