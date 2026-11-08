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
const floatLayer = document.querySelector('#float-layer');

if (!hpBar || !hpFill || !hpValue || !hpMeta || !soulButton || !shapeLayer || !floatLayer) {
  throw new Error('Soul Clicker UI is incomplete');
}

const SHAPE_COLORS = ['#f2c94c', '#56ccf2', '#eb5757', '#9b51e0', '#6fcf97'];

function updateHud(nowMs, rate) {
  const cps = clicker.cpsAt(nowMs);
  const rateLabel = `${rate >= 0 ? '+' : ''}${rate.toFixed(1)}`;

  hpBar.dataset.band = clicker.band;
  hpBar.setAttribute('aria-valuenow', clicker.hp.toFixed(0));
  hpFill.style.width = `${(clicker.fillRatio * 100).toFixed(2)}%`;
  hpValue.textContent = `TEAM HP ${clicker.hp.toFixed(1)}`;
  hpMeta.textContent = `baseline ${clicker.baseline} · living ${clicker.livingTeammates} · CPS ${cps.toFixed(1)} · ${rateLabel} HP/s`;
}

function pulseSoul() {
  soulButton.classList.remove('is-clicked');
  void soulButton.offsetWidth;
  soulButton.classList.add('is-clicked');
}

soulButton.addEventListener('click', () => {
  clicker.click(performance.now());
  pulseSoul();
});

function floatText(text, leftPercent, topPercent) {
  const label = document.createElement('span');
  label.className = 'float-text';
  label.textContent = text;
  label.style.left = `${leftPercent}%`;
  label.style.top = `${topPercent}%`;
  floatLayer.append(label);
  label.addEventListener('animationend', () => label.remove());
}

function spawnShape(plan) {
  const shape = document.createElement('button');
  const size = Math.round(plan.sizePx);
  const color = SHAPE_COLORS[Math.floor(Math.random() * SHAPE_COLORS.length)];

  shape.type = 'button';
  shape.className = `shape shape--${plan.type}`;
  shape.style.left = `calc(${plan.leftPercent}% - ${size / 2}px)`;
  shape.style.top = `calc(${plan.topPercent}% - ${size / 2}px)`;
  shape.style.width = `${size}px`;
  shape.style.height = `${size}px`;
  shape.style.setProperty('--shape-color', color);
  shape.style.animationDuration = `${plan.lifetimeMs}ms`;
  shape.setAttribute('aria-label', 'Collect soul shard');

  shape.addEventListener('click', () => {
    clicker.addShapeBonus();
    floatText(`+${clicker.config.shapeBonusHp} HP`, plan.leftPercent, plan.topPercent);
    shape.classList.add('is-collected');
    shape.disabled = true;
    window.setTimeout(() => shape.remove(), 160);
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

let lastFrameTime = performance.now();

function frame(nowMs) {
  const deltaSeconds = Math.min((nowMs - lastFrameTime) / 1000, 0.25);
  lastFrameTime = nowMs;

  const rate = clicker.tick(nowMs, deltaSeconds);
  updateHud(nowMs, rate);

  window.requestAnimationFrame(frame);
}

scheduleShape();
window.requestAnimationFrame(frame);
