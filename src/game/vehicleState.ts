import * as THREE from "three";
import { HELI_PADS } from "./worldData";

export const HELI_MAX_HP = 300;
export const HELI_RESPAWN_SECS = 60;

export type HeliState = {
  gang: 0 | 1 | 2 | 3;
  pos: THREE.Vector3;
  yaw: number;
  vy: number;
  hp: number;
  destroyed: boolean;
  respawn: number;
};

function makeHeli(gang: 0 | 1 | 2 | 3, slot: 0 | 1): HeliState {
  const pad = HELI_PADS[gang][slot];
  return {
    gang,
    pos: new THREE.Vector3(pad.x, 0, pad.z),
    yaw: 0,
    vy: 0,
    hp: HELI_MAX_HP,
    destroyed: false,
    respawn: 0,
  };
}

// Flat list — two helicopters per gang. Index = gang * 2 + slot.
export const HELICOPTERS: HeliState[] = [
  makeHeli(0, 0), makeHeli(0, 1),
  makeHeli(1, 0), makeHeli(1, 1),
  makeHeli(2, 0), makeHeli(2, 1),
  makeHeli(3, 0), makeHeli(3, 1),
];

export function gangHeliIndices(gang: 0 | 1 | 2 | 3): number[] {
  return [gang * 2, gang * 2 + 1];
}

export const pilotState = {
  piloting: false,
  heliIndex: -1, // which entry in HELICOPTERS the player is currently flying
  nearHeliIndex: -1, // which one they're close enough to board, -1 if none
  interactPressed: false,
  lastError: null as string | null,
};

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

type DestroyHook = (kind: "car" | "heli", id: number) => void;
let _onDestroyed: DestroyHook = () => {};
export function registerVehicleDestroyHook(fn: DestroyHook) {
  _onDestroyed = fn;
}

export function applyRemoteVehicleDestroyed(kind: "car" | "heli", id: number) {
  if (kind === "car") {
    if (carDestroyed[id]) return;
    carHp[id] = 0;
    carDestroyed[id] = true;
    carRespawn[id] = CAR_RESPAWN_SECS;
  } else {
    const h = HELICOPTERS[id];
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

export function damageHeli(index: number, amount: number, occupiedByPlayer: boolean) {
  const h = HELICOPTERS[index];
  if (!h || h.destroyed) return { occupantDamage: 0 };
  h.hp = Math.max(0, h.hp - amount);
  if (h.hp <= 0) {
    h.destroyed = true;
    h.respawn = HELI_RESPAWN_SECS;
    _onDestroyed("heli", index);
    return { occupantDamage: occupiedByPlayer ? 9999 : 0 };
  }
  return { occupantDamage: 0 };
}