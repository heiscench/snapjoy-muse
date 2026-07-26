import * as THREE from "three";
import type { GangId } from "./gangs";

export type NPCState = {
  id: number;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  gang: GangId;
  phase: number;
  hp: number;
  dead: boolean;
  respawn: number;
  hitFlash: number;
};

export const NPCS: NPCState[] = [];

export function spawnNPC(id: number, gang: GangId): NPCState {
  const angle = Math.random() * Math.PI * 2;
  const dist = 30 + Math.random() * 90;
  return {
    id,
    pos: new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist),
    dir: new THREE.Vector3(Math.cos(Math.random() * Math.PI * 2), 0, Math.sin(Math.random() * Math.PI * 2)),
    speed: 1.4 + Math.random() * 1.4,
    gang,
    phase: Math.random() * 10,
    hp: 100,
    dead: false,
    respawn: 0,
    hitFlash: 0,
  };
}

export function damageNPC(n: NPCState, amount: number) {
  if (n.dead) return;
  n.hp -= amount;
  n.hitFlash = 0.25;
  if (n.hp <= 0) {
    n.dead = true;
    n.respawn = 4; // seconds
  }
}
