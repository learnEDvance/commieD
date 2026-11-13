export const DEFAULT_CONFIG = Object.freeze({
  hpPerLivingTeammate: 100,
  yellowBandHp: 90,
  cpsWindowSeconds: 10,
  minimumCps: 5,
  hpPerCpsPerSecond: 1,
  lowCpsPenaltyPerSecond: 2,
  shapeBonusHp: 20,
  shapeSpawnMinMs: 10_000,
  shapeSpawnMaxMs: 30_000,
  shapeLifetimeMs: 4_000,
});

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Pure Soul Clicker state. Rendering and real timers live outside this module.
 */
export class SoulClicker {
  constructor({ livingTeammates = 1, hp, config = {} } = {}) {
    if (!Number.isInteger(livingTeammates) || livingTeammates < 0) {
      throw new RangeError('livingTeammates must be a non-negative integer');
    }

    this.config = { ...DEFAULT_CONFIG, ...config };
    this.livingTeammates = livingTeammates;
    this.hp = hp ?? this.baseline;
    this.clickTimestamps = [];
    this.lastUpdateMs = null;
  }

  get baseline() {
    return this.config.hpPerLivingTeammate * this.livingTeammates;
  }

  get band() {
    const baseline = this.baseline;

    if (this.hp < baseline) {
      return 'red';
    }
    if (this.hp <= baseline + this.config.yellowBandHp) {
      return 'yellow';
    }
    return 'green';
  }

  get displayMaxHp() {
    return Math.max(1, this.baseline + this.config.yellowBandHp);
  }

  get fillRatio() {
    return clamp(this.hp / this.displayMaxHp, 0, 1);
  }

  cpsAt(nowMs) {
    this.#pruneClicks(nowMs);
    return this.clickTimestamps.length / this.config.cpsWindowSeconds;
  }

  hpPerSecondAt(nowMs) {
    const cps = this.cpsAt(nowMs);

    if (cps >= this.config.minimumCps) {
      return cps * this.config.hpPerCpsPerSecond;
    }
    return -this.config.lowCpsPenaltyPerSecond;
  }

  click(nowMs) {
    this.advanceTo(nowMs);
    return this.registerClick(nowMs);
  }

  /**
   * Records a click without applying the CPS rate. The embedded (host-driven)
   * version uses this because the host owns team HP and applies the rate itself.
   */
  registerClick(nowMs) {
    this.clickTimestamps.push(nowMs);
    this.#pruneClicks(nowMs);
    return this.cpsAt(nowMs);
  }

  /**
   * Applies the current CPS rate up to `nowMs` and remembers the timestamp.
   * Called on every frame and on every click so HP responds the moment CPS changes.
   */
  advanceTo(nowMs) {
    if (!Number.isFinite(nowMs)) {
      return this.hpPerSecondAt(this.lastUpdateMs ?? 0);
    }

    if (this.lastUpdateMs === null) {
      this.lastUpdateMs = nowMs;
      return this.hpPerSecondAt(nowMs);
    }

    const deltaSeconds = Math.max(0, (nowMs - this.lastUpdateMs) / 1000);
    this.lastUpdateMs = nowMs;

    return deltaSeconds > 0
      ? this.tick(nowMs, deltaSeconds)
      : this.hpPerSecondAt(nowMs);
  }

  tick(nowMs, deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return 0;
    }

    const rate = this.hpPerSecondAt(nowMs);
    this.hp = Math.max(0, this.hp + rate * deltaSeconds);
    this.lastUpdateMs = nowMs;
    return rate;
  }

  addShapeBonus(amount = this.config.shapeBonusHp) {
    this.hp += amount;
    return this.hp;
  }

  setLivingTeammates(count) {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError('livingTeammates must be a non-negative integer');
    }
    this.livingTeammates = count;
  }

  #pruneClicks(nowMs) {
    const cutoff = nowMs - this.config.cpsWindowSeconds * 1000;
    let firstFreshClick = 0;

    while (
      firstFreshClick < this.clickTimestamps.length &&
      this.clickTimestamps[firstFreshClick] <= cutoff
    ) {
      firstFreshClick += 1;
    }

    if (firstFreshClick > 0) {
      this.clickTimestamps.splice(0, firstFreshClick);
    }
  }
}
