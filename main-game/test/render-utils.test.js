import test from 'node:test';
import assert from 'node:assert/strict';

import { bulletTrailVector } from '../src/render-utils.js';

test('bullet trail has a consistent length for horizontal, vertical, and diagonal shots', () => {
  for (const [vx, vy] of [[4, 0], [0, -7], [3, 4]]) {
    const trail = bulletTrailVector(vx, vy);
    assert.ok(Math.abs(Math.hypot(trail.x, trail.y) - 10) < 1e-9);
  }
});

test('zero speed produces a finite zero-length trail', () => {
  assert.deepEqual(bulletTrailVector(0, 0), { x: 0, y: 0 });
});
