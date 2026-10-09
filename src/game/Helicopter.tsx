import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { GANGS } from "./gangs";
import { HELICOPTERS } from "./vehicleState";
import { RelicSkiff, RELIC_PALETTE } from "./RelicVisuals";
import { HELI_PADS } from "./worldData";

function ParkedHelicopter({ index }: { index: number }) {
  const group = useRef<THREE.Group>(null!);
  const rotor = useRef<THREE.Group>(null);
  const lastPos = useRef(new THREE.Vector3());
  const h0 = HELICOPTERS[index];
  const gang = GANGS[h0.gang];
  const slot = index % 2 as 0 | 1;

  useFrame((_, dt) => {
    const h = HELICOPTERS[index];
    if (!group.current || !rotor.current) return;

    if (h.destroyed) {
      group.current.visible = false;
      h.respawn -= dt;
      if (h.respawn <= 0) {
        const pad = HELI_PADS[h.gang][slot];
        h.pos.set(pad.x, 0, pad.z);
        h.yaw = 0; h.vy = 0;
        h.hp = 300;
        h.destroyed = false;
      }
      return;
    }
    group.current.visible = true;

    const flying = h.pos.y > 0.5 || Math.abs(h.vy) > 0.5;
    rotor.current.position.y = 0.18 + Math.sin(performance.now() * 0.001) * (flying ? 0.06 : 0.1);

    const vx = h.pos.x - lastPos.current.x;
    const vz = h.pos.z - lastPos.current.z;
    lastPos.current.set(h.pos.x, h.pos.y, h.pos.z);

    group.current.position.set(h.pos.x, h.pos.y, h.pos.z);
    // Model front is +Z; the flight direction is (-sin yaw, -cos yaw), so +PI.
    group.current.rotation.y = h.yaw + Math.PI;

    // Sideways speed relative to the pilot's right-hand direction (cos yaw, -sin yaw).
    // Forward flight gives ~0, so the Skiff stays level; strafing banks into the move.
    const lateral = (vx * Math.cos(h.yaw) - vz * Math.sin(h.yaw)) / Math.max(dt, 0.001);
    group.current.rotation.z = THREE.MathUtils.lerp(
      group.current.rotation.z,
      THREE.MathUtils.clamp(lateral * 0.025, -0.3, 0.3),
      Math.min(1, dt * 4),
    );
  });

  const pad = HELI_PADS[h0.gang][slot];

  return (
    <group ref={group} position={[pad.x, 0, pad.z]}>
      <group ref={rotor}><RelicSkiff color={gang.color} /></group>
    </group>
  );
}

function LandingPad({ gangId, slot }: { gangId: 0 | 1 | 2 | 3; slot: 0 | 1 }) {
  const gang = GANGS[gangId];
  const pos = HELI_PADS[gangId][slot];
  return (
    <group position={[pos.x, 0, pos.z]}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[7, 24]} />
        <meshStandardMaterial color={RELIC_PALETTE.ink} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5.6, 6, 24]} />
        <meshBasicMaterial color={gang.accent} />
      </mesh>
    </group>
  );
}

export function Helicopters() {
  const gangs = [0, 1, 2, 3] as const;
  return (
    <>
      {gangs.map((g) => [0, 1].map((s) => <LandingPad key={`pad-${g}-${s}`} gangId={g} slot={s as 0 | 1} />))}
      {HELICOPTERS.map((_, i) => <ParkedHelicopter key={`heli-${i}`} index={i} />)}
    </>
  );
}