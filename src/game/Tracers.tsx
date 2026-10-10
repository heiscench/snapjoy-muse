import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { TRACERS, TRACER_LIFETIME, MAX_TRACERS } from "./tracerState";
import { RELIC_PALETTE } from "./RelicVisuals";

const FWD = new THREE.Vector3(0, 0, 1);
const tmp = new THREE.Vector3();
const quat = new THREE.Quaternion();
const SLOTS = Array.from({ length: MAX_TRACERS }, (_, i) => i);

export function Tracers() {
  const lines = useRef<(THREE.Group | null)[]>([]);
  const glow = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const core = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const sparks = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((_, dt) => {
    for (let i = TRACERS.length - 1; i >= 0; i--) {
      TRACERS[i].life -= dt;
      if (TRACERS[i].life <= 0) TRACERS.splice(i, 1);
    }
    for (let i = 0; i < MAX_TRACERS; i++) {
      const g = lines.current[i];
      const s = sparks.current[i];
      if (!g || !s) continue;
      const t = TRACERS[i];
      if (!t) {
        g.visible = false;
        s.visible = false;
        continue;
      }
      const f = Math.max(0, t.life / TRACER_LIFETIME);
      g.visible = true;
      tmp.copy(t.start).addScaledVector(t.dir, t.len / 2);
      g.position.copy(tmp);
      quat.setFromUnitVectors(FWD, t.dir);
      g.quaternion.copy(quat);
      g.scale.set(1, 1, t.len);
      const gm = glow.current[i];
      const cm = core.current[i];
      if (gm) gm.opacity = f * 0.45;
      if (cm) cm.opacity = f * 0.95;

      if (t.hit) {
        s.visible = true;
        s.position.copy(t.start).addScaledVector(t.dir, t.len);
        s.scale.setScalar(0.12 + (1 - f) * 0.35);
      } else {
        s.visible = false;
      }
    }
  });

  return (
    <group>
      {SLOTS.map((i) => (
        <group key={i}>
          <group ref={(el) => { lines.current[i] = el; }} visible={false}>
            <mesh>
              <boxGeometry args={[0.06, 0.06, 1]} />
              <meshBasicMaterial ref={(m) => { glow.current[i] = m; }} color={RELIC_PALETTE.violet}
                transparent opacity={0} toneMapped={false} depthWrite={false} />
            </mesh>
            <mesh>
              <boxGeometry args={[0.022, 0.022, 1]} />
              <meshBasicMaterial ref={(m) => { core.current[i] = m; }} color={RELIC_PALETTE.rune}
                transparent opacity={0} toneMapped={false} depthWrite={false} />
            </mesh>
          </group>
          <mesh ref={(el) => { sparks.current[i] = el; }} visible={false}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color="#f1e6ff" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}