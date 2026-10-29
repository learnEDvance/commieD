export type Vec2 = { x: number; y: number };

export enum MsgType {
  JOIN = 0,
  INPUT = 1,
  SNAPSHOT = 2,
  EVENT = 3
}

export type JoinMsg = { t: MsgType.JOIN; name: string };
export type InputMsg = { t: MsgType.INPUT; seq: number; mx: number; my: number; shoot: boolean; dash: boolean; use: boolean };
export type SnapshotMsg = { t: MsgType.SNAPSHOT; tick: number; time: number; players: PlayerState[]; bullets: BulletState[]; items: ItemState[]; teams: TeamState[] };
export type EventMsg = { t: MsgType.EVENT; kind: string; data?: any };

export type PlayerState = {
  id: string;
  name: string;
  x: number; y: number;
  vx: number; vy: number;
  hp: number;
  maxHp: number;
  teamId: string | null;
  connectedTo: string[];
  alive: boolean;
  ammo: number;
  speedBoostLeft: number;
  shieldLeft: number;
};

export type BulletState = { id: string; x: number; y: number; vx: number; vy: number; ownerId: string; life: number };
export type ItemState = { id: string; x: number; y: number; kind: string };
export type TeamState = { id: string; members: string[]; connections: Array<[string,string]> };

export const TICK_RATE = 60;
export const MAX_CONNECTIONS = 3;
export const HOP_DELAY = 0.2;
export const TIME_PER_SEC = 1;
export const REPAY_RATE = 0.4;
export const BULLET_DMG = 2;
export const BULLETS_PER_SEC = 10;
export const SPEED_BOOST_SEC = 15;
export const SPEED_BOOST_REGEN_SEC = 30;
export const SHIELD_SEC = 10;
export const BOMB_DMG_ENEMY = 80;
export const BOMB_DMG_LINKED = 40;
export const BOMB_LINKED_NEAR = 5;
export const HP_PLUS = 10;
export const ROUNDS_COUNT = 3;
export const ROUNDS_BULLETS = 10;
