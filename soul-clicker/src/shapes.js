export const SHAPE_TYPES = ['circle', 'square', 'triangle', 'diamond', 'star'];

export function randomBetween(min, max, random = Math.random) {
  return min + random() * (max - min);
}

export function randomShapePlan(
  random = Math.random,
  {
    minDelayMs = 10_000,
    maxDelayMs = 30_000,
    minLifetimeMs = 3_500,
    maxLifetimeMs = 5_000,
  } = {},
) {
  const type = SHAPE_TYPES[Math.floor(random() * SHAPE_TYPES.length)];

  return {
    type,
    leftPercent: randomBetween(5, 90, random),
    topPercent: randomBetween(12, 85, random),
    sizePx: randomBetween(48, 96, random),
    delayMs: randomBetween(minDelayMs, maxDelayMs, random),
    lifetimeMs: randomBetween(minLifetimeMs, maxLifetimeMs, random),
  };
}
