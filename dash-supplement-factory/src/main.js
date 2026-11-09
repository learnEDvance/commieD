import { ASSETS } from './assets.js';
import { DashSupplementFactory, PHASES } from './dashSupplementFactoryCore.js';

const core = new DashSupplementFactory();
const reduceMotion = window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

const MAX_POTS = core.config.maxPotsPerBatch;
const TRAY_TRAVEL_MS = reduceMotion ? 0 : 640;
const BOTTLE_INTERVAL_MS = reduceMotion ? 90 : 470;
const RESET_FADE_MS = reduceMotion ? 0 : 250;

const SHORT_NAMES = {
  vodka: 'VODKA',
  'beet-extract': 'BEET EXTRACT',
  'national-spirit': 'NAT. SPIRIT',
  stir: 'STIR',
  heat: 'HEAT',
  filter: 'FILTER',
};

const LIQUID = {
  vodka: '#dfe8f5',
  'beet-extract': '#a42339',
  'national-spirit': '#e0842f',
};

const MACHINE_PARTS = {
  hopper: '<span class="machine__chute"></span><span class="machine__mouth"></span>',
  dispenser: '<span class="machine__tank"></span><span class="machine__nozzle"></span>',
  stir: '<span class="machine__vat"></span><span class="machine__paddle"></span>',
  hold: '<span class="machine__vat"></span><span class="machine__paddle"></span>',
  heat: '<span class="machine__burner"></span><span class="machine__flame"></span>',
  filter: '<span class="machine__funnel"></span><span class="machine__mesh"></span>',
  bottler:
    '<span class="machine__press"></span><span class="machine__nozzle"></span><span class="machine__pots"></span>',
};

function byId(id) {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Dash Supplement Factory UI is missing #${id}`);
  }
  return el;
}

const ui = {
  factory: byId('factory'),
  hudLamp: byId('hud-lamp'),
  batchNo: byId('batch-no'),
  potsStat: byId('pots-stat'),
  batchStat: byId('batch-stat'),
  dashStat: byId('dash-stat'),
  line: byId('line'),
  stations: byId('stations'),
  tray: byId('tray'),
  trayTag: byId('tray-tag'),
  traySlots: byId('tray-slots'),
  hint: byId('hint'),
  outcome: byId('outcome'),
  outcomeTitle: byId('outcome-title'),
  outcomeDetail: byId('outcome-detail'),
  outcomeAction: byId('outcome-action'),
  toast: byId('toast'),
  fx: byId('fx-layer'),
};

const stationList = [];
const stationEls = [];
const controls = new Map();

let currentBatchNo = 0;
let trayStation = -1;
let transferring = false;
let transferTimer = null;
let bottlingRun = null;
let resetting = false;
let hold = null;
let toastTimer = null;
let beltTimer = null;

/* ---------- Stations ---------- */

function shortName(step) {
  return SHORT_NAMES[step.id] ?? step.label.replace(/^Add\s+/i, '').toUpperCase();
}

function stationKind(step) {
  if (step.type === 'add') {
    return 'dispenser';
  }
  return ['stir', 'heat', 'filter'].includes(step.id) ? step.id : 'hold';
}

function buildStationList() {
  stationList.push({ id: 'hopper', kind: 'hopper', name: 'POT HOPPER' });

  core.recipe.forEach((step) => {
    stationList.push({
      id: step.id,
      kind: stationKind(step),
      name: shortName(step),
      step,
    });
  });

  stationList.push({ id: 'bottler', kind: 'bottler', name: 'BOTTLER' });
}

function makeSpan(className, text) {
  const el = document.createElement('span');
  el.className = className;
  if (text !== undefined) {
    el.textContent = text;
  }
  return el;
}

function buildStations() {
  ui.stations.style.setProperty('--station-count', String(stationList.length));

  stationList.forEach((station, index) => {
    const el = document.createElement('div');
    el.className = 'station';
    el.dataset.stationId = station.id;

    const head = document.createElement('div');
    head.className = 'station__head';

    const machine = document.createElement('div');
    machine.className = `machine machine--${station.kind}`;
    if (station.step) {
      machine.style.setProperty('--station-liquid', LIQUID[station.step.id] ?? '#f2c94c');
    }
    machine.innerHTML = MACHINE_PARTS[station.kind] ?? '';
    machine.prepend(
      makeSpan('station__index', String(index + 1)),
      makeSpan('machine__lamp'),
    );

    const name = makeSpan('station__name', station.name);
    head.append(machine, name);

    const controlsEl = document.createElement('div');
    controlsEl.className = 'station__controls';

    el.append(head, controlsEl);
    el.prepend(makeSpan('station__pendant'));
    ui.stations.append(el);

    stationList[index].el = el;
    stationEls.push(el);
    buildControls(station, index, controlsEl);
  });
}

function buildControls(station, index, host) {
  if (station.id === 'hopper') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'control control--take';
    button.textContent = 'TAKE POT';

    const meta = makeSpan('control__meta', '1–5 POTS');

    button.addEventListener('click', () => {
      if (!canAct()) {
        return;
      }
      const wasEmpty = core.batchSize === 0;
      const event = core.takePot();
      if (event.type === 'pot-taken' && wasEmpty) {
        currentBatchNo += 1;
      }
      handle(event);
    });

    host.append(button, meta);
    controls.set('hopper', { button, meta, kind: 'take' });
    return;
  }

  if (station.step?.type === 'add') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'control control--add';
    button.textContent = `ADD ${shortName(station.step)}`;

    const meta = makeSpan('control__meta', 'INGREDIENT');

    button.addEventListener('click', () => {
      if (!canAct()) {
        return;
      }
      const event = core.addIngredient(station.step.id);
      if (event.type === 'batch-started' || event.type === 'ingredient-added') {
        drip(stationEls[index]);
      }
      handle(event);
    });

    host.append(button, meta);
    controls.set(station.id, { button, meta, kind: 'add' });
    return;
  }

  if (station.step?.type === 'hold') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'control control--hold';
    button.append(
      makeSpan('control__fill'),
      makeSpan('control__label', 'HOLD'),
      makeSpan('control__meta', `${(station.step.durationMs / 1000).toFixed(1)}s`),
    );

    button.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || !canAct()) {
        return;
      }
      event.preventDefault();
      startHold(station, index, button);
    });

    host.append(button);
    controls.set(station.id, { button, kind: 'hold' });
    return;
  }

  if (station.id === 'bottler') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'control control--bottle';
    button.textContent = 'BOTTLER';
    button.addEventListener('click', onBottle);

    const meta = makeSpan('control__meta', 'WAITING');

    const crate = document.createElement('div');
    crate.className = 'crate';
    const bar = document.createElement('div');
    bar.className = 'crate__bar';
    const fill = document.createElement('div');
    fill.className = 'crate__fill';
    bar.append(fill);
    const text = document.createElement('p');
    text.className = 'crate__text';
    text.textContent = '0 BOTTLES';
    crate.append(bar, text);

    host.append(button, meta, crate);
    controls.set('bottler', { button, meta, fill, text, kind: 'bottle' });
  }
}

/* ---------- Tray ---------- */

function fillPercent() {
  if (core.phase === PHASES.COLLECTING) {
    return 0;
  }
  return Math.min(1, core.stepIndex / core.recipe.length) * 100;
}

function liquidColor() {
  for (let i = core.stepIndex - 1; i >= 0; i -= 1) {
    const step = core.recipe[i];
    if (step.type === 'add') {
      return LIQUID[step.id] ?? '#f2c94c';
    }
  }
  return '#dfe8f5';
}

function createMiniPot(pot) {
  const el = document.createElement('div');
  el.className = 'pot';
  el.style.setProperty('--fill', `${Math.round(fillPercent())}%`);
  el.style.setProperty('--liquid', liquidColor());

  if (pot.wasted) {
    el.classList.add('is-wasted');
  }
  if (core.phase === PHASES.PROCESSING) {
    el.classList.add('is-working');
  }

  el.append(
    makeSpan('pot__lid'),
    (() => {
      const body = makeSpan('pot__body');
      body.append(makeSpan('pot__liquid'));
      return body;
    })(),
  );
  el.title = `Pot #${pot.id}`;
  return el;
}

function renderTray() {
  const visible = core.pots.filter(
    (pot) => pot.location === 'main' || pot.location === 'wasted',
  );

  ui.traySlots.replaceChildren();

  for (let i = 0; i < MAX_POTS; i += 1) {
    const slot = document.createElement('div');
    slot.className = 'tray__slot';
    if (visible[i]) {
      slot.append(createMiniPot(visible[i]));
    }
    ui.traySlots.append(slot);
  }

  ui.trayTag.textContent =
    currentBatchNo > 0 ? `BATCH ${String(currentBatchNo).padStart(3, '0')}` : 'BATCH —';
}

function renderMachinePots() {
  const host = document.querySelector('.machine--bottler .machine__pots');

  if (!host) {
    return;
  }

  host.replaceChildren();
  const pots = core.pots.filter(
    (pot) => pot.location === 'bottling' || pot.location === 'bottled',
  );

  pots.forEach((pot) => {
    const dot = document.createElement('span');
    dot.className = 'machine__pot';
    if (pot.bottled) {
      dot.classList.add('is-done');
    }
    host.append(dot);
  });
}

function activeStationIndex() {
  if (core.phase === PHASES.COLLECTING) {
    return 0;
  }
  if (core.phase === PHASES.PROCESSING) {
    return Math.min(core.stepIndex + 1, stationList.length - 1);
  }
  if (core.phase === PHASES.FAILED) {
    return trayStation >= 0 ? trayStation : 0;
  }
  return stationList.length - 1;
}

function moveTrayToActive(instant = false) {
  const active = activeStationIndex();
  const station = stationEls[active];

  if (!station) {
    return;
  }

  if (!instant && active === trayStation && ui.tray.style.transform) {
    return;
  }

  const center = station.offsetLeft + station.offsetWidth / 2;
  const x = Math.round(center - ui.tray.offsetWidth / 2);

  if (instant) {
    ui.tray.classList.add('no-transition');
    ui.tray.style.transform = `translate(${x}px, -50%)`;
    void ui.tray.offsetWidth;
    ui.tray.classList.remove('no-transition');
  } else {
    ui.tray.style.transform = `translate(${x}px, -50%)`;
  }

  if (!instant && trayStation !== -1 && trayStation !== active) {
    animateBelt();
    scrollStationIntoView(active);
  }

  trayStation = active;
}

function animateBelt() {
  ui.line.classList.add('is-moving');
  window.clearTimeout(beltTimer);
  beltTimer = window.setTimeout(
    () => ui.line.classList.remove('is-moving'),
    TRAY_TRAVEL_MS + 80,
  );
}

function scrollStationIntoView(index) {
  const station = stationEls[index];

  if (!station) {
    return;
  }

  const target = station.offsetLeft + station.offsetWidth / 2 - ui.line.clientWidth / 2;

  ui.line.scrollTo({
    left: Math.max(0, target),
    behavior: reduceMotion ? 'auto' : 'smooth',
  });
}

/* ---------- Holds ---------- */

function setFill(button, progress) {
  button.style.setProperty('--hold', String(progress));
}

function startHold(station, index, button) {
  if (hold) {
    return;
  }

  const event = core.beginHold(station.step.id);

  if (event.type !== 'hold-started') {
    handle(event);
    return;
  }

  hold = {
    stepId: station.step.id,
    button,
    stationEl: stationEls[index],
    lastMs: performance.now(),
    frame: 0,
  };

  button.classList.add('is-holding');
  setFill(button, 0);
  render();
  hold.frame = window.requestAnimationFrame(holdFrame);
}

function holdFrame(now) {
  if (!hold) {
    return;
  }

  const delta = Math.max(0, now - hold.lastMs);
  hold.lastMs = now;

  const event = core.advanceHold(delta);
  setFill(hold.button, core.holdProgress);

  if (event.type === 'hold-completed') {
    endHoldUi();
    handle(event);
    return;
  }

  hold.frame = window.requestAnimationFrame(holdFrame);
}

function endHoldUi() {
  if (!hold) {
    return;
  }

  window.cancelAnimationFrame(hold.frame);
  hold.button.classList.remove('is-holding');
  hold.stationEl.classList.remove('is-working');
  hold = null;
}

function endHold() {
  if (!hold) {
    return;
  }

  const button = hold.button;
  endHoldUi();
  setFill(button, 0);
  handle(core.releaseHold());
}

window.addEventListener('pointerup', endHold);
window.addEventListener('pointercancel', endHold);
window.addEventListener('blur', endHold);

/* ---------- Batch actions ---------- */

function canAct() {
  return !bottlingRun && !transferring && !resetting;
}

function drip(stationEl) {
  stationEl.classList.remove('is-dripping');
  void stationEl.offsetWidth;
  stationEl.classList.add('is-dripping');
  window.setTimeout(() => stationEl.classList.remove('is-dripping'), 320);
}

function remainingBottlingPots() {
  return core.pots.filter(
    (pot) => pot.location === 'bottling' && !pot.bottled,
  ).length;
}

function onBottle() {
  if (core.phase !== PHASES.BOTTLING || bottlingRun || !canAct()) {
    return;
  }

  bottlingRun = { timer: 0 };
  render();
  bottlingRun.timer = window.setTimeout(
    runBottleStep,
    reduceMotion ? 0 : 180,
  );
}

function runBottleStep() {
  const event = core.bottleNextPot();

  if (event.type === 'bottled') {
    pulseStation('bottler');
    handle(event);
    bottlingRun.timer = window.setTimeout(runBottleStep, BOTTLE_INTERVAL_MS);
    return;
  }

  bottlingRun = null;
  handle(event);

  if (event.type === 'batch-complete') {
    streamBottles(9);
  }
}

function pulseStation(id) {
  const station = stationList.find((candidate) => candidate.id === id);

  if (!station?.el) {
    return;
  }

  station.el.classList.remove('is-pumping');
  void station.el.offsetWidth;
  station.el.classList.add('is-pumping');
  window.setTimeout(() => station.el.classList.remove('is-pumping'), 340);
}

function maybeTransfer() {
  if (core.phase !== PHASES.MOVING || transferring) {
    return;
  }

  transferring = true;
  window.clearTimeout(transferTimer);
  transferTimer = window.setTimeout(
    () => {
      while (core.phase === PHASES.MOVING) {
        const event = core.moveNextPot();
        if (event.type !== 'pot-moved') {
          break;
        }
      }
      transferring = false;
      render();
    },
    TRAY_TRAVEL_MS + 80,
  );
}

/* ---------- Render ---------- */

function recipeDone(recipeIndex) {
  if (core.phase === PHASES.PROCESSING) {
    return recipeIndex < core.stepIndex;
  }
  return (
    core.phase === PHASES.MOVING ||
    core.phase === PHASES.BOTTLING ||
    core.phase === PHASES.COMPLETE
  );
}

function renderHud() {
  ui.batchNo.textContent =
    currentBatchNo > 0 ? String(currentBatchNo).padStart(3, '0') : '—';
  ui.potsStat.textContent = `${core.batchSize} / ${MAX_POTS}`;
  ui.batchStat.textContent = String(core.batchBottles);
  ui.dashStat.textContent = `${core.secondsProduced}s`;

  const running =
    core.phase === PHASES.PROCESSING ||
    core.phase === PHASES.MOVING ||
    core.phase === PHASES.BOTTLING;

  ui.hudLamp.classList.toggle('is-run', running);
  ui.hudLamp.classList.toggle('is-alarm', core.phase === PHASES.FAILED);
}

function renderStations() {
  const active = activeStationIndex();

  stationList.forEach((station, index) => {
    const el = station.el;
    const isRecipe = Boolean(station.step);
    const done = isRecipe ? recipeDone(index - 1) : false;
    const failedHere = core.phase === PHASES.FAILED && index === active;

    el.classList.toggle('is-active', index === active);
    el.classList.toggle('is-done', done);
    el.classList.toggle('is-failed', failedHere);
    el.classList.toggle(
      'is-working',
      Boolean(hold) && hold.stepId === station.id,
    );

    const control = controls.get(station.id);

    if (!control) {
      return;
    }

    if (control.kind === 'take') {
      control.button.disabled = !core.canTakePot || !canAct();
      control.meta.textContent = `${core.batchSize} / ${MAX_POTS} POTS`;
      return;
    }

    if (control.kind === 'add') {
      control.button.disabled = !canAct();
      return;
    }

    if (control.kind === 'hold') {
      control.button.disabled = !canAct();

      if (done) {
        setFill(control.button, 1);
      } else if (!hold || hold.stepId !== station.id) {
        setFill(control.button, 0);
      }
      return;
    }

    if (control.kind === 'bottle') {
      const bottling = core.phase === PHASES.BOTTLING;
      const running = Boolean(bottlingRun);
      const moving = core.phase === PHASES.MOVING;
      const left = remainingBottlingPots();

      control.button.disabled = !bottling || running || !canAct();
      control.button.textContent = running
        ? 'BOTTLING…'
        : bottling
          ? 'BOTTLE BATCH'
          : 'BOTTLER';
      control.meta.textContent = running || bottling
        ? `${left} ${left === 1 ? 'POT' : 'POTS'} · ${left * core.config.bottlesPerPot * core.config.secondsPerBottle}s`
        : moving
          ? 'LOADING POTS…'
          : 'WAITING';

      const capacity = core.batchSize * core.config.bottlesPerPot;
      const percent = capacity
        ? Math.min(100, (core.batchBottles / capacity) * 100)
        : 0;
      control.fill.style.width = `${percent}%`;
      control.text.textContent = capacity
        ? `${core.batchBottles} / ${capacity} BOTTLES`
        : '0 BOTTLES';
    }
  });
}

function renderHint() {
  const step = core.currentStep;

  switch (core.phase) {
    case PHASES.COLLECTING:
      ui.hint.textContent =
        core.batchSize === 0
          ? 'Take 1–5 pots onto the belt.'
          : 'Start the batch at the vodka dispenser — or load more pots first.';
      break;
    case PHASES.PROCESSING:
      ui.hint.textContent =
        step?.type === 'hold'
          ? `${step.label} at station ${core.stepIndex + 2} — hold until the gauge fills.`
          : `${step?.label ?? 'Add the ingredient'} at station ${core.stepIndex + 2}.`;
      break;
    case PHASES.MOVING:
      ui.hint.textContent = 'The belt is carrying the batch to the bottler.';
      break;
    case PHASES.BOTTLING:
      ui.hint.textContent = bottlingRun
        ? 'The bottler is filling the crate.'
        : 'Run the bottler to fill the crate.';
      break;
    case PHASES.COMPLETE:
      ui.hint.textContent = 'Batch banked. Start a new batch.';
      break;
    case PHASES.FAILED:
      ui.hint.textContent = 'The batch is ruined. Destroy it to clear the line.';
      break;
    default:
      ui.hint.textContent = '';
  }
}

function batchLabel() {
  return currentBatchNo > 0
    ? String(currentBatchNo).padStart(3, '0')
    : '—';
}

function failureText(reason) {
  switch (reason) {
    case 'wrong-order':
      return 'Out of order. Every pot in this batch is ruined.';
    case 'released-early':
      return 'The hold was released too soon. Every pot in this batch is ruined.';
    default:
      return 'The batch is ruined and must be destroyed.';
  }
}

function renderOutcome() {
  if (core.phase === PHASES.FAILED) {
    ui.outcome.hidden = false;
    ui.outcome.dataset.state = 'failed';
    ui.outcomeTitle.textContent = `BATCH ${batchLabel()} WASTED`;
    ui.outcomeDetail.textContent = failureText(core.failureReason);
    ui.outcomeAction.textContent = 'DESTROY BATCH';
    ui.outcomeAction.dataset.action = 'destroy';
    return;
  }

  if (core.phase === PHASES.COMPLETE) {
    const batch = core.lastBatch;

    ui.outcome.hidden = false;
    ui.outcome.dataset.state = 'complete';
    ui.outcomeTitle.textContent = `BATCH ${batchLabel()} COMPLETE`;
    ui.outcomeDetail.textContent = batch
      ? `${batch.pots} pots → ${batch.bottles} bottles → ${batch.seconds} seconds of dash.`
      : 'Bottles banked.';
    ui.outcomeAction.textContent = 'NEW BATCH';
    ui.outcomeAction.dataset.action = 'new';
    return;
  }

  ui.outcome.hidden = true;
}

function render() {
  renderHud();
  renderStations();
  renderTray();
  renderMachinePots();
  renderOutcome();
  renderHint();
  moveTrayToActive();
  maybeTransfer();
}

/* ---------- FX ---------- */

function streamBottles(count) {
  if (reduceMotion) {
    return;
  }

  const nozzle = document.querySelector('.machine--bottler .machine__nozzle');
  const target = controls.get('bottler')?.fill;

  if (!nozzle || !target) {
    return;
  }

  const from = nozzle.getBoundingClientRect();
  const to = target.getBoundingClientRect();

  for (let i = 0; i < count; i += 1) {
    const bottle = document.createElement('img');
    bottle.src = ASSETS.bottle;
    bottle.alt = '';
    bottle.className = 'fx-bottle';
    bottle.style.left = `${from.left + from.width / 2 - 5}px`;
    bottle.style.top = `${from.top + from.height}px`;
    ui.fx.append(bottle);

    const dx =
      to.left +
      to.width * (0.3 + Math.random() * 0.7) -
      (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height);

    const animation = bottle.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(.65)`, opacity: 0 },
      ],
      {
        duration: 520,
        delay: i * 50,
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

/* ---------- Events ---------- */

function rejectionText(reason) {
  switch (reason) {
    case 'no-pots':
      return 'No pots on the line yet.';
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
    case 'bottled':
      render();
      streamBottles(4);
      break;
    case 'batch-complete':
      render();
      break;
    case 'batch-failed':
      endHoldUi();
      render();
      shakeFactory();
      break;
    case 'rejected':
      toast(rejectionText(event.reason));
      render();
      break;
    default:
      render();
  }
}

function resetWithFade(event) {
  if (!event || event.type === 'rejected') {
    return;
  }

  resetting = true;
  ui.tray.classList.add('is-resetting');

  window.setTimeout(() => {
    handle(event);
    moveTrayToActive(true);
    ui.tray.classList.remove('is-resetting');

    window.setTimeout(() => {
      resetting = false;
      render();
    }, RESET_FADE_MS);
  }, RESET_FADE_MS);
}

ui.outcomeAction.addEventListener('click', () => {
  if (resetting) {
    return;
  }

  if (core.phase === PHASES.FAILED) {
    resetWithFade(core.destroyBatch());
  } else if (core.phase === PHASES.COMPLETE) {
    resetWithFade(core.newBatch());
  }
});

/* ---------- Boot ---------- */

buildStationList();
buildStations();
render();
window.requestAnimationFrame(() => moveTrayToActive(true));

window.addEventListener('resize', () => {
  moveTrayToActive(true);
});

