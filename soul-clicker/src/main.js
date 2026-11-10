import { GameClock } from './clock.js';
import { DEFAULT_CONFIG, SoulClicker } from './soulClickerCore.js';
import { randomShapePlan } from './shapes.js';

const params = new URLSearchParams(window.location.search);
const embedded = params.get('embed') === '1';

function embedPost(payload) {
  if (embedded && window.parent !== window) {
    window.parent.postMessage(payload, window.location.origin);
  }
}

function numberParam(name, fallback) {
  const raw = params.get(name);
  if (raw === null) {
    return fallback;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

const livingTeammates = Math.max(0, Math.floor(numberParam('teammates', 1)));
const config = {
  shapeSpawnMinMs: Math.max(250, numberParam('shapeMinMs', DEFAULT_CONFIG.shapeSpawnMinMs)),
  shapeSpawnMaxMs: Math.max(250, numberParam('shapeMaxMs', DEFAULT_CONFIG.shapeSpawnMaxMs)),
};
config.shapeSpawnMaxMs = Math.max(config.shapeSpawnMinMs, config.shapeSpawnMaxMs);

const hasStartingHp = params.has('hp');
const clicker = new SoulClicker({
  livingTeammates,
  hp: hasStartingHp ? numberParam('hp', livingTeammates * DEFAULT_CONFIG.hpPerLivingTeammate) : undefined,
  config,
});

const hpBar = document.querySelector('#hp-bar');
const hpFill = document.querySelector('#hp-fill');
const hpValue = document.querySelector('#hp-value');
const hpMeta = document.querySelector('#hp-meta');
const soulButton = document.querySelector('#soul-button');
const shapeLayer = document.querySelector('#shape-layer');
const pauseOverlay = document.querySelector('#pause-overlay');

if (!hpBar || !hpFill || !hpValue || !hpMeta || !soulButton || !shapeLayer || !pauseOverlay) {
  throw new Error('Soul Clicker UI is incomplete');
}

const clock = new GameClock();
const activeShapes = [];
let pendingShape = null;
let pendingHp = 0;
let lastEmbedTick = null;
let lastContributionAt = 0;

/**
 * While embedded the host owns team HP, so the iframe never advances its own
 * copy. It only measures the CPS rate and reports the signed HP change.
 */
function embedTick(nowMs) {
  if (!embedded) {
    clicker.advanceTo(nowMs);
    return;
  }

  if (lastEmbedTick === null) {
    lastEmbedTick = nowMs;
    return;
  }

  const deltaSeconds = Math.max(0, (nowMs - lastEmbedTick) / 1000);
  lastEmbedTick = nowMs;

  if (deltaSeconds <= 0) {
    return;
  }

  pendingHp += clicker.hpPerSecondAt(nowMs) * deltaSeconds;

  if (nowMs - lastContributionAt >= 1000) {
    flushHp(nowMs);
  }
}

function flushHp(nowMs) {
  if (Math.abs(pendingHp) > 0.001) {
    embedPost({
      type: 'contribute',
      game: 'soul-clicker',
      resources: { hp: pendingHp },
    });
  }
  pendingHp = 0;
  lastContributionAt = nowMs;
}

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin || !embedded) {
    return;
  }

  const data = event.data;
  if (!data || data.type !== 'state') {
    return;
  }

  if (Number.isInteger(data.livingTeammates) && data.livingTeammates >= 0) {
    clicker.setLivingTeammates(data.livingTeammates);
  }
  if (Number.isFinite(data.hp)) {
    clicker.hp = Math.max(0, data.hp);
  }
  lastEmbedTick = clock.now();
  updateHud(clock.now());
});

function updateHud(nowMs) {
  const cps = clicker.cpsAt(nowMs);
  const rate = clicker.hpPerSecondAt(nowMs);
  const rateLabel = `${rate >= 0 ? '+' : ''}${rate.toFixed(1)}`;

  hpBar.dataset.band = clicker.band;
  hpBar.setAttribute('aria-valuenow', clicker.hp.toFixed(0));
  hpFill.style.width = `${(clicker.fillRatio * 100).toFixed(2)}%`;
  hpValue.textContent = `TEAM HP ${clicker.hp.toFixed(1)}`;
  hpMeta.textContent = `baseline ${clicker.baseline} · living ${clicker.livingTeammates} · CPS ${cps.toFixed(1)} · ${rateLabel} HP/s`;
}

function setPaused(next) {
  if (embedded || next === clock.paused) {
    return;
  }

  if (next) {
    clicker.advanceTo(clock.now());
    clock.pause();
  } else {
    clock.resume();
  }

  pauseOverlay.hidden = !clock.paused;
  updateHud(clock.now());
}

soulButton.addEventListener('click', () => {
  if (clock.paused) {
    return;
  }

  const nowMs = clock.now();
  if (embedded) {
    clicker.registerClick(nowMs);
  } else {
    clicker.click(nowMs);
  }
  updateHud(nowMs);
});

window.addEventListener('keydown', (event) => {
  if (event.repeat) {
    return;
  }

  if (event.code !== 'KeyQ' && event.key.toLowerCase() !== 'q') {
    return;
  }

  event.preventDefault();
  setPaused(!clock.paused);
});

function makePendingShape(nowMs) {
  const plan = randomShapePlan(Math.random, {
    minDelayMs: clicker.config.shapeSpawnMinMs,
    maxDelayMs: clicker.config.shapeSpawnMaxMs,
    minLifetimeMs: clicker.config.shapeLifetimeMs,
    maxLifetimeMs: clicker.config.shapeLifetimeMs,
  });

  return { plan, dueAtMs: nowMs + plan.delayMs };
}

function removeShape(entry) {
  entry.element.remove();
  const index = activeShapes.indexOf(entry);
  if (index >= 0) {
    activeShapes.splice(index, 1);
  }
}

function spawnShape(plan, nowMs) {
  const shape = document.createElement('button');
  const size = Math.round(plan.sizePx);
  const entry = { element: shape, expiresAtMs: nowMs + plan.lifetimeMs };

  shape.type = 'button';
  shape.className = `shape shape--${plan.type}`;
  shape.style.left = `calc(${plan.leftPercent}% - ${size / 2}px)`;
  shape.style.top = `calc(${plan.topPercent}% - ${size / 2}px)`;
  shape.style.width = `${size}px`;
  shape.style.height = `${size}px`;
  shape.setAttribute('aria-label', 'Collect soul shard');

  shape.addEventListener('click', () => {
    if (clock.paused) {
      return;
    }

    if (embedded) {
      embedPost({
        type: 'contribute',
        game: 'soul-clicker',
        resources: { hp: clicker.config.shapeBonusHp },
      });
    } else {
      clicker.addShapeBonus();
    }
    removeShape(entry);
    updateHud(clock.now());
  });

  shapeLayer.append(shape);
  activeShapes.push(entry);
}

function updateShapes(nowMs) {
  if (pendingShape === null) {
    pendingShape = makePendingShape(nowMs);
  }

  if (nowMs >= pendingShape.dueAtMs) {
    spawnShape(pendingShape.plan, nowMs);
    pendingShape = makePendingShape(nowMs);
  }

  for (let i = activeShapes.length - 1; i >= 0; i -= 1) {
    const entry = activeShapes[i];
    if (nowMs >= entry.expiresAtMs) {
      removeShape(entry);
    }
  }
}

function frame() {
  const nowMs = clock.now();

  if (!clock.paused) {
    embedTick(nowMs);
    updateShapes(nowMs);
  }

  updateHud(nowMs);
  window.requestAnimationFrame(frame);
}

if (embedded) {
  document.body.classList.add('is-embedded');
  const hint = document.querySelector('.hint');
  if (hint) {
    hint.textContent = 'Click the soul to feed your comrades';
  }
}

window.requestAnimationFrame(frame);
embedPost({ type: 'minigame-ready', game: 'soul-clicker' });
