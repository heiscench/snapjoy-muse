import * as THREE from "three";
import { GANG_HQ } from "./worldData";

export type HeliState = {
  pos: THREE.Vector3;
  yaw: number;
  vy: number; // vertical speed
};

function makeHeli(gangId: 0 | 1 | 2 | 3): HeliState {
  const hq = GANG_HQ[gangId];
  return { pos: new THREE.Vector3(hq.x, 0, hq.z), yaw: 0, vy: 0 };
}

// One shared helicopter per gang. Only the player's own gang's helicopter is
// pilotable for now — enemy/ally-piloted helicopters come with the AI/squad phase.
export const HELICOPTERS: Record<0 | 1 | 2 | 3, HeliState> = {
  0: makeHeli(0),
  1: makeHeli(1),
  2: makeHeli(2),
  3: makeHeli(3),
};

export const pilotState = {
  piloting: false,
  nearOwnHeli: false,
  interactPressed: false, // one-shot flag: GameScene sets true on tap, Player.tsx consumes+clears it
};