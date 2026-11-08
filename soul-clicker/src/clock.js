export class GameClock {
  #now;
  #paused = false;
  #pauseStartedAtMs = 0;
  #pausedTotalMs = 0;

  constructor(now = () => performance.now()) {
    this.#now = now;
  }

  get paused() {
    return this.#paused;
  }

  /** Game time: real time minus every completed pause. Frozen while paused. */
  now() {
    const base = this.#paused ? this.#pauseStartedAtMs : this.#now();
    return base - this.#pausedTotalMs;
  }

  pause() {
    if (this.#paused) {
      return false;
    }

    this.#pauseStartedAtMs = this.#now();
    this.#paused = true;
    return true;
  }

  resume() {
    if (!this.#paused) {
      return false;
    }

    this.#pausedTotalMs += this.#now() - this.#pauseStartedAtMs;
    this.#paused = false;
    return true;
  }

  toggle() {
    return this.#paused ? this.resume() : this.pause();
  }
}
