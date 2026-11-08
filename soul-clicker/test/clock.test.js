import assert from 'node:assert/strict';
import test from 'node:test';
import { GameClock } from '../src/clock.js';

test('advances with real time', () => {
  let now = 1_000;
  const clock = new GameClock(() => now);

  assert.equal(clock.now(), 1_000);

  now = 1_500;
  assert.equal(clock.now(), 1_500);
});

test('freezes while paused and resumes without jumping', () => {
  let now = 1_000;
  const clock = new GameClock(() => now);

  now = 2_000;
  assert.equal(clock.now(), 2_000);
  assert.equal(clock.pause(), true);

  now = 9_000;
  assert.equal(clock.now(), 2_000);

  assert.equal(clock.toggle(), true);
  assert.equal(clock.now(), 2_000);

  now = 9_500;
  assert.equal(clock.now(), 2_500);
});

test('accumulates multiple pauses', () => {
  let now = 0;
  const clock = new GameClock(() => now);

  now = 100;
  clock.pause();
  now = 600;
  clock.resume();
  assert.equal(clock.now(), 100);

  now = 800;
  clock.pause();
  now = 1_300;
  clock.resume();
  assert.equal(clock.now(), 300);
});

test('rejects duplicate state changes', () => {
  let now = 0;
  const clock = new GameClock(() => now);

  assert.equal(clock.resume(), false);
  assert.equal(clock.pause(), true);
  assert.equal(clock.pause(), false);
  assert.equal(clock.paused, true);
});
