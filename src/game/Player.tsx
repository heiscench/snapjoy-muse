import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Character, type CharacterRefs } from "./Character";
import { GANGS, PLAYER_GANG } from "./gangs";
import { input, readKeyboardMove } from "./input";
import { NPCS, damageNPC } from "./npcState";
import { Weapon } from "./Weapon";
import { resolveCollision } from "./worldData";

export function Player() {
  const refs = useRef<CharacterRefs>(null!);
  const vel = useRef(new THREE.Vector3());
  const yaw = useRef(0);
  const pitch = useRef(0.25);
  const grounded = useRef(true);
  const walkPhase = useRef(0);
  const camOffset = useRef(new THREE.Vector3());
  const fireCd = useRef(0);
  const hasSpawned = useRef(false);
  const { camera } = useThree();
  const gang = GANGS[PLAYER_GANG];

  const weaponNode = useMemo(() => <Weapon />, []);

  useFrame((_, dt) => {
    const dtc = Math.min(dt, 0.05);
    const r = refs.current;
    if (!r || !r.root) return;

    // Spawn in a clear street gap, not inside the downtown tower at (0,0).
    if (!hasSpawned.current) {
      r.root.position.set(24, 0, 24);
      hasSpawned.current = true;
    }

    // Look
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
    yaw.current -= lookX * 2.6 * dtc;
    pitch.current = THREE.MathUtils.clamp(pitch.current + lookY * 1.4 * dtc, -0.3, 1.0);

    // Move
    const kb = readKeyboardMove();
    const mx = input.move.x + kb.x;
    const my = input.move.y + kb.y;
    const mag = Math.min(1, Math.hypot(mx, my));
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
    p.y += vel.current.y * dtc;
    if (p.y <= 0) {
      p.y = 0;
      vel.current.y = 0;
      grounded.current = true;
    }

    // Face
    if (aiming) {
      r.root.rotation.y = THREE.MathUtils.lerp(r.root.rotation.y, yaw.current, Math.min(1, dtc * 18));
    } else if (mag > 0.05) {
      const targetRot = Math.atan2(dir.x, dir.z);
      r.root.rotation.y = THREE.MathUtils.lerp(r.root.rotation.y, targetRot, Math.min(1, dtc * 14));
    }

    // Walk cycle
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

    // Camera
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

    // Firing / damage
    fireCd.current = Math.max(0, fireCd.current - dtc);
    if (input.fire && input.aim && fireCd.current === 0) {
      fireCd.current = 0.12;
      const origin = camera.position.clone();
      const forwardV = new THREE.Vector3();
      camera.getWorldDirection(forwardV);
      let best: { d: number; npc: (typeof NPCS)[number] } | null = null;
      for (const n of NPCS) {
        if (n.dead) continue;
        const toN = new THREE.Vector3(n.pos.x, 1, n.pos.z).sub(origin);
        const dist = toN.length();
        if (dist > 80) continue;
        toN.normalize();
        const dot = toN.dot(forwardV);
        if (dot < 0.985) continue;
        if (!best || dist < best.d) best = { d: dist, npc: n };
      }
      if (best) damageNPC(best.npc, 34);
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