import * as THREE from "three";
import type { GangId } from "./gangs";
import { GANG_HQ } from "./worldData";

export type NPCMode = "patrol" | "combat";

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
  // Combat / territory additions
  mode: NPCMode;
  fireCd: number;
  home: { x: number; z: number };
  wanderRadius: number;
  isHuman: boolean; // future multiplayer: mark player-controlled allies
  screenX: number;  // updated each frame for squad tap hit-testing
  screenY: number;
  screenVisible: boolean;
};

export const NPCS: NPCState[] = [];

const WANDER_RADIUS = 45;

export function spawnNPC(id: number, gang: GangId): NPCState {
  const hq = GANG_HQ[gang];
  const angle = Math.random() * Math.PI * 2;
  const dist = 8 + Math.random() * (WANDER_RADIUS - 8);
  return {
    id,
    pos: new THREE.Vector3(hq.x + Math.cos(angle) * dist, 0, hq.z + Math.sin(angle) * dist),
    dir: new THREE.Vector3(Math.cos(Math.random() * Math.PI * 2), 0, Math.sin(Math.random() * Math.PI * 2)),
    speed: 1.4 + Math.random() * 1.4,
    gang,
    phase: Math.random() * 10,
    hp: 100,
    dead: false,
    respawn: 0,
    hitFlash: 0,
    mode: "patrol",
    fireCd: 0,
    home: { x: hq.x, z: hq.z },
    wanderRadius: WANDER_RADIUS,
    isHuman: false,
    screenX: -1, screenY: -1, screenVisible: false,
  };
}

export function damageNPC(n: NPCState, amount: number) {
  if (n.dead) return;
  n.hp -= amount;
  n.hitFlash = 0.25;
  n.mode = "combat";
  if (n.hp <= 0) {
    n.dead = true;
    n.respawn = 4;
  }
}
