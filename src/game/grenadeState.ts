import * as THREE from "three";

export type GrenadeState = {
  id: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  timer: number;
  exploded: boolean;
  explodeT: number;
  damage: number;
  splash: number;
};

export const GRENADES: GrenadeState[] = [];
let nextId = 1;

export function throwGrenade(origin: THREE.Vector3, dir: THREE.Vector3, damage: number, splash: number, speed = 24) {
  GRENADES.push({
    id: nextId++,
    pos: origin.clone(),
    vel: dir.clone().normalize().multiplyScalar(speed).add(new THREE.Vector3(0, 5, 0)),
    timer: 1.6,
    exploded: false,
    explodeT: 0,
    damage,
    splash,
  });
  if (GRENADES.length > 10) GRENADES.shift();
}