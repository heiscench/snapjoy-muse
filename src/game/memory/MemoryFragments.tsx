import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { HELICOPTERS, pilotState } from "../vehicleState";
import { playerState } from "../playerState";
import { rooftopHeightAt } from "../worldData";
import { THEMES } from "../city/palette";
import { FRAGMENTS } from "./fragments";
import { collectFragment, loadMemories, memoryState } from "./memoryState";

const dummy = new THREE.Object3D();
const COLLECT_R = 3.6;
const BEAM_H = 46;

export function MemoryFragments() {
  const crystals = useRef<THREE.InstancedMesh>(null!);
  const beams = useRef<THREE.InstancedMesh>(null!);
  const colors = useMemo(() => FRAGMENTS.map((f) => new THREE.Color(THEMES[f.kingdom].glow)), []);

  useEffect(() => {
    void loadMemories();
  }, []);

  useLayoutEffect(() => {
    const c = crystals.current;
    const b = beams.current;
    if (!c || !b) return;
    FRAGMENTS.forEach((_, i) => {
      c.setColorAt(i, colors[i]);
      b.setColorAt(i, colors[i]);
    });
    if (c.instanceColor) c.instanceColor.needsUpdate = true;
    if (b.instanceColor) b.instanceColor.needsUpdate = true;
  }, [colors]);

  useFrame(({ clock }) => {
    const c = crystals.current;
    const b = beams.current;
    if (!c || !b) return;
    const t = clock.elapsedTime;
    const px = playerState.pos.x;
    const pz = playerState.pos.z;
    // How high the player is: the Skiff's altitude, or the roof they are standing on.
    const height =
      pilotState.piloting && pilotState.heliIndex >= 0
        ? HELICOPTERS[pilotState.heliIndex].pos.y
        : rooftopHeightAt(px, pz);

    FRAGMENTS.forEach((f, i) => {
      const got = memoryState.found.has(f.id);
      const s = got ? 0.0001 : 1;

      dummy.position.set(f.x, f.y + Math.sin(t * 1.6 + i) * 0.25, f.z);
      dummy.rotation.set(0, t * 0.9 + i, 0);
      dummy.scale.set(0.9 * s, 1.5 * s, 0.9 * s);
      dummy.updateMatrix();
      c.setMatrixAt(i, dummy.matrix);

      dummy.position.set(f.x, f.y + BEAM_H / 2 - 1, f.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      b.setMatrixAt(i, dummy.matrix);

      if (!got && Math.hypot(f.x - px, f.z - pz) < COLLECT_R && Math.abs(height - f.floor) < 5) {
        void collectFragment(f.id);
      }
    });
    c.instanceMatrix.needsUpdate = true;
    b.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={crystals} args={[undefined, undefined, FRAGMENTS.length]} frustumCulled={false}>
        <octahedronGeometry args={[0.6, 0]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={beams} args={[undefined, undefined, FRAGMENTS.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.28, 0.28, BEAM_H, 6, 1, true]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.32}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}