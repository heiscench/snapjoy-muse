import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

type Building = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  bucket: 0 | 1 | 2; // 0 warm, 1 cool, 2 neon-pink
};

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function City() {
  const buildings = useMemo<Building[]>(() => {
    const r = rng(1337);
    const list: Building[] = [];
    const blockSize = 40;
    const roadWidth = 12;
    const grid = 4; // 9x9 blocks = 81 blocks * 4 = 324 buildings
    for (let gx = -grid; gx <= grid; gx++) {
      for (let gz = -grid; gz <= grid; gz++) {
        const bx = gx * blockSize;
        const bz = gz * blockSize;
        const per = 2;
        for (let i = 0; i < per; i++) {
          for (let j = 0; j < per; j++) {
            const w = 10 + r() * 6;
            const d = 10 + r() * 6;
            const h = 10 + r() * 40;
            const cellW = (blockSize - roadWidth) / per;
            const cellD = (blockSize - roadWidth) / per;
            const x = bx - (blockSize - roadWidth) / 2 + cellW * (i + 0.5);
            const z = bz - (blockSize - roadWidth) / 2 + cellD * (j + 0.5);
            const roll = r();
            const bucket: 0 | 1 | 2 = roll < 0.45 ? 0 : roll < 0.85 ? 1 : 2;
            list.push({ x, z, w, d, h, bucket });
          }
        }
      }
    }
    return list;
  }, []);

  const refs = [
    useRef<THREE.InstancedMesh>(null!),
    useRef<THREE.InstancedMesh>(null!),
    useRef<THREE.InstancedMesh>(null!),
  ];
  const counts = [0, 1, 2].map((b) => buildings.filter((x) => x.bucket === b).length);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const idx = [0, 0, 0];
    for (const b of buildings) {
      m.compose(
        new THREE.Vector3(b.x, b.h / 2, b.z),
        new THREE.Quaternion(),
        new THREE.Vector3(b.w, b.h, b.d),
      );
      refs[b.bucket].current.setMatrixAt(idx[b.bucket]++, m);
    }
    refs.forEach((r) => (r.current.instanceMatrix.needsUpdate = true));
  }, [buildings]);

  const boxGeom = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const roadCount = 9;

  return (
    <group>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[900, 900]} />
        <meshStandardMaterial color="#0a0b10" roughness={1} />
      </mesh>

      {/* Roads — two big cross planes textured by tiled quads */}
      {Array.from({ length: roadCount }).map((_, i) => {
        const p = (i - (roadCount - 1) / 2) * 40;
        return (
          <group key={i}>
            <mesh position={[p, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[8, 360]} />
              <meshStandardMaterial color="#04050a" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.02, p]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} receiveShadow>
              <planeGeometry args={[8, 360]} />
              <meshStandardMaterial color="#04050a" roughness={0.7} />
            </mesh>
            {/* Center lane markings */}
            <mesh position={[p, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.2, 360]} />
              <meshBasicMaterial color="#e8c96a" />
            </mesh>
            <mesh position={[0, 0.03, p]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
              <planeGeometry args={[0.2, 360]} />
              <meshBasicMaterial color="#e8c96a" />
            </mesh>
          </group>
        );
      })}

      {/* Warm-window buildings */}
      <instancedMesh ref={refs[0]} args={[boxGeom, undefined, counts[0]]}>
        <meshStandardMaterial
          color="#22252d"
          emissive="#ffa658"
          emissiveIntensity={0.7}
          roughness={0.9}
        />
      </instancedMesh>

      {/* Cool-window buildings */}
      <instancedMesh ref={refs[1]} args={[boxGeom, undefined, counts[1]]}>
        <meshStandardMaterial
          color="#1a1f2b"
          emissive="#6ab0ff"
          emissiveIntensity={0.6}
          roughness={0.9}
        />
      </instancedMesh>

      {/* Neon-pink accent buildings */}
      <instancedMesh ref={refs[2]} args={[boxGeom, undefined, counts[2]]}>
        <meshStandardMaterial
          color="#1c1420"
          emissive="#ff3aa8"
          emissiveIntensity={0.9}
          roughness={0.8}
        />
      </instancedMesh>
    </group>
  );
}
