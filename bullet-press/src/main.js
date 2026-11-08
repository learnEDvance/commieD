import { BulletPress } from './bulletPressCore.js';

const core = new BulletPress();

const multiplierEl = document.querySelector('#multiplier');
const magazinesEl = document.querySelector('#magazines');
const brokenEl = document.querySelector('#broken');
const codeRow = document.querySelector('#code-row');
const codeStatus = document.querySelector('#code-status');
const magazine = document.querySelector('#magazine');
const magazineSlots = document.querySelector('#magazine-slots');
const magazineLabel = document.querySelector('#magazine-label');
const inputRow = document.querySelector('#input-row');
const fxLayer = document.querySelector('#fx-layer');

if (
  !multiplierEl ||
  !magazinesEl ||
  !brokenEl ||
  !codeRow ||
  !codeStatus ||
  !magazine ||
  !magazineSlots ||
  !magazineLabel ||
  !inputRow ||
  !fxLayer
) {
  throw new Error('Bullet Press UI is incomplete');
}

const NEXT_RUN_DELAY_MS = 700;
const reduceMotion = window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

let nextRunTimer = null;

function renderStats() {
  multiplierEl.textContent = `${core.multiplier.toFixed(1)}x`;
  magazinesEl.textContent = core.production.toFixed(1);
  brokenEl.textContent = String(core.brokenMagazines);
}

function renderCode() {
  codeRow.replaceChildren();

  for (let i = 0; i < core.sequence.length; i += 1) {
    const char = document.createElement('span');
    char.className = 'code-char';
    char.textContent = core.sequence[i];

    if (i < core.index) {
      char.classList.add('is-done');
    } else if (i === core.index && !core.runComplete) {
      char.classList.add('is-current');
    }

    codeRow.append(char);
  }

  codeStatus.textContent = core.runComplete
    ? 'SEQUENCE COMPLETE'
    : 'Type the highlighted character';
}

function renderInputs() {
  inputRow.replaceChildren();

  for (let i = 0; i < core.sequence.length; i += 1) {
    const slot = document.createElement('div');
    slot.className = 'input-slot';

    const typed = core.typed[i];

    if (typed !== undefined) {
      slot.textContent = typed;
      slot.classList.add(typed === core.sequence[i] ? 'is-correct' : 'is-wrong');
    } else if (i === core.index && !core.runComplete) {
      slot.classList.add('is-current');
    }

    inputRow.append(slot);
  }
}

function renderMagazine() {
  magazineSlots.replaceChildren();

  for (let i = 0; i < core.config.bulletsPerMagazine; i += 1) {
    const slot = document.createElement('span');
    slot.className = 'magazine__slot';
    if (i < core.filled) {
      slot.classList.add('is-filled');
    }
    magazineSlots.append(slot);
  }

  magazine.classList.toggle('is-broken', core.magazineBroken);
  magazineLabel.textContent = core.magazineBroken ? 'BROKEN' : 'MAGAZINE';
}

function render() {
  renderStats();
  renderCode();
  renderInputs();
  renderMagazine();
}

function flyRect(text, startRect, endRect, isWrong) {
  const rect = document.createElement('div');
  rect.className = isWrong ? 'fly-rect is-wrong' : 'fly-rect';
  rect.textContent = text;
  rect.style.left = `${startRect.left}px`;
  rect.style.top = `${startRect.top}px`;
  rect.style.width = `${startRect.width}px`;
  rect.style.height = `${startRect.height}px`;
  fxLayer.append(rect);

  const dx = endRect.left - startRect.left;
  const dy = endRect.top - startRect.top;

  const animation = rect.animate(
    [
      { transform: 'translate(0, 0)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px)`, opacity: isWrong ? 0 : 1 },
    ],
    { duration: 260, easing: 'ease-in', fill: 'forwards' },
  );

  animation.addEventListener('finish', () => rect.remove());
}

function handleInput(char) {
  if (core.runComplete) {
    return;
  }

  const slotIndex = core.index;
  const filledBefore = core.filled;
  const startSlot = inputRow.children[slotIndex];
  const targetSlot = magazineSlots.children[filledBefore];
  const startRect = startSlot?.getBoundingClientRect();
  const targetRect = targetSlot?.getBoundingClientRect();

  const event = core.press(char);
  render();

  if (!reduceMotion && startRect) {
    if (event.type === 'correct' && targetRect) {
      flyRect(event.char, startRect, targetRect, false);
    } else if (event.type === 'wrong') {
      flyRect(event.char, startRect, { left: startRect.left, top: startRect.top + 90 }, true);
    }
  }

  if (core.runComplete) {
    window.clearTimeout(nextRunTimer);
    nextRunTimer = window.setTimeout(() => {
      core.nextRun();
      render();
      nextRunTimer = null;
    }, NEXT_RUN_DELAY_MS);
  }
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

render();
