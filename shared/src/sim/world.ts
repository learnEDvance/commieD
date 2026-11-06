import { SIM } from './constants.js';
import { createRngState } from './rng.js';
import type { CreateWorldOptions, Player, Team, Vec2, World } from './types.js';

export interface CreatePlayerOptions {
  id: string;
  name: string;
  teamId: string;
  position: Vec2;
  angle?: number;
  alive?: boolean;
}

export interface CreateTeamOptions {
  id: string;
  name: string;
  color: string;
  memberIds: string[];
  hp?: number;
  ammo?: number;
  dashes?: number;
}

export function createPlayer(options: CreatePlayerOptions): Player {
  return {
    id: options.id,
    name: options.name,
    teamId: options.teamId,
    position: { x: options.position.x, y: options.position.y },
    velocity: { x: 0, y: 0 },
    angle: options.angle ?? 0,
    alive: options.alive ?? true,
  };
}

export function createTeam(options: CreateTeamOptions): Team {
  const maxHp = options.memberIds.length * SIM.maxHpPerPlayer;

  return {
    id: options.id,
    name: options.name,
    color: options.color,
    memberIds: [...options.memberIds],
    hp: options.hp ?? maxHp,
    maxHp,
    ammo: options.ammo ?? 0,
    dashes: options.dashes ?? SIM.dashCharges,
  };
}

export function createWorld(options: CreateWorldOptions): World {
  return {
    tick: 0,
    elapsedSeconds: 0,
    rngState: createRngState(options.seed),
    bounds: options.bounds ?? { width: SIM.worldWidth, height: SIM.worldHeight },
    players: options.players ?? [],
    teams: options.teams ?? [],
    bullets: [],
    resources: [],
    ghosts: [],
  };
}
