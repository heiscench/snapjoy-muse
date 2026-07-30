import * as THREE from "three";
import type { GangId } from "./gangs";
import { GANG_HQ, districtHQ, type District } from "./worldData";
import { registerOwnerChangedHook, type Owner } from "./territoryState";

export type NPCMode = "patrol" | "combat";
export type NPCKind = "gang" | "defender";

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
  // District garrison: defenders belong to a captured district and are lost
  // with it, rather than being sent from the gang's home HQ.
  kind: NPCKind;
  district: District | null;
};

export const NPCS: NPCState[] = [];

/** Bumped whenever the NPC roster changes so the renderer can re-mount slots. */
export const npcRoster = { version: 0 };

const WANDER_RADIUS = 45;
export const DEFENDERS_PER_DISTRICT = 5;
export const DEFENDER_WANDER_RADIUS = 26;
export const DEFENDER_RESPAWN_SECS = 25;

let nextDefenderId = 100000;

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
    kind: "gang",
    district: null,
  };
}

function spawnDefender(district: District, gang: GangId): NPCState {
  const hq = districtHQ(district);
  const angle = Math.random() * Math.PI * 2;
  const dist = 10 + Math.random() * (DEFENDER_WANDER_RADIUS - 10);
  return {
    id: nextDefenderId++,
    pos: new THREE.Vector3(hq.x + Math.cos(angle) * dist, 0, hq.z + Math.sin(angle) * dist),
    dir: new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)),
    speed: 1.6 + Math.random() * 1.2,
    gang,
    phase: Math.random() * 10,
    hp: 100,
    dead: false,
    respawn: 0,
    hitFlash: 0,
    mode: "patrol",
    fireCd: 0,
    home: { x: hq.x, z: hq.z },
    wanderRadius: DEFENDER_WANDER_RADIUS,
    isHuman: false,
    screenX: -1, screenY: -1, screenVisible: false,
    kind: "defender",
    district,
  };
}

/**
 * Replace a district's garrison. Called on every ownership change (local or
 * remote) so a rival capture wipes the previous holder's defenders instead of
 * relocating them.
 */
export function setDistrictDefenders(district: District, owner: Owner) {
  for (let i = NPCS.length - 1; i >= 0; i--) {
    if (NPCS[i].kind === "defender" && NPCS[i].district === district) NPCS.splice(i, 1);
  }
  if (owner !== null && owner !== undefined) {
    for (let i = 0; i < DEFENDERS_PER_DISTRICT; i++) NPCS.push(spawnDefender(district, owner));
  }
  npcRoster.version++;
}

registerOwnerChangedHook((district, owner) => setDistrictDefenders(district, owner));

export function damageNPC(n: NPCState, amount: number) {
  if (n.dead) return;
  n.hp -= amount;
  n.hitFlash = 0.25;
  n.mode = "combat";
  if (n.hp <= 0) {
    n.dead = true;
    n.respawn = n.kind === "defender" ? DEFENDER_RESPAWN_SECS : 4;
  }
}

/** Respawn position for an NPC — defenders return to their district. */
export function respawnPosition(n: NPCState): THREE.Vector3 {
  const angle = Math.random() * Math.PI * 2;
  const dist = 8 + Math.random() * (n.wanderRadius - 8);
  return new THREE.Vector3(
    n.home.x + Math.cos(angle) * dist,
    0,
    n.home.z + Math.sin(angle) * dist,
  );
}
