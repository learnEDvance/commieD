import {
  createPlayer,
  createTeam,
  createWorld,
  FIXED_DT,
  SIM,
  stepWorld,
  type InputMap,
  type World,
} from '@commied/shared';

export const LOCAL_PLAYER_ID = 'local-player';
export const LOCAL_TEAM_ID = 'red';

export interface RenderPlayer {
  id: string;
  teamId: string;
  color: string;
  x: number;
  y: number;
  angle: number;
  alive: boolean;
}

export interface RenderState {
  tick: number;
  elapsedSeconds: number;
  alpha: number;
  players: RenderPlayer[];
}

interface Pose {
  x: number;
  y: number;
  angle: number;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function lerpAngle(from: number, to: number, t: number): number {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * t;
}

export function createLocalWorld(): World {
  const player = createPlayer({
    id: LOCAL_PLAYER_ID,
    name: 'Comrade',
    teamId: LOCAL_TEAM_ID,
    position: { x: SIM.worldWidth / 2, y: SIM.worldHeight / 2 },
  });

  const team = createTeam({
    id: LOCAL_TEAM_ID,
    name: 'Red',
    color: '#e05252',
    memberIds: [player.id],
  });

  return createWorld({ seed: 1, players: [player], teams: [team] });
}

/** Drives the shared simulation with a fixed timestep and exposes interpolated state. */
export class LocalDriver {
  private accumulator = 0;
  private readonly previousPoses = new Map<string, Pose>();

  constructor(readonly world: World) {
    this.capturePoses();
  }

  advance(frameDeltaSeconds: number, inputs: InputMap): void {
    const safeDelta = Number.isFinite(frameDeltaSeconds) ? frameDeltaSeconds : 0;
    this.accumulator += Math.min(Math.max(safeDelta, 0), SIM.maxFrameDelta);

    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < SIM.maxCatchUpSteps) {
      this.capturePoses();
      stepWorld(this.world, inputs, FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps += 1;
    }

    if (this.accumulator >= FIXED_DT) {
      this.accumulator %= FIXED_DT;
    }
  }

  get alpha(): number {
    return this.accumulator / FIXED_DT;
  }

  getRenderState(): RenderState {
    const alpha = this.alpha;

    return {
      tick: this.world.tick,
      elapsedSeconds: this.world.elapsedSeconds,
      alpha,
      players: this.world.players.map((player) => {
        const previous = this.previousPoses.get(player.id);
        const previousX = previous?.x ?? player.position.x;
        const previousY = previous?.y ?? player.position.y;
        const previousAngle = previous?.angle ?? player.angle;
        const team = this.world.teams.find((candidate) => candidate.id === player.teamId);

        return {
          id: player.id,
          teamId: player.teamId,
          color: team?.color ?? '#ffffff',
          x: lerp(previousX, player.position.x, alpha),
          y: lerp(previousY, player.position.y, alpha),
          angle: lerpAngle(previousAngle, player.angle, alpha),
          alive: player.alive,
        };
      }),
    };
  }

  private capturePoses(): void {
    for (const player of this.world.players) {
      this.previousPoses.set(player.id, {
        x: player.position.x,
        y: player.position.y,
        angle: player.angle,
      });
    }
  }
}
