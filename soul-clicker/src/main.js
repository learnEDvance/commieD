import { DEFAULT_CONFIG, SoulClicker } from './soulClickerCore.js';
import { randomShapePlan } from './shapes.js';

const params = new URLSearchParams(window.location.search);

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

if (!hpBar || !hpFill || !hpValue || !hpMeta || !soulButton || !shapeLayer) {
  throw new Error('Soul Clicker UI is incomplete');
}

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

soulButton.addEventListener('click', () => {
  const nowMs = performance.now();
  clicker.click(nowMs);
  updateHud(nowMs);
});

function spawnShape(plan) {
  const shape = document.createElement('button');
  const size = Math.round(plan.sizePx);

  shape.type = 'button';
  shape.className = `shape shape--${plan.type}`;
  shape.style.left = `calc(${plan.leftPercent}% - ${size / 2}px)`;
  shape.style.top = `calc(${plan.topPercent}% - ${size / 2}px)`;
  shape.style.width = `${size}px`;
  shape.style.height = `${size}px`;
  shape.setAttribute('aria-label', 'Collect soul shard');

  shape.addEventListener('click', () => {
    clicker.addShapeBonus();
    shape.remove();
  });

  shapeLayer.append(shape);
  window.setTimeout(() => shape.remove(), plan.lifetimeMs);
}

function scheduleShape() {
  const plan = randomShapePlan(Math.random, {
    minDelayMs: clicker.config.shapeSpawnMinMs,
    maxDelayMs: clicker.config.shapeSpawnMaxMs,
    minLifetimeMs: clicker.config.shapeLifetimeMs,
    maxLifetimeMs: clicker.config.shapeLifetimeMs,
  });

  window.setTimeout(() => {
    spawnShape(plan);
    scheduleShape();
  }, plan.delayMs);
}

function frame(nowMs) {
  clicker.advanceTo(nowMs);
  updateHud(nowMs);

  window.requestAnimationFrame(frame);
}

scheduleShape();
window.requestAnimationFrame(frame);
