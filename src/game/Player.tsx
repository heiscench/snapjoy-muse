import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Character, type CharacterRefs } from "./Character";
import { GANGS, PLAYER_GANG } from "./gangs";
import { input, readKeyboardMove } from "./input";
import { NPCS, damageNPC } from "./npcState";
import { GUARDS, damageGuard } from "./guardState";
import { shopState } from "./shopState";
import { Weapon } from "./Weapon";
import { resolveCollision, resolveHeliCollision, nearestHospitalDistance, GANG_HQ, WEAPON_SHOPS, SHOP_RADIUS } from "./worldData";
import {
  playerState, damagePlayer, healPlayer, revivePlayer,
  earnMoney, spendMoney, DEATH_COST, KILL_BOUNTY,
} from "./playerState";
import { spawnTracer } from "./tracerState";
import { HELICOPTERS, pilotState, damageHeli } from "./vehicleState";
import { currentWeapon } from "./weaponState";
import { tickTerritory, onPlayerKill } from "./territoryState";

const HEAL_RADIUS = 22; // must clear the hospital building's own footprint (~16 units)
const HEAL_RATE = 22;
const ENEMY_CONTACT_RANGE = 9;
const ENEMY_HIT_CHANCE_PER_SEC = 0.35;
const ENEMY_HIT_DAMAGE = 6;
const HELI_ENTER_RADIUS = 6;
const HELI_BODY_RADIUS = 4.5;
const HELI_EXIT_OFFSET = HELI_BODY_RADIUS + 4; // clearly outside HELI_ENTER_RADIUS

function ejectToOnFoot(r: CharacterRefs, vel: THREE.Vector3) {
  pilotState.piloting = false;
  const heli = HELICOPTERS[PLAYER_GANG];
  r.root!.position.set(heli.pos.x + HELI_EXIT_OFFSET, 0, heli.pos.z);
  r.root!.visible = true;
  vel.set(0, 0, 0);
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
  const hasSpawned = useRef(false);
  const pilotCooldown = useRef(0);
  const { camera } = useThree();
  const gang = GANGS[PLAYER_GANG];

  const weaponNode = useMemo(() => <Weapon />, []);

  useFrame((_, dt) => {
    const dtc = Math.min(dt, 0.05);
    const r = refs.current;
    if (!r || !r.root) return;

    if (!hasSpawned.current) {
      r.root.position.set(24, 0, 24);
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

    pilotCooldown.current = Math.max(0, pilotCooldown.current - dtc);
    if (pilotState.interactPressed && pilotCooldown.current === 0) {
      pilotState.interactPressed = false;
      pilotCooldown.current = 0.5;
      if (pilotState.piloting) {
        ejectToOnFoot(r, vel.current);
      } else if (pilotState.nearOwnHeli) {
        pilotState.piloting = true;
        r.root.visible = false;
      }
    } else {
      pilotState.interactPressed = false;
    }

    if (pilotState.piloting) {
      try {
        const heli = HELICOPTERS[PLAYER_GANG];
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
        heli.pos.y = THREE.MathUtils.clamp(heli.pos.y + heli.vy * dtc, 0, 70);
        if (heli.pos.y <= 0) {
          heli.pos.y = 0;
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
        return;
      } catch (err) {
        // Never let a flight-logic bug freeze the game — eject and surface the error.
        pilotState.lastError = err instanceof Error ? err.message : String(err);
        ejectToOnFoot(r, vel.current);
        // fall through to on-foot logic below for this frame
      }
    }

    // ---- Normal on-foot movement ----
    yaw.current -= lookX * 2.6 * dtc;
    pitch.current = THREE.MathUtils.clamp(pitch.current + lookY * 1.4 * dtc, -0.3, 1.0);

    const running = input.run || input.keys.has("ShiftLeft");
    const aiming = input.aim;
    const speedBase = aiming ? 3.5 : running ? 9 : 5;
    const speed = speedBase * mag;

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

    for (const gid of [0, 1, 2, 3] as const) {
      const h = HELICOPTERS[gid];
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

    pilotState.nearOwnHeli =
      Math.hypot(p.x - HELICOPTERS[PLAYER_GANG].pos.x, p.z - HELICOPTERS[PLAYER_GANG].pos.z) < HELI_ENTER_RADIUS;
const shop = WEAPON_SHOPS[PLAYER_GANG];
shopState.nearOwnShop = Math.hypot(p.x - shop.x, p.z - shop.z) < SHOP_RADIUS;

    if (nearestHospitalDistance(p.x, p.z) < HEAL_RADIUS) {
      healPlayer(HEAL_RATE * dtc);
    }

    for (const n of NPCS) {
      if (n.dead || n.gang === PLAYER_GANG) continue;
      const d = Math.hypot(n.pos.x - p.x, n.pos.z - p.z);
      if (d < ENEMY_CONTACT_RANGE && Math.random() < ENEMY_HIT_CHANCE_PER_SEC * dtc) {
        damagePlayer(ENEMY_HIT_DAMAGE);
      }
    }

    if (playerState.health <= 0) {
      const hq = GANG_HQ[PLAYER_GANG];
      p.set(hq.x, 0, hq.z);
      vel.current.set(0, 0, 0);
      revivePlayer();
      spendMoney(DEATH_COST);
    }

    // Territory / robbery channels
    tickTerritory(dtc, p.x, p.z);

    if (aiming) {
      r.root.rotation.y = THREE.MathUtils.lerp(r.root.rotation.y, yaw.current, Math.min(1, dtc * 18));
    } else if (mag > 0.05) {
      const targetRot = Math.atan2(dir.x, dir.z);
      r.root.rotation.y = THREE.MathUtils.lerp(r.root.rotation.y, targetRot, Math.min(1, dtc * 14));
    }

    const step = running ? 13 : 8;
    walkPhase.current += dtc * step * (mag > 0.05 ? 1 : 0);
    const swing = Math.sin(walkPhase.current) * (running ? 1.0 : 0.65) * mag;
    if (r.legL && r.legR && r.armL && r.armR && r.body) {
      r.legL.rotation.x = swing;
      r.legR.rotation.x = -swing;
      const armSwing = aiming ? 0 : swing * 0.8;
      r.armL.rotation.x = -armSwing;
      r.armR.rotation.x = aiming ? -1.4 : armSwing;
      r.armL.rotation.z = aiming ? 0.15 : 0;
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
      camHeight,
      back.z * targetDist + sideV.z * shoulderX,
    );
    camOffset.current.lerp(targetOffset, Math.min(1, dtc * 8));
    camera.position.set(p.x + camOffset.current.x, p.y + camOffset.current.y, p.z + camOffset.current.z);
    camera.lookAt(p.x + sideV.x * shoulderX * 0.6, p.y + 1.5, p.z + sideV.z * shoulderX * 0.6);

    fireCd.current = Math.max(0, fireCd.current - dtc);
    if (input.fire && input.aim && fireCd.current === 0) {
      const w = currentWeapon();
      fireCd.current = w.fireRate;
      const origin = camera.position.clone();
      const forwardV = new THREE.Vector3();
      camera.getWorldDirection(forwardV);

      for (let pellet = 0; pellet < w.pellets; pellet++) {
        const dir = forwardV.clone();
        if (w.pellets > 1) {
          dir.x += (Math.random() - 0.5) * 0.08;
          dir.y += (Math.random() - 0.5) * 0.08;
          dir.z += (Math.random() - 0.5) * 0.08;
          dir.normalize();
        }
        spawnTracer(origin, dir);

        // Hit NPCs
        let bestN: { d: number; npc: (typeof NPCS)[number] } | null = null;
        for (const n of NPCS) {
          if (n.dead) continue;
          const toN = new THREE.Vector3(n.pos.x, 1, n.pos.z).sub(origin);
          const dist = toN.length();
          if (dist > w.range) continue;
          toN.normalize();
          const dot = toN.dot(dir);
          if (dot < w.spread) continue;
          if (!bestN || dist < bestN.d) bestN = { d: dist, npc: n };
        }
        // Hit guards
        let bestG: { d: number; g: (typeof GUARDS)[number] } | null = null;
        for (const g of GUARDS) {
          if (g.dead) continue;
          const toG = new THREE.Vector3(g.pos.x, 1, g.pos.z).sub(origin);
          const dist = toG.length();
          if (dist > w.range) continue;
          toG.normalize();
          const dot = toG.dot(dir);
          if (dot < w.spread) continue;
          if (!bestG || dist < bestG.d) bestG = { d: dist, g };
        }
        // Hit helicopters (occupied one damages player if destroyed)
        for (const gid of [0, 1, 2, 3] as const) {
          const h = HELICOPTERS[gid];
          if (h.destroyed) continue;
          const toH = new THREE.Vector3(h.pos.x, h.pos.y + 1.4, h.pos.z).sub(origin);
          const dist = toH.length();
          if (dist > w.range) continue;
          toH.normalize();
          const dot = toH.dot(dir);
          if (dot < w.spread - 0.005) continue;
          const occupied = pilotState.piloting && gid === PLAYER_GANG;
          const res = damageHeli(gid, w.damage, occupied);
          if (res.occupantDamage > 0) damagePlayer(res.occupantDamage);
        }

        // Prefer closer target
        if (bestN && bestG) {
          if (bestN.d <= bestG.d) { damageNPC(bestN.npc, w.damage); if (bestN.npc.dead) { earnMoney(KILL_BOUNTY); onPlayerKill(); } }
          else damageGuard(bestG.g, w.damage);
        } else if (bestN) {
          damageNPC(bestN.npc, w.damage); if (bestN.npc.dead) { earnMoney(KILL_BOUNTY); onPlayerKill(); }
        } else if (bestG) {
          damageGuard(bestG.g, w.damage);
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
    scale={1.15}
    />
  );
}