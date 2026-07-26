import * as THREE from "three";

export type Tracer = { id: number; start: THREE.Vector3; dir: THREE.Vector3; life: number };

export const TRACERS: Tracer[] = [];
let nextId = 1;
const LIFETIME = 0.12;

export function spawnTracer(start: THREE.Vector3, dir: THREE.Vector3) {
  TRACERS.push({ id: nextId++, start: start.clone(), dir: dir.clone(), life: LIFETIME });
  if (TRACERS.length > 40) TRACERS.shift();
}

export const TRACER_LIFETIME = LIFETIME;