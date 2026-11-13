import { BulletPress } from './bulletPressCore.js';

const params = new URLSearchParams(window.location.search);
const embedded = params.get('embed') === '1';

function embedPost(payload) {
  if (embedded && window.parent !== window) {
    window.parent.postMessage(payload, window.location.origin);
  }
}

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
const teamAmmoStat = document.querySelector('#team-ammo-stat');
const teamAmmoEl = document.querySelector('#team-ammo');

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

const EJECT_DELAY_MS = 400;
const SHIFT_MS = 300;
const MAGAZINE_GAP_PX = 48;
const FLY_DURATION_MS = 200;
const BULLET_PITCH_PX = 24.8;
const BULLET_GAP_PX = 8;
const FEED_TOP_MARGIN_PX = 32;
const reduceMotion = window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

const feedEls = [];
const lineEntries = [];
const trunkBullets = [];
let currentEntry = null;
let manifoldEl = null;
let manifoldTrack = null;
let trunkPitch = 0;
let trunkSerial = 0;
let docked = false;
let shiftTimer = null;

document.documentElement.style.setProperty('--slots', String(core.config.sequenceLength));

function getCssPx(name, fallback) {
  const value = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(name),
  );
  return Number.isFinite(value) ? value : fallback;
}

function getManifoldInset() {
  return getCssPx('--manifold-inset', 48);
}

function getFeedLift() {
  return getCssPx('--feed-lift', 20);
}

function createTrunkBullet() {
  const bullet = document.createElement('span');
  bullet.className = 'manifold__bullet';
  bullet.dataset.id = String(trunkSerial);
  trunkSerial += 1;
  return bullet;
}

function buildTrunk() {
  if (!manifoldEl || !manifoldTrack || feedEls.length === 0) {
    return;
  }

  manifoldTrack.replaceChildren();
  trunkBullets.length = 0;

  const first = feedEls[0];
  const feedsRect = feedsEl.getBoundingClientRect();
  const firstRect = first.getBoundingClientRect();
  const bulletWidth = firstRect.width * 0.86;
  const branchCenter = firstRect.left + firstRect.width / 2 - feedsRect.left;

  manifoldEl.style.left = `${Math.max(0, branchCenter - bulletWidth / 2)}px`;

  trunkPitch =
    feedEls.length > 1
      ? feedEls[1].getBoundingClientRect().left - firstRect.left
      : firstRect.width;

  if (trunkPitch <= 0) {
    trunkPitch = firstRect.width;
  }

  const width = feedsRect.width - Number.parseFloat(manifoldEl.style.left || '0');
  const count = Math.max(2, Math.ceil(width / trunkPitch) + 2);

  for (let i = 0; i < count; i += 1) {
    const bullet = createTrunkBullet();
    bullet.style.transform = `translateX(${i * trunkPitch}px)`;
    manifoldTrack.append(bullet);
    trunkBullets.push(bullet);
  }
}

function advanceTrunk(slotIndex) {
  if (trunkBullets.length === 0 || trunkPitch <= 0) {
    return;
  }

  trunkBullets.splice(slotIndex, 1);
  trunkBullets.forEach((bullet, index) => {
    bullet.style.transform = `translateX(${index * trunkPitch}px)`;
  });

  const targetIndex = trunkBullets.length;
  const bullet = createTrunkBullet();
  bullet.style.transform = `translateX(${(targetIndex + 1) * trunkPitch}px)`;
  manifoldTrack.append(bullet);
  trunkBullets.push(bullet);

  if (reduceMotion) {
    bullet.style.transform = `translateX(${targetIndex * trunkPitch}px)`;
  } else {
    window.requestAnimationFrame(() => {
      bullet.style.transform = `translateX(${targetIndex * trunkPitch}px)`;
    });
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

  const height =
    (feed.clientHeight || feedsEl.clientHeight) - getManifoldInset() - getFeedLift();
  const count = Math.max(
    1,
    Math.floor((height - FEED_TOP_MARGIN_PX + BULLET_GAP_PX) / BULLET_PITCH_PX),
  );

  for (let i = 0; i < count; i += 1) {
    const bullet = createFeedBullet();
    bullet.style.transform = `translateY(${-i * BULLET_PITCH_PX}px)`;
    queue.append(bullet);
  }
}

function advanceFeed(feed, incomingBullet, sourceRect) {
  const queue = feed.querySelector('.feed__queue');

  if (!queue) {
    return null;
  }

  const bullets = [...queue.querySelectorAll('.feed__bullet')];
  bullets.at(-1)?.remove();

  bullets.slice(0, -1).forEach((bullet, index) => {
    bullet.style.transform = `translateY(${-(index + 1) * BULLET_PITCH_PX}px)`;
  });

  const bullet = incomingBullet ?? createFeedBullet();
  bullet.className = 'feed__bullet';
  bullet.style.transform = '';
  queue.append(bullet);

  if (incomingBullet && sourceRect && !reduceMotion) {
    const targetRect = bullet.getBoundingClientRect();
    const dx = sourceRect.left - targetRect.left;
    const dy = sourceRect.top - targetRect.top;
    const animation = bullet.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: 'translate(0, 0)' },
      ],
      { duration: FLY_DURATION_MS, easing: 'ease-in' },
    );
    animation.finished.catch(() => { });
  }
  return bullet;
}

function buildFeeds() {
  feedsEl.replaceChildren();
  feedEls.length = 0;

  manifoldEl = document.createElement('div');
  manifoldEl.className = 'manifold';
  manifoldEl.setAttribute('aria-hidden', 'true');

  const line = document.createElement('span');
  line.className = 'manifold__line';

  const terminus = document.createElement('span');
  terminus.className = 'manifold__terminus';

  manifoldTrack = document.createElement('div');
  manifoldTrack.className = 'manifold__track';

  manifoldEl.append(line, terminus, manifoldTrack);
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

  buildTrunk();

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

  if (core.pausedAtMs !== null) {
    codeStatus.textContent = 'PAUSED · PRESS Q TO RESUME';
  } else if (!docked && !core.complete) {
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
  document.body.classList.toggle('is-paused', core.pausedAtMs !== null);
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
    render();
  }, SHIFT_MS);
}

function handleInput(char) {
  if (!docked || core.complete || core.pausedAtMs !== null) {
    return;
  }

  const slotIndex = core.index;
  const feed = feedEls[slotIndex];
  const queueBullets = feed?.querySelectorAll('.feed__bullet');
  const topBullet = queueBullets?.[queueBullets.length - 1];
  const startRect = topBullet?.getBoundingClientRect();
  const trunkBullet = trunkBullets[slotIndex];
  const trunkRect = trunkBullet?.getBoundingClientRect();

  const event = core.press(char, performance.now());

  if (event.type !== 'correct' && event.type !== 'wrong') {
    return;
  }

  feed?.classList.add('is-used');
  if (event.type === 'wrong') {
    feed?.classList.add('is-wrong');
  }

  advanceFeed(feed, trunkBullet, trunkRect);
  advanceTrunk(slotIndex);

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

    if (embedded && !event.broken && event.multiplier > 0) {
      // One clean magazine issues 10 rounds per production multiplier.
      embedPost({
        type: 'contribute',
        game: 'bullet-press',
        resources: { ammo: 10 * event.multiplier },
      });
    }
  }
}

function tickElapsed() {
  if (core.complete && core.lastDurationMs !== null) {
    elapsedEl.textContent = `${(core.lastDurationMs / 1000).toFixed(2)}s`;
  } else if (docked && core.startedAtMs !== null) {
    elapsedEl.textContent = `${(core.elapsed(performance.now()) / 1000).toFixed(2)}s`;
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

  if (char === 'Q') {
    event.preventDefault();
    if (core.pausedAtMs === null) core.pause(performance.now());
    else core.resume(performance.now());
    render();
    return;
  }

  if (!/^[A-Z]$/.test(char)) {
    return;
  }

  event.preventDefault();
  handleInput(char);
});

window.addEventListener('resize', () => {
  positionMagazines();
  buildTrunk();
  for (const feed of feedEls) {
    refillFeedQueue(feed);
  }
});

window.addEventListener('message', (event) => {
  if (!embedded || event.origin !== window.location.origin) {
    return;
  }

  const data = event.data;
  if (!data || data.type !== 'state') {
    return;
  }

  if (teamAmmoEl && Number.isFinite(data.ammo)) {
    teamAmmoEl.textContent = String(Math.floor(data.ammo));
    teamAmmoStat?.removeAttribute('hidden');
  }
});

buildFeeds();
setupLine();
docked = true;
render();
window.requestAnimationFrame(tickElapsed);
embedPost({ type: 'minigame-ready', game: 'bullet-press' });
