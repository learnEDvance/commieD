import assert from 'node:assert/strict';
import test from 'node:test';
import { BulletPress, createRng, DEFAULT_CONFIG } from '../src/bulletPressCore.js';

function makeCore(config = {}) {
  return new BulletPress({
    rng: () => 0,
    config: { charset: 'A', sequenceLength: 5, ...config },
  });
}

function fill(core, char, startMs, stepMs) {
  let event = null;

  for (let i = 0; i < core.config.sequenceLength; i += 1) {
    event = core.press(char, startMs + i * stepMs);
  }

  return event;
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

test('uses 10 letters only by default', () => {
  assert.equal(DEFAULT_CONFIG.sequenceLength, 10);
  assert.equal(DEFAULT_CONFIG.charset, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  assert.ok(!/[0-9]/.test(DEFAULT_CONFIG.charset));

  const core = new BulletPress({ seed: 7 });
  assert.equal(core.sequence.length, 10);
  for (const char of core.sequence) {
    assert.match(char, /^[A-Z]$/);
  }
});

test('a default magazine fills after 10 keys', () => {
  const core = new BulletPress({ rng: () => 0 });
  core.start(0);

  let event = null;
  for (let i = 0; i < 10; i += 1) {
    event = core.press('A', 500 + i * 500);
  }

  assert.equal(event.complete, true);
  assert.equal(core.filled, 10);
  assert.equal(event.multiplier, 5);
  assert.equal(core.production, 5);
});

test('ignores digits and punctuation without breaking the magazine', () => {
  const core = makeCore();
  core.start(0);

  for (const input of ['1', '0', '-', '!']) {
    const event = core.press(input, 100);
    assert.equal(event.type, 'ignored');
    assert.equal(event.reason, 'invalid-character');
  }

  assert.equal(core.filled, 0);
  assert.equal(core.brokenMagazine, false);
});

test('uses the injected rng for the sequence', () => {
  const values = [0, 0.99, 0];
  const core = new BulletPress({
    rng: () => values.shift(),
    config: { charset: 'AB', sequenceLength: 3 },
  });

  assert.deepEqual(core.sequence, ['A', 'B', 'A']);
});

test('starts a magazine timer once', () => {
  const core = makeCore();

  assert.equal(core.start(1_000), true);
  assert.equal(core.start(2_000), false);
  assert.equal(core.startedAtMs, 1_000);
});

test('starts the timer on the first valid key without a dock timer', () => {
  const core = makeCore();

  const event = core.press('A', 500);

  assert.equal(event.type, 'correct');
  assert.equal(core.startedAtMs, 500);
  assert.equal(core.filled, 1);
});

test('correct keys fill green slots in order', () => {
  const core = makeCore();
  core.start(0);

  const first = core.press('a', 100);
  assert.equal(first.type, 'correct');
  assert.equal(first.slotIndex, 0);
  assert.equal(first.complete, false);
  assert.deepEqual(core.slots[0], { char: 'A', expected: 'A', correct: true });

  const second = core.press('A', 200);
  assert.equal(second.slotIndex, 1);
  assert.equal(core.filled, 2);
  assert.equal(core.expectedChar, 'A');
});

test('a wrong key fills a red slot, breaks the magazine, and still advances', () => {
  const core = makeCore();
  core.start(0);

  core.press('A', 100);
  const event = core.press('B', 200);

  assert.equal(event.type, 'wrong');
  assert.equal(event.correct, false);
  assert.equal(event.slotIndex, 1);
  assert.equal(core.slots[1].correct, false);
  assert.equal(core.slots[1].char, 'B');
  assert.equal(core.brokenMagazine, true);
  assert.equal(core.index, 2);
});

test('a perfect magazine awards a whole speed multiplier', () => {
  const core = makeCore();
  core.start(0);

  const event = fill(core, 'A', 400, 400);

  assert.equal(event.complete, true);
  assert.equal(event.broken, false);
  assert.equal(event.durationMs, 2_000);
  assert.equal(event.multiplier, 5);
  assert.equal(core.production, 5);
  assert.equal(core.magazinesProduced, 5);
  assert.equal(core.brokenMagazines, 0);
});

test('slower magazines award lower whole multipliers', () => {
  const cases = [
    { durationMs: 1_500, multiplier: 5 },
    { durationMs: 2_500, multiplier: 5 },
    { durationMs: 3_500, multiplier: 4 },
    { durationMs: 5_000, multiplier: 2 },
    { durationMs: 7_000, multiplier: 1 },
  ];

  for (const { durationMs, multiplier } of cases) {
    const core = makeCore();
    core.start(0);

    const event = fill(core, 'A', durationMs, 0);

    assert.equal(event.multiplier, multiplier, `duration ${durationMs}`);
    assert.ok(Number.isInteger(event.multiplier), 'multiplier must be whole');
    assert.equal(core.production, multiplier);
  }
});

test('multiplier uses the average time across the magazine', () => {
  const core = makeCore();
  core.start(1_000);

  // 2.5 seconds total for 5 keys = 500ms average -> 5x.
  const event = fill(core, 'A', 1_000, 625);

  assert.equal(event.durationMs, 2_500);
  assert.equal(event.multiplier, 5);
});

test('a broken magazine produces nothing and increments the broken count', () => {
  const core = makeCore();
  core.start(0);

  core.press('B', 100);
  let event = null;
  for (let i = 0; i < core.config.sequenceLength - 1; i += 1) {
    event = core.press('A', 200 + i * 100);
  }

  assert.equal(event.complete, true);
  assert.equal(event.broken, true);
  assert.equal(event.multiplier, 0);
  assert.equal(core.production, 0);
  assert.equal(core.magazinesProduced, 0);
  assert.equal(core.brokenMagazines, 1);
  assert.equal(core.slots[0].correct, false);
  assert.equal(core.slots[4].correct, true);
});

test('does not start the next magazine before the current one completes', () => {
  const core = makeCore();
  core.start(0);
  core.press('A', 100);

  assert.equal(core.nextMagazine(), null);
  assert.equal(core.complete, false);
});

test('nextMagazine resets the magazine but keeps production', () => {
  const core = makeCore();
  core.start(0);
  fill(core, 'A', 100, 100);

  assert.equal(core.production, 5);
  assert.equal(core.complete, true);
  assert.equal(core.filled, 5);

  const sequence = core.nextMagazine(2_000);

  assert.equal(sequence.length, 5);
  assert.equal(core.complete, false);
  assert.equal(core.filled, 0);
  assert.deepEqual(core.slots, []);
  assert.equal(core.index, 0);
  assert.equal(core.startedAtMs, null);
  assert.equal(core.production, 5);
});

test('nextMagazine waits for the first keypress to start its timer', () => {
  const core = makeCore();
  core.start(0);
  fill(core, 'A', 100, 100);

  core.nextMagazine();

  assert.equal(core.startedAtMs, null);
  assert.equal(core.startedAtMs, null);
  assert.equal(core.press('A', 1_100).type, 'correct');
  assert.equal(core.startedAtMs, 1_100);
});

test('Q pause freezes a started timer and ignores keys until resumed', () => {
  const core = makeCore();
  core.press('A', 100);
  assert.equal(core.pause(600), true);
  assert.equal(core.elapsed(5_000), 500);
  assert.equal(core.press('A', 5_000).reason, 'paused');
  assert.equal(core.resume(5_000), true);
  assert.equal(core.press('A', 5_100).type, 'correct');
  assert.equal(core.elapsed(5_100), 600);
});

test('ignores input once the magazine is complete', () => {
  const core = makeCore();
  core.start(0);
  fill(core, 'A', 100, 100);

  const event = core.press('B', 700);

  assert.equal(event.type, 'ignored');
  assert.equal(core.filled, 5);
  assert.equal(core.production, 5);
});

test('takeMagazines returns whole magazines and empties production', () => {
  const core = makeCore();
  core.start(0);
  fill(core, 'A', 100, 100);

  assert.equal(core.takeMagazines(), 5);
  assert.equal(core.production, 0);
  assert.equal(core.takeMagazines(), 0);
});

test('accepts lowercase input', () => {
  const core = makeCore();
  core.start(0);

  const event = core.press('a', 100);

  assert.equal(event.type, 'correct');
  assert.equal(event.char, 'A');
});

test('rejects invalid configuration', () => {
  assert.throws(() => new BulletPress({ config: { sequenceLength: 0 } }), RangeError);
  assert.throws(() => new BulletPress({ config: { charset: '' } }), RangeError);
  assert.throws(() => new BulletPress({ config: { maxMultiplier: 0 } }), RangeError);
  assert.throws(() => new BulletPress({ config: { speedSteps: [] } }), RangeError);
});

test('createRng is deterministic', () => {
  const a = createRng(123);
  const b = createRng(123);

  for (let i = 0; i < 32; i += 1) {
    assert.equal(a(), b());
  }
});
