import { BotDirector } from '../main-game/src/bots.js';
import { EMPTY_INPUT, GHOST_TASKS, Game } from '../main-game/src/game.js';
import {
  DashSupplementFactory,
  BATCH_STATUS,
} from '../dash-supplement-factory/src/dashSupplementFactoryCore.js';

export const ROOM_DEFAULTS = Object.freeze({
  seed: 20261110,
  teams: 2,
  playersPerTeam: 8,
  botsPerTeam: 8,
  width: 61,
  height: 61,
  itemsPerTeam: 8,
  rematchDelayMs: 6000,
});

const MAX_NAME_LENGTH = 16;
const CONTRIBUTION_LIMITS = Object.freeze({
  hp: 25,
  ammo: 100,
  dashSeconds: 30,
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sanitizeName(name, fallback) {
  const text = String(name ?? '')
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  return text.length > 0 ? text : fallback;
}

function serializeMaze(maze) {
  return {
    width: maze.width,
    height: maze.height,
    seed: maze.seed,
    tiles: Array.from(maze.tiles),
    spawnZones: Array.from(maze.spawnZones),
    spawns: maze.spawns.map((spawn) => ({ ...spawn })),
  };
}

function normalizeInput(input = {}) {
  return {
    ...EMPTY_INPUT,
    up: Boolean(input.up),
    down: Boolean(input.down),
    left: Boolean(input.left),
    right: Boolean(input.right),
    aimX: Number.isFinite(input.aimX) ? input.aimX : null,
    aimY: Number.isFinite(input.aimY) ? input.aimY : null,
    shoot: Boolean(input.shoot),
    dash: Boolean(input.dash),
    useSpecial: Boolean(input.useSpecial),
    ghostTask: GHOST_TASKS.includes(input.ghostTask) ? input.ghostTask : null,
  };
}

/**
 * Authoritative multiplayer room.
 *
 * The room owns the deterministic Game, the bots, and one collaborative Dash
 * Factory per team. Sockets and broadcasting live in server.js; this module can
 * be tested with plain fake `send` callbacks.
 */
export class Room {
  constructor(options = {}) {
    this.options = { ...ROOM_DEFAULTS, ...options };
    this.clients = new Map();
    this.nextClientId = 1;
    this.generation = 1;
    this.rematchVotes = new Set();
    this.matchOverAt = null;
    this.events = [];
    this.#createMatch(this.options.seed);
  }

  /* ------------------------------- Clients ------------------------------- */

  addClient({ send, name } = {}) {
    const id = this.nextClientId;
    this.nextClientId += 1;
    const client = {
      id,
      name: sanitizeName(name, `Comrade ${id}`),
      send: send ?? (() => {}),
      playerId: null,
      preferredTeamId: null,
      input: { ...EMPTY_INPUT },
      pointer: { x: 0.5, y: 0.5, active: false },
    };
    this.clients.set(id, client);
    return client;
  }

  removeClient(clientId) {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    if (client.playerId !== null) {
      const player = this.game.playersById.get(client.playerId);
      const teamId = player?.teamId;
      this.game.leave(client.playerId);
      if (teamId !== undefined && this.game.winnerTeamId === null) {
        this.#replenishBots(teamId);
      }
    }

    this.#removeCursor(clientId);
    this.clients.delete(clientId);
    return true;
  }

  join(clientId, { name, teamId, color } = {}) {
    const client = this.clients.get(clientId);
    if (!client) {
      return { accepted: false, reason: 'unknown-client' };
    }
    if (this.game.winnerTeamId !== null) {
      return { accepted: false, reason: 'match-over' };
    }
    if (client.playerId !== null) {
      return { accepted: false, reason: 'already-joined' };
    }

    const requested = Number.isInteger(teamId) ? teamId : null;
    const targetTeam = this.#teamForJoin(requested);

    if (targetTeam === null) {
      return { accepted: false, reason: 'teams-full' };
    }

    client.name = sanitizeName(name ?? client.name, client.name);
    client.preferredTeamId = targetTeam;
    this.#makeRoomForHuman(targetTeam);
    const player = this.game.join({ teamId: targetTeam, name: client.name, color });
    client.playerId = player.id;

    client.send({
      type: 'welcome',
      clientId: client.id,
      playerId: player.id,
      teamId: player.teamId,
      generation: this.generation,
      maze: serializeMaze(this.game.maze),
      config: {
        playersPerTeam: this.options.playersPerTeam,
        teams: this.options.teams,
        rematchDelayMs: this.options.rematchDelayMs,
      },
    });

    return { accepted: true, player, client };
  }

  handleInput(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.playerId === null) {
      return false;
    }
    client.input = normalizeInput(message);
    return true;
  }

  /* ---------------------------- Contributions ---------------------------- */

  handleContribution(clientId, { game: source, resources = {} } = {}) {
    const client = this.clients.get(clientId);
    const player =
      client && client.playerId !== null
        ? this.game.playersById.get(client.playerId)
        : null;

    if (!player) {
      return { accepted: false, reason: 'not-joined' };
    }
    if (player.alive) {
      return { accepted: false, reason: 'not-a-ghost' };
    }

    const team = this.game.teams[player.teamId];
    if (!team || team.eliminated) {
      return { accepted: false, reason: 'eliminated' };
    }

    const rawHp = Number(resources.hp ?? 0);
    const rawAmmo = Number(resources.ammo ?? 0);
    const rawDash = Number(resources.dashSeconds ?? 0);

    if (![rawHp, rawAmmo, rawDash].every(Number.isFinite)) {
      return { accepted: false, reason: 'invalid' };
    }

    let hp = 0;
    let ammo = 0;
    let dashSeconds = 0;

    if (source === 'soul-clicker') {
      hp = clamp(rawHp, -CONTRIBUTION_LIMITS.hp, CONTRIBUTION_LIMITS.hp);
    } else if (source === 'bullet-press') {
      ammo = clamp(rawAmmo, 0, CONTRIBUTION_LIMITS.ammo);
    } else {
      hp = clamp(rawHp, -CONTRIBUTION_LIMITS.hp, CONTRIBUTION_LIMITS.hp);
      ammo = clamp(rawAmmo, 0, CONTRIBUTION_LIMITS.ammo);
      dashSeconds = clamp(rawDash, 0, CONTRIBUTION_LIMITS.dashSeconds);
    }

    if (hp === 0 && ammo === 0 && dashSeconds === 0) {
      return { accepted: true, hp: 0, ammo: 0, dashSeconds: 0 };
    }

    let result;

    if (hp < 0) {
      result = this.game.drainHp(player.teamId, -hp);
      this.events.push(...result.events);
    } else {
      result = this.game.contribute(player.teamId, { hp, ammo, dashSeconds });
    }

    if (!result.accepted) {
      return result;
    }

    this.#trackContribution(player.teamId, { hp, ammo, dashSeconds });

    return { accepted: true, hp, ammo, dashSeconds };
  }

  /* ------------------------------ Factories ------------------------------ */

  handleFactoryAction(clientId, { action, batchId, targetId } = {}) {
    const client = this.clients.get(clientId);
    const player =
      client && client.playerId !== null
        ? this.game.playersById.get(client.playerId)
        : null;

    if (!player || player.alive) {
      return { type: 'rejected', reason: 'not-a-ghost' };
    }

    const state = this.factories.get(player.teamId);
    if (!state || this.game.teams[player.teamId].eliminated) {
      return { type: 'rejected', reason: 'eliminated' };
    }

    if (action === 'take') {
      return state.factory.takeBatch();
    }

    if (action === 'drop') {
      const result = state.factory.dropBatch(Number(batchId), targetId);
      if (result.type === 'batch-dropped') {
        state.owners.delete(Number(batchId));
      }
      return result;
    }

    if (action === 'claim') {
      const batch = state.factory.batches.find((entry) => entry.id === Number(batchId));
      if (batch && batch.location !== 'exited') {
        state.owners.set(Number(batchId), {
          clientId: client.id,
          name: client.name,
        });
      }
      return { type: 'claimed', batchId: Number(batchId) };
    }

    if (action === 'release') {
      const owner = state.owners.get(Number(batchId));
      if (!owner || owner.clientId === client.id) {
        state.owners.delete(Number(batchId));
      }
      return { type: 'released', batchId: Number(batchId) };
    }

    return { type: 'rejected', reason: 'unknown-action' };
  }

  handlePointer(clientId, { x, y, active } = {}) {
    const client = this.clients.get(clientId);
    const player =
      client && client.playerId !== null
        ? this.game.playersById.get(client.playerId)
        : null;

    if (!client || !player || player.alive) {
      return false;
    }

    client.pointer = {
      x: clamp(Number(x) || 0, 0, 1),
      y: clamp(Number(y) || 0, 0, 1),
      active: Boolean(active),
    };

    const state = this.factories.get(player.teamId);
    if (state) {
      state.cursors.set(client.id, {
        clientId: client.id,
        name: client.name,
        x: client.pointer.x,
        y: client.pointer.y,
        active: client.pointer.active,
      });
    }

    return true;
  }

  /* -------------------------------- Match -------------------------------- */

  step(dtMs) {
    if (this.game.winnerTeamId !== null) {
      if (this.matchOverAt === null) {
        this.matchOverAt = Date.now();
      } else if (Date.now() - this.matchOverAt >= this.options.rematchDelayMs) {
        this.resetMatch();
      }
      return { events: [] };
    }

    const inputs = this.bots.inputs();

    for (const client of this.clients.values()) {
      if (client.playerId === null) {
        continue;
      }
      const player = this.game.playersById.get(client.playerId);
      if (!player) {
        continue;
      }
      inputs.set(player.id, client.input);
      // Special use is edge-triggered; do not repeat it on the next tick.
      client.input.useSpecial = false;
    }

    const result = this.game.step(dtMs, inputs);
    this.events.push(...result.events);

    if (this.game.winnerTeamId !== null) {
      this.matchOverAt = Date.now();
    }

    // Factories keep working even when no ghost is looking at them.
    for (const [teamId, state] of this.factories) {
      const tick = state.factory.advance(dtMs);
      const events = [];

      for (const event of tick.events) {
        events.push(event);

        if (event.type === 'batch-bottled') {
          this.game.contribute(teamId, { dashSeconds: event.seconds });
          this.#trackContribution(teamId, { dashSeconds: event.seconds });
        }
        if (event.type === 'batch-wasted' || event.type === 'batch-bottled') {
          state.owners.delete(event.batchId);
        }
      }

      if (events.length > 0) {
        const pending = this.factoryEvents.get(teamId) ?? [];
        pending.push(...events);
        this.factoryEvents.set(teamId, pending);
      }

      // Owners of batches that have left the line are gone.
      const liveBatchIds = new Set(
        state.factory.batches
          .filter((batch) => batch.location !== 'exited')
          .map((batch) => batch.id),
      );
      for (const batchId of state.owners.keys()) {
        if (!liveBatchIds.has(batchId)) {
          state.owners.delete(batchId);
        }
      }
    }

    return { events: result.events };
  }

  resetMatch(seed = (this.options.seed + this.generation * 7919) >>> 0) {
    const humans = [...this.clients.values()].map((client) => ({
      client,
      name: client.name,
      teamId: client.preferredTeamId,
    }));

    this.options.seed = seed >>> 0;
    this.generation += 1;
    this.#createMatch(this.options.seed);

    for (const human of humans) {
      human.client.playerId = null;
      this.join(human.client.id, { name: human.name, teamId: human.teamId });
    }

    for (const client of this.clients.values()) {
      if (client.playerId === null) {
        // The room was full while the old bot count was being rebuilt.
        client.send({ type: 'spectating', reason: 'teams-full' });
      }
    }

    return this.getSnapshot();
  }

  requestRematch(clientId) {
    if (!this.clients.has(clientId)) {
      return false;
    }
    this.rematchVotes.add(clientId);

    // Any one comrade can call the next match once the old one is over.
    if (this.game.winnerTeamId !== null) {
      this.resetMatch();
      return true;
    }

    return false;
  }

  /* ------------------------------- Output -------------------------------- */

  takeEvents() {
    return this.events.splice(0, this.events.length);
  }

  takeFactoryEvents() {
    const result = {};

    for (const [teamId, events] of this.factoryEvents) {
      if (events.length > 0) {
        result[teamId] = events.splice(0, events.length);
      }
    }

    return result;
  }

  getSnapshot() {
    const snapshot = this.game.snapshot();
    snapshot.generation = this.generation;
    snapshot.seed = this.game.seed;
    snapshot.contributions = Object.fromEntries(
      [...this.contributions.entries()].map(([teamId, totals]) => [teamId, { ...totals }]),
    );
    snapshot.factories = {};

    for (const [teamId, state] of this.factories) {
      snapshot.factories[teamId] = {
        elapsedMs: state.factory.elapsedMs,
        batches: state.factory.batches.filter((batch) => batch.location !== 'exited'),
        stationCapacity: state.factory.stationCapacity,
        bottlerCapacity: state.factory.bottlerCapacity,
        disposerCapacity: state.factory.disposerCapacity,
        pendingDashSeconds: state.factory.pendingDashSeconds,
        batchesBottled: state.factory.batchesBottled,
        batchesWasted: state.factory.batchesWasted,
        owners: Object.fromEntries(
          [...state.owners.entries()].map(([batchId, owner]) => [batchId, { ...owner }]),
        ),
        cursors: [...state.cursors.values()].map((cursor) => ({ ...cursor })),
      };
    }

    return snapshot;
  }

  broadcast(message) {
    for (const client of this.clients.values()) {
      client.send(message);
    }
  }

  broadcastSnapshot() {
    const snapshot = this.getSnapshot();
    snapshot.events = this.takeEvents();
    snapshot.factoryEvents = this.takeFactoryEvents();
    this.broadcast({ type: 'snapshot', snapshot });
    return snapshot;
  }

  /* ------------------------------ Internals ------------------------------ */

  #createMatch(seed) {
    this.game = new Game({
      seed,
      teams: this.options.teams,
      playersPerTeam: this.options.playersPerTeam,
      width: this.options.width,
      height: this.options.height,
      itemsPerTeam: this.options.itemsPerTeam,
    });
    this.bots = new BotDirector(this.game, { seed: (seed ^ 0x5f3759df) >>> 0 });
    this.events = [];
    this.factoryEvents = new Map();
    this.factories = new Map();
    this.contributions = new Map();
    this.matchOverAt = null;
    this.rematchVotes.clear();

    for (const team of this.game.teams) {
      this.factories.set(team.id, {
        factory: new DashSupplementFactory(),
        owners: new Map(),
        cursors: new Map(),
      });
      this.contributions.set(team.id, { hp: 0, ammo: 0, dashSeconds: 0 });
      for (let index = 0; index < this.options.botsPerTeam; index += 1) {
        this.game.join({ teamId: team.id, isBot: true });
      }
    }
  }

  #teamForJoin(requestedTeamId) {
    const canJoin = (team) => {
      if (!team || team.eliminated) {
        return false;
      }
      const count = this.game.players.filter((player) => player.teamId === team.id).length;
      if (count < this.options.playersPerTeam) {
        return true;
      }
      return this.game.players.some(
        (player) => player.teamId === team.id && player.isBot,
      );
    };

    if (requestedTeamId !== null) {
      const requested = this.game.teams[requestedTeamId];
      if (canJoin(requested)) {
        return requestedTeamId;
      }
    }

    const candidates = this.game.teams
      .filter((team) => canJoin(team))
      .map((team) => ({
        id: team.id,
        humans: this.game.players.filter(
          (player) => player.teamId === team.id && !player.isBot,
        ).length,
      }))
      .sort((a, b) => a.humans - b.humans || a.id - b.id);

    return candidates[0]?.id ?? null;
  }

  #makeRoomForHuman(teamId) {
    const count = this.game.players.filter((player) => player.teamId === teamId).length;
    if (count < this.options.playersPerTeam) {
      return;
    }

    const bot = this.game.players.find(
      (player) => player.teamId === teamId && player.isBot,
    );
    if (bot) {
      this.game.leave(bot.id);
    }
  }

  #replenishBots(teamId) {
    if (!this.game.teams[teamId] || this.game.teams[teamId].eliminated) {
      return;
    }

    let bots = this.game.players.filter(
      (player) => player.teamId === teamId && player.isBot,
    ).length;
    let total = this.game.players.filter((player) => player.teamId === teamId).length;

    while (bots < this.options.botsPerTeam && total < this.options.playersPerTeam) {
      this.game.join({ teamId, isBot: true });
      bots += 1;
      total += 1;
    }
  }

  #trackContribution(teamId, { hp = 0, ammo = 0, dashSeconds = 0 }) {
    const totals = this.contributions.get(teamId);
    if (!totals) {
      return;
    }
    totals.hp += Math.max(0, hp);
    totals.hp -= Math.max(0, -hp);
    totals.ammo += ammo;
    totals.dashSeconds += dashSeconds;
  }

  #removeCursor(clientId) {
    for (const state of this.factories.values()) {
      state.cursors.delete(clientId);
    }
  }
}

export { BATCH_STATUS };
