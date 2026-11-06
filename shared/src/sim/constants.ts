export const SIM = {
  tickRate: 60,
  maxFrameDelta: 0.25,
  maxCatchUpSteps: 8,
  worldWidth: 1600,
  worldHeight: 1200,
  playerSpeed: 220,
  playerRadius: 14,
  maxHpPerPlayer: 100,
  bulletSpeed: 900,
  bulletDamage: 2,
  bulletLifetimeSeconds: 2,
  dashCharges: 3,
  dashCooldownSeconds: 5,
  regenPerSecond: 1,
  soulCpsThreshold: 5,
  soulHpPerSecond: 1,
  soulHpDecayPerSecond: 0.2,
  bulletPress: {
    furnaceHoldSeconds: 5,
    furnaceHeatSeconds: 20,
    cutterHoldSeconds: 5,
    cutterRunSeconds: 25,
  },
} as const;

export const FIXED_DT = 1 / SIM.tickRate;
