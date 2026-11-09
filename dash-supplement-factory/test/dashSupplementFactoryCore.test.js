import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BASE_RECIPE,
  DEFAULT_RECIPE,
  DashSupplementFactory,
  PHASES,
} from '../src/dashSupplementFactoryCore.js';

function makeFactory(config = {}) {
  return new DashSupplementFactory({ config });
}

function takePots(factory, count) {
  for (let i = 0; i < count; i += 1) {
    assert.equal(factory.takePot().type, 'pot-taken');
  }
}

function addIngredient(factory, id) {
  const event = factory.addIngredient(id);
  assert.ok(
    event.type === 'batch-started' || event.type === 'ingredient-added',
    `expected ${id} to be accepted, got ${event.type}:${event.reason ?? ''}`,
  );
  return event;
}

function holdFor(factory, stepId, ms) {
  const started = factory.beginHold(stepId);
  assert.equal(started.type, 'hold-started');
  return factory.advanceHold(ms);
}

function finishRecipe(factory) {
  addIngredient(factory, 'vodka');
  addIngredient(factory, 'beet-extract');
  holdFor(factory, 'stir', 1800);
  addIngredient(factory, 'national-spirit');
  holdFor(factory, 'heat', 2200);
  holdFor(factory, 'filter', 1400);
  assert.equal(factory.phase, PHASES.MOVING);
}

function moveAllPots(factory) {
  while (factory.pots.some((pot) => pot.location === 'main')) {
    assert.equal(factory.moveNextPot().type, 'pot-moved');
  }
}

function bottleAllPots(factory) {
  while (factory.phase === PHASES.BOTTLING) {
    const event = factory.bottleNextPot();
    assert.ok(event.type === 'bottled' || event.type === 'batch-complete');
  }
}

test('starts empty and collecting', () => {
  const factory = makeFactory();

  assert.equal(factory.phase, PHASES.COLLECTING);
  assert.equal(factory.batchSize, 0);
  assert.equal(factory.canTakePot, true);
  assert.equal(factory.canStartBatch, false);
  assert.equal(factory.nextAction, 'take-pots');
  assert.deepEqual(factory.pots, []);
});

test('takes up to five pots and rejects a sixth', () => {
  const factory = makeFactory();
  takePots(factory, 5);

  assert.equal(factory.batchSize, 5);
  assert.deepEqual(
    factory.pots.map((pot) => pot.id),
    [1, 2, 3, 4, 5],
  );
  assert.equal(factory.canTakePot, false);

  const rejected = factory.takePot();
  assert.equal(rejected.type, 'rejected');
  assert.equal(rejected.reason, 'batch-full');
  assert.equal(factory.phase, PHASES.COLLECTING);
  assert.equal(factory.batchSize, 5);
});

test('adding vodka without pots is rejected', () => {
  const factory = makeFactory();
  const result = factory.addIngredient('vodka');

  assert.equal(result.type, 'rejected');
  assert.equal(result.reason, 'no-pots');
  assert.equal(factory.phase, PHASES.COLLECTING);
});

test('stray factory actions before any pot is taken are rejected, not failed', () => {
  const factory = makeFactory();

  for (const result of [
    factory.movePot(1),
    factory.moveNextPot(),
    factory.bottleNextPot(),
    factory.beginHold('stir'),
  ]) {
    assert.equal(result.type, 'rejected');
    assert.equal(result.reason, 'no-pots');
  }

  assert.equal(factory.phase, PHASES.COLLECTING);
  assert.equal(factory.batchesFailed, 0);
  assert.equal(factory.lastBatch, null);
});

test('adding vodka starts the batch and moves to beet extract', () => {
  const factory = makeFactory();
  takePots(factory, 3);

  const event = factory.addIngredient('vodka');
  assert.equal(event.type, 'batch-started');
  assert.equal(event.batchSize, 3);
  assert.equal(factory.phase, PHASES.PROCESSING);
  assert.equal(factory.currentStep.id, 'beet-extract');
  assert.equal(factory.nextAction, 'beet-extract');
  assert.equal(factory.canTakePot, false);
});

test('the default recipe reaches the moving phase', () => {
  const factory = makeFactory();
  takePots(factory, 4);
  finishRecipe(factory);

  assert.equal(factory.phase, PHASES.MOVING);
  assert.equal(factory.nextAction, 'move-pots');
  assert.deepEqual(
    factory.pots.map((pot) => pot.location),
    ['main', 'main', 'main', 'main'],
  );
});

test('hold progress is reported and completes the step', () => {
  const factory = makeFactory();
  takePots(factory, 1);
  addIngredient(factory, 'vodka');
  addIngredient(factory, 'beet-extract');

  assert.equal(factory.beginHold('stir').type, 'hold-started');
  const half = factory.advanceHold(900);
  assert.equal(half.type, 'hold-progress');
  assert.equal(half.progress, 0.5);
  assert.equal(factory.holdProgress, 0.5);

  const done = factory.advanceHold(900);
  assert.equal(done.type, 'hold-completed');
  assert.equal(done.stepId, 'stir');
  assert.equal(factory.currentStep.id, 'national-spirit');
  assert.equal(factory.hold, null);
});

test('releasing a hold early fails and wastes the whole batch', () => {
  const factory = makeFactory();
  takePots(factory, 3);
  addIngredient(factory, 'vodka');
  addIngredient(factory, 'beet-extract');
  factory.beginHold('stir');
  factory.advanceHold(500);

  const failed = factory.releaseHold();
  assert.equal(failed.type, 'batch-failed');
  assert.equal(failed.reason, 'released-early');
  assert.equal(factory.phase, PHASES.FAILED);
  assert.equal(factory.failureReason, 'released-early');
  assert.equal(factory.batchBottles, 0);
  assert.equal(factory.batchesFailed, 1);
  assert.ok(factory.pots.every((pot) => pot.wasted && pot.location === 'wasted'));
  assert.equal(factory.lastBatch.failed, true);
  assert.equal(factory.lastBatch.bottles, 0);
});

test('a wrong ingredient fails the batch', () => {
  const factory = makeFactory();
  takePots(factory, 2);
  addIngredient(factory, 'vodka');

  const failed = factory.addIngredient('national-spirit');
  assert.equal(failed.type, 'batch-failed');
  assert.equal(failed.reason, 'wrong-order');
  assert.equal(factory.phase, PHASES.FAILED);
});

test('a wrong hold fails the batch', () => {
  const factory = makeFactory();
  takePots(factory, 2);
  addIngredient(factory, 'vodka');
  addIngredient(factory, 'beet-extract');

  const failed = factory.beginHold('heat');
  assert.equal(failed.type, 'batch-failed');
  assert.equal(failed.reason, 'wrong-order');
  assert.equal(factory.phase, PHASES.FAILED);
});

test('adding an ingredient during a hold fails the batch', () => {
  const factory = makeFactory();
  takePots(factory, 1);
  addIngredient(factory, 'vodka');
  addIngredient(factory, 'beet-extract');
  factory.beginHold('stir');
  factory.advanceHold(200);

  const failed = factory.addIngredient('national-spirit');
  assert.equal(failed.type, 'batch-failed');
  assert.equal(failed.reason, 'wrong-order');
});

test('unknown ingredient and hold ids are rejected without failing', () => {
  const factory = makeFactory();
  takePots(factory, 1);

  const unknownIngredient = factory.addIngredient('unobtainium');
  assert.equal(unknownIngredient.type, 'rejected');
  assert.equal(unknownIngredient.reason, 'unknown-ingredient');
  assert.equal(factory.phase, PHASES.COLLECTING);

  addIngredient(factory, 'vodka');
  addIngredient(factory, 'beet-extract');
  const unknownHold = factory.beginHold('unobtainium');
  assert.equal(unknownHold.type, 'rejected');
  assert.equal(unknownHold.reason, 'unknown-hold');
  assert.equal(factory.phase, PHASES.PROCESSING);
});

test('non-positive hold deltas are ignored', () => {
  const factory = makeFactory();
  takePots(factory, 1);
  addIngredient(factory, 'vodka');
  addIngredient(factory, 'beet-extract');
  factory.beginHold('stir');

  assert.equal(factory.advanceHold(0).type, 'noop');
  assert.equal(factory.advanceHold(-50).type, 'noop');
  assert.equal(factory.holdProgress, 0);
});

test('releasing after a completed hold is a no-op', () => {
  const factory = makeFactory();
  takePots(factory, 1);
  addIngredient(factory, 'vodka');
  addIngredient(factory, 'beet-extract');
  factory.beginHold('stir');

  assert.equal(factory.advanceHold(1800).type, 'hold-completed');
  assert.equal(factory.releaseHold().type, 'noop');
  assert.equal(factory.phase, PHASES.PROCESSING);
});

test('moves pots independently and starts bottling when all arrive', () => {
  const factory = makeFactory();
  takePots(factory, 3);
  finishRecipe(factory);

  const first = factory.movePot(3);
  assert.equal(first.type, 'pot-moved');
  assert.equal(first.remaining, 2);
  assert.equal(factory.phase, PHASES.MOVING);

  const second = factory.movePot(1);
  assert.equal(second.remaining, 1);
  assert.equal(factory.phase, PHASES.MOVING);

  const third = factory.movePot(2);
  assert.equal(third.remaining, 0);
  assert.equal(factory.phase, PHASES.BOTTLING);
  assert.equal(factory.nextAction, 'bottle');
});

test('unknown pot ids are rejected while moving', () => {
  const factory = makeFactory();
  takePots(factory, 2);
  finishRecipe(factory);

  const result = factory.movePot(99);
  assert.equal(result.type, 'rejected');
  assert.equal(result.reason, 'unknown-pot');
  assert.equal(factory.phase, PHASES.MOVING);
});

test('five pots bottle into one hundred seconds', () => {
  const factory = makeFactory();
  takePots(factory, 5);
  finishRecipe(factory);
  moveAllPots(factory);
  assert.equal(factory.phase, PHASES.BOTTLING);

  for (let i = 1; i <= 4; i += 1) {
    const event = factory.bottleNextPot();
    assert.equal(event.type, 'bottled');
    assert.equal(event.bottles, 20);
    assert.equal(event.batchBottles, i * 20);
    assert.equal(event.complete, false);
    assert.equal(factory.bottlesProduced, 0);
  }

  const complete = factory.bottleNextPot();
  assert.equal(complete.type, 'batch-complete');
  assert.equal(complete.bottles, 100);
  assert.equal(complete.seconds, 100);
  assert.equal(complete.phase, PHASES.COMPLETE);
  assert.equal(factory.bottlesProduced, 100);
  assert.equal(factory.secondsProduced, 100);
  assert.equal(factory.batchesCompleted, 1);
  assert.deepEqual(factory.lastBatch, {
    pots: 5,
    bottles: 100,
    seconds: 100,
    failed: false,
    reason: null,
  });
  assert.ok(factory.pots.every((pot) => pot.bottled && pot.location === 'bottled'));
});

test('the base recipe also produces one hundred seconds for five pots', () => {
  const factory = makeFactory({ recipe: BASE_RECIPE });
  takePots(factory, 5);

  addIngredient(factory, 'vodka');
  holdFor(factory, 'stir', 1800);
  addIngredient(factory, 'national-spirit');
  holdFor(factory, 'heat', 2200);

  assert.equal(factory.phase, PHASES.MOVING);
  moveAllPots(factory);
  bottleAllPots(factory);

  assert.equal(factory.bottlesProduced, 100);
  assert.equal(factory.secondsProduced, 100);
});

test('failure after partial bottling discards the pending bottles', () => {
  const factory = makeFactory();
  takePots(factory, 2);
  finishRecipe(factory);
  moveAllPots(factory);

  const first = factory.bottleNextPot();
  assert.equal(first.type, 'bottled');
  assert.equal(factory.batchBottles, 20);
  assert.equal(factory.bottlesProduced, 0);

  const failed = factory.addIngredient('vodka');
  assert.equal(failed.type, 'batch-failed');
  assert.equal(failed.reason, 'wrong-order');
  assert.equal(factory.batchBottles, 0);
  assert.equal(factory.bottlesProduced, 0);
  assert.equal(factory.lastBatch.failed, true);
  assert.equal(factory.lastBatch.bottles, 0);
  assert.ok(factory.pots.every((pot) => pot.wasted));
});

test('moving before heating fails the batch', () => {
  const factory = makeFactory();
  takePots(factory, 1);
  addIngredient(factory, 'vodka');
  addIngredient(factory, 'beet-extract');

  const failed = factory.moveNextPot();
  assert.equal(failed.type, 'batch-failed');
  assert.equal(failed.reason, 'wrong-order');
});

test('bottling before moving all pots fails the batch', () => {
  const factory = makeFactory();
  takePots(factory, 2);
  finishRecipe(factory);

  const failed = factory.bottleNextPot();
  assert.equal(failed.type, 'batch-failed');
  assert.equal(failed.reason, 'wrong-order');
});

test('a failed batch must be destroyed before starting again', () => {
  const factory = makeFactory();
  takePots(factory, 1);
  addIngredient(factory, 'vodka');

  assert.equal(factory.addIngredient('national-spirit').type, 'batch-failed');
  assert.equal(factory.takePot().reason, 'destroy-required');
  assert.equal(factory.startBatch().reason, 'destroy-required');
  assert.equal(factory.newBatch().reason, 'destroy-required');

  const destroyed = factory.destroyBatch();
  assert.equal(destroyed.type, 'batch-destroyed');
  assert.equal(factory.phase, PHASES.COLLECTING);
  assert.deepEqual(factory.pots, []);
  assert.equal(factory.failureReason, null);
  assert.equal(factory.batchesFailed, 1);
  assert.equal(factory.takePot().type, 'pot-taken');
});

test('taking a pot after a completed batch starts a new batch', () => {
  const factory = makeFactory();
  takePots(factory, 1);
  finishRecipe(factory);
  moveAllPots(factory);
  factory.bottleNextPot();

  assert.equal(factory.phase, PHASES.COMPLETE);
  assert.equal(factory.bottlesProduced, 20);

  const next = factory.takePot();
  assert.equal(next.type, 'pot-taken');
  assert.equal(next.batchSize, 1);
  assert.equal(factory.phase, PHASES.COLLECTING);
  assert.equal(factory.bottlesProduced, 20);
  assert.equal(factory.batchesCompleted, 1);
});

test('newBatch returns to collecting without losing output', () => {
  const factory = makeFactory();
  takePots(factory, 2);
  finishRecipe(factory);
  moveAllPots(factory);
  bottleAllPots(factory);

  assert.equal(factory.newBatch().type, 'new-batch');
  assert.equal(factory.phase, PHASES.COLLECTING);
  assert.equal(factory.batchSize, 0);
  assert.equal(factory.bottlesProduced, 40);
});

test('takeBottles and takeSeconds clear the produced output', () => {
  const factory = makeFactory();
  takePots(factory, 2);
  finishRecipe(factory);
  moveAllPots(factory);
  bottleAllPots(factory);

  assert.equal(factory.takeBottles(), 40);
  assert.equal(factory.bottlesProduced, 0);
  assert.equal(factory.takeSeconds(), 0);

  factory.newBatch();
  takePots(factory, 1);
  finishRecipe(factory);
  moveAllPots(factory);
  bottleAllPots(factory);

  assert.equal(factory.takeSeconds(), 20);
  assert.equal(factory.bottlesProduced, 0);
});

test('supports a recipe that starts with a hold via startBatch', () => {
  const factory = makeFactory({
    recipe: [{ id: 'stir', type: 'hold', durationMs: 100 }],
  });
  takePots(factory, 1);

  assert.equal(factory.startBatch().type, 'batch-started');
  assert.equal(factory.currentStep.id, 'stir');
  assert.equal(factory.beginHold('stir').type, 'hold-started');
  assert.equal(factory.advanceHold(100).type, 'hold-completed');
  assert.equal(factory.phase, PHASES.MOVING);
});

test('validates configuration', () => {
  assert.throws(() => makeFactory({ maxPotsPerBatch: 0 }), /maxPotsPerBatch/);
  assert.throws(() => makeFactory({ bottlesPerPot: 0 }), /bottlesPerPot/);
  assert.throws(() => makeFactory({ secondsPerBottle: 0 }), /secondsPerBottle/);
  assert.throws(() => makeFactory({ recipe: [] }), /recipe/);
  assert.throws(
    () => makeFactory({ recipe: [{ id: 'x', type: 'hold', durationMs: 0 }] }),
    /durationMs/,
  );
  assert.throws(
    () =>
      makeFactory({
        recipe: [
          { id: 'x', type: 'add' },
          { id: 'x', type: 'add' },
        ],
      }),
    /duplicate/,
  );
});

test('the default recipe is longer than the base recipe', () => {
  assert.ok(DEFAULT_RECIPE.length > BASE_RECIPE.length);
});
