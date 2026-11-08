import { BulletPress } from './bulletPressCore.js';

const core = new BulletPress();

const multiplierEl = document.querySelector('#multiplier');
const magazinesEl = document.querySelector('#magazines');
const brokenEl = document.querySelector('#broken');
const elapsedEl = document.querySelector('#elapsed');
const codeRow = document.querySelector('#code-row');
const codeStatus = document.querySelector('#code-status');
const magazineTrack = document.querySelector('#magazine-track');
const feedsEl = document.querySelector('#feeds');
const fxLayer = document.querySelector('#fx-layer');

if (
  !multiplierEl ||
  !magazinesEl ||
  !brokenEl ||
  !elapsedEl ||
  !codeRow ||
  !codeStatus ||
  !magazineTrack ||
  !feedsEl ||
  !fxLayer
) {
  throw new Error('Bullet Press UI is incomplete');
}

const EJECT_DELAY_MS = 420;
const SHIFT_MS = 300;
const MAGAZINE_GAP_PX = 48;
const FLY_DURATION_MS = 220;
const BULLET_PITCH_PX = 24.8;
const BULLET_GAP_PX = 8;
const FEED_TOP_MARGIN_PX = 32;
const MANIFOLD_DURATION_MS = 4800;
const MANIFOLD_SPACING_PX = 88;
const reduceMotion = window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

const feedEls = [];
const lineEntries = [];
let currentEntry = null;
let manifoldEl = null;
let docked = false;
let shiftTimer = null;

document.documentElement.style.setProperty('--slots', String(core.config.sequenceLength));

function getManifoldInset() {
  const value = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--manifold-inset'),
  );
  return Number.isFinite(value) ? value : 48;
}

function buildManifold() {
  if (!manifoldEl) {
    return;
  }

  manifoldEl.replaceChildren();

  const line = document.createElement('span');
  line.className = 'manifold__line';
  manifoldEl.append(line);

  const count = Math.max(8, Math.ceil(window.innerWidth / MANIFOLD_SPACING_PX));

  for (let i = 0; i < count; i += 1) {
    const bullet = document.createElement('span');
    bullet.className = 'manifold__bullet';

    if (reduceMotion) {
      bullet.style.left = `${(i / count) * 100}%`;
    } else {
      bullet.style.animationDuration = `${MANIFOLD_DURATION_MS}ms`;
      bullet.style.animationDelay = `${-(i / count) * MANIFOLD_DURATION_MS}ms`;
    }

    manifoldEl.append(bullet);
  }
}

function createFeedBullet() {
  const bullet = document.createElement('span');
  bullet.className = 'feed__bullet';
  return bullet;
}

function refillFeedQueue(feed) {
  const queue = feed.querySelector('.feed__queue');

  if (!queue) {
    return;
  }

  queue.replaceChildren();
  queue.style.setProperty('--queue-shift', '0px');

  const height = (feed.clientHeight || feedsEl.clientHeight) - getManifoldInset();
  const count = Math.max(
    1,
    Math.floor((height - FEED_TOP_MARGIN_PX + BULLET_GAP_PX) / BULLET_PITCH_PX),
  );

  for (let i = 0; i < count; i += 1) {
    queue.append(createFeedBullet());
  }

  if (feed.classList.contains('is-used')) {
    queue.firstElementChild?.remove();
    queue.style.setProperty('--queue-shift', `-${BULLET_PITCH_PX}px`);
  }
}

function buildFeeds() {
  feedsEl.replaceChildren();
  feedEls.length = 0;

  manifoldEl = document.createElement('div');
  manifoldEl.className = 'manifold';
  manifoldEl.setAttribute('aria-hidden', 'true');
  feedsEl.append(manifoldEl);

  for (let i = 0; i < core.config.sequenceLength; i += 1) {
    const feed = document.createElement('div');
    feed.className = 'feed';
    feed.dataset.index = String(i);

    const line = document.createElement('span');
    line.className = 'feed__line';

    const fill = document.createElement('span');
    fill.className = 'feed__fill';

    const arrow = document.createElement('span');
    arrow.className = 'feed__arrow';

    const junction = document.createElement('span');
    junction.className = 'feed__junction';

    const queue = document.createElement('div');
    queue.className = 'feed__queue';

    feed.append(line, fill, arrow, junction, queue);
    feedsEl.append(feed);
    feedEls.push(feed);
  }

  buildManifold();

  for (const feed of feedEls) {
    refillFeedQueue(feed);
  }
}

function resetFeeds() {
  for (const feed of feedEls) {
    feed.classList.remove('is-used', 'is-wrong');
    refillFeedQueue(feed);
  }
}

function createMagazineEntry({ waiting = false } = {}) {
  const el = document.createElement('div');
  el.className = 'magazine';
  if (waiting) {
    el.classList.add('is-waiting');
  }

  const slotsEl = document.createElement('div');
  slotsEl.className = 'magazine__slots';

  const labelEl = document.createElement('span');
  labelEl.className = 'magazine__label';

  el.append(slotsEl, labelEl);
  magazineTrack.append(el);

  return { el, slotsEl, labelEl };
}

function renderEmptyShell(entry) {
  entry.slotsEl.replaceChildren();

  for (let i = 0; i < core.config.sequenceLength; i += 1) {
    const slot = document.createElement('span');
    slot.className = 'magazine__slot';
    entry.slotsEl.append(slot);
  }

  entry.labelEl.textContent = 'EMPTY';
  entry.el.classList.add('is-waiting');
  entry.el.classList.remove('is-broken', 'is-current', 'is-previous', 'is-leaving');
}

function getStep() {
  const sample = lineEntries[0]?.el;
  if (!sample) {
    return 0;
  }

  return sample.offsetWidth + MAGAZINE_GAP_PX;
}

function positionMagazines() {
  const step = getStep();

  lineEntries.forEach((entry, index) => {
    const offset = (index - 2) * step;
    entry.el.style.transform = `translate(calc(-50% + ${offset}px), -50%)`;
  });
}

function renderStats() {
  multiplierEl.textContent = core.lastMultiplier === null ? '—' : `x${core.lastMultiplier}`;
  magazinesEl.textContent = String(core.production);
  brokenEl.textContent = String(core.brokenMagazines);
}

function renderCode() {
  codeRow.replaceChildren();

  for (let i = 0; i < core.sequence.length; i += 1) {
    const char = document.createElement('span');
    char.className = 'code-char';
    char.textContent = core.sequence[i];

    const slot = core.slots[i];

    if (slot) {
      char.classList.add(slot.correct ? 'is-correct' : 'is-wrong');
    } else if (docked && !core.complete && i === core.index) {
      char.classList.add('is-current');
    }

    codeRow.append(char);
  }

  if (!docked && !core.complete) {
    codeStatus.textContent = 'LOADING MAGAZINE…';
  } else if (core.complete) {
    const seconds = (core.lastDurationMs / 1000).toFixed(2);
    codeStatus.textContent = core.brokenMagazine
      ? `BROKEN · ${seconds}s`
      : `PERFECT · x${core.lastMultiplier} · ${seconds}s`;
  } else {
    codeStatus.textContent = '';
  }
}

function renderCurrentMagazine() {
  const entry = currentEntry;
  if (!entry) {
    return;
  }

  entry.el.classList.remove('is-waiting', 'is-previous', 'is-leaving');
  entry.el.classList.add('is-current');
  entry.el.classList.toggle('is-broken', core.brokenMagazine);

  entry.slotsEl.replaceChildren();

  for (let i = 0; i < core.config.sequenceLength; i += 1) {
    const slot = document.createElement('span');
    slot.className = 'magazine__slot';

    const loaded = core.slots[i];

    if (loaded) {
      slot.classList.add(loaded.correct ? 'is-correct' : 'is-wrong');
    } else if (docked && !core.complete && i === core.index) {
      slot.classList.add('is-current');
    }

    entry.slotsEl.append(slot);
  }

  entry.labelEl.textContent = core.complete
    ? core.brokenMagazine
      ? 'BROKEN'
      : 'PERFECT'
    : core.brokenMagazine
      ? 'BROKEN'
      : 'MAGAZINE';
}

function render() {
  renderStats();
  renderCode();
  renderCurrentMagazine();
}

function flyBullet(correct, startRect, endRect) {
  const rect = document.createElement('div');
  rect.className = correct ? 'fly-bullet' : 'fly-bullet is-wrong';
  rect.style.left = `${startRect.left}px`;
  rect.style.top = `${startRect.top}px`;
  rect.style.width = `${startRect.width}px`;
  rect.style.height = `${startRect.height}px`;
  fxLayer.append(rect);

  const dx =
    endRect.left + endRect.width / 2 - (startRect.left + startRect.width / 2);
  const dy = endRect.top + endRect.height / 2 - (startRect.top + startRect.height / 2);
  const scaleX = endRect.width / startRect.width;
  const scaleY = endRect.height / startRect.height;

  const animation = rect.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`, opacity: 1 },
    ],
    { duration: FLY_DURATION_MS, easing: 'ease-in' },
  );

  animation.finished.then(() => rect.remove()).catch(() => rect.remove());
}

function shiftLine() {
  shiftTimer = null;

  if (!currentEntry) {
    return;
  }

  const step = getStep();
  const completed = currentEntry;

  if (lineEntries.length > 3) {
    const oldPrevious = lineEntries[3];
    lineEntries.splice(3, 1);
    oldPrevious.el.classList.remove('is-current', 'is-previous');
    oldPrevious.el.classList.add('is-leaving');
    oldPrevious.el.style.transform = `translate(calc(-50% + ${2 * step}px), -50%)`;
    window.setTimeout(() => oldPrevious.el.remove(), SHIFT_MS + 100);
  }

  completed.el.classList.remove('is-current');
  completed.el.classList.add('is-previous');

  const newFar = createMagazineEntry({ waiting: true });
  renderEmptyShell(newFar);
  newFar.el.style.transform = `translate(calc(-50% + ${-3 * step}px), -50%)`;
  void newFar.el.offsetWidth;

  const newCurrent = lineEntries[1];
  lineEntries.unshift(newFar);
  currentEntry = newCurrent;

  newCurrent.el.classList.remove('is-waiting');
  newCurrent.el.classList.add('is-current');

  positionMagazines();

  window.clearTimeout(shiftTimer);
  shiftTimer = window.setTimeout(() => {
    core.nextMagazine();
    resetFeeds();
    docked = true;
    core.start(performance.now());
    render();
  }, SHIFT_MS);
}

function handleInput(char) {
  if (!docked || core.complete) {
    return;
  }

  const slotIndex = core.index;
  const feed = feedEls[slotIndex];
  const topBullet = feed?.querySelector('.feed__bullet');
  const startRect = topBullet?.getBoundingClientRect();

  const event = core.press(char, performance.now());

  if (event.type !== 'correct' && event.type !== 'wrong') {
    return;
  }

  feed?.classList.add('is-used');
  if (event.type === 'wrong') {
    feed?.classList.add('is-wrong');
  }

  topBullet?.remove();
  feed
    ?.querySelector('.feed__queue')
    ?.style.setProperty('--queue-shift', `-${BULLET_PITCH_PX}px`);

  if (core.complete) {
    docked = false;
  }

  render();

  const targetRect = currentEntry?.slotsEl.children[slotIndex]?.getBoundingClientRect();

  if (!reduceMotion && startRect && targetRect) {
    flyBullet(event.correct, startRect, targetRect);
  }

  if (core.complete) {
    window.clearTimeout(shiftTimer);
    shiftTimer = window.setTimeout(shiftLine, EJECT_DELAY_MS);
  }
}

function tickElapsed() {
  if (core.complete && core.lastDurationMs !== null) {
    elapsedEl.textContent = `${(core.lastDurationMs / 1000).toFixed(2)}s`;
  } else if (docked && core.startedAtMs !== null) {
    elapsedEl.textContent = `${((performance.now() - core.startedAtMs) / 1000).toFixed(2)}s`;
  } else {
    elapsedEl.textContent = '—';
  }

  window.requestAnimationFrame(tickElapsed);
}

function setupLine() {
  const far = createMagazineEntry({ waiting: true });
  const near = createMagazineEntry({ waiting: true });
  const current = createMagazineEntry();

  lineEntries.push(far, near, current);
  currentEntry = current;

  renderEmptyShell(far);
  renderEmptyShell(near);
  renderCurrentMagazine();

  magazineTrack.classList.add('no-transition');
  positionMagazines();
  window.requestAnimationFrame(() => magazineTrack.classList.remove('no-transition'));
}

window.addEventListener('keydown', (event) => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  const char = event.key.toUpperCase();

  if (!/^[A-Z]$/.test(char)) {
    return;
  }

  event.preventDefault();
  handleInput(char);
});

window.addEventListener('resize', () => {
  positionMagazines();
  buildManifold();
  for (const feed of feedEls) {
    refillFeedQueue(feed);
  }
});

buildFeeds();
setupLine();
docked = true;
core.start(performance.now());
render();
window.requestAnimationFrame(tickElapsed);
