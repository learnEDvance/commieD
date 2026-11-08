import assert from 'node:assert/strict';
import test from 'node:test';
import { BulletPress, createRng, DEFAULT_CONFIG } from '../src/bulletPressCore.js';

function close(actual, expected) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `expected ${actual} to be close to ${expected}`,
  );
}

function makeCore(config = {}) {
  return new BulletPress({
    rng: () => 0,
    config: { charset: 'A', sequenceLength: 10, ...config },
  });
}

test('generates the same sequence from the same seed', () => {
  const a = new BulletPress({ seed: 42 });
  const b = new BulletPress({ seed: 42 });

  assert.deepEqual(a.sequence, b.sequence);
  assert.equal(a.sequence.length, DEFAULT_CONFIG.sequenceLength);
  for (const char of a.sequence) {
    assert.ok(DEFAULT_CONFIG.charset.includes(char));
  }
});

test('uses the injected rng for the sequence', () => {
  const values = [0, 0.99, 0];
  const core = new BulletPress({
    rng: () => values.shift(),
    config: { charset: 'AB', sequenceLength: 3 },
  });

  assert.deepEqual(core.sequence, ['A', 'B', 'A']);
});

test('loads a perfect magazine and raises the multiplier', () => {
  const core = makeCore();

  for (let i = 0; i < 4; i += 1) {
    const event = core.press('A');
    assert.equal(event.type, 'correct');
    assert.equal(event.magazineCompleted, null);
  }

  assert.equal(core.filled, 4);

  const event = core.press('A');
  assert.equal(event.type, 'correct');
  assert.equal(event.magazineCompleted, 'perfect');
  assert.equal(core.filled, 0);
  close(core.production, 1);
  close(core.multiplier, 1.1);
  assert.equal(core.magazinesProduced, 1);
});

test('marks the magazine broken and lowers the multiplier on a wrong key', () => {
  const core = makeCore();

  core.press('A');
  const event = core.press('B');

  assert.equal(event.type, 'wrong');
  assert.equal(core.filled, 1);
  assert.equal(core.magazine.broken, true);
  assert.equal(core.brokenMagazines, 0);
  close(core.multiplier, 0.9);
});

test('does not discard a broken magazine immediately', () => {
  const core = makeCore();

  core.press('A');
  core.press('B');

  assert.equal(core.filled, 1);
  assert.equal(core.magazine.broken, true);
  assert.equal(core.brokenMagazines, 0);

  for (let i = 0; i < 4; i += 1) {
    core.press('A');
  }

  assert.equal(core.brokenMagazines, 1);
  assert.equal(core.filled, 0);
  assert.equal(core.magazine.broken, false);
  close(core.production, 0);
  assert.equal(core.magazinesProduced, 0);
});

test('discards a partial broken magazine when the run ends', () => {
  const core = makeCore();

  for (let i = 0; i < 7; i += 1) {
    core.press('A');
  }

  core.press('B');
  core.press('A');
  const event = core.press('A');

  assert.equal(event.runComplete, true);
  assert.equal(event.discardedBroken, 1);
  assert.equal(core.brokenMagazines, 1);
  assert.equal(core.filled, 0);
  assert.equal(core.magazine.broken, false);
  close(core.production, 1);
});

test('carries a clean partial magazine into the next run', () => {
  const core = makeCore({ sequenceLength: 7 });

  for (let i = 0; i < 7; i += 1) {
    core.press('A');
  }

  assert.equal(core.runComplete, true);
  assert.equal(core.filled, 2);
  assert.equal(core.magazine.broken, false);

  core.nextRun();

  assert.equal(core.filled, 2);
  assert.equal(core.magazine.broken, false);
});

test('only starts a new run after the current one is complete', () => {
  const core = makeCore();

  assert.equal(core.nextRun(), null);

  for (let i = 0; i < 10; i += 1) {
    core.press('A');
  }

  assert.equal(core.runComplete, true);
  assert.equal(core.typed.length, 10);

  const sequence = core.nextRun();

  assert.equal(sequence.length, 10);
  assert.equal(core.runComplete, false);
  assert.equal(core.index, 0);
  assert.deepEqual(core.typed, []);
});

test('ignores input while waiting for the next run', () => {
  const core = makeCore();

  for (let i = 0; i < 10; i += 1) {
    core.press('A');
  }

  const production = core.production;
  const multiplier = core.multiplier;
  const event = core.press('B');

  assert.equal(event.type, 'ignored');
  assert.equal(core.production, production);
  assert.equal(core.multiplier, multiplier);
});

test('keeps the multiplier at the 0.5x floor', () => {
  const core = makeCore({ sequenceLength: 5 });

  for (let i = 0; i < 5; i += 1) {
    core.press('B');
  }

  close(core.multiplier, 0.5);

  core.nextRun();

  for (let i = 0; i < 5; i += 1) {
    core.press('B');
  }

  close(core.multiplier, 0.5);
});

test('caps the multiplier at 5x and scales production', () => {
  const core = makeCore({
    sequenceLength: 5,
    startingMultiplier: 4.95,
    multiplierStepUp: 0.1,
  });

  for (let i = 0; i < 5; i += 1) {
    core.press('A');
  }

  close(core.multiplier, 5);
  close(core.production, 4.95);
  assert.equal(core.magazinesProduced, 4);

  core.nextRun();

  for (let i = 0; i < 5; i += 1) {
    core.press('A');
  }

  close(core.production, 9.95);
  close(core.multiplier, 5);
  assert.equal(core.magazinesProduced, 9);
});

test('takes only whole magazines', () => {
  const core = makeCore({ sequenceLength: 5 });

  for (let i = 0; i < 5; i += 1) {
    core.press('A');
  }

  assert.equal(core.takeMagazines(), 1);
  close(core.production, 0);
  assert.equal(core.magazinesProduced, 0);
  assert.equal(core.takeMagazines(), 0);
});

test('accepts lowercase input', () => {
  const core = makeCore();

  const event = core.press('a');

  assert.equal(event.type, 'correct');
});

test('advances the sequence on a wrong key without adding a bullet', () => {
  const core = makeCore();

  core.press('A');
  const event = core.press('B');

  assert.equal(event.expected, 'A');
  assert.equal(core.index, 2);
  assert.equal(core.expectedChar, 'A');
  assert.equal(core.filled, 1);
});

test('counts an empty broken magazine when the run ends', () => {
  const core = makeCore({ sequenceLength: 1 });

  const event = core.press('B');

  assert.equal(event.runComplete, true);
  assert.equal(event.discardedBroken, 1);
  assert.equal(core.brokenMagazines, 1);
  assert.equal(core.filled, 0);
});

test('rejects invalid configuration', () => {
  assert.throws(() => new BulletPress({ config: { sequenceLength: 0 } }), RangeError);
  assert.throws(() => new BulletPress({ config: { bulletsPerMagazine: 0 } }), RangeError);
  assert.throws(() => new BulletPress({ config: { charset: '' } }), RangeError);
});

test('createRng is deterministic', () => {
  const a = createRng(123);
  const b = createRng(123);

  for (let i = 0; i < 32; i += 1) {
    assert.equal(a(), b());
  }
});
