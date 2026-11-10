import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DashSupplementFactory,
  POT_STATUS,
  PROCESSES,
  STATIONS,
} from '../src/dashSupplementFactoryCore.js';

const FAST_PROCESS = {
  id: 'only-process',
  order: 1,
  name: 'ONLY PROCESS',
  stationId: 'mill',
  durationMs: 100,
  windowMs: 300,
};

const FAST_CONFIG = {
  processes: [FAST_PROCESS],
  bottlingMs: 100,
  vialsPerPot: 20,
  secondsPerVial: 1,
};

function makeFactory(config = {}) {
  return new DashSupplementFactory({ config });
}

function takePots(factory, count = 1) {
  const events = [];

  for (let i = 0; i < count; i += 1) {
    const event = factory.takePot();
    assert.equal(event.type, 'pot-taken');
    events.push(event);
  }
  return events;
}

function drop(factory, potId, targetId) {
  return factory.dropPot(potId, targetId);
}

function finishSingleProcess(factory, potId) {
  assert.equal(drop(factory, potId, FAST_PROCESS.stationId).type, 'pot-dropped');
  const tick = factory.advance(FAST_PROCESS.durationMs);
  assert.equal(tick.events[0]?.type, 'process-complete');
}

function finishFullRoute(factory, potId) {
  for (const process of factory.processes) {
    const dropped = drop(factory, potId, process.stationId);
    assert.equal(dropped.type, 'pot-dropped', JSON.stringify(dropped));
    const tick = factory.advance(process.durationMs);
    assert.equal(
      tick.events.filter((event) => event.type === 'process-complete').length,
      1,
    );
  }
}

test('ships twelve numbered processes across six reused stations', () => {
  assert.equal(PROCESSES.length, 12);
  assert.equal(STATIONS.length, 6);
  assert.deepEqual(
    [...new Set(PROCESSES.map((process) => process.stationId))].sort(),
    STATIONS.map((station) => station.id).sort(),
  );

  const uses = Object.fromEntries(STATIONS.map((station) => [station.id, 0]));
  for (const process of PROCESSES) {
    uses[process.stationId] += 1;
  }

  assert.equal(uses.mill, 1);
  assert.equal(uses.vat, 3);
  assert.equal(uses.press, 2);
  assert.equal(uses.still, 2);
  assert.equal(uses.filter, 2);
  assert.equal(uses.bureau, 2);
});

test('starts with an empty floor and no output', () => {
  const factory = makeFactory();

  assert.equal(factory.activePots.length, 0);
  assert.equal(factory.vialsProduced, 0);
  assert.equal(factory.secondsProduced, 0);
  assert.equal(factory.potsSpoiled, 0);
  assert.deepEqual(factory.occupancy, {
    mill: 0,
    vat: 0,
    press: 0,
    still: 0,
    filter: 0,
    bureau: 0,
    bottler: 0,
    disposer: 0,
  });
});

test('takes unlimited empty pots at the intake', () => {
  const factory = makeFactory();

  takePots(factory, 20);

  assert.equal(factory.intakePots.length, 20);
  assert.equal(factory.activePots.length, 20);
  assert.deepEqual(
    factory.intakePots.map((pot) => pot.id),
    Array.from({ length: 20 }, (_, index) => index + 1),
  );
});

test('rejects a wrong station and leaves the pot at the intake', () => {
  const factory = makeFactory();
  takePots(factory, 1);

  const event = drop(factory, 1, 'vat');

  assert.equal(event.type, 'rejected');
  assert.equal(event.reason, 'wrong-station');
  assert.equal(event.expectedStationId, 'mill');
  assert.equal(factory.pots[0].location, 'intake');
  assert.equal(factory.pots[0].stepIndex, 0);
});

test('starts working when dropped on the correct station', () => {
  const factory = makeFactory();
  takePots(factory, 1);

  const event = drop(factory, 1, 'mill');

  assert.equal(event.type, 'pot-dropped');
  assert.equal(event.step.order, 1);
  assert.equal(factory.pots[0].status, POT_STATUS.WORKING);
  assert.equal(factory.pots[0].progressMs, 0);
  assert.equal(factory.occupancy.mill, 1);
});

test('does not let a working pot leave early', () => {
  const factory = makeFactory();
  takePots(factory, 1);
  drop(factory, 1, 'mill');
  factory.advance(500);

  const event = drop(factory, 1, 'vat');

  assert.equal(event.type, 'rejected');
  assert.equal(event.reason, 'pot-busy');
  assert.equal(factory.pots[0].location, 'mill');
  assert.equal(factory.pots[0].status, POT_STATUS.WORKING);
  assert.equal(factory.pots[0].progressMs, 500);
});

test('completes a process and opens the ready window', () => {
  const factory = makeFactory();
  takePots(factory, 1);
  drop(factory, 1, 'mill');

  const first = factory.advance(1500);

  assert.equal(first.events.length, 1);
  assert.equal(first.events[0].type, 'process-complete');
  assert.equal(first.events[0].nextStep.stationId, 'vat');
  assert.equal(factory.pots[0].status, POT_STATUS.READY);
  assert.equal(factory.pots[0].stepIndex, 1);
  assert.equal(factory.pots[0].windowMsLeft, 7000);

  const second = factory.advance(1000);

  assert.equal(second.events.length, 0);
  assert.equal(factory.pots[0].windowMsLeft, 6000);
});

test('a ready pot can move to the next station', () => {
  const factory = makeFactory();
  takePots(factory, 1);
  drop(factory, 1, 'mill');
  factory.advance(1500);

  const event = drop(factory, 1, 'vat');

  assert.equal(event.type, 'pot-dropped');
  assert.equal(event.step.order, 2);
  assert.equal(factory.pots[0].location, 'vat');
  assert.equal(factory.pots[0].status, POT_STATUS.WORKING);
  assert.equal(factory.occupancy.mill, 0);
  assert.equal(factory.occupancy.vat, 1);
});

test('a wrong station after completion leaves a ready pot where it was', () => {
  const factory = makeFactory();
  takePots(factory, 1);
  drop(factory, 1, 'mill');
  factory.advance(1500);

  const event = drop(factory, 1, 'still');

  assert.equal(event.type, 'rejected');
  assert.equal(event.reason, 'wrong-station');
  assert.equal(event.expectedStationId, 'vat');
  assert.equal(factory.pots[0].location, 'mill');
  assert.equal(factory.pots[0].status, POT_STATUS.READY);
});

test('a station holds four pots and rejects the fifth', () => {
  const factory = makeFactory();
  takePots(factory, 5);

  for (let id = 1; id <= 4; id += 1) {
    assert.equal(drop(factory, id, 'mill').type, 'pot-dropped');
  }

  const event = drop(factory, 5, 'mill');

  assert.equal(event.type, 'rejected');
  assert.equal(event.reason, 'station-full');
  assert.equal(factory.pots[4].location, 'intake');
  assert.equal(factory.occupancy.mill, 4);
});

test('stations can process different steps of the route at once', () => {
  const factory = makeFactory();
  takePots(factory, 2);

  drop(factory, 1, 'mill');
  factory.advance(1500);
  drop(factory, 1, 'vat');
  factory.advance(1400);

  // Pot 2 is still on mill's step; pot 1 is ready at the vat on step 3.
  assert.equal(factory.pots[0].stepIndex, 2);
  assert.equal(factory.pots[0].status, POT_STATUS.READY);

  drop(factory, 2, 'mill');
  factory.advance(1500);
  assert.equal(drop(factory, 2, 'vat').type, 'pot-dropped');
  assert.equal(factory.occupancy.vat, 2);
  assert.equal(factory.pots[1].stepIndex, 1);
  assert.equal(factory.pots[1].status, POT_STATUS.WORKING);
});

test('an uncollected ready batch stays in its station until disposal', () => {
  const factory = makeFactory(FAST_CONFIG);
  takePots(factory, 1);
  finishSingleProcess(factory, 1);

  const nearly = factory.advance(299);
  assert.equal(nearly.events.length, 0);
  assert.equal(factory.pots[0].status, POT_STATUS.READY);

  const late = factory.advance(1);

  assert.equal(late.events.length, 1);
  assert.equal(late.events[0].type, 'pot-spoiled');
  assert.equal(late.events[0].reason, 'window');
  assert.equal(factory.pots[0].status, POT_STATUS.SPOILED);
  assert.equal(factory.pots[0].location, 'mill');
  assert.equal(factory.occupancy.mill, 1);
  assert.equal(factory.activePots.length, 1);
  assert.equal(factory.potsSpoiled, 1);
});

test('wasted batches queue at disposal and leave only when emptying finishes', () => {
  const factory = makeFactory({ ...FAST_CONFIG, disposingMs: 300 });
  takePots(factory, 2);
  finishSingleProcess(factory, 1);
  finishSingleProcess(factory, 2);
  factory.advance(300);
  factory.advance(300);

  assert.equal(factory.dropPot(1, 'disposer').status, POT_STATUS.DISPOSING);
  assert.equal(factory.dropPot(2, 'disposer').status, POT_STATUS.QUEUED);
  assert.equal(factory.getPotsAt('disposer').length, 2);
  const tick = factory.advance(600);
  assert.deepEqual(tick.events.map((event) => event.type), ['batch-disposed', 'batch-disposed']);
  assert.equal(factory.getPotsAt('disposer').length, 0);
  assert.equal(factory.activePots.length, 0);
});

test('the full route reuses stations and ends at the bottler', () => {
  const factory = makeFactory();
  takePots(factory, 1);

  finishFullRoute(factory, 1);

  assert.equal(factory.pots[0].stepIndex, PROCESSES.length);
  assert.equal(factory.pots[0].status, POT_STATUS.READY);

  const dropped = drop(factory, 1, 'bottler');
  assert.equal(dropped.type, 'pot-dropped');
  assert.equal(factory.pots[0].status, POT_STATUS.BOTTLING);

  const early = factory.advance(9999);
  assert.equal(early.events.length, 0);
  assert.equal(factory.pots[0].status, POT_STATUS.BOTTLING);
  assert.equal(factory.vialsProduced, 0);

  const tick = factory.advance(1);
  assert.equal(tick.events.length, 1);
  assert.equal(tick.events[0].type, 'pot-bottled');
  assert.equal(tick.events[0].vials, 20);
  assert.equal(tick.events[0].seconds, 20);
  assert.equal(factory.vialsProduced, 20);
  assert.equal(factory.secondsProduced, 20);
  assert.equal(factory.potsBottled, 1);
  assert.equal(factory.pots[0].status, POT_STATUS.DONE);
  assert.equal(factory.pots[0].bottled, true);
});

test('refuses the bottler until every process is complete', () => {
  const factory = makeFactory();
  takePots(factory, 1);

  const event = drop(factory, 1, 'bottler');

  assert.equal(event.type, 'rejected');
  assert.equal(event.reason, 'processes-remaining');
  assert.equal(event.process.stationId, 'mill');
  assert.equal(factory.pots[0].location, 'intake');
});

test('the bottler holds four pots and rejects the fifth', () => {
  // A long ready window keeps the waiting fifth pot from spoiling while the
  // bottler drains the first four.
  const factory = makeFactory({
    ...FAST_CONFIG,
    processes: [{ ...FAST_PROCESS, windowMs: 5000 }],
    stationCapacity: 5,
  });
  takePots(factory, 5);

  for (let id = 1; id <= 5; id += 1) {
    assert.equal(drop(factory, id, 'mill').type, 'pot-dropped');
  }
  factory.advance(FAST_PROCESS.durationMs);

  for (let id = 1; id <= 4; id += 1) {
    assert.equal(drop(factory, id, 'bottler').type, 'pot-dropped');
  }

  const fifth = drop(factory, 5, 'bottler');
  assert.equal(fifth.type, 'rejected');
  assert.equal(fifth.reason, 'bottler-full');
  assert.equal(factory.occupancy.bottler, 4);

  const first = factory.advance(100);
  assert.equal(
    first.events.filter((event) => event.type === 'pot-bottled').length,
    1,
  );

  const rest = factory.advance(300);
  assert.equal(
    rest.events.filter((event) => event.type === 'pot-bottled').length,
    3,
  );
  assert.equal(factory.vialsProduced, 80);
  assert.equal(factory.activePots.length, 1);
  assert.equal(drop(factory, 5, 'bottler').type, 'pot-dropped');
});

test('the bottler empties pots one at a time', () => {
  const factory = makeFactory({ ...FAST_CONFIG, stationCapacity: 5 });
  takePots(factory, 2);

  for (const id of [1, 2]) {
    assert.equal(drop(factory, id, 'mill').type, 'pot-dropped');
  }
  factory.advance(FAST_PROCESS.durationMs);

  assert.equal(drop(factory, 1, 'bottler').type, 'pot-dropped');
  assert.equal(drop(factory, 2, 'bottler').type, 'pot-dropped');
  assert.equal(factory.pots[0].status, POT_STATUS.BOTTLING);
  assert.equal(factory.pots[1].status, POT_STATUS.QUEUED);

  const half = factory.advance(60);
  assert.equal(half.events.length, 0);
  assert.equal(factory.pots[0].progressMs, 60);
  assert.equal(factory.pots[1].progressMs, 0);
  assert.equal(factory.vialsProduced, 0);

  const first = factory.advance(40);
  assert.deepEqual(
    first.events.map((event) => [event.type, event.potId]),
    [
      ['pot-bottled', 1],
      ['bottling-started', 2],
    ],
  );
  assert.equal(factory.pots[0].location, 'exited');
  assert.equal(factory.pots[1].status, POT_STATUS.BOTTLING);
  assert.equal(factory.pots[1].progressMs, 0);
  assert.equal(factory.vialsProduced, 20);

  factory.advance(100);
  assert.equal(factory.potsBottled, 2);
  assert.equal(factory.vialsProduced, 40);
});

test('a large tick empties queued pots in order', () => {
  const factory = makeFactory({ ...FAST_CONFIG, stationCapacity: 5 });
  takePots(factory, 2);

  for (const id of [1, 2]) {
    assert.equal(drop(factory, id, 'mill').type, 'pot-dropped');
  }
  factory.advance(FAST_PROCESS.durationMs);
  drop(factory, 1, 'bottler');
  drop(factory, 2, 'bottler');

  const tick = factory.advance(200);
  assert.deepEqual(
    tick.events.map((event) => [event.type, event.potId]),
    [
      ['pot-bottled', 1],
      ['bottling-started', 2],
      ['pot-bottled', 2],
    ],
  );
  assert.equal(factory.vialsProduced, 40);
  assert.equal(factory.potsBottled, 2);
});

test('one tick can complete several pots deterministically', () => {
  const factory = makeFactory(FAST_CONFIG);
  takePots(factory, 3);

  for (let id = 1; id <= 3; id += 1) {
    drop(factory, id, 'mill');
  }

  const processed = factory.advance(100);
  assert.deepEqual(
    processed.events.map((event) => [event.type, event.potId]),
    [
      ['process-complete', 1],
      ['process-complete', 2],
      ['process-complete', 3],
    ],
  );

  for (let id = 1; id <= 3; id += 1) {
    drop(factory, id, 'bottler');
  }

  const first = factory.advance(100);
  assert.deepEqual(
    first.events.map((event) => [event.type, event.potId]),
    [
      ['pot-bottled', 1],
      ['bottling-started', 2],
    ],
  );
  assert.equal(factory.vialsProduced, 20);

  const bottled = factory.advance(200);
  assert.deepEqual(
    bottled.events.map((event) => [event.type, event.potId]),
    [
      ['pot-bottled', 2],
      ['bottling-started', 3],
      ['pot-bottled', 3],
    ],
  );
  assert.equal(factory.vialsProduced, 60);
});

test('takeVials and takeSeconds drain the produced output', () => {
  const factory = makeFactory({ ...FAST_CONFIG, secondsPerVial: 2 });
  takePots(factory, 1);
  finishSingleProcess(factory, 1);
  drop(factory, 1, 'bottler');
  factory.advance(100);

  assert.equal(factory.vialsProduced, 20);
  assert.equal(factory.secondsProduced, 40);
  assert.equal(factory.takeVials(), 20);
  assert.equal(factory.vialsProduced, 0);
  assert.equal(factory.takeBottles(), 0);
  assert.equal(factory.takeSeconds(), 0);
});

test('rejects unknown pots and stations without changing state', () => {
  const factory = makeFactory();
  takePots(factory, 1);

  assert.equal(drop(factory, 99, 'mill').reason, 'unknown-pot');
  assert.equal(drop(factory, 1, 'spa').reason, 'unknown-station');
  assert.equal(factory.pots[0].location, 'intake');
});

test('advance ignores non-positive or invalid deltas', () => {
  const factory = makeFactory();
  takePots(factory, 1);
  drop(factory, 1, 'mill');

  for (const delta of [0, -5, Number.NaN, Infinity]) {
    const tick = factory.advance(delta);
    assert.equal(tick.type, 'tick');
    assert.equal(tick.events.length, 0);
    assert.equal(factory.pots[0].progressMs, 0);
  }
});

test('is deterministic for the same action sequence', () => {
  function run() {
    const factory = makeFactory(FAST_CONFIG);
    takePots(factory, 2);
    drop(factory, 1, 'mill');
    drop(factory, 2, 'mill');
    factory.advance(100);
    drop(factory, 1, 'bottler');
    factory.advance(100);
    return factory;
  }

  const a = run();
  const b = run();

  assert.deepEqual(a.pots, b.pots);
  assert.deepEqual(a.occupancy, b.occupancy);
  assert.equal(a.vialsProduced, b.vialsProduced);
  assert.equal(a.elapsedMs, b.elapsedMs);
});

test('validates stations, processes, capacities, and timings', () => {
  assert.throws(
    () => makeFactory({ stations: [] }),
    /stations must contain at least one station/,
  );
  assert.throws(
    () => makeFactory({ processes: [] }),
    /processes must contain at least one process/,
  );
  assert.throws(
    () =>
      makeFactory({
        processes: [{ ...FAST_PROCESS, stationId: 'nowhere' }],
      }),
    /unknown station/,
  );
  assert.throws(
    () => makeFactory({ stationCapacity: 0 }),
    /stationCapacity must be a positive integer/,
  );
  assert.throws(
    () => makeFactory({ bottlerCapacity: 0 }),
    /bottlerCapacity must be a positive integer/,
  );
  assert.throws(
    () => makeFactory({ processes: [{ ...FAST_PROCESS, durationMs: 0 }] }),
    /positive durationMs/,
  );
  assert.throws(
    () => makeFactory({ processes: [{ ...FAST_PROCESS, windowMs: 0 }] }),
    /positive windowMs/,
  );
});

test('hydrate mirrors an authoritative floor snapshot', () => {
  const factory = makeFactory(FAST_CONFIG);

  factory.hydrate({
    elapsedMs: 4200,
    vialsProduced: 40,
    potsBottled: 2,
    potsSpoiled: 1,
    pots: [
      {
        id: 7,
        stepIndex: 1,
        location: 'mill',
        status: POT_STATUS.WORKING,
        progressMs: 50,
        windowMsLeft: 0,
      },
      {
        id: 9,
        stepIndex: 1,
        location: 'bottler',
        status: POT_STATUS.BOTTLING,
        progressMs: 25,
        windowMsLeft: 0,
      },
      {
        id: 10,
        location: 'exited',
        status: POT_STATUS.DONE,
      },
    ],
  });

  assert.equal(factory.elapsedMs, 4200);
  assert.equal(factory.vialsProduced, 40);
  assert.equal(factory.secondsProduced, 40);
  assert.equal(factory.potsBottled, 2);
  assert.equal(factory.potsSpoiled, 1);
  assert.equal(factory.pots.length, 2);
  assert.equal(factory.getPotsAt('mill')[0].id, 7);
  assert.equal(factory.getPotsAt('bottler')[0].progressMs, 25);

  const next = factory.takePot();
  assert.equal(next.potId, 11);
});
