import { ASSETS } from './assets.js';
import { DashSupplementFactory, POT_STATUS } from './dashSupplementFactoryCore.js';

const core = new DashSupplementFactory();
const reduceMotion = window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

const INTAKE_POSITION = { x: 8, y: 16 };
const STATION_POSITIONS = {
  mill: { x: 27, y: 17 },
  vat: { x: 48, y: 15 },
  still: { x: 69, y: 17 },
  press: { x: 38, y: 48 },
  bureau: { x: 56, y: 47 },
  filter: { x: 74, y: 48 },
  bottler: { x: 76, y: 84 },
};
const FLOW_INDEX = {
  intake: 0,
  mill: 1,
  vat: 2,
  still: 3,
  press: 4,
  bureau: 5,
  filter: 6,
  bottler: 7,
};

const LIQUID = {
  mill: '#c8a24b',
  vat: '#a42339',
  press: '#e0842f',
  still: '#b9d9d4',
  filter: '#7fc9ba',
  bureau: '#9d86ca',
  bottler: '#f2c94c',
};

const MACHINE_ICONS = {
  mill: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></svg>',
  vat: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9h16M8 5v15M16 5v15"/></svg>',
  press: '<svg viewBox="0 0 24 24"><path d="M4 3h16M12 3v8M7 11h10v4H7zM9 15v6M15 15v6"/></svg>',
  still: '<svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v5l-4 7a4 4 0 0 0 3.5 6h5a4 4 0 0 0 3.5-6l-4-7V3"/><path d="M8 15h8"/></svg>',
  filter: '<svg viewBox="0 0 24 24"><path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z"/></svg>',
  bureau: '<svg viewBox="0 0 24 24"><path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4M8 11h8M8 15h6"/></svg>',
  bottler: '<svg viewBox="0 0 24 24"><path d="M9 2h6M10 2v4l-2 3v11h8V9l-2-3V2"/><path d="M8 13h8"/></svg>',
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
  floor: byId('floor'),
  canvas: byId('floor-canvas'),
  arrows: byId('arrows'),
  stations: byId('stations'),
  intake: byId('intake'),
  intakeRack: byId('intake-rack'),
  takePot: byId('take-pot'),
  emptiesCount: byId('empties-count'),
  plan: byId('plan'),
  hint: byId('hint'),
  lamp: byId('hud-lamp'),
  activeStat: byId('active-stat'),
  vialsStat: byId('vials-stat'),
  dashStat: byId('dash-stat'),
  spoiledStat: byId('spoiled-stat'),
  toast: byId('toast'),
  fx: byId('fx-layer'),
};

const stationViews = new Map();
const planChips = [];
let drag = null;
let toastTimer = null;
let lastFrame = performance.now();

const processByIndex = core.processes;
const stationMeta = new Map(
  core.stations.map((station) => [station.id, station]),
);

/* ---------- Build the floor ---------- */

function buildStations() {
  core.stations.forEach((station, index) => {
    const position = STATION_POSITIONS[station.id];
    const card = document.createElement('section');
    card.className = 'station';
    card.dataset.stationId = station.id;
    card.style.setProperty('--x', `${position.x}%`);
    card.style.setProperty('--y', `${position.y}%`);
    card.setAttribute('aria-label', station.name);

    card.innerHTML = `
      <div class="station__machine machine--${station.kind}">
        <span class="station__icon" aria-hidden="true">${MACHINE_ICONS[station.kind] ?? ''}</span>
        <span class="station__machine-name">${station.name}</span>
        <span class="station__index">${String(index + 1).padStart(2, '0')}</span>
        <span class="station__lamp" aria-hidden="true"></span>
      </div>
      <div class="station__body">
        <div class="station__slots"></div>
        <div class="station__meta">
          <span data-count>0 / ${core.stationCapacity}</span>
          <span>2 × 2</span>
        </div>
      </div>
    `;

    ui.stations.append(card);
    stationViews.set(station.id, {
      card,
      slots: card.querySelector('.station__slots'),
      count: card.querySelector('[data-count]'),
      capacity: core.stationCapacity,
      label: station.short,
    });
  });

  const bottlerPosition = STATION_POSITIONS.bottler;
  const bottler = document.createElement('section');
  bottler.className = 'station station--bottler';
  bottler.dataset.stationId = 'bottler';
  bottler.style.setProperty('--x', `${bottlerPosition.x}%`);
  bottler.style.setProperty('--y', `${bottlerPosition.y}%`);
  bottler.setAttribute('aria-label', 'Bottler');
  bottler.innerHTML = `
    <div class="station__machine machine--bottler">
      <span class="station__icon" aria-hidden="true">${MACHINE_ICONS.bottler}</span>
      <span class="station__machine-name">BOTTLER</span>
      <span class="station__index">OUT</span>
      <span class="station__lamp" aria-hidden="true"></span>
    </div>
    <div class="station__body">
      <div class="station__slots"></div>
      <div class="station__meta">
        <span data-count>0 / ${core.bottlerCapacity}</span>
        <span>VIALS →</span>
      </div>
    </div>
    <div class="outfeed outfeed--vials" aria-hidden="true">
      <span class="outfeed__label">VIALS</span>
      <div class="belt">
        <span class="belt__track" data-vial-track></span>
      </div>
    </div>
    <div class="outfeed outfeed--empties" aria-hidden="true">
      <span class="outfeed__label">EMPTIES</span>
      <div class="belt belt--empties">
        <span class="belt__track" data-empties-track></span>
      </div>
    </div>
  `;

  ui.stations.append(bottler);
  stationViews.set('bottler', {
    card: bottler,
    slots: bottler.querySelector('.station__slots'),
    count: bottler.querySelector('[data-count]'),
    capacity: core.bottlerCapacity,
    label: 'BOTTLER',
    vialTrack: bottler.querySelector('[data-vial-track]'),
    emptiesTrack: bottler.querySelector('[data-empties-track]'),
  });
}

function buildPlan() {
  ui.plan.replaceChildren();

  processByIndex.forEach((process) => {
    const chip = document.createElement('div');
    chip.className = 'plan-step';
    chip.dataset.processIndex = String(process.order - 1);
    chip.title = `${process.order}. ${process.name} — ${stationMeta.get(process.stationId).name}`;

    const num = document.createElement('span');
    num.className = 'plan-step__num';
    num.textContent = String(process.order).padStart(2, '0');

    const name = document.createElement('span');
    name.className = 'plan-step__name';
    name.textContent = process.name;

    const station = document.createElement('span');
    station.className = 'plan-step__station';
    station.textContent = stationMeta.get(process.stationId).short;

    chip.append(num, name, station);
    ui.plan.append(chip);
    planChips.push(chip);
  });
}

/* ---------- Pots ---------- */

function findPot(potId) {
  return core.pots.find((pot) => pot.id === potId) ?? null;
}

function potFill(pot) {
  if (pot.location === 'intake') {
    return 0;
  }
  if (pot.location === 'bottler') {
    // The pot visibly drains as the bottler pulls its contents out.
    const remaining = 1 - pot.progressMs / core.config.bottlingMs;
    return Math.max(0, Math.min(1, remaining)) * 100;
  }

  const total = processByIndex.length;
  let completed = Math.min(pot.stepIndex, total);
  let fraction = 0;

  if (pot.status === POT_STATUS.WORKING) {
    const process = processByIndex[pot.stepIndex];
    fraction = process
      ? Math.min(1, pot.progressMs / process.durationMs)
      : 0;
  }

  return Math.min(100, ((completed + fraction) / total) * 100);
}

function potLiquid(pot) {
  if (pot.location === 'intake') {
    return '#484334';
  }
  if (pot.location === 'bottler') {
    return LIQUID.bottler;
  }

  const index =
    pot.status === POT_STATUS.WORKING
      ? pot.stepIndex
      : Math.max(0, pot.stepIndex - 1);
  const process = processByIndex[Math.min(index, processByIndex.length - 1)];

  return LIQUID[process?.stationId] ?? '#8d8470';
}

function potBadge(pot) {
  if (pot.location === 'intake') {
    return '○';
  }
  if (pot.location === 'bottler') {
    return pot.status === POT_STATUS.QUEUED ? 'WAIT' : 'BTL';
  }
  if (pot.status === POT_STATUS.WORKING) {
    return String(processByIndex[pot.stepIndex]?.order ?? '·');
  }

  const next = processByIndex[pot.stepIndex];
  return next ? String(next.order) : 'BTL';
}

function potTitle(pot) {
  if (pot.location === 'intake') {
    return `Pot #${pot.id} — empty, drag it to the mill`;
  }
  if (pot.location === 'bottler') {
    if (pot.status === POT_STATUS.QUEUED) {
      return `Pot #${pot.id} — waiting in the bottler queue`;
    }
    const secondsLeft = Math.max(
      0,
      (core.config.bottlingMs - pot.progressMs) / 1000,
    );
    return `Pot #${pot.id} — emptying into vials (${secondsLeft.toFixed(
      1,
    )}s left)`;
  }
  if (pot.status === POT_STATUS.WORKING) {
    const process = processByIndex[pot.stepIndex];
    return `Pot #${pot.id} — process ${process.order} ${process.name} in progress`;
  }

  const next = processByIndex[pot.stepIndex];
  return next
    ? `Pot #${pot.id} — ready, next process ${next.order} at ${stationMeta.get(next.stationId).short}`
    : `Pot #${pot.id} — ready for the bottler`;
}

function isDraggable(pot) {
  return pot.location === 'intake' || pot.status === POT_STATUS.READY;
}

function meterDetails(pot) {
  if (pot.status === POT_STATUS.WORKING) {
    const process = processByIndex[pot.stepIndex];
    return {
      ratio: process ? Math.min(1, pot.progressMs / process.durationMs) : 0,
      color: '#96d05c',
      mode: 'working',
    };
  }

  if (pot.status === POT_STATUS.BOTTLING) {
    return {
      ratio: Math.min(1, pot.progressMs / core.config.bottlingMs),
      color: '#f2c94c',
      mode: 'bottling',
    };
  }

  if (pot.status === POT_STATUS.READY) {
    const process = processByIndex[Math.max(0, pot.stepIndex - 1)];
    const ratio = process
      ? Math.max(0, Math.min(1, pot.windowMsLeft / process.windowMs))
      : 0;

    return {
      ratio,
      color: ratio <= 0.25 ? '#d64545' : ratio <= 0.5 ? '#dd9d34' : '#f2c94c',
      mode: 'ready',
    };
  }

  return { ratio: 0, color: '#96d05c', mode: 'idle' };
}

function setPotMeter(el, pot) {
  const meter = meterDetails(pot);
  el.style.setProperty('--meter', `${Math.round(meter.ratio * 100)}%`);
  el.style.setProperty('--meter-color', meter.color);
  el.classList.toggle(
    'is-warning',
    meter.mode === 'ready' && meter.ratio <= 0.5 && meter.ratio > 0.25,
  );
  el.classList.toggle(
    'is-urgent',
    meter.mode === 'ready' && meter.ratio <= 0.25,
  );
}

function createPotElement(pot) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'pot';
  el.dataset.potId = String(pot.id);
  el.title = potTitle(pot);
  el.setAttribute('aria-label', potTitle(pot));

  if (pot.location === 'intake') {
    el.classList.add('is-empty');
  }
  if (pot.status === POT_STATUS.WORKING) {
    el.classList.add('is-working');
  }
  if (pot.status === POT_STATUS.READY) {
    el.classList.add('is-ready');
  }
  if (pot.status === POT_STATUS.BOTTLING) {
    el.classList.add('is-bottling');
  }
  if (pot.status === POT_STATUS.QUEUED) {
    el.classList.add('is-queued');
  }
  if (isDraggable(pot)) {
    el.classList.add('is-draggable');
  }

  el.style.setProperty('--fill', `${potFill(pot)}%`);
  el.style.setProperty('--liquid', potLiquid(pot));

  el.innerHTML = `
    <span class="pot__badge">${potBadge(pot)}</span>
    <span class="pot__lid"></span>
    <span class="pot__body"><span class="pot__liquid"></span></span>
    <span class="pot__meter"><span class="pot__meter-fill"></span></span>
  `;

  setPotMeter(el, pot);
  return el;
}

/* ---------- Render ---------- */

function renderHud() {
  const active = core.activePots;
  const ready = active.some((pot) => pot.status === POT_STATUS.READY);
  const running = active.some(
    (pot) =>
      pot.status === POT_STATUS.WORKING ||
      pot.status === POT_STATUS.BOTTLING,
  );

  ui.emptiesCount.textContent = String(core.intakePots.length);
  ui.activeStat.textContent = String(active.length);
  ui.vialsStat.textContent = String(core.vialsProduced);
  ui.dashStat.textContent = `${core.secondsProduced}s`;
  ui.spoiledStat.textContent = String(core.potsSpoiled);
  ui.lamp.classList.toggle('is-ready', ready);
  ui.lamp.classList.toggle('is-run', !ready && running);
}

function renderIntake() {
  const pots = core.intakePots;
  ui.intakeRack.replaceChildren(...pots.map(createPotElement));
  ui.intakeRack.classList.toggle('is-empty', pots.length === 0);
}

function createSlots(pots, capacity) {
  const slots = [];

  for (let index = 0; index < capacity; index += 1) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    if (pots[index]) {
      slot.classList.add('has-pot');
      slot.append(createPotElement(pots[index]));
    }
    slots.push(slot);
  }

  return slots;
}

function renderStations() {
  for (const station of core.stations) {
    const view = stationViews.get(station.id);
    const pots = core.getPotsAt(station.id);

    view.slots.replaceChildren(...createSlots(pots, view.capacity));
    view.count.textContent = `${pots.length} / ${view.capacity}`;
    view.card.classList.toggle(
      'has-ready',
      pots.some((pot) => pot.status === POT_STATUS.READY),
    );
    view.card.classList.toggle(
      'is-working',
      pots.some((pot) => pot.status === POT_STATUS.WORKING),
    );
    view.card.classList.toggle('is-full', pots.length >= view.capacity);
  }

  const bottler = stationViews.get('bottler');
  const pots = core.getPotsAt('bottler');
  bottler.slots.replaceChildren(...createSlots(pots, bottler.capacity));
  bottler.count.textContent = `${pots.length} / ${bottler.capacity}`;
  bottler.card.classList.toggle(
    'is-working',
    pots.some((pot) => pot.status === POT_STATUS.BOTTLING),
  );
  bottler.card.classList.toggle('is-full', pots.length >= bottler.capacity);
}

function renderPlan() {
  const live = new Set();

  for (const pot of core.activePots) {
    if (pot.location === 'intake') {
      live.add(0);
    } else if (pot.status === POT_STATUS.WORKING) {
      live.add(pot.stepIndex);
    } else if (pot.status === POT_STATUS.READY) {
      live.add(pot.stepIndex);
    }
  }

  planChips.forEach((chip, index) => {
    chip.classList.toggle('is-live', live.has(index));
  });
}

function stationLabel(id) {
  return stationViews.get(id)?.label ?? (id === 'bottler' ? 'BOTTLER' : id);
}

function nextDestination(pot) {
  if (pot.location === 'bottler') {
    return null;
  }

  let nextIndex;

  if (pot.location === 'intake') {
    nextIndex = 0;
  } else if (pot.status === POT_STATUS.WORKING) {
    nextIndex = pot.stepIndex + 1;
  } else {
    nextIndex = pot.stepIndex;
  }

  const nextProcess = processByIndex[nextIndex] ?? null;
  return {
    toId: nextProcess ? nextProcess.stationId : 'bottler',
    nextIndex,
    process: nextProcess,
  };
}

function renderHint() {
  const active = core.activePots;
  const ready = active.find((pot) => pot.status === POT_STATUS.READY);

  if (ready) {
    const destination = nextDestination(ready);
    const target = stationLabel(destination.toId);

    ui.hint.textContent =
      destination.toId === 'bottler'
        ? `Pot #${ready.id} is ready at ${stationLabel(
            ready.location,
          )} — drag it into the BOTTLER before the timer empties.`
        : `Pot #${ready.id} is ready at ${stationLabel(
            ready.location,
          )} — drag it to ${target} (process ${destination.process.order}) before the timer empties.`;
    return;
  }

  const bottling = active.find(
    (pot) => pot.status === POT_STATUS.BOTTLING,
  );
  if (bottling) {
    const waiting = active.filter(
      (pot) => pot.status === POT_STATUS.QUEUED,
    ).length;
    ui.hint.textContent = `Pot #${bottling.id} is emptying onto the vial belt — one pot at a time, ${core.config.bottlingMs / 1000} seconds each.${waiting > 0 ? ` ${waiting} pot${waiting === 1 ? '' : 's'} waiting.` : ''}`;
    return;
  }

  if (active.length === 0) {
    ui.hint.textContent =
      core.vialsProduced > 0
        ? `${core.vialsProduced} vials banked. Take another pot from the intake.`
        : 'Take empty pots from the top-left intake.';
    return;
  }

  if (active.every((pot) => pot.location === 'intake')) {
    ui.hint.textContent =
      'Drag an empty pot into the GRAIN MILL for process 1.';
    return;
  }

  ui.hint.textContent =
    'Stations work on their own. Keep every pot moving before its ready timer runs out.';
}

function render() {
  renderHud();
  renderPlan();
  renderIntake();
  renderStations();
  renderArrows();
  renderHint();
}

function updateLiveUi() {
  document.querySelectorAll('.pot[data-pot-id]').forEach((el) => {
    if (el.closest('.fx-layer') || el.classList.contains('drag-ghost')) {
      return;
    }

    const pot = findPot(Number(el.dataset.potId));
    if (!pot) {
      return;
    }

    el.style.setProperty('--fill', `${potFill(pot)}%`);
    setPotMeter(el, pot);
  });
}

/* ---------- Arrows ---------- */

function svgElement(name) {
  return document.createElementNS('http://www.w3.org/2000/svg', name);
}

function nodeRect(id, canvasRect) {
  const el = id === 'intake' ? ui.intake : stationViews.get(id)?.card;
  if (!el) {
    return null;
  }

  const rect = el.getBoundingClientRect();
  return {
    left: rect.left - canvasRect.left,
    top: rect.top - canvasRect.top,
    width: rect.width,
    height: rect.height,
  };
}

function centerOf(rect) {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function edgePoint(rect, toward, pad = 7) {
  const center = centerOf(rect);
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const halfW = rect.width / 2 + pad;
  const halfH = rect.height / 2 + pad;

  if (dx === 0 && dy === 0) {
    return center;
  }

  const scaleX = dx === 0 ? Number.POSITIVE_INFINITY : halfW / Math.abs(dx);
  const scaleY = dy === 0 ? Number.POSITIVE_INFINITY : halfH / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);

  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale,
  };
}

function renderArrows() {
  const canvasRect = ui.canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(canvasRect.width));
  const height = Math.max(1, Math.round(canvasRect.height));

  ui.arrows.setAttribute('viewBox', `0 0 ${width} ${height}`);
  ui.arrows.replaceChildren();

  const defs = svgElement('defs');
  defs.innerHTML = `
    <marker id="arrow-dim" viewBox="0 0 10 10" refX="8" refY="5"
      markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M0 0 10 5 0 10z" fill="#6d6855"></path>
    </marker>
    <marker id="arrow-gold" viewBox="0 0 10 10" refX="8" refY="5"
      markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M0 0 10 5 0 10z" fill="#f2c94c"></path>
    </marker>
  `;
  ui.arrows.append(defs);

  const groups = new Map();

  for (const pot of core.activePots) {
    const destination = nextDestination(pot);
    if (!destination || destination.toId === pot.location) {
      continue;
    }

    const key = `${pot.location}->${destination.toId}`;
    let group = groups.get(key);

    if (!group) {
      group = {
        fromId: pot.location,
        toId: destination.toId,
        orders: new Set(),
        ready: false,
        count: 0,
      };
      groups.set(key, group);
    }

    group.count += 1;
    group.ready =
      group.ready ||
      pot.status === POT_STATUS.READY ||
      pot.location === 'intake';
    group.orders.add(destination.process?.order ?? 'BTL');
  }

  if (groups.size === 0 && core.activePots.length === 0) {
    groups.set('intake->mill', {
      fromId: 'intake',
      toId: 'mill',
      orders: new Set([1]),
      ready: false,
      count: 0,
    });
  }

  for (const group of groups.values()) {
    const fromRect = nodeRect(group.fromId, canvasRect);
    const toRect = nodeRect(group.toId, canvasRect);

    if (!fromRect || !toRect) {
      continue;
    }

    const start = edgePoint(fromRect, centerOf(toRect));
    const end = edgePoint(toRect, centerOf(fromRect));
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy) || 1;
    const fromIndex = FLOW_INDEX[group.fromId] ?? 0;
    const toIndex = FLOW_INDEX[group.toId] ?? 0;
    const direction = fromIndex <= toIndex ? 1 : -1;
    const bend = Math.min(54, distance * 0.15) * direction;
    const normalX = -dy / distance;
    const normalY = dx / distance;
    const controlX = (start.x + end.x) / 2 + normalX * bend;
    const controlY = (start.y + end.y) / 2 + normalY * bend;

    const path = svgElement('path');
    path.setAttribute(
      'd',
      `M ${start.x} ${start.y} Q ${controlX} ${controlY} ${end.x} ${end.y}`,
    );
    path.setAttribute(
      'class',
      `arrow ${group.ready ? 'arrow--ready' : 'arrow--waiting'}`,
    );
    path.setAttribute(
      'marker-end',
      group.ready ? 'url(#arrow-gold)' : 'url(#arrow-dim)',
    );
    ui.arrows.append(path);

    const label = svgElement('text');
    label.setAttribute('x', String(0.25 * start.x + 0.5 * controlX + 0.25 * end.x));
    label.setAttribute('y', String(0.25 * start.y + 0.5 * controlY + 0.25 * end.y));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute(
      'class',
      `arrow__label${group.ready ? ' arrow__label--ready' : ''}`,
    );
    label.textContent = [...group.orders].join('·');
    ui.arrows.append(label);
  }
}

/* ---------- Drag and drop ---------- */

function updateDragCards() {
  const expected = drag ? nextDestination(findPot(drag.potId))?.toId : null;

  for (const [id, view] of stationViews) {
    view.card.classList.toggle('is-valid-target', id === expected);
    view.card.classList.remove('is-drop-invalid');
  }
}

function targetUnderPointer(clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY);
  const card = el?.closest('.station');
  const id = card?.dataset.stationId;

  return id && stationViews.has(id) ? id : null;
}

function moveGhost(clientX, clientY) {
  if (!drag) {
    return;
  }
  drag.ghost.style.left = `${clientX - drag.offsetX}px`;
  drag.ghost.style.top = `${clientY - drag.offsetY}px`;
}

function onPointerMove(event) {
  if (!drag) {
    return;
  }

  moveGhost(event.clientX, event.clientY);
  const targetId = targetUnderPointer(event.clientX, event.clientY);

  if (targetId === drag.hoverId) {
    return;
  }

  drag.hoverId = targetId;

  for (const [id, view] of stationViews) {
    view.card.classList.toggle('is-drop-hover', id === targetId);
    view.card.classList.toggle(
      'is-drop-invalid',
      id === targetId && id !== drag.expectedId,
    );
  }
}

function cleanupDrag() {
  if (!drag) {
    return;
  }

  drag.ghost.remove();
  drag.originEl?.classList.remove('is-dragging-source');
  document.body.classList.remove('is-dragging');

  for (const view of stationViews.values()) {
    view.card.classList.remove(
      'is-valid-target',
      'is-drop-hover',
      'is-drop-invalid',
    );
  }

  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerCancel);
  drag = null;
}

function onPointerUp(event) {
  if (!drag) {
    return;
  }

  const potId = drag.potId;
  const targetId = targetUnderPointer(event.clientX, event.clientY);

  cleanupDrag();

  if (targetId) {
    const eventResult = core.dropPot(potId, targetId);

    if (eventResult.type === 'rejected') {
      toast(rejectionText(eventResult));
    }
  }

  render();
}

function onPointerCancel() {
  cleanupDrag();
  render();
}

function onPointerDown(event) {
  if (event.button !== 0) {
    return;
  }

  const potEl = event.target.closest('.pot');
  if (!potEl || potEl.closest('.fx-layer')) {
    return;
  }

  const pot = findPot(Number(potEl.dataset.potId));
  if (!pot) {
    return;
  }

  if (!isDraggable(pot)) {
    if (
      pot.status === POT_STATUS.WORKING ||
      pot.status === POT_STATUS.BOTTLING
    ) {
      toast(`Pot #${pot.id} is still working.`);
    }
    return;
  }

  event.preventDefault();

  const rect = potEl.getBoundingClientRect();
  const ghost = potEl.cloneNode(true);
  ghost.classList.remove('is-working', 'is-ready', 'is-urgent', 'is-warning');
  ghost.classList.add('drag-ghost');
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.tabIndex = -1;
  ui.fx.append(ghost);

  potEl.classList.add('is-dragging-source');

  drag = {
    potId: pot.id,
    ghost,
    originEl: potEl,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    expectedId: nextDestination(pot)?.toId ?? null,
    hoverId: null,
  };

  document.body.classList.add('is-dragging');
  updateDragCards();

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);
}

/* ---------- Events, FX, and hints ---------- */

function stationName(id) {
  return id === 'bottler' ? 'BOTTLER' : stationMeta.get(id)?.name ?? id;
}

function rejectionText(event) {
  switch (event.reason) {
    case 'wrong-station':
      return `Wrong station — that pot needs ${stationName(
        event.expectedStationId,
      )} for process ${event.process?.order}.`;
    case 'pot-busy':
      return 'That pot is still being processed.';
    case 'station-full':
      return 'That station already holds four pots.';
    case 'bottler-full':
      return 'The bottler is full. Wait for a pot to finish.';
    case 'processes-remaining':
      return `That pot still needs process ${event.process?.order} at ${stationName(
        event.process?.stationId,
      )}.`;
    case 'ready-for-bottler':
      return 'All twelve processes are done — drop it in the bottler.';
    case 'already-there':
      return 'That pot is already at this station.';
    case 'pot-gone':
      return 'That pot has already left the line.';
    case 'unknown-station':
      return 'That is not a station.';
    case 'unknown-pot':
      return 'Unknown pot.';
    default:
      return 'That move is not possible right now.';
  }
}

function toast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    ui.toast.classList.remove('is-visible');
  }, 2100);
}

function pulseStation(id) {
  const view = stationViews.get(id);
  if (!view) {
    return;
  }

  view.card.classList.remove('is-pumping');
  void view.card.offsetWidth;
  view.card.classList.add('is-pumping');
  window.setTimeout(() => view.card.classList.remove('is-pumping'), 380);
}

function clonePotVisual(potEl) {
  const clone = potEl.cloneNode(true);
  clone.classList.remove(
    'is-ready',
    'is-working',
    'is-bottling',
    'is-queued',
    'is-urgent',
    'is-warning',
    'is-draggable',
    'is-dragging-source',
  );
  clone.removeAttribute('data-pot-id');
  clone.tabIndex = -1;
  clone.disabled = true;
  return clone;
}

function captureSpoiledFx(potId) {
  if (reduceMotion) {
    return;
  }

  const el = document.querySelector(
    `.pot[data-pot-id="${potId}"]:not(.drag-ghost)`,
  );
  if (!el) {
    return;
  }

  const rect = el.getBoundingClientRect();
  const clone = clonePotVisual(el);
  clone.classList.add('fx-pot');
  clone.style.left = `${rect.left}px`;
  clone.style.top = `${rect.top}px`;
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;
  ui.fx.append(clone);

  const animation = clone.animate(
    [
      { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
      { transform: 'translate(0, 100px) scale(0.5) rotate(26deg)', opacity: 0 },
    ],
    {
      duration: 680,
      easing: 'ease-in',
      fill: 'forwards',
    },
  );

  animation.finished.then(() => clone.remove()).catch(() => clone.remove());
}

/* Emptied pots ride the lower conveyor away; they never fade in place. */
function sendPotDownEmpties(potId) {
  if (reduceMotion) {
    return;
  }

  const track = stationViews.get('bottler')?.emptiesTrack;
  const el = document.querySelector(
    `.pot[data-pot-id="${potId}"]:not(.drag-ghost)`,
  );

  if (!track || !el) {
    return;
  }

  const clone = clonePotVisual(el);
  clone.classList.add('is-empty', 'belt-pot');

  const badge = clone.querySelector('.pot__badge');
  if (badge) {
    badge.textContent = '○';
  }
  clone.style.setProperty('--fill', '0%');
  clone.style.setProperty('--liquid', 'transparent');

  track.append(clone);

  const travel = track.clientWidth + 80;
  const duration = Math.max(900, (travel / 95) * 1000);
  const animation = clone.animate(
    [
      { transform: 'translate(-12px, -68px) rotate(-9deg)' },
      { transform: 'translate(0, 0) rotate(0deg)', offset: 0.1 },
      { transform: `translate(${travel}px, 0) rotate(0deg)` },
    ],
    {
      duration,
      easing: 'linear',
      fill: 'forwards',
    },
  );

  animation.finished.then(() => clone.remove()).catch(() => clone.remove());
}

/* Vials are released one at a time as the active pot drains. */
function spawnVial() {
  if (reduceMotion) {
    return;
  }

  const track = stationViews.get('bottler')?.vialTrack;
  if (!track) {
    return;
  }

  const vial = document.createElement('img');
  vial.src = ASSETS.vial;
  vial.alt = '';
  vial.className = 'belt-vial';
  track.append(vial);

  const travel = track.clientWidth + 40;
  const duration = Math.max(1100, (travel / 110) * 1000);
  const animation = vial.animate(
    [
      { transform: 'translate(-16px, 0)' },
      { transform: `translate(${travel}px, 0)` },
    ],
    {
      duration,
      easing: 'linear',
      fill: 'forwards',
    },
  );

  animation.finished.then(() => vial.remove()).catch(() => vial.remove());
}

const vialEmitted = new Map();

function vialQuota(progressMs) {
  const perVial = core.config.bottlingMs / core.config.vialsPerPot;
  return Math.max(
    0,
    Math.min(
      core.config.vialsPerPot,
      Math.floor(progressMs / perVial + 1e-6),
    ),
  );
}

function updateBottlingFlow() {
  const active = core.pots.find(
    (pot) =>
      pot.location === 'bottler' && pot.status === POT_STATUS.BOTTLING,
  );

  if (!active) {
    return;
  }

  const emitted = vialQuota(active.progressMs);
  const previous = vialEmitted.get(active.id) ?? 0;

  if (emitted <= previous) {
    return;
  }

  for (let index = previous; index < emitted; index += 1) {
    spawnVial();
  }
  vialEmitted.set(active.id, emitted);
}

function handleEvents(events) {
  for (const event of events) {
    switch (event.type) {
      case 'process-complete':
        pulseStation(event.stationId);
        break;
      case 'pot-spoiled':
        captureSpoiledFx(event.potId);
        toast(
          `Pot #${event.potId} spoiled at ${stationLabel(event.stationId)} — the timer ran out.`,
        );
        break;
      case 'pot-bottled': {
        const already = vialEmitted.get(event.potId) ?? 0;
        const remaining = Math.max(0, event.vials - already);
        for (let index = 0; index < remaining; index += 1) {
          spawnVial();
        }
        vialEmitted.delete(event.potId);
        sendPotDownEmpties(event.potId);
        break;
      }
      default:
        break;
    }
  }
}

/* ---------- Input ---------- */

ui.takePot.addEventListener('click', () => {
  core.takePot();
  render();
});

window.addEventListener('pointerdown', onPointerDown);
window.addEventListener('resize', renderArrows);
window.addEventListener('visibilitychange', () => {
  lastFrame = performance.now();
});

document.fonts?.ready.then(renderArrows).catch(() => {});

/* ---------- Boot and game loop ---------- */

ui.intake.style.setProperty('--intake-x', `${INTAKE_POSITION.x}%`);
ui.intake.style.setProperty('--intake-y', `${INTAKE_POSITION.y}%`);

buildStations();
buildPlan();
render();

window.requestAnimationFrame(() => {
  renderArrows();
});

function frame(now) {
  const delta = Math.min(250, Math.max(0, now - lastFrame));
  lastFrame = now;

  if (!document.hidden) {
    const result = core.advance(delta);

    if (result.events.length > 0) {
      handleEvents(result.events);
    }

    updateBottlingFlow();

    if (result.events.length > 0) {
      render();
    } else {
      updateLiveUi();
    }
  }

  window.requestAnimationFrame(frame);
}

window.requestAnimationFrame((now) => {
  lastFrame = now;
  window.requestAnimationFrame(frame);
});
