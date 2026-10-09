import { useFrame } from "@react-three/fiber";
import { useState } from "react";
import * as THREE from "three";
import { TRACERS, TRACER_LIFETIME } from "./tracerState";
import { RELIC_PALETTE } from "./RelicVisuals";

const LENGTH = 45;
const UP = new THREE.Vector3(0, 0, 1);

export function Tracers() {
  const [, force] = useState(0);

  useFrame((_, dt) => {
    let changed = false;
    for (let i = TRACERS.length - 1; i >= 0; i--) {
      TRACERS[i].life -= dt;
      if (TRACERS[i].life <= 0) {
        TRACERS.splice(i, 1);
        changed = true;
      }
    }
    if (TRACERS.length > 0 || changed) force((n) => n + 1);
  });

  return (
    <group>
      {TRACERS.map((t) => {
        const mid = t.start.clone().addScaledVector(t.dir, LENGTH / 2);
        const quat = new THREE.Quaternion().setFromUnitVectors(UP, t.dir);
        const opacity = Math.max(0, t.life / TRACER_LIFETIME) * 0.9;
        return (
          <group key={t.id} position={mid} quaternion={quat}>
            <mesh><boxGeometry args={[0.07, 0.07, LENGTH]} /><meshBasicMaterial color={RELIC_PALETTE.violet} transparent opacity={opacity * 0.4} toneMapped={false} /></mesh>
            <mesh><boxGeometry args={[0.025, 0.025, LENGTH]} /><meshBasicMaterial color={RELIC_PALETTE.rune} transparent opacity={opacity} toneMapped={false} /></mesh>
          </group>
        );
      })}
    </group>
  );
}