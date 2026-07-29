import * as THREE from "three";
import { GANG_HQ } from "./worldData";

export const HELI_MAX_HP = 300;
export const HELI_RESPAWN_SECS = 60;

export type HeliState = {
  pos: THREE.Vector3;
  yaw: number;
  vy: number;
  hp: number;
  destroyed: boolean;
  respawn: number;
};

function makeHeli(gangId: 0 | 1 | 2 | 3): HeliState {
  const hq = GANG_HQ[gangId];
  return {
    pos: new THREE.Vector3(hq.x, 0, hq.z),
    yaw: 0,
    vy: 0,
    hp: HELI_MAX_HP,
    destroyed: false,
    respawn: 0,
  };
}

export const HELICOPTERS: Record<0 | 1 | 2 | 3, HeliState> = {
  0: makeHeli(0),
  1: makeHeli(1),
  2: makeHeli(2),
  3: makeHeli(3),
};

export const pilotState = {
  piloting: false,
  nearOwnHeli: false,
  interactPressed: false,
  lastError: null as string | null,
};

// Car destruction: since cars are decorative parked instances, we track health
// keyed by index and hide destroyed ones. Vehicles.tsx registers its count.
export const CAR_MAX_HP = 120;
export const CAR_RESPAWN_SECS = 60;
export const carHp: number[] = [];
export const carDestroyed: boolean[] = [];
export const carRespawn: number[] = [];

export function initCarHealth(count: number) {
  carHp.length = 0; carDestroyed.length = 0; carRespawn.length = 0;
  for (let i = 0; i < count; i++) {
    carHp.push(CAR_MAX_HP);
    carDestroyed.push(false);
    carRespawn.push(0);
  }
}

// Multiplayer hook: fired locally when a vehicle is destroyed here so the
// channel can tell everyone else. Registered by GameScene at startup.
type DestroyHook = (kind: "car" | "heli", id: number) => void;
let _onDestroyed: DestroyHook = () => {};
export function registerVehicleDestroyHook(fn: DestroyHook) {
  _onDestroyed = fn;
}

/** A remote client destroyed this vehicle — mirror it locally, same timer. */
export function applyRemoteVehicleDestroyed(kind: "car" | "heli", id: number) {
  if (kind === "car") {
    if (carDestroyed[id]) return;
    carHp[id] = 0;
    carDestroyed[id] = true;
    carRespawn[id] = CAR_RESPAWN_SECS;
  } else {
    const h = HELICOPTERS[id as 0 | 1 | 2 | 3];
    if (!h || h.destroyed) return;
    h.hp = 0;
    h.destroyed = true;
    h.respawn = HELI_RESPAWN_SECS;
  }
}

export function damageCar(i: number, amount: number) {
  if (carDestroyed[i]) return;
  carHp[i] = Math.max(0, carHp[i] - amount);
  if (carHp[i] <= 0) {
    carDestroyed[i] = true;
    carRespawn[i] = CAR_RESPAWN_SECS;
    _onDestroyed("car", i);
  }
}

export function damageHeli(gangId: 0 | 1 | 2 | 3, amount: number, occupiedByPlayer: boolean) {
  const h = HELICOPTERS[gangId];
  if (h.destroyed) return { occupantDamage: 0 };
  h.hp = Math.max(0, h.hp - amount);
  if (h.hp <= 0) {
    h.destroyed = true;
    h.respawn = HELI_RESPAWN_SECS;
    _onDestroyed("heli", gangId);
    // If occupied on death, the occupant takes the death penalty.
    return { occupantDamage: occupiedByPlayer ? 9999 : 0 };
  }
  return { occupantDamage: 0 };
}
