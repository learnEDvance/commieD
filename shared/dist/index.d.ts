export type Vec2 = {
    x: number;
    y: number;
};
export declare enum MsgType {
    JOIN = 0,
    INPUT = 1,
    SNAPSHOT = 2,
    EVENT = 3
}
export type JoinMsg = {
    t: MsgType.JOIN;
    name: string;
};
export type InputMsg = {
    t: MsgType.INPUT;
    seq: number;
    mx: number;
    my: number;
    shoot: boolean;
    dash: boolean;
    use: boolean;
};
export type SnapshotMsg = {
    t: MsgType.SNAPSHOT;
    tick: number;
    time: number;
    players: PlayerState[];
    bullets: BulletState[];
    items: ItemState[];
    teams: TeamState[];
};
export type EventMsg = {
    t: MsgType.EVENT;
    kind: string;
    data?: any;
};
export type PlayerState = {
    id: string;
    name: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    hp: number;
    maxHp: number;
    teamId: string | null;
    connectedTo: string[];
    alive: boolean;
    ammo: number;
    speedBoostLeft: number;
    shieldLeft: number;
};
export type BulletState = {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    ownerId: string;
    life: number;
};
export type ItemState = {
    id: string;
    x: number;
    y: number;
    kind: string;
};
export type TeamState = {
    id: string;
    members: string[];
    connections: Array<[string, string]>;
};
export declare const TICK_RATE = 60;
export declare const MAX_CONNECTIONS = 3;
export declare const HOP_DELAY = 0.2;
export declare const TIME_PER_SEC = 1;
export declare const REPAY_RATE = 0.4;
export declare const BULLET_DMG = 2;
export declare const BULLETS_PER_SEC = 10;
export declare const SPEED_BOOST_SEC = 15;
export declare const SPEED_BOOST_REGEN_SEC = 30;
export declare const SHIELD_SEC = 10;
export declare const BOMB_DMG_ENEMY = 80;
export declare const BOMB_DMG_LINKED = 40;
export declare const BOMB_LINKED_NEAR = 5;
export declare const HP_PLUS = 10;
export declare const ROUNDS_COUNT = 3;
export declare const ROUNDS_BULLETS = 10;
