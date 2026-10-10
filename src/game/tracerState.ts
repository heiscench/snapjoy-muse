import * as THREE from "three";

export type Tracer = {
  id: number;
  start: THREE.Vector3;
  dir: THREE.Vector3;
  len: number;
  hit: boolean;
  life: number;
};

export const TRACERS: Tracer[] = [];
export const MAX_TRACERS = 32;
export const TRACER_LIFETIME = 0.1;
let nextId = 1;

export function spawnTracer(start: THREE.Vector3, dir: THREE.Vector3, len = 45, hit = false) {
  TRACERS.push({ id: nextId++, start: start.clone(), dir: dir.clone(), len, hit, life: TRACER_LIFETIME });
  if (TRACERS.length > MAX_TRACERS) TRACERS.shift();
}