export const STATIONS = Object.freeze([
  Object.freeze({ id: 'mill', name: 'COMMIE MILL', short: 'MILL', kind: 'mill' }),
  Object.freeze({ id: 'vat', name: 'NATIONAL SPIRIT FERMENTER', short: 'FERMENTER', kind: 'vat' }),
  Object.freeze({ id: 'press', name: 'VODKA MIXER', short: 'MIXER', kind: 'press' }),
  Object.freeze({ id: 'still', name: 'PROPAGANDA ADDITION', short: 'ADDITION', kind: 'still' }),
  Object.freeze({ id: 'filter', name: 'CAPITALIST HATE INFUSER', short: 'INFUSER', kind: 'filter' }),
  Object.freeze({ id: 'bureau', name: 'INSPECTION', short: 'INSPECTION', kind: 'bureau' }),
]);

// Twelve numbered processes. Stations are deliberately reused: a pot visits the
// vat three times, the still and bureau twice, and the mill, press, and filter
// once each. The final drop is the bottler.
export const PROCESSES = Object.freeze([
  Object.freeze({
    id: 'seize-harvest',
    order: 1,
    name: 'SEIZE THE HARVEST',
    stationId: 'mill',
    durationMs: 1500,
    windowMs: 7000,
  }),
  Object.freeze({
    id: 'nationalize-mash',
    order: 2,
    name: 'NATIONALIZE THE MASH',
    stationId: 'vat',
    durationMs: 1400,
    windowMs: 7000,
  }),
  Object.freeze({
    id: 'agitate-masses',
    order: 3,
    name: 'AGITATE THE MASSES',
    stationId: 'press',
    durationMs: 1200,
    windowMs: 6500,
  }),
  Object.freeze({
    id: 'distill-spirit',
    order: 4,
    name: 'DISTILL THE SPIRIT',
    stationId: 'still',
    durationMs: 1900,
    windowMs: 6500,
  }),
  Object.freeze({
    id: 'collectivize-vat',
    order: 5,
    name: 'COLLECTIVIZE THE VAT',
    stationId: 'vat',
    durationMs: 1500,
    windowMs: 7000,
  }),
  Object.freeze({
    id: 'purge-deviations',
    order: 6,
    name: 'PURGE DEVIATIONS',
    stationId: 'filter',
    durationMs: 1400,
    windowMs: 6500,
  }),
  Object.freeze({
    id: 'ratify-plan',
    order: 7,
    name: 'RATIFY THE PLAN',
    stationId: 'bureau',
    durationMs: 1200,
    windowMs: 7000,
  }),
  Object.freeze({
    id: 'five-year-ferment',
    order: 8,
    name: 'FIVE-YEAR FERMENT',
    stationId: 'still',
    durationMs: 2100,
    windowMs: 6500,
  }),
  Object.freeze({
    id: 'commissars-blend',
    order: 9,
    name: "COMMISSAR'S BLEND",
    stationId: 'vat',
    durationMs: 1500,
    windowMs: 7000,
  }),
  Object.freeze({
    id: 'inspect-cadre',
    order: 10,
    name: 'INSPECT THE CADRE',
    stationId: 'bureau',
    durationMs: 1300,
    windowMs: 6500,
  }),
  Object.freeze({
    id: 'filter-line',
    order: 11,
    name: 'FILTER THE LINE',
    stationId: 'filter',
    durationMs: 1700,
    windowMs: 6500,
  }),
  Object.freeze({
    id: 'seal-revolution',
    order: 12,
    name: 'SEAL THE REVOLUTION',
    stationId: 'press',
    durationMs: 1400,
    windowMs: 7000,
  }),
]);

export const DEFAULT_CONFIG = Object.freeze({
  stations: STATIONS,
  processes: PROCESSES,
  stationCapacity: 4,
  bottlerCapacity: 4,
  disposerCapacity: 4,
  disposingMs: 10000,
  vialsPerPot: 20,
  secondsPerVial: 1,
  bottlingMs: 10000,
});

export const POT_STATUS = Object.freeze({
  IDLE: 'idle',
  WORKING: 'working',
  READY: 'ready',
  QUEUED: 'queued',
  BOTTLING: 'bottling',
  DISPOSING: 'disposing',
  DONE: 'done',
  SPOILED: 'spoiled',
});

function clone(value) {
  return value ? { ...value } : null;
}

function validateConfig(config) {
  const stationIds = new Set();

  if (!Array.isArray(config.stations) || config.stations.length < 1) {
    throw new RangeError('stations must contain at least one station');
  }

  for (const station of config.stations) {
    if (!station || typeof station.id !== 'string' || station.id.length === 0) {
      throw new RangeError('every station needs a non-empty id');
    }
    if (stationIds.has(station.id)) {
      throw new RangeError(`duplicate station: ${station.id}`);
    }
    stationIds.add(station.id);
  }

  if (!Array.isArray(config.processes) || config.processes.length < 1) {
    throw new RangeError('processes must contain at least one process');
  }

  const processIds = new Set();
  const orders = new Set();

  for (const process of config.processes) {
    if (!process || typeof process.id !== 'string' || process.id.length === 0) {
      throw new RangeError('every process needs a non-empty id');
    }
    if (processIds.has(process.id)) {
      throw new RangeError(`duplicate process: ${process.id}`);
    }
    processIds.add(process.id);

    if (!Number.isInteger(process.order) || process.order < 1) {
      throw new RangeError(`process ${process.id} needs a positive integer order`);
    }
    if (orders.has(process.order)) {
      throw new RangeError(`duplicate process order: ${process.order}`);
    }
    orders.add(process.order);

    if (!stationIds.has(process.stationId)) {
      throw new RangeError(`process ${process.id} uses an unknown station`);
    }
    if (!Number.isFinite(process.durationMs) || process.durationMs <= 0) {
      throw new RangeError(`process ${process.id} needs a positive durationMs`);
    }
    if (!Number.isFinite(process.windowMs) || process.windowMs <= 0) {
      throw new RangeError(`process ${process.id} needs a positive windowMs`);
    }
  }

  for (const key of ['stationCapacity', 'bottlerCapacity', 'disposerCapacity', 'vialsPerPot']) {
    if (!Number.isInteger(config[key]) || config[key] < 1) {
      throw new RangeError(`${key} must be a positive integer`);
    }
  }

  if (!Number.isFinite(config.secondsPerVial) || config.secondsPerVial <= 0) {
    throw new RangeError('secondsPerVial must be positive');
  }
  if (!Number.isFinite(config.bottlingMs) || config.bottlingMs <= 0) {
    throw new RangeError('bottlingMs must be positive');
  }
  if (!Number.isFinite(config.disposingMs) || config.disposingMs <= 0) {
    throw new RangeError('disposingMs must be positive');
  }
}

/**
 * Pure management rules for the Dash Supplement Factory.
 *
 * The player takes empty pots from an unlimited intake, drags each one into the
 * station for its current numbered process, and moves it on before the ready
 * window expires. Stations process four pots at once. After all twelve
 * processes, a pot goes to the bottler and produces 20 one-second vials.
 *
 * The core has no DOM or wall clock. The host reports elapsed time with
 * `advance(deltaMs)` and receives every completion, spoil, and bottling event.
 */
export class DashSupplementFactory {
  constructor({ config = {} } = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    validateConfig(this.config);

    this.stations = this.config.stations.map((station) => ({ ...station }));
    this.processes = this.config.processes
      .map((process) => ({ ...process }))
      .sort((a, b) => a.order - b.order);

    this._pots = [];
    this._nextPotId = 1;
    this._elapsedMs = 0;
    this._vialsProduced = 0;
    this._potsBottled = 0;
    this._potsSpoiled = 0;
  }

  get pots() {
    return this._pots.map((pot) => ({ ...pot }));
  }

  get activePots() {
    return this._pots
      .filter((pot) => pot.location !== 'exited')
      .map((pot) => ({ ...pot }));
  }

  get intakePots() {
    return this.#potsAt('intake');
  }

  get elapsedMs() {
    return this._elapsedMs;
  }

  get vialsProduced() {
    return this._vialsProduced;
  }

  get secondsProduced() {
    return this._vialsProduced * this.config.secondsPerVial;
  }

  get potsBottled() {
    return this._potsBottled;
  }

  get potsSpoiled() {
    return this._potsSpoiled;
  }

  get stationCapacity() {
    return this.config.stationCapacity;
  }

  get bottlerCapacity() {
    return this.config.bottlerCapacity;
  }

  get disposerCapacity() {
    return this.config.disposerCapacity;
  }

  /** Active pots at one station, the intake, or the bottler. */
  getPotsAt(location) {
    return this.#potsAt(location);
  }

  /** Number of occupied slots per station, plus the bottler. */
  get occupancy() {
    const result = {};

    for (const station of this.stations) {
      result[station.id] = this.#potsAt(station.id).length;
    }
    result.bottler = this.#potsAt('bottler').length;
    result.disposer = this.#potsAt('disposer').length;

    return result;
  }

  /** The process that is running or awaiting movement for a pot, if any. */
  processFor(potId) {
    const pot = this._pots.find((candidate) => candidate.id === potId);

    if (!pot || pot.stepIndex >= this.processes.length) {
      return null;
    }
    return clone(this.processes[pot.stepIndex]);
  }

  /** Add one empty pot to the intake. There is no limit. */
  takePot() {
    const pot = {
      id: this._nextPotId,
      stepIndex: 0,
      location: 'intake',
      status: POT_STATUS.IDLE,
      progressMs: 0,
      windowMsLeft: 0,
      spoiled: false,
      bottled: false,
    };
    this._nextPotId += 1;
    this._pots.push(pot);

    return {
      type: 'pot-taken',
      potId: pot.id,
      pot: { ...pot },
      intake: this.#potsAt('intake').length,
    };
  }

  /**
   * Drag a pot into a station or the bottler.
   *
   * A pot waiting at the intake or ready at a station can move. Working pots
   * are rejected with `pot-busy`; a wrong station leaves the pot where it was.
   */
  dropPot(potId, targetId) {
    const pot = this._pots.find((candidate) => candidate.id === potId);

    if (!pot) {
      return this.#rejected('unknown-pot');
    }
    if (pot.location === 'exited') {
      return this.#rejected('pot-gone');
    }
    if (
      pot.status === POT_STATUS.WORKING ||
      pot.status === POT_STATUS.QUEUED ||
      pot.status === POT_STATUS.BOTTLING ||
      pot.status === POT_STATUS.DISPOSING
    ) {
      return this.#rejected('pot-busy');
    }

    if (targetId === 'bottler') {
      return this.#dropAtBottler(pot);
    }
    if (targetId === 'disposer') return this.#dropAtDisposer(pot);

    const station = this.stations.find((candidate) => candidate.id === targetId);

    if (!station) {
      return this.#rejected('unknown-station');
    }
    if (pot.location === targetId) {
      return this.#rejected('already-there');
    }

    const step = this.processes[pot.stepIndex];

    if (!step) {
      return this.#rejected('ready-for-bottler');
    }
    if (step.stationId !== targetId) {
      return this.#rejected('wrong-station', {
        expectedStationId: step.stationId,
        process: clone(step),
      });
    }
    if (this.#potsAt(targetId).length >= this.config.stationCapacity) {
      return this.#rejected('station-full');
    }

    const from = pot.location;
    pot.location = targetId;
    pot.status = POT_STATUS.WORKING;
    pot.progressMs = 0;
    pot.windowMsLeft = 0;

    return {
      type: 'pot-dropped',
      potId: pot.id,
      from,
      to: targetId,
      status: pot.status,
      stepIndex: pot.stepIndex,
      step: clone(step),
    };
  }

  /**
   * Advance every working, ready, and bottling pot by `deltaMs`.
   *
   * Returns a tick with an ordered `events` array. The array can contain
   * process completions, spoiled pots, and bottled pots in the same tick.
   */
  advance(deltaMs) {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
      return this.#tick(0, []);
    }

    this._elapsedMs += deltaMs;
    const events = [];

    for (const pot of this._pots) {
      if (pot.status === POT_STATUS.WORKING) {
        const step = this.processes[pot.stepIndex];

        if (!step) {
          continue;
        }

        const completedIndex = pot.stepIndex;
        pot.progressMs += deltaMs;

        if (pot.progressMs >= step.durationMs) {
          const overflow = pot.progressMs - step.durationMs;
          pot.progressMs = step.durationMs;
          pot.status = POT_STATUS.READY;
          pot.windowMsLeft = step.windowMs;
          pot.stepIndex += 1;
          events.push({
            type: 'process-complete',
            potId: pot.id,
            stationId: pot.location,
            stepIndex: completedIndex,
            step: clone(step),
            nextStep: clone(this.processes[pot.stepIndex] ?? null),
            windowMsLeft: pot.windowMsLeft,
          });

          if (overflow > 0) {
            pot.windowMsLeft -= overflow;

            if (pot.windowMsLeft <= 0) {
              this.#spoil(pot, events, completedIndex);
            }
          }
        }
      } else if (pot.status === POT_STATUS.READY) {
        pot.windowMsLeft -= deltaMs;

        if (pot.windowMsLeft <= 0) {
          this.#spoil(pot, events, Math.max(0, pot.stepIndex - 1));
        }
      }
    }

    // The bottler empties one pot at a time. Anything else in the bottler
    // waits as a queue, so a large delta can finish several pots in order.
    let bottlingRemaining = deltaMs;

    while (bottlingRemaining > 0) {
      const active = this._pots.find(
        (candidate) =>
          candidate.location === 'bottler' &&
          candidate.status === POT_STATUS.BOTTLING,
      );

      if (!active) {
        break;
      }

      const needed = this.config.bottlingMs - active.progressMs;

      if (bottlingRemaining < needed) {
        active.progressMs += bottlingRemaining;
        break;
      }

      bottlingRemaining -= needed;
      active.progressMs = this.config.bottlingMs;
      active.status = POT_STATUS.DONE;
      active.bottled = true;
      active.location = 'exited';
      this._vialsProduced += this.config.vialsPerPot;
      this._potsBottled += 1;
      events.push({
        type: 'pot-bottled',
        potId: active.id,
        vials: this.config.vialsPerPot,
        seconds: this.config.vialsPerPot * this.config.secondsPerVial,
        vialsProduced: this._vialsProduced,
        secondsProduced: this.secondsProduced,
      });

      this.#promoteQueuedPot(events);
    }

    let disposingRemaining = deltaMs;
    while (disposingRemaining > 0) {
      const active = this._pots.find((candidate) => candidate.location === 'disposer' && candidate.status === POT_STATUS.DISPOSING);
      if (!active) break;
      const needed = this.config.disposingMs - active.progressMs;
      if (disposingRemaining < needed) { active.progressMs += disposingRemaining; break; }
      disposingRemaining -= needed;
      active.progressMs = this.config.disposingMs;
      active.location = 'exited';
      active.status = POT_STATUS.DONE;
      events.push({ type: 'batch-disposed', potId: active.id });
      const next = this._pots.find((candidate) => candidate.location === 'disposer' && candidate.status === POT_STATUS.QUEUED);
      if (next) { next.status = POT_STATUS.DISPOSING; next.progressMs = 0; }
    }

    return this.#tick(deltaMs, events);
  }

  /** Remove all produced vials from the module and return the count. */
  takeVials() {
    const vials = this._vialsProduced;
    this._vialsProduced = 0;
    return vials;
  }

  /** Remove all produced vials and return their total speed duration. */
  takeSeconds() {
    return this.takeVials() * this.config.secondsPerVial;
  }

  /** Backwards-compatible aliases for hosts that still call them bottles. */
  takeBottles() {
    return this.takeVials();
  }

  /**
   * Mirror an authoritative snapshot received from a host.
   *
   * Embedded clients never advance their own factory: they render this state
   * and forward player actions so every ghost on the team shares one floor.
   */
  hydrate(snapshot = {}) {
    const pots = Array.isArray(snapshot.pots) ? snapshot.pots : [];
    let maxId = 0;

    for (const pot of pots) {
      maxId = Math.max(maxId, Math.floor(Number(pot?.id) || 0));
    }

    this._pots = pots
      .filter((pot) => pot && pot.location !== 'exited')
      .map((pot) => {
        const id = Math.floor(Number(pot.id) || 0);
        return {
          id,
          stepIndex: Math.max(0, Math.floor(Number(pot.stepIndex) || 0)),
          location: String(pot.location ?? 'intake'),
          status: String(pot.status ?? POT_STATUS.IDLE),
          progressMs: Math.max(0, Number(pot.progressMs) || 0),
          windowMsLeft: Math.max(0, Number(pot.windowMsLeft) || 0),
          spoiled: Boolean(pot.spoiled),
          bottled: Boolean(pot.bottled),
        };
      });

    this._elapsedMs = Math.max(0, Number(snapshot.elapsedMs) || 0);
    this._vialsProduced = Math.max(0, Number(snapshot.vialsProduced) || 0);
    this._potsBottled = Math.max(0, Number(snapshot.potsBottled) || 0);
    this._potsSpoiled = Math.max(0, Number(snapshot.potsSpoiled) || 0);
    this._nextPotId = Math.max(this._nextPotId, maxId + 1);

    return this;
  }

  #dropAtBottler(pot) {
    if (pot.stepIndex < this.processes.length) {
      return this.#rejected('processes-remaining', {
        process: clone(this.processes[pot.stepIndex]),
      });
    }
    if (this.#potsAt('bottler').length >= this.config.bottlerCapacity) {
      return this.#rejected('bottler-full');
    }

    const from = pot.location;
    const bottlerBusy = this._pots.some(
      (candidate) =>
        candidate.location === 'bottler' &&
        candidate.status === POT_STATUS.BOTTLING,
    );

    pot.location = 'bottler';
    pot.status = bottlerBusy ? POT_STATUS.QUEUED : POT_STATUS.BOTTLING;
    pot.progressMs = 0;
    pot.windowMsLeft = 0;

    return {
      type: 'pot-dropped',
      potId: pot.id,
      from,
      to: 'bottler',
      status: pot.status,
      stepIndex: pot.stepIndex,
      step: null,
    };
  }

  #dropAtDisposer(pot) {
    if (!pot.spoiled && pot.status !== POT_STATUS.SPOILED) {
      return this.#rejected('not-wasted');
    }
    if (this.#potsAt('disposer').length >= this.config.disposerCapacity) {
      return this.#rejected('disposer-full');
    }
    const busy = this._pots.some((item) => item.location === 'disposer' && item.status === POT_STATUS.DISPOSING);
    const from = pot.location;
    pot.location = 'disposer';
    pot.status = busy ? POT_STATUS.QUEUED : POT_STATUS.DISPOSING;
    pot.progressMs = 0;
    return {
      type: 'pot-dropped',
      potId: pot.id,
      from,
      to: 'disposer',
      status: pot.status,
      stepIndex: pot.stepIndex,
      step: null,
    };
  }

  /** Start the next waiting pot in the bottler, if any. */
  #promoteQueuedPot(events) {
    const next = this._pots.find(
      (candidate) =>
        candidate.location === 'bottler' &&
        candidate.status === POT_STATUS.QUEUED,
    );

    if (!next) {
      return null;
    }

    next.status = POT_STATUS.BOTTLING;
    next.progressMs = 0;
    events.push({
      type: 'bottling-started',
      potId: next.id,
    });

    return next;
  }

  #spoil(pot, events, stepIndex = pot.stepIndex) {
    const stationId = pot.location;

    pot.status = POT_STATUS.SPOILED;
    // Wasted batches remain in their station until routed to disposal.
    pot.spoiled = true;
    pot.windowMsLeft = 0;
    pot.progressMs = 0;
    this._potsSpoiled += 1;
    events.push({
      type: 'pot-spoiled',
      potId: pot.id,
      stationId,
      stepIndex,
      reason: 'window',
    });
  }

  #potsAt(location) {
    return this._pots
      .filter((pot) => pot.location === location)
      .map((pot) => ({ ...pot }));
  }

  #tick(deltaMs, events) {
    return {
      type: 'tick',
      deltaMs,
      elapsedMs: this._elapsedMs,
      events,
      activePots: this._pots.filter((pot) => pot.location !== 'exited').length,
      vialsProduced: this._vialsProduced,
    };
  }

  #rejected(reason, extra = {}) {
    return {
      type: 'rejected',
      reason,
      ...extra,
    };
  }
}
