export const DEFAULT_CONFIG = Object.freeze({
  sequenceLength: 10,
  bulletsPerMagazine: 5,
  charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  startingMultiplier: 1,
  minMultiplier: 0.5,
  maxMultiplier: 5,
  multiplierStepDown: 0.1,
  multiplierStepUp: 0.1,
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
 * A run is a fixed-length sequence. Each correct key loads one bullet into the
 * current magazine. A wrong key marks the current magazine broken; it stays in
 * place and cannot be discarded until it fills or the run ends. Once a run is
 * complete, call `nextRun()` to generate the next sequence.
 */
export class BulletPress {
  constructor({ seed = 1, config = {}, rng } = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (this.config.sequenceLength < 1) {
      throw new RangeError('sequenceLength must be at least 1');
    }
    if (this.config.bulletsPerMagazine < 1) {
      throw new RangeError('bulletsPerMagazine must be at least 1');
    }
    if (this.config.charset.length < 1) {
      throw new RangeError('charset must contain at least one character');
    }

    this.rng = rng ?? createRng(seed);
    this.multiplier = this.config.startingMultiplier;
    this.production = 0;
    this.brokenMagazines = 0;
    this.cleanStreak = 0;
    this.sequence = [];
    this.typed = [];
    this.index = 0;
    this.filled = 0;
    this.magazineBroken = false;
    this.runComplete = false;

    this.#generateSequence();
  }

  get expectedChar() {
    return this.runComplete ? null : this.sequence[this.index];
  }

  get magazinesProduced() {
    return Math.floor(this.production + 1e-9);
  }

  get magazine() {
    return { filled: this.filled, broken: this.magazineBroken };
  }

  /** Consume and return whole magazines produced so far. */
  takeMagazines() {
    const count = this.magazinesProduced;
    this.production -= count;
    return count;
  }

  /** Type one character. Returns an event describing what happened. */
  press(input) {
    if (this.runComplete) {
      return { type: 'ignored' };
    }

    const char = String(input).toUpperCase();
    const expected = this.expectedChar;
    const correct = char === expected;

    this.typed.push(char);
    this.index += 1;

    let magazineCompleted = null;

    if (correct) {
      this.filled += 1;

      if (this.filled >= this.config.bulletsPerMagazine) {
        if (this.magazineBroken) {
          this.brokenMagazines += 1;
          this.cleanStreak = 0;
          magazineCompleted = 'broken';
        } else {
          this.production += this.multiplier;
          this.cleanStreak += 1;
          this.multiplier = Math.min(
            this.config.maxMultiplier,
            this.multiplier + this.config.multiplierStepUp,
          );
          magazineCompleted = 'perfect';
        }

        this.filled = 0;
        this.magazineBroken = false;
      }
    } else {
      this.cleanStreak = 0;
      this.multiplier = Math.max(
        this.config.minMultiplier,
        this.multiplier - this.config.multiplierStepDown,
      );
      this.magazineBroken = true;
    }

    let discardedBroken = 0;

    if (this.index >= this.sequence.length) {
      this.runComplete = true;

      // A broken magazine cannot be discarded mid-run. It is cleared here,
      // once the whole sequence has been typed.
      if (this.magazineBroken) {
        this.brokenMagazines += 1;
        discardedBroken = 1;
        this.filled = 0;
        this.magazineBroken = false;
      }
    }

    return {
      type: correct ? 'correct' : 'wrong',
      char,
      expected,
      magazineCompleted,
      runComplete: this.runComplete,
      discardedBroken,
      multiplier: this.multiplier,
      production: this.production,
      magazinesProduced: this.magazinesProduced,
    };
  }

  /** Start the next manufacturing run. Only valid once the current run is done. */
  nextRun() {
    if (!this.runComplete) {
      return null;
    }

    this.#generateSequence();
    return [...this.sequence];
  }

  #generateSequence() {
    const chars = [];

    for (let i = 0; i < this.config.sequenceLength; i += 1) {
      chars.push(this.config.charset[Math.floor(this.rng() * this.config.charset.length)]);
    }

    this.sequence = chars;
    this.typed = [];
    this.index = 0;
    this.runComplete = false;
  }
}
