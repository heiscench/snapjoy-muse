import * as THREE from "three";
import { playGunshot, playHitMarker } from "./audio";
import { PLAYER_GANG } from "./gangs";
import { NPCS, damageNPC } from "./npcState";
import { GUARDS, damageGuard } from "./guardState";
import { HELICOPTERS, pilotState, damageHeli, carDestroyed, damageCar } from "./vehicleState";
import { CAR_LIVE, carPilot } from "./carState";
import { remotePlayers } from "./remotePlayerState";
import { broadcastHit } from "./presence";
import { earnMoney, KILL_BOUNTY } from "./playerState";
import { onPlayerKill } from "./territoryState";
import { BUILDINGS } from "./worldData";
import { canFire, consumeAmmo, currentWeapon, startReload } from "./weaponState";
import { spawnTracer } from "./tracerState";
import { markHit, markShot, type HitKind } from "./shotFeedback";
import { monsterTarget, damageMonster } from "./monster/monsterState";

type Npc = (typeof NPCS)[number];
type Guard = (typeof GUARDS)[number];

// Accuracy (radians of random spread) and camera kick per weapon.
const TUNING: Record<string, { hip: number; aim: number; recoil: number }> = {
  pistol:  { hip: 0.014, aim: 0.004, recoil: 0.6 },
  smg:     { hip: 0.04,  aim: 0.022, recoil: 0.35 },
  rifle:   { hip: 0.022, aim: 0.008, recoil: 0.45 },
  shotgun: { hip: 0.075, aim: 0.055, recoil: 1.0 },
  sniper:  { hip: 0.035, aim: 0.0,   recoil: 1.2 },
  tank:    { hip: 0.012, aim: 0.005, recoil: 1.3 },
};

const HEAD_MULT = 1.8;
const BODY_R = 0.6;
const HEAD_R = 0.34;
const HEAD_Y = 1.7;
const BODY_YS = [0.6, 1.05, 1.5];
const WORLD_UP = new THREE.Vector3(0, 1, 0);

// ---- Ray helpers (module-level scratch objects: no per-shot garbage) -------
const P = { t: 0, perp: 0 };
function rayPoint(o: THREE.Vector3, d: THREE.Vector3, px: number, py: number, pz: number) {
  const vx = px - o.x, vy = py - o.y, vz = pz - o.z;
  const t = vx * d.x + vy * d.y + vz * d.z;
  const qx = o.x + d.x * t - px;
  const qy = o.y + d.y * t - py;
  const qz = o.z + d.z * t - pz;
  P.t = t;
  P.perp = Math.sqrt(qx * qx + qy * qy + qz * qz);
}

const H = { t: 0, head: false };

/** Humanoid target: head sphere first, then three body points. */
function testHumanoid(o: THREE.Vector3, d: THREE.Vector3, x: number, z: number, range: number, aiming: boolean): boolean {
  const base = aiming ? 0.2 : 0.5; // forgiveness, larger when hip-firing
  rayPoint(o, d, x, HEAD_Y, z);
  if (P.t > 0.5 && P.t <= range && P.perp <= HEAD_R + (base + P.t * 0.004) * 0.6) {
    H.t = P.t; H.head = true;
    return true;
  }
  let best = Infinity;
  for (const y of BODY_YS) {
    rayPoint(o, d, x, y, z);
    if (P.t > 0.5 && P.t <= range && P.perp <= BODY_R + base + P.t * 0.004 && P.t < best) best = P.t;
  }
  if (best === Infinity) return false;
  H.t = best; H.head = false;
  return true;
}

function testSphere(o: THREE.Vector3, d: THREE.Vector3, x: number, y: number, z: number, r: number, range: number): boolean {
  rayPoint(o, d, x, y, z);
  if (P.t > 0.5 && P.t <= range && P.perp <= r) {
    H.t = P.t; H.head = false;
    return true;
  }
  return false;
}

// ---- Wall occlusion: ray vs building boxes (slab method) -------------------
const S = { tmin: 0, tmax: 0, ok: true };
function slab(oo: number, dd: number, mn: number, mx: number) {
  if (Math.abs(dd) < 1e-8) {
    if (oo < mn || oo > mx) S.ok = false;
    return;
  }
  let t1 = (mn - oo) / dd;
  let t2 = (mx - oo) / dd;
  if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
  if (t1 > S.tmin) S.tmin = t1;
  if (t2 < S.tmax) S.tmax = t2;
  if (S.tmin > S.tmax) S.ok = false;
}

function buildingDistance(o: THREE.Vector3, d: THREE.Vector3, maxDist: number): number {
  let best = maxDist;
  for (const b of BUILDINGS) {
    if (b.type === "crane" || b.type === "plaza") continue;
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2;
    const z0 = b.z - b.d / 2, z1 = b.z + b.d / 2;
    // A camera that clipped into a wall must not block every shot.
    if (o.x > x0 && o.x < x1 && o.z > z0 && o.z < z1 && o.y < b.h) continue;
    S.tmin = 0; S.tmax = best; S.ok = true;
    slab(o.x, d.x, x0, x1);
    if (S.ok) slab(o.y, d.y, 0, b.h);
    if (S.ok) slab(o.z, d.z, z0, z1);
    if (S.ok && S.tmin < best) best = S.tmin;
  }
  return best;
}