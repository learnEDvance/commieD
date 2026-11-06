import { SIM } from '@commied/shared';
import type { RenderState } from './localDriver.js';

const GRID_SIZE = 100;

function drawArena(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#151715';
  ctx.fillRect(0, 0, SIM.worldWidth, SIM.worldHeight);

  ctx.strokeStyle = '#202420';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= SIM.worldWidth; x += GRID_SIZE) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, SIM.worldHeight);
  }
  for (let y = 0; y <= SIM.worldHeight; y += GRID_SIZE) {
    ctx.moveTo(0, y);
    ctx.lineTo(SIM.worldWidth, y);
  }
  ctx.stroke();

  ctx.strokeStyle = '#3a423a';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, SIM.worldWidth, SIM.worldHeight);
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  viewportWidth: number,
  viewportHeight: number,
  selfId: string,
): void {
  const self = state.players.find((player) => player.id === selfId) ?? state.players[0];
  const cameraX = self ? self.x - viewportWidth / 2 : 0;
  const cameraY = self ? self.y - viewportHeight / 2 : 0;

  ctx.fillStyle = '#0b0d0b';
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  ctx.save();
  ctx.translate(-cameraX, -cameraY);
  drawArena(ctx);

  for (const player of state.players) {
    if (!player.alive) continue;

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    ctx.beginPath();
    ctx.moveTo(SIM.playerRadius, 0);
    ctx.lineTo(-SIM.playerRadius * 0.7, -SIM.playerRadius * 0.7);
    ctx.lineTo(-SIM.playerRadius * 0.35, 0);
    ctx.lineTo(-SIM.playerRadius * 0.7, SIM.playerRadius * 0.7);
    ctx.closePath();
    ctx.fillStyle = player.color;
    ctx.fill();
    ctx.strokeStyle = '#0b0d0b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  ctx.restore();
}
