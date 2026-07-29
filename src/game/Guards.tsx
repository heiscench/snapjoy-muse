import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Character, type CharacterRefs } from "./Character";
import { GANGS } from "./gangs";
import {
  GUARDS,
  GUARD_DAMAGE,
  GUARD_DETECT_RANGE,
  GUARD_FIRE_RATE,
  initGuards,
  type GuardState,
} from "./guardState";
import { playerState, damagePlayer } from "./playerState";
import { nearestHostile } from "./targets";
import { territoryState } from "./territoryState";
import { resolveCollision } from "./worldData";
import { pilotState } from "./vehicleState";
import { carPilot } from "./carState";
import { spawnTracer } from "./tracerState";

const SECURITY_UNIFORM = "#1a1d26";
const SECURITY_ACCENT = "#3a4050";

export function Guards() {
  useEffect(() => {
    initGuards();
  }, []);
  const [, force] = useState(0);
  useEffect(() => { force(1); }, []);
  if (GUARDS.length === 0) return null;
  return (
    <group>
      {GUARDS.map((g) => <GuardUnit key={g.id} guard={g} />)}
    </group>
  );
}

function GuardUnit({ guard }: { guard: GuardState }) {
  const refs = useRef<CharacterRefs>(null!);
  const walkPhase = useRef(0);
  const uniformColor = useMemo(() => {
    if (guard.gang !== null) return GANGS[guard.gang].color;
    return SECURITY_UNIFORM;
  }, [guard.gang]);
  const accentColor = guard.gang !== null ? GANGS[guard.gang].accent : SECURITY_ACCENT;
  const baseCol = useMemo(() => new THREE.Color(uniformColor), [uniformColor]);
  const hitCol = useMemo(() => new THREE.Color("#ff5050"), []);

  useFrame((_, dt) => {
    const dtc = Math.min(dt, 0.05);
    const r = refs.current;
    if (!r || !r.root) return;

    if (guard.dead) {
      guard.respawn -= dtc;
      r.root.visible = false;
      if (guard.respawn <= 0) {
        guard.pos.copy(guard.home);
        guard.hp = guard.maxHp;
        guard.dead = false;
        guard.aggroT = 0;
      }
      return;
    }
    r.root.visible = true;

    const pp = playerState.pos;
    const hostile = nearestHostile(guard.pos.x, guard.pos.z, null, GUARD_DETECT_RANGE, true);
    const nearestDist = hostile ? hostile.dist : Infinity;

    let aggro = guard.aggroT > 0;
    if (guard.kind === "bank" && nearestDist < GUARD_DETECT_RANGE) aggro = true;
    if (guard.kind === "neutral") {
      const capturingHere = territoryState.captureDistrict === guard.district && territoryState.captureProgress > 0;
      if (capturingHere) aggro = true;
      if (nearestDist < GUARD_DETECT_RANGE * 0.6) aggro = true;
    }

    if (aggro) {
      guard.aggroT = Math.max(guard.aggroT - dtc, 0);
      const tx = hostile ? hostile.target.x : pp.x;
      const tz = hostile ? hostile.target.z : pp.z;
      const targetIsLocal = hostile ? hostile.target.isLocal : true;
      const targetInVehicle = hostile
        ? hostile.target.inVehicle
        : pilotState.piloting || carPilot.driving;

      const dx = tx - guard.pos.x, dz = tz - guard.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const speed = guard.kind === "bank" ? 3.4 : 3.8;
      const nx = guard.pos.x + (dx / d) * speed * dtc;
      const nz = guard.pos.z + (dz / d) * speed * dtc;
      const resolved = resolveCollision(guard.pos.x, guard.pos.z, nx, nz, 0.5);
      guard.pos.x = resolved.x; guard.pos.z = resolved.z;
      guard.dir.set(dx / d, 0, dz / d);

      guard.fireCd = Math.max(0, guard.fireCd - dtc);
      if (d < 40 && guard.fireCd === 0) {
        guard.fireCd = GUARD_FIRE_RATE;
        const from = new THREE.Vector3(guard.pos.x, 1.4, guard.pos.z);
        const to = new THREE.Vector3(tx, 1.4, tz).sub(from).normalize();
        spawnTracer(from, to);
        if (d < 36 && targetIsLocal && !targetInVehicle) damagePlayer(GUARD_DAMAGE);
      }
    } else {
      const dx = guard.home.x - guard.pos.x, dz = guard.home.z - guard.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 6) {
        const nx = guard.pos.x + (dx / d) * 1.4 * dtc;
        const nz = guard.pos.z + (dz / d) * 1.4 * dtc;
        const resolved = resolveCollision(guard.pos.x, guard.pos.z, nx, nz, 0.5);
        guard.pos.x = resolved.x; guard.pos.z = resolved.z;
        guard.dir.set(dx / d, 0, dz / d);
      }
    }

    const yaw = Math.atan2(guard.dir.x, guard.dir.z);
    r.root.position.set(guard.pos.x, 0, guard.pos.z);
    r.root.rotation.y = yaw;

    walkPhase.current += dtc * 8;
    const swing = Math.sin(walkPhase.current) * 0.6;
    if (r.legL) r.legL.rotation.x = swing;
    if (r.legR) r.legR.rotation.x = -swing;

    if (guard.hitFlash > 0) {
      guard.hitFlash -= dtc;
      if (r.torsoMat) r.torsoMat.color.copy(hitCol);
    } else if (r.torsoMat) {
      r.torsoMat.color.copy(baseCol);
    }
  });

  return <Character ref={refs} color={uniformColor} accent={accentColor} scale={1.15} />;
}