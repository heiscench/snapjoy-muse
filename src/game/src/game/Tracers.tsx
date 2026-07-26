import { useFrame } from "@react-three/fiber";
import { useState } from "react";
import * as THREE from "three";
import { TRACERS, TRACER_LIFETIME } from "./tracerState";

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
          <mesh key={t.id} position={mid} quaternion={quat}>
            <boxGeometry args={[0.035, 0.035, LENGTH]} />
            <meshBasicMaterial color="#fff2b0" transparent opacity={opacity} />
          </mesh>
        );
      })}
    </group>
  );
}