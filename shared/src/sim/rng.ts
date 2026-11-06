export function createRngState(seed: number): number {
  return seed >>> 0;
}

/** Mulberry32 step. Returns the next state and a value in [0, 1). */
export function nextRandom(state: number): { state: number; value: number } {
  const nextState = (state + 0x6d2b79f5) >>> 0;
  let value = nextState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return {
    state: nextState,
    value: ((value ^ (value >>> 14)) >>> 0) / 4294967296,
  };
}
