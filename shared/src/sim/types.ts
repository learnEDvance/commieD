export type EntityId = string;
export type TeamId = EntityId;

export interface Vec2 {
  x: number;
  y: number;
}

export interface PlayerInput {
  moveX: number;
  moveY: number;
  /** Aim direction in radians. */
  aim: number;
  shoot: boolean;
  dash: boolean;
  use: boolean;
}

export type InputMap = Readonly<Record<EntityId, PlayerInput>>;

export interface WorldBounds {
  width: number;
  height: number;
}

export interface Player {
  id: EntityId;
  name: string;
  teamId: TeamId;
  position: Vec2;
  velocity: Vec2;
  /** Facing direction in radians. */
  angle: number;
  alive: boolean;
}

export interface Team {
  id: TeamId;
  name: string;
  color: string;
  memberIds: EntityId[];
  hp: number;
  maxHp: number;
  ammo: number;
  dashes: number;
}

export interface Bullet {
  id: EntityId;
  ownerId: EntityId;
  teamId: TeamId;
  position: Vec2;
  velocity: Vec2;
  damage: number;
  lifetimeSeconds: number;
}

export type ResourceKind = 'soul' | 'ammo' | 'speed' | 'powerup';

export interface Resource {
  id: EntityId;
  kind: ResourceKind;
  position: Vec2;
  amount: number;
}

export interface Ghost {
  id: EntityId;
  playerId: EntityId;
  teamId: TeamId;
  position: Vec2;
  velocity: Vec2;
}

export interface World {
  tick: number;
  /** Simulated time in seconds. */
  elapsedSeconds: number;
  rngState: number;
  bounds: WorldBounds;
  players: Player[];
  teams: Team[];
  bullets: Bullet[];
  resources: Resource[];
  ghosts: Ghost[];
}

export interface CreateWorldOptions {
  seed: number;
  bounds?: WorldBounds;
  players?: Player[];
  teams?: Team[];
}
