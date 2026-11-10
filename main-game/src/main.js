import { BotDirector } from './bots.js';
import {
  EMPTY_INPUT,
  ENEMY_COLOR,
  Game,
  PLAYER_COLORS,
  PLAYER_RADIUS,
  TEAM_HP_PER_PLAYER,
} from './game.js';
import { GhostConsole } from './ghost-console.js';
import { NetClient, defaultWebSocketUrl } from './net.js';
import { TILE, isWall, spawnTeamAt } from './maze.js';
import { DashSupplementFactory } from '../../dash-supplement-factory/src/dashSupplementFactoryCore.js';

const params = new URLSearchParams(window.location.search);
const NETWORK = params.get('local') !== '1';
const TILE_PX = 30;
const MINIMAP_SIZE = 180;
const LOCAL_TEAM = 0;
const PLAYERS_PER_TEAM = 4;
const LOCAL_AMMO = 900;
const ITEMS_PER_TEAM = 8;
const MINIMAP_MODES = ['FULL', 'COMRATS'];
const INPUT_INTERVAL_MS = 50;
const DELTA_VISIBLE_MS = 1400;

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
  lobby: document.getElementById('lobby'),
  lobbyName: document.getElementById('lobby-name'),
  lobbyTeams: document.getElementById('lobby-teams'),
  lobbyColors: document.getElementById('lobby-colors'),
  lobbyJoin: document.getElementById('lobby-join'),
  lobbyStatus: document.getElementById('lobby-status'),
  ghostOpen: document.getElementById('ghost-open'),
  ghostConsole: document.getElementById('ghost-console'),
  ammoDelta: document.getElementById('ammo-delta'),
  dashDelta: document.getElementById('dash-delta'),
  effectNotch: document.getElementById('effect-notch'),
};

const keys = new Set();
const mouse = { x: 0, y: 0, down: false };

let game;
let me;
let bots;
let localFactory;
let net;
let myClientId = null;
let myPlayerId = null;
let networkTeams = [];
let networkStatus = NETWORK ? 'CONNECTING' : 'LOCAL';
let networkJoined = false;
let lobbyTeamId = 0;
let lobbyColor = PLAYER_COLORS[0];
let cameraReady = false;
let inputNext = 0;
let ghostConsole;
let ghostConsoleVisible = true;
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
let reserveBaseline = { teamId: null, ammo: 0, dashSeconds: 0 };
let reserveDelta = { ammo: 0, dashSeconds: 0, until: 0 };

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

function startLocalMatch(seed) {
  game = new Game({
    seed,
    teams: 2,
    playersPerTeam: PLAYERS_PER_TEAM,
    width: 61,
    height: 61,
    itemsPerTeam: ITEMS_PER_TEAM,
  });

  me = game.join({ teamId: LOCAL_TEAM, name: 'YOU', color: PLAYER_COLORS[0] });
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
  localFactory = new DashSupplementFactory();
  buildMazeBitmap();
  camera = { x: me.x, y: me.y };
  cameraReady = true;
  effects = [];
  mouse.down = false;
  specialRequested = false;
  ghostTaskKey = null;
  ghostConsoleVisible = true;
  routeTargetId = null;
  routePath = [];
  reserveBaseline = { teamId: null, ammo: 0, dashSeconds: 0 };
  reserveDelta = { ammo: 0, dashSeconds: 0, until: 0 };
  ui.banner.hidden = true;
  ui.banner.className = 'banner';
  ui.lobby.hidden = true;
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
  const aim = NETWORK && me ? networkAim() : screenToWorld(mouse.x, mouse.y);

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

function networkAim() {
  if (!me) {
    return { x: 0, y: 0 };
  }
  return {
    x: camera.x + (mouse.x - viewWidth / 2) / TILE_PX,
    y: camera.y + (mouse.y - viewHeight / 2) / TILE_PX,
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

  if (!document.hidden) {
    if (NETWORK) {
      if (networkJoined && me) {
        interpolateNetwork();
        sendNetworkInput(now);
      }
    } else if (game) {
      const inputs = bots.inputs();
      if (me) {
        inputs.set(me.id, playerInput());
      }

      const result = game.step(delta, inputs);
      handleEvents(result.events);
      specialRequested = false;
      advanceLocalFactory(delta);
      updateLocalGhostConsole();
    }
  }

  if (me) {
    const follow = me.isGhost ? 0.12 : 0.2;
    camera.x += (me.x - camera.x) * follow;
    camera.y += (me.y - camera.y) * follow;
  }

  render(now);
  updateHud(now, delta);
}

function sendNetworkInput(now) {
  if (now < inputNext || !net) {
    return;
  }
  inputNext = now + INPUT_INTERVAL_MS;

  const input = playerInput();
  net.send({ type: 'input', ...input });
  specialRequested = false;
}

function interpolateNetwork() {
  const factor = 0.35;

  for (const player of game.players) {
    player.x += (player.targetX - player.x) * factor;
    player.y += (player.targetY - player.y) * factor;
    const diff = Math.atan2(
      Math.sin(player.targetAngle - player.angle),
      Math.cos(player.targetAngle - player.angle),
    );
    player.angle += diff * factor;
  }

  for (const bullet of game.bullets) {
    bullet.x += (bullet.targetX - bullet.x) * 0.5;
    bullet.y += (bullet.targetY - bullet.y) * 0.5;
  }

  for (const bomb of game.bombs) {
    bomb.x += (bomb.targetX - bomb.x) * 0.5;
    bomb.y += (bomb.targetY - bomb.y) * 0.5;
  }
}

function advanceLocalFactory(delta) {
  if (!localFactory || !game || !me) {
    return;
  }

  const result = localFactory.advance(delta);

  for (const event of result.events) {
    if (event.type === 'pot-bottled') {
      game.contribute(me.teamId, { dashSeconds: event.seconds });
      toast(`DASH SUPPLEMENT BOTTLED — +${event.seconds}s TO THE TEAM`, 'good');
    }
  }
}

/* ---------- Network host ---------- */

function createNetworkView(maze) {
  return {
    maze: { ...maze, items: [] },
    teams: networkTeams.map((team) => ({
      ...team,
      hp: 0,
      maxHp: 0,
      ammo: 0,
      dashSeconds: 0,
      specials: [],
      activeEffect: null,
      kills: 0,
      eliminated: false,
    })),
    players: [],
    playersById: new Map(),
    bullets: [],
    bombs: [],
    winnerTeamId: null,
    timeMs: 0,
  };
}

function connectNetwork() {
  net = new NetClient({
    url: defaultWebSocketUrl(),
    onStatus: setNetworkStatus,
    onMessage: handleNetMessage,
  });
  net.connect();
}

function setNetworkStatus(status) {
  const previous = networkStatus;
  networkStatus = status;

  if (!networkJoined) {
    if (ui.lobbyStatus) {
      ui.lobbyStatus.textContent =
        status === 'ONLINE'
          ? 'THE COLLECTIVE IS READY'
          : status === 'CONNECTING'
            ? 'CONNECTING TO THE COLLECTIVE…'
            : 'SERVER OFFLINE — RETRYING…';
      ui.lobbyStatus.classList.toggle('is-error', status === 'OFFLINE');
    }
    return;
  }

  if (status === 'OFFLINE' && previous !== 'OFFLINE') {
    toast('CONNECTION LOST — RECONNECTING', 'bad');
  } else if (status === 'ONLINE' && previous === 'OFFLINE') {
    toast('RECONNECTED TO THE COLLECTIVE', 'good');
  }
}

function setupLobby() {
  if (!NETWORK) {
    return;
  }

  const storedColor = window.localStorage.getItem('commied-color');
  if (PLAYER_COLORS.includes(storedColor)) {
    lobbyColor = storedColor;
  }

  ui.lobbyName.value = window.localStorage.getItem('commied-name') ?? '';
  ui.lobbyJoin.addEventListener('click', joinNetwork);
  ui.lobbyName.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      joinNetwork();
    }
  });
  renderLobbyColors();
}

function renderLobbyColors() {
  if (!ui.lobbyColors) {
    return;
  }

  const swatches = PLAYER_COLORS.map((color) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lobby__color';
    button.dataset.color = color;
    button.style.backgroundColor = color;
    button.setAttribute('aria-label', `Colour ${color}`);
    button.classList.toggle('is-selected', color === lobbyColor);
    button.addEventListener('click', () => {
      lobbyColor = color;
      renderLobbyColors();
    });
    return button;
  });

  ui.lobbyColors.replaceChildren(...swatches);
}

function joinNetwork() {
  const name = ui.lobbyName.value.trim();

  if (!name) {
    ui.lobbyStatus.textContent = 'A COMRADE NEEDS A NAME';
    ui.lobbyStatus.classList.add('is-error');
    ui.lobbyName.focus();
    return;
  }

  window.localStorage.setItem('commied-name', name);
  window.localStorage.setItem('commied-color', lobbyColor);
  ui.lobbyJoin.disabled = true;
  ui.lobbyStatus.classList.remove('is-error');
  ui.lobbyStatus.textContent = 'JOINING THE COLLECTIVE…';
  net.join({ name, teamId: lobbyTeamId, color: lobbyColor });
}

function renderLobbyTeams() {
  if (!ui.lobbyTeams || networkTeams.length === 0) {
    return;
  }

  const buttons = networkTeams.map((team) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lobby__team';
    button.dataset.team = String(team.id);
    button.style.borderColor = team.color;
    button.classList.toggle('is-selected', team.id === lobbyTeamId);

    const name = document.createElement('strong');
    name.textContent = team.name.toUpperCase();
    name.style.color = team.color;
    const hint = document.createElement('small');
    hint.textContent = team.id === lobbyTeamId ? 'SELECTED' : 'CHOOSE';
    button.append(name, hint);

    button.addEventListener('click', () => {
      lobbyTeamId = team.id;
      renderLobbyTeams();
    });

    return button;
  });

  ui.lobbyTeams.replaceChildren(...buttons);
}

function handleNetMessage(message) {
  switch (message.type) {
    case 'hello':
      networkTeams = message.teams ?? [];
      renderLobbyTeams();
      break;
    case 'welcome':
      myClientId = message.clientId;
      myPlayerId = message.playerId;
      networkJoined = true;
      game = createNetworkView(message.maze);
      me = null;
      mazeBitmap = null;
      buildMazeBitmap();
      cameraReady = false;
      routeTargetId = myPlayerId;
      routePath = [];
      ghostTaskKey = null;
      ghostConsoleVisible = true;
      effects = [];
      reserveBaseline = { teamId: null, ammo: 0, dashSeconds: 0 };
      reserveDelta = { ammo: 0, dashSeconds: 0, until: 0 };
      ui.lobby.hidden = true;
      ui.banner.hidden = true;
      ui.banner.className = 'banner';
      ui.stats.conn.textContent = 'ONLINE';
      hudNext = 0;
      comratsNext = 0;
      break;
    case 'snapshot':
      applyNetworkSnapshot(message.snapshot);
      break;
    case 'join-rejected':
      ui.lobby.hidden = false;
      ui.lobbyJoin.disabled = false;
      ui.lobbyStatus.textContent = `JOIN FAILED — ${String(message.reason ?? 'UNKNOWN').toUpperCase()}`;
      ui.lobbyStatus.classList.add('is-error');
      break;
    case 'spectating':
      ui.lobby.hidden = false;
      ui.lobbyJoin.disabled = false;
      ui.lobbyStatus.textContent = 'THE TEAMS ARE FULL — TRY AGAIN AFTER THE RESET';
      ui.lobbyStatus.classList.add('is-error');
      networkJoined = false;
      break;
    case 'contribution-rejected':
      break;
    case 'factory-reject':
      if (message.reason && message.reason !== 'not-a-ghost') {
        toast(`FACTORY — ${String(message.reason).replaceAll('-', ' ').toUpperCase()}`);
      }
      break;
    default:
      break;
  }
}

function applyNetworkSnapshot(snapshot) {
  if (!game) {
    return;
  }

  const previous = game.playersById;
  const players = snapshot.players.map((player) => {
    const old = previous?.get(player.id);
    return {
      ...player,
      x: old ? old.x : player.x,
      y: old ? old.y : player.y,
      angle: old ? old.angle : player.angle,
      targetX: player.x,
      targetY: player.y,
      targetAngle: player.angle,
    };
  });

  const previousBullets = new Map(game.bullets.map((bullet) => [bullet.id, bullet]));
  const previousBombs = new Map(game.bombs.map((bomb) => [bomb.id, bomb]));

  game = {
    maze: { ...game.maze, items: snapshot.items },
    teams: snapshot.teams,
    players,
    playersById: new Map(players.map((player) => [player.id, player])),
    bullets: snapshot.bullets.map((bullet) => {
      const old = previousBullets.get(bullet.id);
      return {
        ...bullet,
        x: old ? old.x : bullet.x,
        y: old ? old.y : bullet.y,
        targetX: bullet.x,
        targetY: bullet.y,
      };
    }),
    bombs: snapshot.bombs.map((bomb) => {
      const old = previousBombs.get(bomb.id);
      return {
        ...bomb,
        x: old ? old.x : bomb.x,
        y: old ? old.y : bomb.y,
        targetX: bomb.x,
        targetY: bomb.y,
      };
    }),
    winnerTeamId: snapshot.winnerTeamId,
    timeMs: snapshot.timeMs,
  };

  me = game.playersById.get(myPlayerId) ?? null;

  if (!me) {
    return;
  }

  if (!cameraReady) {
    camera = { x: me.x, y: me.y };
    cameraReady = true;
  }

  if (snapshot.events?.length) {
    handleEvents(snapshot.events);
  }

  updateNetworkGhostConsole(snapshot);
}

/* ---------- Ghost shift bridge ---------- */

function setupGhostConsole() {
  ghostConsole = new GhostConsole({
    root: ui.ghostConsole,
    onContribute: contributeFromGhost,
    onFactoryAction: factoryAction,
    onPointer: (pointer) => {
      if (NETWORK && networkJoined) {
        net.send({ type: 'pointer', ...pointer });
      }
    },
    onTask: (task) => {
      ghostTaskKey = task;
      if (NETWORK && networkJoined) {
        net.send({ type: 'input', ghostTask: task });
      }
    },
    onClose: () => {
      ghostConsoleVisible = false;
      updateGhostOpenButton();
    },
  });

  ui.ghostOpen.addEventListener('click', () => {
    if (!me || me.alive) {
      return;
    }
    ghostConsoleVisible = true;
    if (NETWORK) {
      ghostConsole.show();
    } else {
      updateLocalGhostConsole({ force: true });
    }
    updateGhostOpenButton();
  });
}

function updateGhostOpenButton() {
  if (!ui.ghostOpen) {
    return;
  }
  ui.ghostOpen.hidden = !(me && !me.alive && ghostConsole && !ghostConsole.visible);
}

function contributeFromGhost({ game: source, resources = {} }) {
  if (NETWORK) {
    net?.send({ type: 'contribute', game: source, resources });
    return;
  }

  if (!me || me.alive || game.teams[me.teamId].eliminated) {
    return;
  }

  const hp = Number(resources.hp ?? 0);
  const ammo = Number(resources.ammo ?? 0);
  const dashSeconds = Number(resources.dashSeconds ?? 0);

  if (![hp, ammo, dashSeconds].every(Number.isFinite)) {
    return;
  }
  if (hp < 0) {
    const result = game.drainHp(me.teamId, -hp);
    handleEvents(result.events);
  } else {
    game.contribute(me.teamId, {
      hp: Math.max(0, hp),
      ammo: Math.max(0, ammo),
      dashSeconds: Math.max(0, dashSeconds),
    });
  }
}

function factoryAction(action) {
  if (NETWORK) {
    net?.send({ type: 'factory', ...action });
    return;
  }

  if (!localFactory) {
    return;
  }

  if (action.action === 'take') {
    localFactory.takePot();
  } else if (action.action === 'drop') {
    const result = localFactory.dropPot(Number(action.potId), action.targetId);
    if (result.type === 'rejected') {
      toast(`FACTORY — ${String(result.reason).replaceAll('-', ' ').toUpperCase()}`);
    }
  }

  updateLocalGhostConsole({ force: true });
}

function localFactorySnapshot() {
  if (!localFactory) {
    return null;
  }

  return {
    elapsedMs: localFactory.elapsedMs,
    pots: localFactory.pots.filter((pot) => pot.location !== 'exited'),
    stationCapacity: localFactory.stationCapacity,
    bottlerCapacity: localFactory.bottlerCapacity,
    vialsProduced: localFactory.vialsProduced,
    secondsProduced: localFactory.secondsProduced,
    potsBottled: localFactory.potsBottled,
    potsSpoiled: localFactory.potsSpoiled,
    owners: {},
    cursors: [],
  };
}

let ghostUiNext = 0;

function updateLocalGhostConsole({ force = false } = {}) {
  if (!game || !me || !ghostConsole) {
    return;
  }

  const now = performance.now();
  if (!force && now < ghostUiNext) {
    return;
  }
  ghostUiNext = now + 120;

  const team = game.teams[me.teamId];
  const eliminated = team.eliminated;

  if (me.alive || eliminated) {
    ghostConsole.hide();
    ghostConsoleVisible = true;
    updateGhostOpenButton();
    return;
  }

  ghostConsole.setIdentity({ clientId: null, teamId: me.teamId, playerId: me.id });
  ghostConsole.setState({
    visible: ghostConsoleVisible,
    task: ghostTaskKey ?? me.ghostTask ?? 'clicker',
    hp: team.hp,
    maxHp: team.maxHp,
    baseline: countAlive(me.teamId) * TEAM_HP_PER_PLAYER,
    livingTeammates: countAlive(me.teamId),
    ammo: team.ammo,
    factory: localFactorySnapshot(),
    eliminated,
  });
  updateGhostOpenButton();
}

function updateNetworkGhostConsole(snapshot) {
  if (!ghostConsole || !networkJoined || !me) {
    return;
  }

  const team = game.teams[me.teamId];
  const eliminated = team.eliminated;

  if (me.alive || eliminated) {
    ghostConsole.hide();
    ghostConsoleVisible = true;
    updateGhostOpenButton();
    return;
  }

  ghostConsole.setIdentity({
    clientId: myClientId,
    teamId: me.teamId,
    playerId: me.id,
  });
  ghostConsole.setState({
    visible: ghostConsoleVisible,
    task: ghostTaskKey ?? me.ghostTask ?? 'clicker',
    hp: team.hp,
    maxHp: team.maxHp,
    baseline: countAlive(me.teamId) * TEAM_HP_PER_PLAYER,
    livingTeammates: countAlive(me.teamId),
    ammo: team.ammo,
    factory: snapshot.factories?.[me.teamId] ?? null,
    eliminated,
  });
  updateGhostOpenButton();
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

  if (!game || !me) {
    return;
  }

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
    ctx.fillStyle = player.teamId === me.teamId ? player.color : ENEMY_COLOR;
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

  if (!game || !me) {
    return;
  }

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

  ui.stats.conn.textContent = NETWORK ? networkStatus : 'LOCAL';
  ui.stats.conn.className = `stat ${
    NETWORK && networkStatus === 'ONLINE' ? '' : 'is-dim'
  }`;

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
  const now = performance.now();
  if (reserveBaseline.teamId !== team.id) {
    reserveBaseline = { teamId: team.id, ammo: team.ammo, dashSeconds: team.dashSeconds };
    reserveDelta = { ammo: 0, dashSeconds: 0, until: 0 };
  } else {
    const ammoChange = team.ammo - reserveBaseline.ammo;
    const dashChange = team.dashSeconds - reserveBaseline.dashSeconds;
    if (ammoChange !== 0 || dashChange !== 0) {
      reserveDelta = { ammo: ammoChange, dashSeconds: dashChange, until: now + DELTA_VISIBLE_MS };
      reserveBaseline = { teamId: team.id, ammo: team.ammo, dashSeconds: team.dashSeconds };
    }
  }

  ui.teamName.textContent = team.name.toUpperCase();
  ui.ammo.textContent = String(team.ammo);
  ui.dash.textContent = `${Math.floor(team.dashSeconds)}s`;
  showReserveDelta(ui.ammoDelta, reserveDelta.ammo, now < reserveDelta.until);
  showReserveDelta(ui.dashDelta, reserveDelta.dashSeconds, now < reserveDelta.until);
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

function showReserveDelta(element, amount, visible) {
  if (!element) return;
  element.textContent = visible && amount !== 0
    ? `${amount > 0 ? '+' : '−'}${Math.abs(Math.round(amount * 10) / 10)}`
    : '';
  element.className = amount > 0 ? 'is-positive' : 'is-negative';
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
    const effectName = EFFECT_NAMES[team.activeEffect.type] ?? team.activeEffect.type;
    ui.effectLabel.textContent = effectName;
    ui.effectNotch.hidden = false;
    ui.effectNotch.textContent = `${effectName} · ${seconds.toFixed(1)}s`;
  } else {
    ui.effectLabel.textContent = 'NO EFFECT';
    ui.effectNotch.hidden = true;
    ui.effectNotch.textContent = '';
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
    showBanner(
      'ELIMINATED',
      NETWORK ? 'The collective falls — wait for the next match' : 'Press R for a new match',
    );
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
    minimapCtx.globalAlpha = player.alive ? 1 : 0.45;
    minimapCtx.beginPath();
    minimapCtx.arc(x, y, player.id === me.id ? 2.6 : 2, 0, Math.PI * 2);
    minimapCtx.fillStyle = player.teamId === me.teamId ? player.color : ENEMY_COLOR;
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
    game &&
    me &&
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
    if (minimapModeIndex === 2 && game && me) {
      if (!game.playersById.has(routeTargetId)) {
        routeTargetId = me.id;
      }
      refreshRoute();
      toast('COMRATS — ↑ ↓ SELECT ROUTE', 'good');
    }
  } else if (event.code === 'KeyR') {
    if (NETWORK) {
      if (networkJoined) {
        net.send({ type: 'rematch' });
        toast('REMATCH REQUESTED', 'good');
      }
    } else if (game) {
      startLocalMatch(Math.floor(Math.random() * 1_000_000_000));
    }
  } else if (event.code === 'Digit1' || event.code === 'Digit2' || event.code === 'Digit3') {
    const task = event.code === 'Digit1' ? 'clicker' : event.code === 'Digit2' ? 'ammo' : 'dash';
    ghostTaskKey = task;

    if (me && !me.alive && !game.teams[me.teamId].eliminated) {
      ghostConsoleVisible = true;
      if (NETWORK) {
        net.send({ type: 'input', ghostTask: task });
      } else {
        ghostConsole.select(task);
        updateLocalGhostConsole({ force: true });
      }
    }
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
setupGhostConsole();

if (NETWORK) {
  setupLobby();
  connectNetwork();
} else {
  ui.lobby.hidden = true;
  startLocalMatch(20261110);
}

requestAnimationFrame(frame);
