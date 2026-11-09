export const BASE_RECIPE = Object.freeze([
  Object.freeze({ id: 'vodka', type: 'add', label: 'Add vodka' }),
  Object.freeze({ id: 'stir', type: 'hold', label: 'Hold to stir', durationMs: 1800 }),
  Object.freeze({ id: 'national-spirit', type: 'add', label: 'Add national spirit' }),
  Object.freeze({ id: 'heat', type: 'hold', label: 'Hold to heat', durationMs: 2200 }),
]);

// The source process, with two extra factory steps added so a batch takes a
// little longer. Pass `recipe: BASE_RECIPE` to play the short version.
export const DEFAULT_RECIPE = Object.freeze([
  Object.freeze({ id: 'vodka', type: 'add', label: 'Add vodka' }),
  Object.freeze({ id: 'beet-extract', type: 'add', label: 'Add beet extract' }),
  Object.freeze({ id: 'stir', type: 'hold', label: 'Hold to stir', durationMs: 1800 }),
  Object.freeze({ id: 'national-spirit', type: 'add', label: 'Add national spirit' }),
  Object.freeze({ id: 'heat', type: 'hold', label: 'Hold to heat', durationMs: 2200 }),
  Object.freeze({ id: 'filter', type: 'hold', label: 'Hold to filter', durationMs: 1400 }),
]);

export const DEFAULT_CONFIG = Object.freeze({
  maxPotsPerBatch: 5,
  bottlesPerPot: 20,
  secondsPerBottle: 1,
  recipe: DEFAULT_RECIPE,
});

export const PHASES = Object.freeze({
  COLLECTING: 'collecting',
  PROCESSING: 'processing',
  MOVING: 'moving',
  BOTTLING: 'bottling',
  COMPLETE: 'complete',
  FAILED: 'failed',
});

function validateRecipe(recipe) {
  if (!Array.isArray(recipe) || recipe.length < 1) {
    throw new RangeError('recipe must contain at least one step');
  }

  const ids = new Set();

  for (const step of recipe) {
    if (!step || typeof step.id !== 'string' || step.id.length === 0) {
      throw new RangeError('every recipe step needs a non-empty id');
    }
    if (ids.has(step.id)) {
      throw new RangeError(`duplicate recipe step: ${step.id}`);
    }
    ids.add(step.id);

    if (step.type === 'add') {
      continue;
    }
    if (step.type === 'hold') {
      if (!Number.isFinite(step.durationMs) || step.durationMs <= 0) {
        throw new RangeError(`hold step ${step.id} needs a positive durationMs`);
      }
      continue;
    }

    throw new RangeError(`recipe step ${step.id} has an unknown type`);
  }
}

/**
 * Pure Dash Supplement Factory rules. The browser owns rendering, mouse input,
 * drag/drop, and the animation clock; it reports hold time with `advanceHold()`.
 *
 * A batch is 1-5 pots. The player follows the recipe exactly, moves every pot
 * to bottling, then clicks the bottling machine once per pot. Each pot yields
 * 20 one-second bottles, so a full batch yields 100 seconds of dash.
 *
 * Any action out of order wastes the whole batch. Its pending bottles are
 * discarded, every pot is marked wasted, and the player must call
 * `destroyBatch()` before starting another batch.
 */
export class DashSupplementFactory {
  constructor({ config = {} } = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (!Array.isArray(this.config.recipe) || this.config.recipe.length < 1) {
      throw new RangeError('recipe must contain at least one step');
    }

    this.recipe = this.config.recipe.map((step) => ({ ...step }));
    validateRecipe(this.recipe);

    if (!Number.isInteger(this.config.maxPotsPerBatch) || this.config.maxPotsPerBatch < 1) {
      throw new RangeError('maxPotsPerBatch must be a positive integer');
    }
    if (!Number.isInteger(this.config.bottlesPerPot) || this.config.bottlesPerPot < 1) {
      throw new RangeError('bottlesPerPot must be a positive integer');
    }
    if (!Number.isFinite(this.config.secondsPerBottle) || this.config.secondsPerBottle <= 0) {
      throw new RangeError('secondsPerBottle must be positive');
    }

    this.bottlesProduced = 0;
    this.batchesCompleted = 0;
    this.batchesFailed = 0;
    this.lastBatch = null;

    this._pots = [];
    this._phase = PHASES.COLLECTING;
    this._stepIndex = 0;
    this._hold = null;
    this._pendingBottles = 0;
    this._failureReason = null;
    this._nextPotId = 1;
  }

  get phase() {
    return this._phase;
  }

  get batchSize() {
    return this._pots.length;
  }

  get pots() {
    return this._pots.map((pot) => ({ ...pot }));
  }

  get currentStep() {
    if (this._phase !== PHASES.PROCESSING) {
      return null;
    }
    const step = this.recipe[this._stepIndex];
    return step ? { ...step } : null;
  }

  get nextAction() {
    switch (this._phase) {
      case PHASES.COLLECTING:
        return 'take-pots';
      case PHASES.PROCESSING:
        return this.currentStep?.id ?? null;
      case PHASES.MOVING:
        return 'move-pots';
      case PHASES.BOTTLING:
        return 'bottle';
      case PHASES.COMPLETE:
        return 'new-batch';
      case PHASES.FAILED:
        return 'destroy-batch';
      default:
        return null;
    }
  }

  get canTakePot() {
    return (
      this._phase === PHASES.COLLECTING &&
      this._pots.length < this.config.maxPotsPerBatch
    );
  }

  get canStartBatch() {
    return this._phase === PHASES.COLLECTING && this._pots.length > 0;
  }

  get hold() {
    if (!this._hold) {
      return null;
    }

    return {
      ...this._hold,
      progress: this._hold.elapsedMs / this._hold.requiredMs,
    };
  }

  get holdProgress() {
    return this._hold
      ? Math.min(1, this._hold.elapsedMs / this._hold.requiredMs)
      : 0;
  }

  get batchBottles() {
    return this._pendingBottles;
  }

  get batchSeconds() {
    return this._pendingBottles * this.config.secondsPerBottle;
  }

  get secondsProduced() {
    return this.bottlesProduced * this.config.secondsPerBottle;
  }

  get failureReason() {
    return this._failureReason;
  }

  /** Add one pot while collecting. A completed batch starts a fresh one. */
  takePot() {
    if (this._phase === PHASES.FAILED) {
      return this.#rejected('destroy-required');
    }

    if (this._phase === PHASES.COMPLETE) {
      this.#resetBatch();
    }

    if (this._phase !== PHASES.COLLECTING) {
      return this.#fail('wrong-order');
    }

    if (this._pots.length >= this.config.maxPotsPerBatch) {
      return this.#rejected('batch-full');
    }

    const pot = {
      id: this._nextPotId,
      location: 'main',
      bottled: false,
      wasted: false,
    };
    this._nextPotId += 1;
    this._pots.push(pot);

    return {
      type: 'pot-taken',
      potId: pot.id,
      phase: this._phase,
      batchSize: this._pots.length,
    };
  }

  /** Lock the batch without adding the first ingredient. */
  startBatch() {
    if (this._phase === PHASES.FAILED) {
      return this.#rejected('destroy-required');
    }
    if (this._phase !== PHASES.COLLECTING) {
      return this.#rejected('batch-active');
    }
    if (this._pots.length === 0) {
      return this.#rejected('no-pots');
    }

    this._phase = PHASES.PROCESSING;
    this._stepIndex = 0;

    return {
      type: 'batch-started',
      phase: this._phase,
      batchSize: this._pots.length,
      step: this.currentStep,
    };
  }

  /** Add an ingredient by recipe id. The first add step may start the batch. */
  addIngredient(ingredientId) {
    if (this._phase === PHASES.FAILED) {
      return this.#rejected('destroy-required');
    }
    if (this._phase === PHASES.COMPLETE) {
      return this.#rejected('batch-complete');
    }
    if (this._phase === PHASES.MOVING || this._phase === PHASES.BOTTLING) {
      return this.#fail('wrong-order');
    }

    if (this._phase === PHASES.COLLECTING) {
      if (this._pots.length === 0) {
        return this.#rejected('no-pots');
      }

      const firstStep = this.recipe[0];

      if (firstStep.type === 'add' && firstStep.id === ingredientId) {
        this._phase = PHASES.PROCESSING;
        this._stepIndex = 0;
        return this.#consumeAddStep(ingredientId, { started: true });
      }

      if (this.#isRecipeAdd(ingredientId)) {
        return this.#fail('wrong-order');
      }
      return this.#rejected('unknown-ingredient');
    }

    const step = this.currentStep;

    if (!step || step.type !== 'add') {
      return this.#fail('wrong-order');
    }

    if (step.id !== ingredientId) {
      if (this.#isRecipeAdd(ingredientId)) {
        return this.#fail('wrong-order');
      }
      return this.#rejected('unknown-ingredient');
    }

    return this.#consumeAddStep(ingredientId, { started: false });
  }

  /** Begin a stir/heat/filter hold for the current hold step. */
  beginHold(stepId) {
    if (this._phase === PHASES.FAILED) {
      return this.#rejected('destroy-required');
    }
    if (this._phase === PHASES.COMPLETE) {
      return this.#rejected('batch-complete');
    }
    if (this._hold) {
      return this.#rejected('hold-active');
    }
    if (this._phase === PHASES.COLLECTING) {
      return this._pots.length === 0
        ? this.#rejected('no-pots')
        : this.#fail('wrong-order');
    }
    if (this._phase !== PHASES.PROCESSING) {
      return this.#fail('wrong-order');
    }

    const step = this.currentStep;

    if (!step || step.type !== 'hold') {
      return this.#fail('wrong-order');
    }

    if (step.id !== stepId) {
      if (this.#isRecipeHold(stepId)) {
        return this.#fail('wrong-order');
      }
      return this.#rejected('unknown-hold');
    }

    this._hold = {
      stepId: step.id,
      elapsedMs: 0,
      requiredMs: step.durationMs,
    };

    return {
      type: 'hold-started',
      stepId: step.id,
      requiredMs: step.durationMs,
      progress: 0,
      phase: this._phase,
    };
  }

  /** Report how long the current hold has been held. */
  advanceHold(deltaMs) {
    if (!this._hold || !Number.isFinite(deltaMs) || deltaMs <= 0) {
      return { type: 'noop' };
    }

    this._hold.elapsedMs = Math.min(
      this._hold.requiredMs,
      this._hold.elapsedMs + deltaMs,
    );

    if (this._hold.elapsedMs < this._hold.requiredMs) {
      return {
        type: 'hold-progress',
        stepId: this._hold.stepId,
        elapsedMs: this._hold.elapsedMs,
        remainingMs: this._hold.requiredMs - this._hold.elapsedMs,
        progress: this.holdProgress,
        phase: this._phase,
      };
    }

    const stepId = this._hold.stepId;
    this._hold = null;
    this._stepIndex += 1;
    this.#advanceRecipe();

    return {
      type: 'hold-completed',
      stepId,
      phase: this._phase,
      step: this.currentStep,
    };
  }

  /** Release the hold. Releasing before the hold finishes wastes the batch. */
  releaseHold() {
    if (!this._hold) {
      return { type: 'noop' };
    }

    if (this._hold.elapsedMs < this._hold.requiredMs) {
      return this.#fail('released-early');
    }

    return { type: 'noop' };
  }

  /** Move one pot from the main station to the bottling station. */
  movePot(potId) {
    if (this._phase === PHASES.FAILED) {
      return this.#rejected('destroy-required');
    }
    if (this._phase === PHASES.COMPLETE) {
      return this.#rejected('batch-complete');
    }
    if (this._phase !== PHASES.MOVING) {
      return this.#fail('wrong-order');
    }

    const pot = this._pots.find((candidate) => candidate.id === potId);

    if (!pot) {
      return this.#rejected('unknown-pot');
    }
    if (pot.location !== 'main') {
      return this.#rejected('pot-not-at-main');
    }

    pot.location = 'bottling';

    if (this._pots.every((candidate) => candidate.location !== 'main')) {
      this._phase = PHASES.BOTTLING;
    }

    return {
      type: 'pot-moved',
      potId,
      phase: this._phase,
      remaining: this._pots.filter((candidate) => candidate.location === 'main').length,
    };
  }

  /** Convenience for click-to-move UIs: move the next pot still at main. */
  moveNextPot() {
    const pot = this._pots.find((candidate) => candidate.location === 'main');

    if (!pot) {
      if (this._phase === PHASES.FAILED) {
        return this.#rejected('destroy-required');
      }
      if (this._phase === PHASES.COMPLETE) {
        return this.#rejected('batch-complete');
      }
      if (this._phase !== PHASES.MOVING) {
        return this.#fail('wrong-order');
      }
      return this.#rejected('no-pot');
    }

    return this.movePot(pot.id);
  }

  /** Bottle one pot at the bottling station. The last pot completes the batch. */
  bottleNextPot() {
    if (this._phase === PHASES.FAILED) {
      return this.#rejected('destroy-required');
    }
    if (this._phase === PHASES.COMPLETE) {
      return this.#rejected('batch-complete');
    }
    if (this._phase !== PHASES.BOTTLING) {
      return this.#fail('wrong-order');
    }

    const pot = this._pots.find(
      (candidate) => candidate.location === 'bottling' && !candidate.bottled,
    );

    if (!pot) {
      return this.#rejected('no-pot');
    }

    pot.bottled = true;
    pot.location = 'bottled';
    this._pendingBottles += this.config.bottlesPerPot;

    const remaining = this._pots.filter(
      (candidate) => candidate.location === 'bottling' && !candidate.bottled,
    ).length;

    if (remaining === 0) {
      return this.#completeBatch();
    }

    return {
      type: 'bottled',
      potId: pot.id,
      bottles: this.config.bottlesPerPot,
      batchBottles: this._pendingBottles,
      remaining,
      complete: false,
      phase: this._phase,
    };
  }

  /** Clear a failed batch. Required before another batch can be started. */
  destroyBatch() {
    if (this._phase !== PHASES.FAILED) {
      return this.#rejected('not-failed');
    }

    this.#resetBatch();

    return {
      type: 'batch-destroyed',
      phase: this._phase,
    };
  }

  /** Clear a completed batch and return to collecting. */
  newBatch() {
    if (this._phase === PHASES.FAILED) {
      return this.#rejected('destroy-required');
    }
    if (this._phase !== PHASES.COMPLETE) {
      return this.#rejected('batch-active');
    }

    this.#resetBatch();

    return {
      type: 'new-batch',
      phase: this._phase,
    };
  }

  /** Remove all produced bottles from the module and return the count. */
  takeBottles() {
    const bottles = this.bottlesProduced;
    this.bottlesProduced = 0;
    return bottles;
  }

  /** Remove all produced bottles and return their total speed duration. */
  takeSeconds() {
    return this.takeBottles() * this.config.secondsPerBottle;
  }

  #consumeAddStep(ingredientId, { started }) {
    const step = this.recipe[this._stepIndex];
    this._stepIndex += 1;
    this.#advanceRecipe();

    return {
      type: started ? 'batch-started' : 'ingredient-added',
      ingredientId,
      stepId: step.id,
      phase: this._phase,
      step: this.currentStep,
      batchSize: this._pots.length,
    };
  }

  #advanceRecipe() {
    if (this._stepIndex >= this.recipe.length) {
      this._phase = PHASES.MOVING;
    }
  }

  #isRecipeAdd(ingredientId) {
    return this.recipe.some((step) => step.type === 'add' && step.id === ingredientId);
  }

  #isRecipeHold(stepId) {
    return this.recipe.some((step) => step.type === 'hold' && step.id === stepId);
  }

  #completeBatch() {
    const bottles = this._pendingBottles;
    this.bottlesProduced += bottles;
    this.batchesCompleted += 1;
    this._phase = PHASES.COMPLETE;
    this.lastBatch = {
      pots: this._pots.length,
      bottles,
      seconds: bottles * this.config.secondsPerBottle,
      failed: false,
      reason: null,
    };

    return {
      type: 'batch-complete',
      bottles,
      seconds: bottles * this.config.secondsPerBottle,
      bottlesProduced: this.bottlesProduced,
      batchBottles: this._pendingBottles,
      phase: this._phase,
    };
  }

  #fail(reason) {
    // Nothing to waste yet: a stray click before any pot is taken is rejected
    // instead of creating an empty failed batch the player must destroy.
    if (this._pots.length === 0) {
      return this.#rejected('no-pots');
    }

    this._phase = PHASES.FAILED;
    this._failureReason = reason;
    this._hold = null;
    this._pendingBottles = 0;
    this._pots.forEach((pot) => {
      pot.location = 'wasted';
      pot.wasted = true;
      pot.bottled = false;
    });
    this.batchesFailed += 1;
    this.lastBatch = {
      pots: this._pots.length,
      bottles: 0,
      seconds: 0,
      failed: true,
      reason,
    };

    return {
      type: 'batch-failed',
      reason,
      phase: this._phase,
      batchSize: this._pots.length,
    };
  }

  #rejected(reason) {
    return {
      type: 'rejected',
      reason,
      phase: this._phase,
    };
  }

  #resetBatch() {
    this._pots = [];
    this._phase = PHASES.COLLECTING;
    this._stepIndex = 0;
    this._hold = null;
    this._pendingBottles = 0;
    this._failureReason = null;
    this._nextPotId = 1;
  }
}
