import { BulletPress } from './bulletPressCore.js';

const core = new BulletPress();

const multiplierEl = document.querySelector('#multiplier');
const magazinesEl = document.querySelector('#magazines');
const brokenEl = document.querySelector('#broken');
const elapsedEl = document.querySelector('#elapsed');
const codeRow = document.querySelector('#code-row');
const codeStatus = document.querySelector('#code-status');
const magazine = document.querySelector('#magazine');
const magazineSlots = document.querySelector('#magazine-slots');
const magazineLabel = document.querySelector('#magazine-label');
const feedsEl = document.querySelector('#feeds');
const fxLayer = document.querySelector('#fx-layer');

if (
  !multiplierEl ||
  !magazinesEl ||
  !brokenEl ||
  !elapsedEl ||
  !codeRow ||
  !codeStatus ||
  !magazine ||
  !magazineSlots ||
  !magazineLabel ||
  !feedsEl ||
  !fxLayer
) {
  throw new Error('Bullet Press UI is incomplete');
}

const EJECT_DELAY_MS = 420;
const ENTER_DURATION_MS = 340;
const FLY_DURATION_MS = 220;
const reduceMotion = window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

const feedEls = [];
let docked = false;
let ejectTimer = null;

document.documentElement.style.setProperty('--slots', String(core.config.sequenceLength));

function buildFeeds() {
  feedsEl.replaceChildren();
  feedEls.length = 0;

  for (let i = 0; i < core.config.sequenceLength; i += 1) {
    const feed = document.createElement('div');
    feed.className = 'feed';
    feed.dataset.index = String(i);

    const line = document.createElement('span');
    line.className = 'feed__line';

    const bullet = document.createElement('span');
    bullet.className = 'feed__bullet';

    feed.append(line, bullet);
    feedsEl.append(feed);
    feedEls.push(feed);
  }
}

function resetFeeds() {
  for (const feed of feedEls) {
    feed.classList.remove('is-used');
  }
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
    codeStatus.textContent = 'Type the highlighted character';
  }
}

function renderMagazine() {
  magazineSlots.replaceChildren();

  for (let i = 0; i < core.config.sequenceLength; i += 1) {
    const slot = document.createElement('span');
    slot.className = 'magazine__slot';

    const loaded = core.slots[i];

    if (loaded) {
      slot.classList.add(loaded.correct ? 'is-correct' : 'is-wrong');
    } else if (docked && !core.complete && i === core.index) {
      slot.classList.add('is-current');
    }

    magazineSlots.append(slot);
  }

  magazine.classList.toggle('is-broken', core.brokenMagazine);
  magazineLabel.textContent = core.complete
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
  renderMagazine();
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

function animateMagazineIn() {
  docked = false;
  render();

  if (reduceMotion) {
    docked = true;
    core.start(performance.now());
    render();
    return;
  }

  const animation = magazine.animate(
    [
      { transform: 'translate(-50%, -50%) translateX(-360px)', opacity: 0.35 },
      { transform: 'translate(-50%, -50%) translateX(0)', opacity: 1 },
    ],
    { duration: ENTER_DURATION_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
  );

  animation.finished
    .then(() => {
      docked = true;
      core.start(performance.now());
      render();
    })
    .catch(() => {});
}

function ejectMagazine() {
  ejectTimer = null;

  const prepareNext = () => {
    core.nextMagazine();
    resetFeeds();
    render();
    animateMagazineIn();
  };

  if (reduceMotion) {
    prepareNext();
    return;
  }

  const animation = magazine.animate(
    [
      { transform: 'translate(-50%, -50%) translateX(0)', opacity: 1 },
      { transform: 'translate(-50%, -50%) translateX(360px)', opacity: 0.35 },
    ],
    { duration: 300, easing: 'ease-in' },
  );

  animation.finished.then(prepareNext).catch(prepareNext);
}

function handleInput(char) {
  if (!docked || core.complete) {
    return;
  }

  const slotIndex = core.index;
  const feedBullet = feedEls[slotIndex]?.querySelector('.feed__bullet');
  const startRect = feedBullet?.getBoundingClientRect();

  const event = core.press(char, performance.now());

  if (event.type !== 'correct' && event.type !== 'wrong') {
    return;
  }

  feedEls[slotIndex]?.classList.add('is-used');

  if (core.complete) {
    docked = false;
  }

  render();

  const targetRect = magazineSlots.children[slotIndex]?.getBoundingClientRect();

  if (!reduceMotion && startRect && targetRect) {
    flyBullet(event.correct, startRect, targetRect);
  }

  if (core.complete) {
    window.clearTimeout(ejectTimer);
    ejectTimer = window.setTimeout(ejectMagazine, EJECT_DELAY_MS);
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

window.addEventListener('keydown', (event) => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  const char = event.key.toUpperCase();

  if (!/^[A-Z0-9]$/.test(char)) {
    return;
  }

  event.preventDefault();
  handleInput(char);
});

buildFeeds();
render();
docked = true;
core.start(performance.now());
render();
window.requestAnimationFrame(tickElapsed);
