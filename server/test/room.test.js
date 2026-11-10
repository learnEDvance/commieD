import test from 'node:test';
import assert from 'node:assert/strict';

import { Room } from '../room.js';

function makeRoom(options = {}) {
  return new Room({
    seed: 11,
    teams: 2,
    playersPerTeam: 4,
    botsPerTeam: 0,
    width: 41,
    height: 41,
    itemsPerTeam: 4,
    ...options,
  });
}

function addClient(room, name = 'Ana') {
  const messages = [];
  const client = room.addClient({
    name,
    send(message) {
      messages.push(message);
    },
  });
  return { client, messages };
}

function joinGhost(room, name = 'Ana', teamId = 0) {
  const { client, messages } = addClient(room, name);
  const result = room.join(client.id, { name, teamId });
  assert.equal(result.accepted, true);
  const player = room.game.playersById.get(client.playerId);
  player.alive = false;
  player.isGhost = true;
  return { client, messages, player };
}

test('joining sends a welcome with a JSON-safe maze', () => {
  const room = makeRoom();
  const { client, messages } = addClient(room, 'Ana');
  const result = room.join(client.id, { name: 'Ana', teamId: 0 });

  assert.equal(result.accepted, true);
  assert.equal(result.player.teamId, 0);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, 'welcome');
  assert.equal(messages[0].playerId, result.player.id);

  const { maze } = messages[0];
  assert.ok(Array.isArray(maze.tiles));
  assert.ok(Array.isArray(maze.spawnZones));
  assert.equal(maze.tiles.length, 41 * 41);
  assert.equal(maze.spawnZones.length, 41 * 41);
  assert.ok(maze.spawns.length >= 2);
});

test('humans replace bots when a preferred team is full', () => {
  const room = makeRoom({ botsPerTeam: 2 });
  const players = [];

  for (let index = 0; index < 4; index += 1) {
    const { client } = addClient(room, `Comrade ${index}`);
    const result = room.join(client.id, { name: `Comrade ${index}`, teamId: 0 });
    assert.equal(result.accepted, true);
    players.push(result.player);
  }

  const teamZero = room.game.players.filter((player) => player.teamId === 0);
  assert.equal(teamZero.length, 4);
  assert.equal(teamZero.filter((player) => !player.isBot).length, 4);

  const { client } = addClient(room, 'Fifth');
  const rejected = room.join(client.id, { name: 'Fifth', teamId: 0 });
  assert.equal(rejected.accepted, true);
  assert.equal(rejected.player.teamId, 1);
});

test('only ghosts can contribute resources', () => {
  const room = makeRoom();
  const { client } = addClient(room, 'Ana');
  const joined = room.join(client.id, { name: 'Ana', teamId: 0 });

  const alive = room.handleContribution(client.id, {
    game: 'bullet-press',
    resources: { ammo: 20 },
  });
  assert.deepEqual(alive, { accepted: false, reason: 'not-a-ghost' });

  const player = room.game.playersById.get(joined.player.id);
  player.alive = false;
  player.isGhost = true;

  const ammoBefore = room.game.teams[0].ammo;
  const accepted = room.handleContribution(client.id, {
    game: 'bullet-press',
    resources: { ammo: 20 },
  });
  assert.equal(accepted.accepted, true);
  assert.equal(room.game.teams[0].ammo, ammoBefore + 20);
});

test('soul-clicker drain reduces team HP and clamps damage per message', () => {
  const room = makeRoom();
  const { client, player } = joinGhost(room, 'Ana', 0);
  const hpBefore = room.game.teams[0].hp;

  const result = room.handleContribution(client.id, {
    game: 'soul-clicker',
    resources: { hp: -100 },
  });

  assert.equal(result.accepted, true);
  assert.equal(result.hp, -25);
  assert.equal(room.game.teams[0].hp, hpBefore - 25);
  assert.equal(player.alive, false);
});

test('team factories are shared and bottling awards dash seconds', () => {
  const room = makeRoom();
  const { client } = joinGhost(room, 'Ana', 0);
  const state = room.factories.get(0);

  const taken = room.handleFactoryAction(client.id, { action: 'take' });
  assert.equal(taken.type, 'pot-taken');

  const pot = state.factory._pots[0];
  pot.stepIndex = state.factory.processes.length;
  pot.location = 'mill';
  pot.status = 'ready';
  pot.windowMsLeft = 7000;

  const dropped = room.handleFactoryAction(client.id, {
    action: 'drop',
    potId: pot.id,
    targetId: 'bottler',
  });
  assert.equal(dropped.type, 'pot-dropped');

  const dashBefore = room.game.teams[0].dashSeconds;
  room.step(10_000);

  assert.equal(room.game.teams[0].dashSeconds, dashBefore + 20);
  assert.ok(room.getSnapshot().factories[0].potsBottled >= 1);
});

test('factory owners are visible to teammates and cleared by a drop', () => {
  const room = makeRoom();
  const first = joinGhost(room, 'Ana', 0);
  const second = joinGhost(room, 'Boris', 0);

  const taken = room.handleFactoryAction(first.client.id, { action: 'take' });
  room.handleFactoryAction(first.client.id, {
    action: 'claim',
    potId: taken.potId,
  });
  room.handleFactoryAction(second.client.id, {
    action: 'claim',
    potId: taken.potId,
  });

  const claimed = room.getSnapshot().factories[0].owners[taken.potId];
  assert.equal(claimed.clientId, second.client.id);
  assert.equal(claimed.name, 'Boris');

  room.handleFactoryAction(second.client.id, {
    action: 'drop',
    potId: taken.potId,
    targetId: 'mill',
  });

  assert.equal(room.getSnapshot().factories[0].owners[taken.potId], undefined);
});

test('pointer positions are broadcast through factory snapshots', () => {
  const room = makeRoom();
  const { client } = joinGhost(room, 'Ana', 0);

  room.handlePointer(client.id, { x: 0.25, y: 0.75, active: true });
  const cursors = room.getSnapshot().factories[0].cursors;

  assert.equal(cursors.length, 1);
  assert.deepEqual(cursors[0], {
    clientId: client.id,
    name: 'Ana',
    x: 0.25,
    y: 0.75,
    active: true,
  });
});

test('a match reset rejoins every client and resets factories', () => {
  const room = makeRoom();
  const { client, messages } = joinGhost(room, 'Ana', 0);
  const generation = room.generation;

  room.resetMatch(99);

  assert.equal(room.generation, generation + 1);
  assert.equal(room.game.playersById.get(client.playerId).name, 'Ana');
  assert.ok(messages.some((message) => message.type === 'welcome' && message.generation === room.generation));
  assert.equal(room.getSnapshot().factories[0].pots.length, 0);
});

test('snapshots carry game events and factory events exactly once', () => {
  const room = makeRoom();
  joinGhost(room, 'Ana', 0);
  room.game.teams[0].hp = 1;
  room.handleContribution(room.clients.keys().next().value, {
    game: 'soul-clicker',
    resources: { hp: -25 },
  });

  const snapshot = room.broadcastSnapshot();
  assert.ok(snapshot.events.length >= 1);
  assert.equal(room.takeEvents().length, 0);
  assert.equal(Object.keys(room.takeFactoryEvents()).length, 0);
});
