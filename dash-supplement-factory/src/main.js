import { ASSETS } from './assets.js';
import { DashSupplementFactory, PHASES } from './dashSupplementFactoryCore.js';

const core = new DashSupplementFactory();
const reduceMotion = window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

function byId(id) {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Dash Supplement Factory UI is missing #${id}`);
  }
  return el;
}

const ui = {
  factory: byId('factory'),
  potsStat: byId('pots-stat'),
  stepStat: byId('step-stat'),
  batchStat: byId('batch-stat'),
  dashStat: byId('dash-stat'),
  recipeList: byId('recipe-list'),
  potRack: byId('pot-rack'),
  bottlingRack: byId('bottling-rack'),
  actionPanel: byId('action-panel'),
  takePot: byId('take-pot'),
  machine: byId('machine'),
  machineCount: byId('machine-count'),
  batchFill: byId('batch-fill'),
  batchText: byId('batch-text'),
  outcome: byId('outcome'),
  outcomeTitle: byId('outcome-title'),
  outcomeDetail: byId('outcome-detail'),
  outcomeAction: byId('outcome-action'),
  hint: byId('hint'),
  toast: byId('toast'),
  fx: byId('fx-layer'),
};

const LIQUID_STEPS = [
  'transparent',
  '#dfe8f5',
  '#a42339',
  '#c02a44',
  '#e0842f',
  '#f0a93a',
  '#f2c94c',
];

const recipeEls = [];
const actionButtons = new Map();

let activeHold = null;
let toastTimer = null;

/* ---------- Recipe strip ---------- */

function buildRecipe() {
  core.recipe.forEach((step, index) => {
    const li = document.createElement('li');
    li.className = 'recipe-step';
    li.dataset.stepId = step.id;

    const number = document.createElement('span');
    number.className = 'recipe-step__index';
    number.textContent = String(index + 1);

    const label = document.createElement('span');
    label.className = 'recipe-step__label';
    label.textContent = step.label;

    li.append(number, label);

    if (step.type === 'hold') {
      const time = document.createElement('span');
      time.className = 'recipe-step__time';
      time.textContent = `${(step.durationMs / 1000).toFixed(1)}s`;
      li.append(time);
    }

    ui.recipeList.append(li);
    recipeEls.push(li);
  });
}

/* ---------- Action panel ---------- */

function buildActions() {
  core.recipe.forEach((step, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `action action--${step.type}`;
    button.dataset.stepId = step.id;
    button.dataset.stepIndex = String(index);

    if (step.type === 'hold') {
      const fill = document.createElement('span');
      fill.className = 'action__fill';

      const label = document.createElement('span');
      label.className = 'action__label';
      label.textContent = step.label;

      const time = document.createElement('span');
      time.className = 'action__time';
      time.textContent = `HOLD ${(step.durationMs / 1000).toFixed(1)}s`;

      button.append(fill, label, time);
      button.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) {
          return;
        }
        event.preventDefault();
        startHold(step, button);
      });
    } else {
      button.textContent = step.label;
      button.addEventListener('click', () => {
        handle(core.addIngredient(step.id));
      });
    }

    ui.actionPanel.append(button);
    actionButtons.set(step.id, button);
  });
}

/* ---------- Holds ---------- */

function setHoldFill(button, progress) {
  button.style.setProperty('--hold', String(progress));
}

function startHold(step, button) {
  if (activeHold) {
    return;
  }

  const event = core.beginHold(step.id);

  if (event.type !== 'hold-started') {
    handle(event);
    return;
  }

  activeHold = {
    stepId: step.id,
    button,
    lastMs: performance.now(),
    frame: 0,
  };

  button.classList.add('is-holding');
  setHoldFill(button, 0);
  render();
  activeHold.frame = window.requestAnimationFrame(holdFrame);
}

function holdFrame(now) {
  if (!activeHold) {
    return;
  }

  const delta = Math.max(0, now - activeHold.lastMs);
  activeHold.lastMs = now;

  const event = core.advanceHold(delta);
  setHoldFill(activeHold.button, core.holdProgress);

  if (event.type === 'hold-completed') {
    stopHoldUi();
    handle(event);
    return;
  }

  activeHold.frame = window.requestAnimationFrame(holdFrame);
}

function stopHoldUi() {
  if (!activeHold) {
    return;
  }

  window.cancelAnimationFrame(activeHold.frame);
  activeHold.button.classList.remove('is-holding');
  activeHold = null;
}

function endHold() {
  if (!activeHold) {
    return;
  }

  const button = activeHold.button;
  stopHoldUi();
  setHoldFill(button, 0);

  const event = core.releaseHold();
  handle(event);
}

window.addEventListener('pointerup', endHold);
window.addEventListener('pointercancel', endHold);
window.addEventListener('blur', endHold);

/* ---------- Pots ---------- */

function potFill() {
  if (core.phase === PHASES.COLLECTING) {
    return 0;
  }
  return Math.min(1, core.stepIndex / core.recipe.length);
}

function potLiquid() {
  if (core.phase === PHASES.COLLECTING) {
    return 'transparent';
  }
  return LIQUID_STEPS[Math.min(core.stepIndex, LIQUID_STEPS.length - 1)];
}

function createPot(pot) {
  const el = document.createElement('div');
  el.className = 'pot';
  el.dataset.potId = String(pot.id);
  el.style.setProperty('--fill', `${Math.round(potFill() * 100)}%`);
  el.style.setProperty('--liquid', potLiquid());

  if (pot.wasted) {
    el.classList.add('is-wasted');
  }
  if (pot.bottled) {
    el.classList.add('is-bottled');
  }
  if (core.phase === PHASES.PROCESSING) {
    el.classList.add('is-processing');
    if (activeHold) {
      el.classList.add('is-working');
    }
  }
  if (core.phase === PHASES.MOVING) {
    el.classList.add('is-movable');
  }

  const lid = document.createElement('span');
  lid.className = 'pot__lid';

  const body = document.createElement('span');
  body.className = 'pot__body';

  const liquid = document.createElement('span');
  liquid.className = 'pot__liquid';
  body.append(liquid);

  const label = document.createElement('span');
  label.className = 'pot__label';
  label.textContent = `#${pot.id}`;

  el.append(lid, body, label);
  el.title = `Pot #${pot.id}`;
  el.addEventListener('click', () => onPotClick(pot.id, el));

  return el;
}

function createPotSlot() {
  const el = document.createElement('div');
  el.className = 'pot-slot';
  el.setAttribute('aria-hidden', 'true');
  return el;
}

function renderPots() {
  const pots = core.pots;

  ui.potRack.replaceChildren();
  ui.bottlingRack.replaceChildren();

  for (const pot of pots) {
    const el = createPot(pot);

    if (pot.location === 'main' || pot.location === 'wasted') {
      ui.potRack.append(el);
    } else {
      ui.bottlingRack.append(el);
    }
  }

  if (core.phase === PHASES.COLLECTING) {
    const taken = pots.length;

    for (let i = taken; i < core.config.maxPotsPerBatch; i += 1) {
      ui.potRack.append(createPotSlot());
    }

    ui.potRack.classList.add('is-collecting');
  } else {
    ui.potRack.classList.remove('is-collecting');
  }

  const waiting = pots.filter(
    (pot) => pot.location === 'bottling' && !pot.bottled,
  ).length;

  ui.bottlingRack.classList.toggle('is-empty', waiting === 0);

  if (core.phase === PHASES.MOVING) {
    ui.potRack.classList.add('is-movable');
  } else {
    ui.potRack.classList.remove('is-movable');
  }
}

function onPotClick(potId, el) {
  if (core.phase !== PHASES.MOVING) {
    el.classList.remove('is-nudge');
    void el.offsetWidth;
    el.classList.add('is-nudge');
    return;
  }

  const fromRect = el.getBoundingClientRect();
  const event = core.movePot(potId);

  if (event.type !== 'pot-moved') {
    handle(event);
    return;
  }

  render();

  const target = ui.bottlingRack.querySelector(`[data-pot-id="${potId}"]`);

  if (!target || reduceMotion) {
    return;
  }

  target.style.visibility = 'hidden';
  flyPot(fromRect, target.getBoundingClientRect(), () => {
    target.style.visibility = '';
  });
}

/* ---------- FX ---------- */

function flyPot(fromRect, toRect, done) {
  const ghost = document.createElement('div');
  ghost.className = 'pot pot--ghost';
  ghost.style.width = `${fromRect.width}px`;
  ghost.style.height = `${fromRect.height}px`;
  ghost.style.left = `${fromRect.left}px`;
  ghost.style.top = `${fromRect.top}px`;
  ghost.style.setProperty('--fill', `${Math.round(potFill() * 100)}%`);
  ghost.style.setProperty('--liquid', potLiquid());

  ghost.innerHTML =
    '<span class="pot__lid"></span><span class="pot__body"><span class="pot__liquid"></span></span>';

  ui.fx.append(ghost);

  const dx =
    toRect.left + toRect.width / 2 - (fromRect.left + fromRect.width / 2);
  const dy = toRect.top + toRect.height / 2 - (fromRect.top + fromRect.height / 2);
  const scale = Math.min(1, toRect.width / Math.max(1, fromRect.width));

  const animation = ghost.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.85 },
    ],
    { duration: 340, easing: 'cubic-bezier(.35, 0, .2, 1)' },
  );

  const finish = () => {
    ghost.remove();
    done?.();
  };

  animation.finished.then(finish).catch(finish);
}

function streamBottles(count = 5) {
  if (reduceMotion) {
    return;
  }

  const from = ui.machine.getBoundingClientRect();
  const to = ui.batchFill.getBoundingClientRect();

  for (let i = 0; i < count; i += 1) {
    const bottle = document.createElement('img');
    bottle.src = ASSETS.bottle;
    bottle.alt = '';
    bottle.className = 'fx-bottle';
    bottle.style.left = `${from.left + from.width / 2 - 6}px`;
    bottle.style.top = `${from.top + from.height / 2 - 15}px`;
    ui.fx.append(bottle);

    const dx =
      to.left + to.width * (0.35 + Math.random() * 0.6) -
      (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);

    const animation = bottle.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(.6)`, opacity: 0 },
      ],
      {
        duration: 420,
        delay: i * 45,
        easing: 'ease-in',
        fill: 'backwards',
      },
    );

    animation.finished.then(() => bottle.remove()).catch(() => bottle.remove());
  }
}

function shakeFactory() {
  ui.factory.classList.remove('is-shaking');
  void ui.factory.offsetWidth;
  ui.factory.classList.add('is-shaking');
  window.setTimeout(() => ui.factory.classList.remove('is-shaking'), 400);
}

function toast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    ui.toast.classList.remove('is-visible');
  }, 1600);
}

/* ---------- Render ---------- */

function renderStats() {
  ui.potsStat.textContent = `${core.batchSize} / ${core.config.maxPotsPerBatch}`;
  ui.batchStat.textContent = String(core.batchBottles);
  ui.dashStat.textContent = `${core.secondsProduced}s`;

  switch (core.phase) {
    case PHASES.COLLECTING:
      ui.stepStat.textContent = 'Take pots';
      break;
    case PHASES.PROCESSING:
      ui.stepStat.textContent = core.currentStep?.label ?? 'Process';
      break;
    case PHASES.MOVING:
      ui.stepStat.textContent = 'Move pots';
      break;
    case PHASES.BOTTLING:
      ui.stepStat.textContent = 'Bottle';
      break;
    case PHASES.COMPLETE:
      ui.stepStat.textContent = 'Complete';
      break;
    case PHASES.FAILED:
      ui.stepStat.textContent = 'Wasted';
      break;
    default:
      ui.stepStat.textContent = '—';
  }
}

function renderRecipe() {
  const processing = core.phase === PHASES.PROCESSING;
  const failed = core.phase === PHASES.FAILED;
  const finished =
    core.phase === PHASES.MOVING ||
    core.phase === PHASES.BOTTLING ||
    core.phase === PHASES.COMPLETE;

  recipeEls.forEach((el, index) => {
    const done = finished || (processing && index < core.stepIndex);
    const current = processing && index === core.stepIndex;

    el.classList.toggle('is-done', done);
    el.classList.toggle('is-current', current);
    el.classList.toggle('is-next', current);
    el.classList.toggle('is-failed', failed);
  });
}

function renderActions() {
  const processing = core.phase === PHASES.PROCESSING;
  const collecting = core.phase === PHASES.COLLECTING;

  for (const [stepId, button] of actionButtons) {
    const index = Number(button.dataset.stepIndex);
    const step = core.recipe[index];

    button.classList.toggle(
      'is-next',
      (processing && core.currentStep?.id === stepId) ||
        (collecting && core.batchSize > 0 && index === 0),
    );

    const done =
      (processing && index < core.stepIndex) ||
      core.phase === PHASES.MOVING ||
      core.phase === PHASES.BOTTLING ||
      core.phase === PHASES.COMPLETE;

    button.classList.toggle('is-done', done);

    if (step.type === 'hold') {
      if (done) {
        setHoldFill(button, 1);
      } else if (!activeHold || activeHold.stepId !== stepId) {
        setHoldFill(button, 0);
      }
    }
  }

  ui.takePot.disabled = !core.canTakePot;
  ui.takePot.classList.toggle('is-next', collecting);
}

function renderMachine() {
  ui.machineCount.textContent = String(core.batchBottles);
  ui.machine.classList.toggle('is-ready', core.phase === PHASES.BOTTLING);
  ui.machine.disabled = core.batchSize === 0;
}

function renderBatchBar() {
  const capacity = core.batchSize * core.config.bottlesPerPot;

  if (capacity === 0) {
    ui.batchFill.style.width = '0%';
    ui.batchText.textContent = '0 bottles';
    return;
  }

  const percent = Math.min(100, (core.batchBottles / capacity) * 100);
  ui.batchFill.style.width = `${percent}%`;
  ui.batchText.textContent = `${core.batchBottles} / ${capacity} bottles`;
}

function failureText(reason) {
  switch (reason) {
    case 'wrong-order':
      return 'Out of order. Every pot in this batch is ruined.';
    case 'released-early':
      return 'You let go too soon. Every pot in this batch is ruined.';
    default:
      return 'The batch is ruined and must be destroyed.';
  }
}

function renderOutcome() {
  if (core.phase === PHASES.FAILED) {
    ui.outcome.hidden = false;
    ui.outcome.dataset.state = 'failed';
    ui.outcomeTitle.textContent = 'BATCH WASTED';
    ui.outcomeDetail.textContent = failureText(core.failureReason);
    ui.outcomeAction.textContent = 'DESTROY BATCH';
    ui.outcomeAction.dataset.action = 'destroy';
    return;
  }

  if (core.phase === PHASES.COMPLETE) {
    const batch = core.lastBatch;

    ui.outcome.hidden = false;
    ui.outcome.dataset.state = 'complete';
    ui.outcomeTitle.textContent = 'BATCH COMPLETE';
    ui.outcomeDetail.textContent = batch
      ? `${batch.bottles} bottles banked — ${batch.seconds} seconds of dash.`
      : 'Bottles banked.';
    ui.outcomeAction.textContent = 'NEW BATCH';
    ui.outcomeAction.dataset.action = 'new';
    return;
  }

  ui.outcome.hidden = true;
}

function renderHint() {
  switch (core.phase) {
    case PHASES.COLLECTING:
      ui.hint.textContent =
        core.batchSize === 0
          ? 'Take up to 5 pots.'
          : 'Add vodka to start the batch — you can still take more pots.';
      break;
    case PHASES.PROCESSING: {
      const step = core.currentStep;

      if (!step) {
        ui.hint.textContent = '';
      } else if (step.type === 'hold') {
        ui.hint.textContent = `${step.label} — hold the button until the bar fills.`;
      } else {
        ui.hint.textContent = `${step.label} — click the ingredient.`;
      }
      break;
    }
    case PHASES.MOVING:
      ui.hint.textContent = 'Click each pot to move it to the bottling station.';
      break;
    case PHASES.BOTTLING:
      ui.hint.textContent = 'Click the bottling machine once per pot.';
      break;
    case PHASES.COMPLETE:
      ui.hint.textContent = 'Batch bottled. The dash is banked.';
      break;
    case PHASES.FAILED:
      ui.hint.textContent = 'Destroy the wasted batch before starting again.';
      break;
    default:
      ui.hint.textContent = '';
  }
}

function render() {
  renderStats();
  renderRecipe();
  renderActions();
  renderPots();
  renderMachine();
  renderBatchBar();
  renderOutcome();
  renderHint();
}

/* ---------- Events ---------- */

function rejectionText(reason) {
  switch (reason) {
    case 'no-pots':
      return 'No pots yet.';
    case 'batch-full':
      return 'This batch already has 5 pots.';
    case 'unknown-ingredient':
    case 'unknown-hold':
      return 'That is not part of the recipe.';
    case 'hold-active':
      return 'A hold is already in progress.';
    case 'destroy-required':
      return 'Destroy the wasted batch first.';
    case 'batch-active':
      return 'A batch is already in progress.';
    case 'batch-complete':
      return 'Start a new batch first.';
    case 'unknown-pot':
      return 'Unknown pot.';
    case 'pot-not-at-main':
      return 'That pot has already moved.';
    case 'no-pot':
      return 'No pot left to bottle.';
    default:
      return 'Not possible right now.';
  }
}

function handle(event) {
  switch (event.type) {
    case 'batch-complete':
      render();
      streamBottles(6);
      break;
    case 'batch-failed':
      render();
      shakeFactory();
      break;
    case 'bottled':
      render();
      streamBottles(4);
      break;
    case 'rejected':
      toast(rejectionText(event.reason));
      render();
      break;
    case 'noop':
      render();
      break;
    default:
      render();
      break;
  }
}

ui.takePot.addEventListener('click', () => {
  handle(core.takePot());
});

ui.machine.addEventListener('click', () => {
  const event = core.bottleNextPot();

  if (event.type === 'bottled' || event.type === 'batch-complete') {
    ui.machine.classList.remove('is-pumping');
    void ui.machine.offsetWidth;
    ui.machine.classList.add('is-pumping');
  }

  handle(event);
});

ui.outcomeAction.addEventListener('click', () => {
  const action = ui.outcomeAction.dataset.action;
  handle(action === 'destroy' ? core.destroyBatch() : core.newBatch());
});

/* ---------- Boot ---------- */

buildRecipe();
buildActions();
render();
