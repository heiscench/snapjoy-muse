// Unarmed civilian residents. They wander their district, never shoot, and
// panic (walk faster, away from gunfire) when something dies nearby. Kept
// separate from NPCS so combat/aggro code never picks them as targets.
import * as THREE from "three";
import { CIVILIAN_DISTRICTS, districtHQ, type District } from "./worldData";

export type CivilianState = {
  id: number;
  district: District;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  phase: number;
  home: { x: number; z: number };
  shirt: string;
  pants: string;
};

export const CIVILIANS: CivilianState[] = [];

export const CIVILIANS_PER_DISTRICT = 6;
export const CIVILIAN_WANDER_RADIUS = 40;
export const CIVILIAN_SPEED_MIN = 0.9;
export const CIVILIAN_SPEED_MAX = 2.0;
export const CIVILIAN_TURN_SECS = 4;

const SHIRTS = ["#c9c4bb", "#8d9bb0", "#b98a6a", "#7f8f7a", "#c2a06b", "#9a7fb0"];
const PANTS = ["#33353c", "#2a2f38", "#40372c", "#25282f"];

export function initCivilians() {
  CIVILIANS.length = 0;
  let id = 1;
  for (const district of CIVILIAN_DISTRICTS) {
    const hq = districtHQ(district);
    for (let i = 0; i < CIVILIANS_PER_DISTRICT; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = 12 + Math.random() * (CIVILIAN_WANDER_RADIUS - 12);
      CIVILIANS.push({
        id: id++,
        district,
        pos: new THREE.Vector3(hq.x + Math.cos(a) * dist, 0, hq.z + Math.sin(a) * dist),
        dir: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)),
        speed: CIVILIAN_SPEED_MIN + Math.random() * (CIVILIAN_SPEED_MAX - CIVILIAN_SPEED_MIN),
        phase: Math.random() * CIVILIAN_TURN_SECS,
        home: { x: hq.x, z: hq.z },
        shirt: SHIRTS[Math.floor(Math.random() * SHIRTS.length)],
        pants: PANTS[Math.floor(Math.random() * PANTS.length)],
      });
    }
  }
}
