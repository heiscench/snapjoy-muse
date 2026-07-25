import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

type Building = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  warm: boolean;
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
    const blockSize = 36;
    const roadWidth = 10;
    const grid = 6;
    for (let gx = -grid; gx <= grid; gx++) {
      for (let gz = -grid; gz <= grid; gz++) {
        const bx = gx * blockSize;
        const bz = gz * blockSize;
        const per = 2;
        for (let i = 0; i < per; i++) {
          for (let j = 0; j < per; j++) {
            const w = 9 + r() * 5;
            const d = 9 + r() * 5;
            const h = 8 + r() * 34;
            const cellW = (blockSize - roadWidth) / per;
            const cellD = (blockSize - roadWidth) / per;
            const x = bx - (blockSize - roadWidth) / 2 + cellW * (i + 0.5);
            const z = bz - (blockSize - roadWidth) / 2 + cellD * (j + 0.5);
            list.push({ x, z, w, d, h, warm: r() > 0.5 });
          }
        }
      }
    }
    return list;
  }, []);

  const warmRef = useRef<THREE.InstancedMesh>(null!);
  const coolRef = useRef<THREE.InstancedMesh>(null!);
  const warmCount = buildings.filter((b) => b.warm).length;
  const coolCount = buildings.length - warmCount;

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    let wi = 0;
    let ci = 0;
    for (const b of buildings) {
      m.compose(
        new THREE.Vector3(b.x, b.h / 2, b.z),
        new THREE.Quaternion(),
        new THREE.Vector3(b.w, b.h, b.d),
      );
      if (b.warm) {
        warmRef.current.setMatrixAt(wi++, m);
      } else {
        coolRef.current.setMatrixAt(ci++, m);
      }
    }
    warmRef.current.instanceMatrix.needsUpdate = true;
    coolRef.current.instanceMatrix.needsUpdate = true;
  }, [buildings]);

  const boxGeom = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  return (
    <group>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[800, 800]} />
        <meshStandardMaterial color="#12141a" roughness={1} />
      </mesh>

      {/* Roads */}
      {Array.from({ length: 13 }).map((_, i) => {
        const p = (i - 6) * 36;
        return (
          <group key={i}>
            <mesh position={[p, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[6, 468]} />
              <meshStandardMaterial color="#080a0f" />
            </mesh>
            <mesh position={[0, 0.01, p]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} receiveShadow>
              <planeGeometry args={[6, 468]} />
              <meshStandardMaterial color="#080a0f" />
            </mesh>
          </group>
        );
      })}

      {/* Instanced buildings — warm windows */}
      <instancedMesh
        ref={warmRef}
        args={[boxGeom, undefined, warmCount]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color="#2a2d36"
          emissive="#ffb066"
          emissiveIntensity={0.55}
          roughness={0.85}
        />
      </instancedMesh>

      {/* Instanced buildings — cool windows */}
      <instancedMesh
        ref={coolRef}
        args={[boxGeom, undefined, coolCount]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color="#1f2530"
          emissive="#78b6ff"
          emissiveIntensity={0.5}
          roughness={0.85}
        />
      </instancedMesh>

      {/* A handful of street lamps near origin only (perf) */}
      {Array.from({ length: 12 }).map((_, i) => {
        const gx = (i % 4) - 1.5;
        const gz = Math.floor(i / 4) - 1;
        const x = gx * 36 + 18;
        const z = gz * 36 + 18;
        return (
          <group key={`l${i}`} position={[x, 0, z]}>
            <mesh position={[0, 3, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 6]} />
              <meshStandardMaterial color="#111" />
            </mesh>
            <pointLight position={[0, 6, 0]} intensity={6} distance={16} color="#ffcf88" />
            <mesh position={[0, 6, 0]}>
              <sphereGeometry args={[0.3, 10, 10]} />
              <meshBasicMaterial color="#ffcf88" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
