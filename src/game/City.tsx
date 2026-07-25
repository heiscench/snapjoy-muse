import { useMemo } from "react";
import * as THREE from "three";

type Building = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  windowColor: THREE.Color;
};

// Deterministic pseudo-random
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function City() {
  const buildings = useMemo<Building[]>(() => {
    const r = rng(42);
    const list: Building[] = [];
    const blockSize = 40;
    const roadWidth = 10;
    const grid = 5;
    for (let gx = -grid; gx <= grid; gx++) {
      for (let gz = -grid; gz <= grid; gz++) {
        const bx = gx * blockSize;
        const bz = gz * blockSize;
        // buildings per block
        const per = 2 + Math.floor(r() * 2);
        for (let i = 0; i < per; i++) {
          for (let j = 0; j < per; j++) {
            const w = 8 + r() * 6;
            const d = 8 + r() * 6;
            const h = 10 + r() * 40;
            const cellW = (blockSize - roadWidth) / per;
            const cellD = (blockSize - roadWidth) / per;
            const x = bx - (blockSize - roadWidth) / 2 + cellW * (i + 0.5);
            const z = bz - (blockSize - roadWidth) / 2 + cellD * (j + 0.5);
            const warm = r() > 0.5;
            list.push({
              x,
              z,
              w,
              d,
              h,
              windowColor: new THREE.Color(warm ? "#ffd08a" : "#a8d0ff"),
            });
          }
        }
      }
    }
    return list;
  }, []);

  return (
    <group>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#1a1d24" />
      </mesh>

      {/* Road grid - painted stripes */}
      {Array.from({ length: 11 }).map((_, i) => {
        const p = (i - 5) * 40;
        return (
          <group key={i}>
            <mesh position={[p, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[6, 440]} />
              <meshStandardMaterial color="#0f1116" />
            </mesh>
            <mesh position={[0, 0.01, p]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
              <planeGeometry args={[6, 440]} />
              <meshStandardMaterial color="#0f1116" />
            </mesh>
          </group>
        );
      })}

      {/* Buildings with emissive window facades */}
      {buildings.map((b, i) => (
        <group key={i} position={[b.x, b.h / 2, b.z]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial
              color="#2b2f38"
              emissive={b.windowColor}
              emissiveIntensity={0.35}
              roughness={0.8}
            />
          </mesh>
        </group>
      ))}

      {/* Street lamps */}
      {Array.from({ length: 40 }).map((_, i) => {
        const gx = (i % 8) - 4;
        const gz = Math.floor(i / 8) - 2;
        const x = gx * 40 + 20;
        const z = gz * 40 + 20;
        return (
          <group key={`l${i}`} position={[x, 0, z]}>
            <mesh position={[0, 3, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 6]} />
              <meshStandardMaterial color="#111" />
            </mesh>
            <pointLight position={[0, 6, 0]} intensity={8} distance={18} color="#ffcf88" />
            <mesh position={[0, 6, 0]}>
              <sphereGeometry args={[0.35, 12, 12]} />
              <meshStandardMaterial
                emissive="#ffcf88"
                emissiveIntensity={2}
                color="#ffcf88"
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
