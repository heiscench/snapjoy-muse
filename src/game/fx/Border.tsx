import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BLOCK_SIZE, GRID } from "../worldData";
import { borderTexture } from "./fxTextures";

const BORDER = (GRID + 0.75) * BLOCK_SIZE; // just outside the outermost buildings
const LEN = BORDER * 2;
const HEIGHT = 80;
const STEP = 64;

const SIDES: { x: number; z: number; ry: number }[] = [
  { x: 0, z: BORDER, ry: 0 },
  { x: 0, z: -BORDER, ry: 0 },
  { x: BORDER, z: 0, ry: Math.PI / 2 },
  { x: -BORDER, z: 0, ry: Math.PI / 2 },
];

/** Pillar positions along all four sides. */
const PILLARS: { x: number; z: number }[] = (() => {
  const list: { x: number; z: number }[] = [];
  const n = Math.round(LEN / STEP);
  for (let i = 0; i <= n; i++) {
    const v = -BORDER + (i * LEN) / n;
    list.push({ x: v, z: BORDER }, { x: v, z: -BORDER }, { x: BORDER, z: v }, { x: -BORDER, z: v });
  }
  return list;
})();

export function Border() {
  const walls = useRef<(THREE.Mesh | null)[]>([]);
  const pillars = useRef<THREE.InstancedMesh>(null!);
  const crystals = useRef<THREE.InstancedMesh>(null!);

  const tex = useMemo(() => {
    const t = borderTexture();
    if (t) t.repeat.set(Math.round(LEN / STEP), 1);
    return t;
  }, []);

  const wallMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: tex ?? undefined,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    [tex],
  );

  useLayoutEffect(() => {
    const p = pillars.current;
    const c = crystals.current;
    if (!p || !c) return;
    const d = new THREE.Object3D();
    PILLARS.forEach((s, i) => {
      d.position.set(s.x, 9, s.z);
      d.scale.set(1, 1, 1);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      p.setMatrixAt(i, d.matrix);
      d.position.set(s.x, 22, s.z);
      d.rotation.set(0, i * 0.7, 0);
      d.scale.set(1.2, 2, 1.2);
      d.updateMatrix();
      c.setMatrixAt(i, d.matrix);
    });
    p.instanceMatrix.needsUpdate = true;
    c.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame(({ clock }) => {
    wallMat.opacity = 0.55 + Math.sin(clock.elapsedTime * 0.8) * 0.15;
  });

  return (
    <group>
      {SIDES.map((s, i) => (
        <mesh
          key={i}
          ref={(el) => { walls.current[i] = el; }}
          position={[s.x, HEIGHT / 2, s.z]}
          rotation={[0, s.ry, 0]}
          material={wallMat}
        >
          <planeGeometry args={[LEN, HEIGHT]} />
        </mesh>
      ))}

      {SIDES.map((s, i) => (
        <mesh key={`line-${i}`} position={[s.x, 0.06, s.z]} rotation={[-Math.PI / 2, 0, s.ry]}>
          <planeGeometry args={[LEN, 1.4]} />
          <meshBasicMaterial color="#b99aff" transparent opacity={0.8} fog={false} toneMapped={false} />
        </mesh>
      ))}

      <instancedMesh ref={pillars} args={[undefined, undefined, PILLARS.length]} frustumCulled={false}>
        <boxGeometry args={[2.4, 18, 2.4]} />
        <meshStandardMaterial color="#2a2530" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={crystals} args={[undefined, undefined, PILLARS.length]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#c9a8ff" fog={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}