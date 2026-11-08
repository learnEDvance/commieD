import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBetween, randomShapePlan, SHAPE_TYPES } from '../src/shapes.js';

test('randomBetween stays within its bounds', () => {
  assert.equal(randomBetween(10, 20, () => 0), 10);
  assert.equal(randomBetween(10, 20, () => 0.5), 15);
  assert.equal(randomBetween(10, 20, () => 1), 20);
});

test('randomShapePlan returns a valid shape and safe placement', () => {
  let value = 0;
  const random = () => {
    value = (value + 0.13) % 1;
    return value;
  };

  for (let i = 0; i < 50; i += 1) {
    const plan = randomShapePlan(random, {
      minDelayMs: 1_000,
      maxDelayMs: 2_000,
      minLifetimeMs: 3_000,
      maxLifetimeMs: 4_000,
    });

    assert.ok(SHAPE_TYPES.includes(plan.type));
    assert.ok(plan.leftPercent >= 5 && plan.leftPercent <= 90);
    assert.ok(plan.topPercent >= 12 && plan.topPercent <= 85);
    assert.ok(plan.sizePx >= 48 && plan.sizePx <= 96);
    assert.ok(plan.delayMs >= 1_000 && plan.delayMs <= 2_000);
    assert.ok(plan.lifetimeMs >= 3_000 && plan.lifetimeMs <= 4_000);
  }
});
