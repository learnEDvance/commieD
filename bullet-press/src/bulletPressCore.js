export const DEFAULT_CONFIG = Object.freeze({
  sequenceLength: 10,
  charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  maxMultiplier: 5,
  // Average time per key for each whole-number multiplier. Slower than the
  // last entry earns the default 1x.
  speedSteps: Object.freeze([
    { maxAverageMs: 300, multiplier: 10 },
    { maxAverageMs: 500, multiplier: 5 },
    { maxAverageMs: 700, multiplier: 4 },
    { maxAverageMs: 900, multiplier: 3 },
    { maxAverageMs: 1000, multiplier: 2 },
  ]),
});

/** Small deterministic RNG so a sequence can be replayed from a seed. */
export function createRng(seed) {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pure Bullet Press rules. The browser owns rendering, key events, and animations.
 *
 * One sequence fills one magazine. Correct keys load green bullets; a wrong key
 * still fills a slot, but turns it red and breaks that magazine. Once every slot
 * is filled, the completed magazine is ejected and `nextMagazine()` can start a
 * fresh one.
 *
 * The production multiplier is a whole number based on how quickly the magazine
 * was completed: faster typing earns 5x, slower typing earns less. A broken
 * magazine produces nothing.
 */
export class BulletPress {
  constructor({ seed = 1, config = {}, rng } = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (this.config.sequenceLength < 1) {
      throw new RangeError('sequenceLength must be at least 1');
    }
    if (this.config.charset.length < 1) {
      throw new RangeError('charset must contain at least one character');
    }
    if (this.config.maxMultiplier < 1) {
      throw new RangeError('maxMultiplier must be at least 1');
    }
    if (!Array.isArray(this.config.speedSteps) || this.config.speedSteps.length < 1) {
      throw new RangeError('speedSteps must contain at least one step');
    }

    this.rng = rng ?? createRng(seed);
    this.production = 0;
    this.brokenMagazines = 0;

    this.sequence = [];
    this.slots = [];
    this.index = 0;
    this.complete = false;
    this.brokenMagazine = false;

    this.startedAtMs = null;
    this.pausedAtMs = null;
    this.lastMultiplier = null;
    this.lastDurationMs = null;

    this.#generateSequence();
  }

  get expectedChar() {
    return this.complete ? null : this.sequence[this.index];
  }

  get filled() {
    return this.slots.length;
  }

  get magazinesProduced() {
    return this.production;
  }

  get magazine() {
    return {
      slots: this.slots.map((slot) => ({ ...slot })),
      filled: this.filled,
      broken: this.brokenMagazine,
      complete: this.complete,
    };
  }

  /** Start the timer for the magazine currently in the loading area. */
  start(nowMs) {
    if (this.startedAtMs !== null || !Number.isFinite(nowMs)) {
      return false;
    }

    this.startedAtMs = nowMs;
    return true;
  }

  pause(nowMs) {
    if (this.pausedAtMs !== null || !Number.isFinite(nowMs) || this.complete) return false;
    this.pausedAtMs = nowMs;
    return true;
  }

  resume(nowMs) {
    if (this.pausedAtMs === null || !Number.isFinite(nowMs)) return false;
    if (this.startedAtMs !== null) this.startedAtMs += Math.max(0, nowMs - this.pausedAtMs);
    this.pausedAtMs = null;
    return true;
  }

  elapsed(nowMs) {
    if (this.startedAtMs === null) return null;
    const endpoint = this.pausedAtMs ?? nowMs;
    return Math.max(0, endpoint - this.startedAtMs);
  }

  multiplierForDuration(durationMs) {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      return 1;
    }

    const averageMs = durationMs / this.config.sequenceLength;

    for (const step of this.config.speedSteps) {
      if (averageMs <= step.maxAverageMs) {
        return Math.max(1, Math.min(this.config.maxMultiplier, step.multiplier));
      }
    }

    return 1;
  }

  /**
   * Type one character. Returns an event describing the slot that was filled.
   * `nowMs` must come from the host clock; rules never read the wall clock.
   */
  press(input, nowMs) {
    if (this.pausedAtMs !== null) return { type: 'ignored', reason: 'paused' };
    if (this.complete) {
      return { type: 'ignored', reason: 'complete' };
    }

    const char = String(input).toUpperCase();

    if (!/^[A-Z]$/.test(char)) {
      return { type: 'ignored', reason: 'invalid-character' };
    }

    if (!Number.isFinite(nowMs)) return { type: 'ignored', reason: 'invalid-time' };
    if (this.startedAtMs === null) this.startedAtMs = nowMs;

    const expected = this.expectedChar;
    const correct = char === expected;
    const slotIndex = this.index;

    this.slots.push({ char, expected, correct });
    this.index += 1;

    if (!correct) {
      this.brokenMagazine = true;
    }

    let multiplier = null;
    let durationMs = null;

    if (this.index >= this.config.sequenceLength) {
      this.complete = true;
      durationMs = Math.max(0, nowMs - this.startedAtMs);
      multiplier = this.brokenMagazine ? 0 : this.multiplierForDuration(durationMs);

      this.lastMultiplier = multiplier;
      this.lastDurationMs = durationMs;

      if (this.brokenMagazine) {
        this.brokenMagazines += 1;
      } else {
        this.production += multiplier;
      }
    }

    return {
      type: correct ? 'correct' : 'wrong',
      char,
      expected,
      correct,
      slotIndex,
      complete: this.complete,
      broken: this.brokenMagazine,
      multiplier,
      durationMs,
      production: this.production,
      magazinesProduced: this.magazinesProduced,
    };
  }

  /**
   * Start a fresh magazine once the current one is complete. The timer begins
   * on its first valid keypress.
   */
  nextMagazine(nowMs) {
    if (!this.complete) {
      return null;
    }

    this.#generateSequence();
    this.slots = [];
    this.index = 0;
    this.complete = false;
    this.brokenMagazine = false;
    this.startedAtMs = null;
    this.pausedAtMs = null;

    return [...this.sequence];
  }

  /** Consume and return the whole magazines produced so far. */
  takeMagazines() {
    const count = this.production;
    this.production = 0;
    return count;
  }

  #generateSequence() {
    const chars = [];

    for (let i = 0; i < this.config.sequenceLength; i += 1) {
      chars.push(this.config.charset[Math.floor(this.rng() * this.config.charset.length)]);
    }

    this.sequence = chars;
  }
}
