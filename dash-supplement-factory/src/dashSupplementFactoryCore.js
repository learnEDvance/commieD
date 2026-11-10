export const STATIONS = Object.freeze([
  Object.freeze({ id: 'mill', name: 'COMMIE MILL', short: 'MILL', kind: 'mill' }),
  Object.freeze({ id: 'vat', name: 'NATIONAL SPIRIT FERMENTER', short: 'FERMENTER', kind: 'vat' }),
  Object.freeze({ id: 'press', name: 'VODKA MIXER', short: 'MIXER', kind: 'press' }),
  Object.freeze({ id: 'still', name: 'PROPAGANDA ADDITION', short: 'ADDITION', kind: 'still' }),
  Object.freeze({ id: 'filter', name: 'CAPITALIST HATE INFUSER', short: 'INFUSER', kind: 'filter' }),
  Object.freeze({ id: 'bureau', name: 'INSPECTION', short: 'INSPECTION', kind: 'bureau' }),
]);

// Twelve numbered processes. Stations are deliberately reused: a batch visits the
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
  dashSecondsPerBatch: 20,
  bottlingMs: 10000,
});

export const BATCH_STATUS = Object.freeze({
  IDLE: 'idle',
  WORKING: 'working',
  READY: 'ready',
  QUEUED: 'queued',
  BOTTLING: 'bottling',
  DISPOSING: 'disposing',
  DONE: 'done',
  WASTED: 'wasted',
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

  for (const key of ['stationCapacity', 'bottlerCapacity', 'disposerCapacity', 'dashSecondsPerBatch']) {
    if (!Number.isInteger(config[key]) || config[key] < 1) {
      throw new RangeError(`${key} must be a positive integer`);
    }
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
 * The player takes empty batches from an unlimited intake, drags each one into the
 * station for its current numbered process, and moves it on before the ready
 * window expires. Stations process four batches at once. After all twelve
 * processes, a batch goes to the bottler and adds 20 seconds to the team's dash reserve.
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

    this._batches = [];
    this._nextBatchId = 1;
    this._elapsedMs = 0;
    this._pendingDashSeconds = 0;
    this._batchesBottled = 0;
    this._batchesWasted = 0;
  }

  get batches() {
    return this._batches.map((batch) => ({ ...batch }));
  }

  get activeBatches() {
    return this._batches
      .filter((batch) => batch.location !== 'exited')
      .map((batch) => ({ ...batch }));
  }

  get intakeBatches() {
    return this.#batchesAt('intake');
  }

  get elapsedMs() {
    return this._elapsedMs;
  }

  get pendingDashSeconds() {
    return this._pendingDashSeconds;
  }

  get batchesBottled() {
    return this._batchesBottled;
  }

  get batchesWasted() {
    return this._batchesWasted;
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

  /** Active batches at one station, the intake, or the bottler. */
  getBatchesAt(location) {
    return this.#batchesAt(location);
  }

  /** Number of occupied slots per station, plus the bottler. */
  get occupancy() {
    const result = {};

    for (const station of this.stations) {
      result[station.id] = this.#batchesAt(station.id).length;
    }
    result.bottler = this.#batchesAt('bottler').length;
    result.disposer = this.#batchesAt('disposer').length;

    return result;
  }

  /** The process that is running or awaiting movement for a batch, if any. */
  processFor(batchId) {
    const batch = this._batches.find((candidate) => candidate.id === batchId);

    if (!batch || batch.stepIndex >= this.processes.length) {
      return null;
    }
    return clone(this.processes[batch.stepIndex]);
  }

  /** Add one empty batch to the intake. There is no limit. */
  takeBatch() {
    const batch = {
      id: this._nextBatchId,
      stepIndex: 0,
      location: 'intake',
      status: BATCH_STATUS.IDLE,
      progressMs: 0,
      windowMsLeft: 0,
      wasted: false,
      bottled: false,
    };
    this._nextBatchId += 1;
    this._batches.push(batch);

    return {
      type: 'batch-taken',
      batchId: batch.id,
      batch: { ...batch },
      intake: this.#batchesAt('intake').length,
    };
  }

  /**
   * Drag a batch into a station or the bottler.
   *
   * A batch waiting at the intake or ready at a station can move. Working batches
   * are rejected with `batch-busy`; a wrong station leaves the batch where it was.
   */
  dropBatch(batchId, targetId) {
    const batch = this._batches.find((candidate) => candidate.id === batchId);

    if (!batch) {
      return this.#rejected('unknown-batch');
    }
    if (batch.location === 'exited') {
      return this.#rejected('batch-gone');
    }
    if (
      batch.status === BATCH_STATUS.WORKING ||
      batch.status === BATCH_STATUS.QUEUED ||
      batch.status === BATCH_STATUS.BOTTLING ||
      batch.status === BATCH_STATUS.DISPOSING
    ) {
      return this.#rejected('batch-busy');
    }

    if (targetId === 'bottler') {
      return this.#dropAtBottler(batch);
    }
    if (targetId === 'disposer') return this.#dropAtDisposer(batch);

    const station = this.stations.find((candidate) => candidate.id === targetId);

    if (!station) {
      return this.#rejected('unknown-station');
    }
    if (batch.location === targetId) {
      return this.#rejected('already-there');
    }

    const step = this.processes[batch.stepIndex];

    if (!step) {
      return this.#rejected('ready-for-bottler');
    }
    if (step.stationId !== targetId) {
      return this.#rejected('wrong-station', {
        expectedStationId: step.stationId,
        process: clone(step),
      });
    }
    if (this.#batchesAt(targetId).length >= this.config.stationCapacity) {
      return this.#rejected('station-full');
    }

    const from = batch.location;
    batch.location = targetId;
    batch.status = BATCH_STATUS.WORKING;
    batch.progressMs = 0;
    batch.windowMsLeft = 0;

    return {
      type: 'batch-dropped',
      batchId: batch.id,
      from,
      to: targetId,
      status: batch.status,
      stepIndex: batch.stepIndex,
      step: clone(step),
    };
  }

  /**
   * Advance every working, ready, and bottling batch by `deltaMs`.
   *
   * Returns a tick with an ordered `events` array. The array can contain
   * process completions, wasted batches, and bottled batches in the same tick.
   */
  advance(deltaMs) {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
      return this.#tick(0, []);
    }

    this._elapsedMs += deltaMs;
    const events = [];

    for (const batch of this._batches) {
      if (batch.status === BATCH_STATUS.WORKING) {
        const step = this.processes[batch.stepIndex];

        if (!step) {
          continue;
        }

        const completedIndex = batch.stepIndex;
        batch.progressMs += deltaMs;

        if (batch.progressMs >= step.durationMs) {
          const overflow = batch.progressMs - step.durationMs;
          batch.progressMs = step.durationMs;
          batch.status = BATCH_STATUS.READY;
          batch.windowMsLeft = step.windowMs;
          batch.stepIndex += 1;
          events.push({
            type: 'process-complete',
            batchId: batch.id,
            stationId: batch.location,
            stepIndex: completedIndex,
            step: clone(step),
            nextStep: clone(this.processes[batch.stepIndex] ?? null),
            windowMsLeft: batch.windowMsLeft,
          });

          if (overflow > 0) {
            batch.windowMsLeft -= overflow;

            if (batch.windowMsLeft <= 0) {
              this.#spoil(batch, events, completedIndex);
            }
          }
        }
      } else if (batch.status === BATCH_STATUS.READY) {
        batch.windowMsLeft -= deltaMs;

        if (batch.windowMsLeft <= 0) {
          this.#spoil(batch, events, Math.max(0, batch.stepIndex - 1));
        }
      }
    }

    // The bottler empties one batch at a time. Anything else in the bottler
    // waits as a queue, so a large delta can finish several batches in order.
    let bottlingRemaining = deltaMs;

    while (bottlingRemaining > 0) {
      const active = this._batches.find(
        (candidate) =>
          candidate.location === 'bottler' &&
          candidate.status === BATCH_STATUS.BOTTLING,
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
      active.status = BATCH_STATUS.DONE;
      active.bottled = true;
      active.location = 'exited';
      this._pendingDashSeconds += this.config.dashSecondsPerBatch;
      this._batchesBottled += 1;
      events.push({
        type: 'batch-bottled',
        batchId: active.id,
        seconds: this.config.dashSecondsPerBatch,
        pendingDashSeconds: this._pendingDashSeconds,
      });

      this.#promoteQueuedBatch(events);
    }

    let disposingRemaining = deltaMs;
    while (disposingRemaining > 0) {
      const active = this._batches.find((candidate) => candidate.location === 'disposer' && candidate.status === BATCH_STATUS.DISPOSING);
      if (!active) break;
      const needed = this.config.disposingMs - active.progressMs;
      if (disposingRemaining < needed) { active.progressMs += disposingRemaining; break; }
      disposingRemaining -= needed;
      active.progressMs = this.config.disposingMs;
      active.location = 'exited';
      active.status = BATCH_STATUS.DONE;
      events.push({ type: 'batch-disposed', batchId: active.id });
      const next = this._batches.find((candidate) => candidate.location === 'disposer' && candidate.status === BATCH_STATUS.QUEUED);
      if (next) { next.status = BATCH_STATUS.DISPOSING; next.progressMs = 0; }
    }

    return this.#tick(deltaMs, events);
  }

  /** Return newly produced dash seconds and reset the output accumulator. */
  takeSeconds() {
    const seconds = this._pendingDashSeconds;
    this._pendingDashSeconds = 0;
    return seconds;
  }

  /**
   * Mirror an authoritative snapshot received from a host.
   *
   * Embedded clients never advance their own factory: they render this state
   * and forward player actions so every ghost on the team shares one floor.
   */
  hydrate(snapshot = {}) {
    const batches = Array.isArray(snapshot.batches) ? snapshot.batches : [];
    let maxId = 0;

    for (const batch of batches) {
      maxId = Math.max(maxId, Math.floor(Number(batch?.id) || 0));
    }

    this._batches = batches
      .filter((batch) => batch && batch.location !== 'exited')
      .map((batch) => {
        const id = Math.floor(Number(batch.id) || 0);
        return {
          id,
          stepIndex: Math.max(0, Math.floor(Number(batch.stepIndex) || 0)),
          location: String(batch.location ?? 'intake'),
          status: String(batch.status ?? BATCH_STATUS.IDLE),
          progressMs: Math.max(0, Number(batch.progressMs) || 0),
          windowMsLeft: Math.max(0, Number(batch.windowMsLeft) || 0),
          wasted: Boolean(batch.wasted),
          bottled: Boolean(batch.bottled),
        };
      });

    this._elapsedMs = Math.max(0, Number(snapshot.elapsedMs) || 0);
    this._pendingDashSeconds = Math.max(0, Number(snapshot.pendingDashSeconds) || 0);
    this._batchesBottled = Math.max(0, Number(snapshot.batchesBottled) || 0);
    this._batchesWasted = Math.max(0, Number(snapshot.batchesWasted) || 0);
    this._nextBatchId = Math.max(this._nextBatchId, maxId + 1);

    return this;
  }

  #dropAtBottler(batch) {
    if (batch.stepIndex < this.processes.length) {
      return this.#rejected('processes-remaining', {
        process: clone(this.processes[batch.stepIndex]),
      });
    }
    if (this.#batchesAt('bottler').length >= this.config.bottlerCapacity) {
      return this.#rejected('bottler-full');
    }

    const from = batch.location;
    const bottlerBusy = this._batches.some(
      (candidate) =>
        candidate.location === 'bottler' &&
        candidate.status === BATCH_STATUS.BOTTLING,
    );

    batch.location = 'bottler';
    batch.status = bottlerBusy ? BATCH_STATUS.QUEUED : BATCH_STATUS.BOTTLING;
    batch.progressMs = 0;
    batch.windowMsLeft = 0;

    return {
      type: 'batch-dropped',
      batchId: batch.id,
      from,
      to: 'bottler',
      status: batch.status,
      stepIndex: batch.stepIndex,
      step: null,
    };
  }

  #dropAtDisposer(batch) {
    if (!batch.wasted && batch.status !== BATCH_STATUS.WASTED) {
      return this.#rejected('not-wasted');
    }
    if (this.#batchesAt('disposer').length >= this.config.disposerCapacity) {
      return this.#rejected('disposer-full');
    }
    const busy = this._batches.some((item) => item.location === 'disposer' && item.status === BATCH_STATUS.DISPOSING);
    const from = batch.location;
    batch.location = 'disposer';
    batch.status = busy ? BATCH_STATUS.QUEUED : BATCH_STATUS.DISPOSING;
    batch.progressMs = 0;
    return {
      type: 'batch-dropped',
      batchId: batch.id,
      from,
      to: 'disposer',
      status: batch.status,
      stepIndex: batch.stepIndex,
      step: null,
    };
  }

  /** Start the next waiting batch in the bottler, if any. */
  #promoteQueuedBatch(events) {
    const next = this._batches.find(
      (candidate) =>
        candidate.location === 'bottler' &&
        candidate.status === BATCH_STATUS.QUEUED,
    );

    if (!next) {
      return null;
    }

    next.status = BATCH_STATUS.BOTTLING;
    next.progressMs = 0;
    events.push({
      type: 'bottling-started',
      batchId: next.id,
    });

    return next;
  }

  #spoil(batch, events, stepIndex = batch.stepIndex) {
    const stationId = batch.location;

    batch.status = BATCH_STATUS.WASTED;
    // Wasted batches remain in their station until routed to disposal.
    batch.wasted = true;
    batch.windowMsLeft = 0;
    batch.progressMs = 0;
    this._batchesWasted += 1;
    events.push({
      type: 'batch-wasted',
      batchId: batch.id,
      stationId,
      stepIndex,
      reason: 'window',
    });
  }

  #batchesAt(location) {
    return this._batches
      .filter((batch) => batch.location === location)
      .map((batch) => ({ ...batch }));
  }

  #tick(deltaMs, events) {
    return {
      type: 'tick',
      deltaMs,
      elapsedMs: this._elapsedMs,
      events,
      activeBatches: this._batches.filter((batch) => batch.location !== 'exited').length,
      pendingDashSeconds: this._pendingDashSeconds,
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
