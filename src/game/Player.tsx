import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Character, type CharacterRefs } from "./Character";
import { playGunshot, playFootstep, startEngine, updateEngine, stopEngine } from "./audio";
import { GANGS, PLAYER_GANG } from "./gangs";
import { input, readKeyboardMove } from "./input";
import { NPCS, damageNPC } from "./npcState";
import { GUARDS, damageGuard } from "./guardState";
import { shopState } from "./shopState";
import { isFollowing } from "./squadState";
import { Weapon } from "./Weapon";
import {
  resolveCollision, resolveHeliCollision, rooftopHeightAt,
  nearestHospitalDistance, GANG_HQ, WEAPON_SHOPS, SHOP_RADIUS, HELI_PADS,
} from "./worldData";
import {
  playerState, damagePlayer, healPlayer, revivePlayer,
  earnMoney, spendMoney, DEATH_COST, KILL_BOUNTY,
} from "./playerState";
import { spawnTracer } from "./tracerState";
import { throwGrenade } from "./grenadeState";
import { HELICOPTERS, gangHeliIndices, pilotState, damageHeli } from "./vehicleState";
import { currentWeapon } from "./weaponState";
import { tickTerritory, onPlayerKill } from "./territoryState";
import { CAR_LIVE, carPilot, CAR_ENTER_RADIUS, CAR_EXIT_OFFSET, CAR_TOP_SPEED, CAR_COLLIDE_RADIUS } from "./carState";
import { carDestroyed, damageCar } from "./vehicleState";
import { remotePlayers } from "./remotePlayerState";
import {
  broadcastDeath,
  broadcastHit,
  lastAttacker,
  LAST_ATTACKER_WINDOW_MS,
} from "./presence";

const HEAL_RADIUS = 22;
const HEAL_RATE = 22;
const HELI_ENTER_RADIUS = 6;
const HELI_BODY_RADIUS = 4.5;
const HELI_EXIT_OFFSET = HELI_BODY_RADIUS + 4;
const RECOIL_DECAY = 6.5;
const RECOIL_PER_SHOT = 0.75;
const OTHER_OBJECT_RADIUS = 1.3;
const CAR_HIT_HEIGHT = 1.0;
const CAR_HIT_TOLERANCE = 0.008;
const BOARD_RADIUS = 8;
const WALK_SPEED = 8;
const RUN_SPEED = 14;
const AIM_SPEED = 4.5;

function boardNearbyFollowers(x: number, z: number) {
  for (const n of NPCS) {
    if (n.dead || n.gang !== PLAYER_GANG || !isFollowing(n.id)) continue;
    if (Math.hypot(n.pos.x - x, n.pos.z - z) < BOARD_RADIUS) n.boarded = true;
  }
}

function unboardFollowers(x: number, z: number) {
  let slot = 0;
  for (const n of NPCS) {
    if (!n.boarded) continue;
    n.boarded = false;
    const angle = (slot / 6) * Math.PI * 2;
    n.pos.set(x + Math.cos(angle) * 4, 0, z + Math.sin(angle) * 4);
    slot++;
  }
}

function ejectToOnFoot(r: CharacterRefs, vel: THREE.Vector3) {
  const heli = HELICOPTERS[pilotState.heliIndex];
  pilotState.piloting = false;
  unboardFollowers(heli.pos.x, heli.pos.z);
  r.root!.position.set(heli.pos.x + HELI_EXIT_OFFSET, heli.pos.y, heli.pos.z);
  r.root!.visible = true;
  pilotState.heliIndex = -1;
  vel.set(0, 0, 0);
}

function handleDeathAt(x: number, z: number, set: (x: number, y: number, z: number) => void) {
  if (playerState.health > 0) return false;
  const hq = GANG_HQ[PLAYER_GANG];
  unboardFollowers(hq.x, hq.z);
  set(hq.x, 0, hq.z);
  const recent =
    lastAttacker.userId && Date.now() - lastAttacker.at < LAST_ATTACKER_WINDOW_MS
      ? lastAttacker.userId
      : null;
  broadcastDeath(recent);
  lastAttacker.userId = null;
  revivePlayer();
  spendMoney(DEATH_COST);
  return true;
}

export function Player() {
  const refs = useRef<CharacterRefs>(null!);
  const vel = useRef(new THREE.Vector3());
  const heliVel = useRef(new THREE.Vector3());
  const yaw = useRef(0);
  const pitch = useRef(0.25);
  const grounded = useRef(true);
  const walkPhase = useRef(0);
  const camOffset = useRef(new THREE.Vector3());
  const fireCd = useRef(0);
  const recoil = useRef(0);
  const hasSpawned = useRef(false);
  const pilotCooldown = useRef(0);
  const { camera } = useThree();
  const gang = GANGS[PLAYER_GANG];

  const weaponNode = useMemo(() => <Weapon />, []);

  useFrame((_, dt) => {
    const dtc = Math.min(dt, 0.05);
    const r = refs.current;
    if (!r || !r.root) return;

    // Spawn from wherever the saved profile left off (or the HQ fallback the
    // profile was created with) — never overrides a loaded position.
    if (!hasSpawned.current) {
      r.root.position.set(playerState.pos.x, 0, playerState.pos.z);
      hasSpawned.current = true;
    }

    const lookX =
      input.look.x +
      ((input.keys.has("ArrowRight") ? 1 : 0) - (input.keys.has("ArrowLeft") ? 1 : 0)) +
      input.mouseDX * 0.12;
    const lookY =
      input.look.y +
      ((input.keys.has("ArrowDown") ? 1 : 0) - (input.keys.has("ArrowUp") ? 1 : 0)) +
      input.mouseDY * 0.12;
    input.mouseDX = 0;
    input.mouseDY = 0;

    const kb = readKeyboardMove();
    const mx = input.move.x + kb.x;
    const my = input.move.y + kb.y;
    const mag = Math.min(1, Math.hypot(mx, my));

    // ---- Enter / exit interact (shared by helicopter and cars) ----
    pilotCooldown.current = Math.max(0, pilotCooldown.current - dtc);
    if (pilotState.interactPressed && pilotCooldown.current === 0) {
      pilotState.interactPressed = false;
      pilotCooldown.current = 0.5;
      if (carPilot.driving) {
        const idx = carPilot.drivingIndex;
        const c = CAR_LIVE[idx];
        carPilot.driving = false;
        carPilot.drivingIndex = -1;
        stopEngine();
        unboardFollowers(c.x, c.z);
        r.root.position.set(c.x + Math.sin(c.rotY) * CAR_EXIT_OFFSET, 0, c.z + Math.cos(c.rotY) * CAR_EXIT_OFFSET);
        r.root.visible = true;
        vel.current.set(0, 0, 0);
      } else if (pilotState.piloting) {
        ejectToOnFoot(r, vel.current);
      } else if (carPilot.nearIndex >= 0) {
        carPilot.driving = true;
        carPilot.drivingIndex = carPilot.nearIndex;
        r.root.visible = false;
        startEngine();
        boardNearbyFollowers(r.root.position.x, r.root.position.z);
      } else if (pilotState.nearHeliIndex >= 0) {
        pilotState.piloting = true;
        pilotState.heliIndex = pilotState.nearHeliIndex;
        r.root.visible = false;
        boardNearbyFollowers(r.root.position.x, r.root.position.z);
      }
    } else {
      pilotState.interactPressed = false;
    }

    // ---- Driving a car ----
    if (carPilot.driving) {
      try {
        const c = CAR_LIVE[carPilot.drivingIndex];
        if (carDestroyed[carPilot.drivingIndex]) {
          carPilot.driving = false;
          stopEngine();
          unboardFollowers(c.x, c.z);
          r.root.visible = true;
        } else {
          if (Math.abs(c.speed) > 0.5) c.rotY -= mx * 1.6 * dtc;
          const targetSpeed = -my * CAR_TOP_SPEED;
          c.speed = THREE.MathUtils.lerp(c.speed, targetSpeed, Math.min(1, dtc * 2.2));
          updateEngine(Math.abs(c.speed) / CAR_TOP_SPEED);

          const fwd = new THREE.Vector3(Math.sin(c.rotY), 0, Math.cos(c.rotY));
          let nx = c.x + fwd.x * c.speed * dtc;
          let nz = c.z + fwd.z * c.speed * dtc;
          const resolved = resolveCollision(c.x, c.z, nx, nz, CAR_COLLIDE_RADIUS);
          if (resolved.x === c.x && resolved.z === c.z) c.speed *= 0.3;
          nx = resolved.x; nz = resolved.z;

          for (let i = 0; i < CAR_LIVE.length; i++) {
            if (i === carPilot.drivingIndex || carDestroyed[i]) continue;
            const other = CAR_LIVE[i];
            const dx = nx - other.x, dz = nz - other.z;
            const d = Math.hypot(dx, dz);
            const minD = OTHER_OBJECT_RADIUS + 2.6;
            if (d < minD && d > 0.0001) {
              nx = other.x + (dx / d) * minD;
              nz = other.z + (dz / d) * minD;
              c.speed *= 0.4;
            }
          }
          for (const n of NPCS) {
            if (n.dead || n.boarded) continue;
            const dx = nx - n.pos.x, dz = nz - n.pos.z;
            const d = Math.hypot(dx, dz);
            if (d < OTHER_OBJECT_RADIUS && d > 0.0001) {
              nx = n.pos.x + (dx / d) * OTHER_OBJECT_RADIUS;
              nz = n.pos.z + (dz / d) * OTHER_OBJECT_RADIUS;
              c.speed *= 0.4;
            }
          }
          for (const g of GUARDS) {
            if (g.dead) continue;
            const dx = nx - g.pos.x, dz = nz - g.pos.z;
            const d = Math.hypot(dx, dz);
            if (d < OTHER_OBJECT_RADIUS && d > 0.0001) {
              nx = g.pos.x + (dx / d) * OTHER_OBJECT_RADIUS;
              nz = g.pos.z + (dz / d) * OTHER_OBJECT_RADIUS;
              c.speed *= 0.4;
            }
          }

          c.x = nx;
          c.z = nz;

          playerState.pos.x = c.x;
          playerState.pos.z = c.z;
          playerState.yaw = c.rotY;

          const back = new THREE.Vector3(Math.sin(c.rotY), 0, Math.cos(c.rotY));
          const camTarget = new THREE.Vector3(c.x - back.x * 7, 3.4, c.z - back.z * 7);
          camera.position.lerp(camTarget, Math.min(1, dtc * 6));
          camera.lookAt(c.x, 1, c.z);

          if (handleDeathAt(c.x, c.z, (x, y, z) => {
            carPilot.driving = false;
            stopEngine();
            r.root!.position.set(x, y, z);
            r.root!.visible = true;
            vel.current.set(0, 0, 0);
          })) return;
        }
        return;
      } catch (err) {
        pilotState.lastError = err instanceof Error ? err.message : String(err);
        carPilot.driving = false;
        stopEngine();
        r.root!.visible = true;
      }
    }

    // ---- Piloting a helicopter ----
    if (pilotState.piloting) {
      try {
        const heli = HELICOPTERS[pilotState.heliIndex];
        heli.yaw -= lookX * 1.8 * dtc;
        pitch.current = THREE.MathUtils.clamp(pitch.current + lookY * 1.4 * dtc, -0.3, 1.0);

        const ascend = input.jump;
        const descend = input.run;
        const vTarget = ascend && !descend ? 9 : descend && !ascend ? -7 : -1.0;
        heli.vy = THREE.MathUtils.lerp(heli.vy, vTarget, Math.min(1, dtc * 3));

        const fwd = new THREE.Vector3(-Math.sin(heli.yaw), 0, -Math.cos(heli.yaw));
        const rightV = new THREE.Vector3(-fwd.z, 0, fwd.x);
        const thrust = 16;
        const desired = new THREE.Vector3();
        if (mag > 0.01) {
          desired.addScaledVector(fwd, -my / mag).addScaledVector(rightV, mx / mag).multiplyScalar(thrust * mag);
        }
        heliVel.current.x = THREE.MathUtils.lerp(heliVel.current.x, desired.x, Math.min(1, dtc * 2.2));
        heliVel.current.z = THREE.MathUtils.lerp(heliVel.current.z, desired.z, Math.min(1, dtc * 2.2));

        const prevX = heli.pos.x, prevZ = heli.pos.z;
        const nx = prevX + heliVel.current.x * dtc;
        const nz = prevZ + heliVel.current.z * dtc;
        const resolved = resolveHeliCollision(prevX, prevZ, nx, nz, heli.pos.y, 4.5);
        heli.pos.x = resolved.x;
        heli.pos.z = resolved.z;

        const floor = rooftopHeightAt(heli.pos.x, heli.pos.z);
        heli.pos.y = THREE.MathUtils.clamp(heli.pos.y + heli.vy * dtc, floor, 90);
        if (heli.pos.y <= floor) {
          heli.pos.y = floor;
          heli.vy = Math.max(0, heli.vy);
        }

        playerState.pos.x = heli.pos.x;
        playerState.pos.z = heli.pos.z;
        playerState.yaw = heli.yaw;

        const camBack = new THREE.Vector3(Math.sin(heli.yaw), 0, Math.cos(heli.yaw));
        const camTarget = new THREE.Vector3(
          heli.pos.x + camBack.x * 14,
          heli.pos.y + 6 + Math.sin(pitch.current) * 3,
          heli.pos.z + camBack.z * 14,
        );
        camera.position.lerp(camTarget, Math.min(1, dtc * 6));
        camera.lookAt(heli.pos.x, heli.pos.y + 1.5, heli.pos.z);

        if (handleDeathAt(heli.pos.x, heli.pos.z, (x, y, z) => {
          pilotState.piloting = false;
          const hq = GANG_HQ[PLAYER_GANG];
          const pad = HELI_PADS[PLAYER_GANG][pilotState.heliIndex % 2];
          heli.pos.set(pad.x, 0, pad.z);
          pilotState.heliIndex = -1;
          r.root!.position.set(x, 0, z);
          r.root!.visible = true;
          vel.current.set(0, 0, 0);
          void hq;
        })) return;

        return;
      } catch (err) {
        pilotState.lastError = err instanceof Error ? err.message : String(err);
        ejectToOnFoot(r, vel.current);
      }
    }

    // ---- Normal on-foot movement ----
    yaw.current -= lookX * 2.6 * dtc;
    pitch.current = THREE.MathUtils.clamp(pitch.current + lookY * 1.4 * dtc, -0.3, 1.0);

    const running = input.run || input.keys.has("ShiftLeft");
    const aiming = input.aim;
    const holding = aiming || input.fire;
    const speedBase = aiming ? AIM_SPEED : running ? RUN_SPEED : WALK_SPEED;
    const speed = speedBase * mag;

    recoil.current = Math.max(0, recoil.current - dtc * RECOIL_DECAY);

    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const dir = new THREE.Vector3();
    if (mag > 0.01) {
      dir.addScaledVector(forward, -my / (mag || 1));
      dir.addScaledVector(right, mx / (mag || 1));
      dir.normalize().multiplyScalar(speed);
    }
    vel.current.x = THREE.MathUtils.lerp(vel.current.x, dir.x, Math.min(1, dtc * 12));
    vel.current.z = THREE.MathUtils.lerp(vel.current.z, dir.z, Math.min(1, dtc * 12));

    vel.current.y -= 22 * dtc;
    if (input.jump && grounded.current) {
      vel.current.y = 8.5;
      grounded.current = false;
    }
    input.jump = false;

    const p = r.root.position;
    const prevX = p.x, prevZ = p.z;
    const nx = p.x + vel.current.x * dtc;
    const nz = p.z + vel.current.z * dtc;
    const resolved = resolveCollision(prevX, prevZ, nx, nz, 0.6);
    p.x = resolved.x;
    p.z = resolved.z;

    for (const h of HELICOPTERS) {
      if (h.pos.y > 1.5) continue;
      const dx = p.x - h.pos.x, dz = p.z - h.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < HELI_BODY_RADIUS && d > 0.0001) {
        p.x = h.pos.x + (dx / d) * HELI_BODY_RADIUS;
        p.z = h.pos.z + (dz / d) * HELI_BODY_RADIUS;
      }
    }

    p.y += vel.current.y * dtc;
    if (p.y <= 0) {
      p.y = 0;
      vel.current.y = 0;
      grounded.current = true;
    }

    playerState.pos.x = p.x;
    playerState.pos.z = p.z;
    playerState.yaw = yaw.current;

    let bestHeliD = Infinity;
    let bestHeliI = -1;
    for (const hi of gangHeliIndices(PLAYER_GANG)) {
      const h = HELICOPTERS[hi];
      const d = Math.hypot(p.x - h.pos.x, p.z - h.pos.z);
      if (d < HELI_ENTER_RADIUS && d < bestHeliD) { bestHeliD = d; bestHeliI = hi; }
    }
    pilotState.nearHeliIndex = bestHeliI;

    const shop = WEAPON_SHOPS[PLAYER_GANG];
    shopState.nearOwnShop = Math.hypot(p.x - shop.x, p.z - shop.z) < SHOP_RADIUS;

    let bestCarD = Infinity;
    let bestCarI = -1;
    for (let i = 0; i < CAR_LIVE.length; i++) {
      if (carDestroyed[i]) continue;
      const d = Math.hypot(p.x - CAR_LIVE[i].x, p.z - CAR_LIVE[i].z);
      if (d < CAR_ENTER_RADIUS && d < bestCarD) { bestCarD = d; bestCarI = i; }
    }
    carPilot.nearIndex = bestCarI;

    if (nearestHospitalDistance(p.x, p.z) < HEAL_RADIUS) {
      healPlayer(HEAL_RATE * dtc);
    }

    if (handleDeathAt(p.x, p.z, (x, y, z) => { p.set(x, y, z); vel.current.set(0, 0, 0); })) {
      // handled
    }

    tickTerritory(dtc, p.x, p.z);

    if (aiming) {
      r.root.rotation.y = THREE.MathUtils.lerp(r.root.rotation.y, yaw.current, Math.min(1, dtc * 18));
    } else if (mag > 0.05) {
      const targetRot = Math.atan2(dir.x, dir.z);
      r.root.rotation.y = THREE.MathUtils.lerp(r.root.rotation.y, targetRot, Math.min(1, dtc * 14));
    }

    const step = running ? 13 : 8;
    const prevPhase = walkPhase.current;
    walkPhase.current += dtc * step * (mag > 0.05 && !holding ? 1 : 0);
    if (mag > 0.05 && !holding && Math.floor(walkPhase.current / Math.PI) !== Math.floor(prevPhase / Math.PI)) {
      playFootstep(running);
    }
    const swing = Math.sin(walkPhase.current) * (running ? 1.0 : 0.65) * mag;
    if (r.legL && r.legR && r.armL && r.armR && r.body) {
      r.legL.rotation.x = swing;
      r.legR.rotation.x = -swing;
      const armSwing = holding ? 0 : swing * 0.8;
      r.armL.rotation.x = -armSwing;
      r.armR.rotation.x = holding ? -1.4 - recoil.current * 0.1 : armSwing;
      r.armL.rotation.z = holding ? 0.15 : 0;
      r.body.position.y = 1.05 + Math.abs(Math.sin(walkPhase.current)) * 0.06 * mag;
    }
    if (r.head) r.head.rotation.x = THREE.MathUtils.lerp(r.head.rotation.x, pitch.current * 0.4, 0.2);

    const targetDist = aiming ? 2.6 : 5.8;
    const shoulderX = aiming ? 0.7 : 0;
    const camHeight = 2.0 + Math.sin(pitch.current) * 2.4;
    const back = new THREE.Vector3(Math.sin(yaw.current), 0, Math.cos(yaw.current));
    const sideV = new THREE.Vector3(-back.z, 0, back.x);
    const targetOffset = new THREE.Vector3(
      back.x * targetDist + sideV.x * shoulderX,
      camHeight + recoil.current * 0.12,
      back.z * targetDist + sideV.z * shoulderX,
    );
    camOffset.current.lerp(targetOffset, Math.min(1, dtc * 8));
    camera.position.set(p.x + camOffset.current.x, p.y + camOffset.current.y, p.z + camOffset.current.z);
    camera.lookAt(
      p.x + sideV.x * shoulderX * 0.6,
      p.y + 1.5 + recoil.current * 0.35,
      p.z + sideV.z * shoulderX * 0.6,
    );

    fireCd.current = Math.max(0, fireCd.current - dtc);
    if (input.fire && fireCd.current === 0) {
      const w = currentWeapon();
      fireCd.current = w.fireRate;
      const origin = camera.position.clone();
      const forwardV = new THREE.Vector3();
      camera.getWorldDirection(forwardV);

      if (w.kind === "grenade") {
        recoil.current = Math.min(1.4, recoil.current + RECOIL_PER_SHOT * 0.6);
        throwGrenade(origin, forwardV, w.damage, w.splash ?? 6);
      } else {
        playGunshot(w.id);
        recoil.current = Math.min(1.4, recoil.current + RECOIL_PER_SHOT);

        for (let pellet = 0; pellet < w.pellets; pellet++) {
          const dir = forwardV.clone();
          if (w.pellets > 1) {
            dir.x += (Math.random() - 0.5) * 0.08;
            dir.y += (Math.random() - 0.5) * 0.08;
            dir.z += (Math.random() - 0.5) * 0.08;
            dir.normalize();
          }
          spawnTracer(origin, dir);

          let bestN: { d: number; npc: (typeof NPCS)[number] } | null = null;
          let bestNPos: THREE.Vector3 | null = null;
          for (const n of NPCS) {
            if (n.dead) continue;
            const toN = new THREE.Vector3(n.pos.x, 1, n.pos.z).sub(origin);
            const dist = toN.length();
            if (dist > w.range) continue;
            toN.normalize();
            const dot = toN.dot(dir);
            if (dot < w.spread) continue;
            if (!bestN || dist < bestN.d) { bestN = { d: dist, npc: n }; bestNPos = new THREE.Vector3(n.pos.x, 1, n.pos.z); }
          }
          let bestG: { d: number; g: (typeof GUARDS)[number] } | null = null;
          let bestGPos: THREE.Vector3 | null = null;
          for (const g of GUARDS) {
            if (g.dead) continue;
            const toG = new THREE.Vector3(g.pos.x, 1, g.pos.z).sub(origin);
            const dist = toG.length();
            if (dist > w.range) continue;
            toG.normalize();
            const dot = toG.dot(dir);
            if (dot < w.spread) continue;
            if (!bestG || dist < bestG.d) { bestG = { d: dist, g }; bestGPos = new THREE.Vector3(g.pos.x, 1, g.pos.z); }
          }
          for (let hi = 0; hi < HELICOPTERS.length; hi++) {
            const h = HELICOPTERS[hi];
            if (h.destroyed) continue;
            if (pilotState.piloting && hi === pilotState.heliIndex) continue;
            const toH = new THREE.Vector3(h.pos.x, h.pos.y + 1.4, h.pos.z).sub(origin);
            const dist = toH.length();
            if (dist > w.range) continue;
            toH.normalize();
            const dot = toH.dot(dir);
            if (dot < w.spread - 0.005) continue;
            damageHeli(hi, w.damage, false);
          }

          let bestC: { d: number; i: number } | null = null;
          let bestCPos: THREE.Vector3 | null = null;
          for (let ci = 0; ci < CAR_LIVE.length; ci++) {
            if (carDestroyed[ci]) continue;
            if (carPilot.driving && ci === carPilot.drivingIndex) continue;
            const c = CAR_LIVE[ci];
            const toC = new THREE.Vector3(c.x, CAR_HIT_HEIGHT, c.z).sub(origin);
            const dist = toC.length();
            if (dist > w.range) continue;
            toC.normalize();
            if (toC.dot(dir) < w.spread - CAR_HIT_TOLERANCE) continue;
            if (!bestC || dist < bestC.d) { bestC = { d: dist, i: ci }; bestCPos = new THREE.Vector3(c.x, CAR_HIT_HEIGHT, c.z); }
          }

          let bestR: { d: number; userId: string } | null = null;
          let bestRPos: THREE.Vector3 | null = null;
          for (const rp of remotePlayers.values()) {
            if (rp.health <= 0 || rp.inVehicle || rp.gang === PLAYER_GANG) continue;
            const toR = new THREE.Vector3(rp.x, 1, rp.z).sub(origin);
            const dist = toR.length();
            if (dist > w.range) continue;
            toR.normalize();
            if (toR.dot(dir) < w.spread) continue;
            if (!bestR || dist < bestR.d) { bestR = { d: dist, userId: rp.userId }; bestRPos = new THREE.Vector3(rp.x, 1, rp.z); }
          }

          const dN = bestN?.d ?? Infinity;
          const dG = bestG?.d ?? Infinity;
          const dR = bestR?.d ?? Infinity;
          const dC = bestC?.d ?? Infinity;
          const closest = Math.min(dN, dG, dR, dC);
          let impact: THREE.Vector3 | null = null;

          if (closest === Infinity) {
            // nothing hit
          } else if (closest === dR && bestR) {
            broadcastHit(bestR.userId, w.damage);
            impact = bestRPos;
          } else if (closest === dN && bestN) {
            damageNPC(bestN.npc, w.damage);
            if (bestN.npc.dead) { earnMoney(KILL_BOUNTY); onPlayerKill(); }
            impact = bestNPos;
          } else if (closest === dC && bestC) {
            damageCar(bestC.i, w.damage);
            impact = bestCPos;
          } else if (bestG) {
            damageGuard(bestG.g, w.damage);
            impact = bestGPos;
          }

          if (impact && w.splash) {
            const sp = w.splash;
            for (const n of NPCS) {
              if (n.dead || n === bestN?.npc) continue;
              const d = impact.distanceTo(new THREE.Vector3(n.pos.x, 1, n.pos.z));
              if (d < sp) { damageNPC(n, w.damage * 0.6 * (1 - d / sp)); if (n.dead) { earnMoney(KILL_BOUNTY); onPlayerKill(); } }
            }
            for (const g of GUARDS) {
              if (g.dead || g === bestG?.g) continue;
              const d = impact.distanceTo(new THREE.Vector3(g.pos.x, 1, g.pos.z));
              if (d < sp) damageGuard(g, w.damage * 0.6 * (1 - d / sp));
            }
          }
        }
      }
    }
  });

  return (
    <Character
      ref={refs}
      color={gang.color}
      accent={gang.accent}
      showWeaponSlot={weaponNode}
    />
  );
}