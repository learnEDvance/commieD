import type { InputMap } from '@commied/shared';
import { createLocalWorld, LOCAL_PLAYER_ID, LocalDriver } from './game/localDriver.js';
import { drawFrame } from './game/render.js';

const canvasElement = document.querySelector<HTMLCanvasElement>('#game');
const hudElement = document.querySelector<HTMLDivElement>('#hud');

if (!canvasElement || !hudElement) {
  throw new Error('Missing game canvas or HUD');
}

const canvas = canvasElement;
const hud = hudElement;
const context = canvas.getContext('2d');

if (!context) {
  throw new Error('2D canvas context is unavailable');
}

const ctx = context;

const driver = new LocalDriver(createLocalWorld());
const pressed = new Set<string>();
const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let viewportWidth = 0;
let viewportHeight = 0;

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;

  canvas.width = Math.round(viewportWidth * dpr);
  canvas.height = Math.round(viewportHeight * dpr);
  canvas.style.width = `${viewportWidth}px`;
  canvas.style.height = `${viewportHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function readInput(): InputMap {
  const moveX =
    (pressed.has('KeyD') || pressed.has('ArrowRight') ? 1 : 0) -
    (pressed.has('KeyA') || pressed.has('ArrowLeft') ? 1 : 0);
  const moveY =
    (pressed.has('KeyS') || pressed.has('ArrowDown') ? 1 : 0) -
    (pressed.has('KeyW') || pressed.has('ArrowUp') ? 1 : 0);
  const aim = Math.atan2(pointer.y - viewportHeight / 2, pointer.x - viewportWidth / 2);

  return {
    [LOCAL_PLAYER_ID]: {
      moveX,
      moveY,
      aim,
      shoot: pressed.has('Space'),
      dash: pressed.has('ShiftLeft') || pressed.has('ShiftRight'),
      use: pressed.has('KeyE'),
    },
  };
}

window.addEventListener('resize', resize);
window.addEventListener('keydown', (event) => {
  pressed.add(event.code);
  if (event.code.startsWith('Arrow') || event.code === 'Space') {
    event.preventDefault();
  }
});
window.addEventListener('keyup', (event) => pressed.delete(event.code));
window.addEventListener('blur', () => pressed.clear());
window.addEventListener('pointermove', (event) => {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
});

resize();

let lastFrameTime = performance.now();

function frame(now: number): void {
  const deltaSeconds = (now - lastFrameTime) / 1000;
  lastFrameTime = now;

  driver.advance(deltaSeconds, readInput());
  const state = driver.getRenderState();

  drawFrame(ctx, state, viewportWidth, viewportHeight, LOCAL_PLAYER_ID);

  const self = state.players.find((player) => player.id === LOCAL_PLAYER_ID);
  hud.textContent = self
    ? `tick ${state.tick} · ${state.elapsedSeconds.toFixed(1)}s · x ${self.x.toFixed(0)} y ${self.y.toFixed(0)} · WASD/arrows move · mouse aim`
    : 'waiting for player';

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
