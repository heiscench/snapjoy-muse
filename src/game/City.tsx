import { useMemo } from "react";
import * as THREE from "three";
import { BUILDINGS, BLOCK_SIZE, GRID, HARBOR_Z, type BuildingBox } from "./worldData";

const DISTRICT_ACCENT: Record<string, string> = {
  downtown: "#6ab0ff",
  industrial: "#e8c96a",
  stadium: "#7cff9a",
  bank: "#ffd66a",
  shopping: "#ff9ad6",
  harbor: "#6adfff",
};

function Tower({ b }: { b: BuildingBox }) {
  const bands = Math.max(3, Math.floor(b.h / 5));
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color="#1a1f2b" emissive="#6ab0ff" emissiveIntensity={0.35} roughness={0.9} />
      </mesh>
      {/* Floor-line banding */}
      {Array.from({ length: bands }).map((_, i) => (
        <mesh key={i} position={[0, (i + 0.5) * (b.h / bands), b.d / 2 + 0.02]}>
          <planeGeometry args={[b.w * 0.9, 0.15]} />
          <meshBasicMaterial color="#e8c96a" />
        </mesh>
      ))}
    </group>
  );
}

function Warehouse({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color="#2a2820" roughness={0.95} />
      </mesh>
      {/* Garage doors */}
      <mesh position={[0, b.h * 0.4, b.d / 2 + 0.02]}>
        <planeGeometry args={[b.w * 0.35, b.h * 0.55]} />
        <meshBasicMaterial color="#e8a24a" />
      </mesh>
      <mesh position={[b.w * 0.28, b.h * 0.4, b.d / 2 + 0.02]}>
        <planeGeometry args={[b.w * 0.2, b.h * 0.55]} />
        <meshBasicMaterial color="#c68a30" />
      </mesh>
    </group>
  );
}

function Bank({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color="#2a2418" emissive="#ffd66a" emissiveIntensity={0.25} roughness={0.7} />
      </mesh>
      {/* Cap */}
      <mesh position={[0, b.h + 1, 0]}>
        <boxGeometry args={[b.w * 1.1, 2, b.d * 1.1]} />
        <meshStandardMaterial color="#3a3222" />
      </mesh>
      {/* Columns */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (b.w / 2 - 1.5), b.h * 0.3, b.d / 2 + 0.5]}>
          <boxGeometry args={[1, b.h * 0.6, 1]} />
          <meshStandardMaterial color="#4a4230" />
        </mesh>
      ))}
    </group>
  );
}

function LowRise({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color="#231a2a" emissive="#ff9ad6" emissiveIntensity={0.35} roughness={0.85} />
      </mesh>
      {/* Storefronts */}
      <mesh position={[0, 1.5, b.d / 2 + 0.02]}>
        <planeGeometry args={[b.w * 0.9, 2.4]} />
        <meshBasicMaterial color="#ffe4a3" />
      </mesh>
    </group>
  );
}

function Harbor({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color="#1a2a30" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Crane({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color="#8a3a1a" />
      </mesh>
      <mesh position={[b.w * 3, b.h * 0.9, 0]}>
        <boxGeometry args={[b.w * 6, 0.6, 0.8]} />
        <meshStandardMaterial color="#8a3a1a" />
      </mesh>
    </group>
  );
}

function Stadium({ b }: { b: BuildingBox }) {
  const segs = 16;
  return (
    <group position={[b.x, 0, b.z]}>
      {/* Outer bowl ring built from box segments */}
      {Array.from({ length: segs }).map((_, i) => {
        const a = (i / segs) * Math.PI * 2;
        const r = b.w / 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * r, b.h / 2, Math.sin(a) * r]}
            rotation={[0, -a, 0]}
          >
            <boxGeometry args={[(2 * Math.PI * r) / segs, b.h, 3]} />
            <meshStandardMaterial color="#2a2f2a" emissive="#7cff9a" emissiveIntensity={0.3} />
          </mesh>
        );
      })}
      {/* Field */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[b.w / 2 - 3, 24]} />
        <meshStandardMaterial color="#0f3a1a" />
      </mesh>
    </group>
  );
}

export function City() {
  const roadCount = GRID * 2 + 1;

  const rendered = useMemo(() => {
    return BUILDINGS.map((b, i) => {
      switch (b.type) {
        case "tower": return <Tower key={i} b={b} />;
        case "warehouse": return <Warehouse key={i} b={b} />;
        case "bank": return <Bank key={i} b={b} />;
        case "lowrise": return <LowRise key={i} b={b} />;
        case "harbor": return <Harbor key={i} b={b} />;
        case "crane": return <Crane key={i} b={b} />;
        case "stadium": return <Stadium key={i} b={b} />;
      }
    });
  }, []);

  const groundExtent = (GRID * 2 + 2) * BLOCK_SIZE;
  const roadLen = groundExtent;

  return (
    <group>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[groundExtent, groundExtent]} />
        <meshStandardMaterial color="#0a0b10" roughness={1} />
      </mesh>

      {/* Harbor water plane */}
      <mesh position={[0, 0.03, HARBOR_Z - BLOCK_SIZE * 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[groundExtent, BLOCK_SIZE * 1.4]} />
        <meshStandardMaterial color="#0d2a3f" emissive="#0a1a30" emissiveIntensity={0.2} roughness={0.4} />
      </mesh>

      {/* Roads on the grid */}
      {Array.from({ length: roadCount }).map((_, i) => {
        const p = (i - (roadCount - 1) / 2) * BLOCK_SIZE;
        return (
          <group key={i}>
            <mesh position={[p, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[10, roadLen]} />
              <meshStandardMaterial color="#04050a" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.02, p]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} receiveShadow>
              <planeGeometry args={[10, roadLen]} />
              <meshStandardMaterial color="#04050a" roughness={0.7} />
            </mesh>
            <mesh position={[p, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.2, roadLen]} />
              <meshBasicMaterial color="#e8c96a" />
            </mesh>
            <mesh position={[0, 0.03, p]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
              <planeGeometry args={[0.2, roadLen]} />
              <meshBasicMaterial color="#e8c96a" />
            </mesh>
          </group>
        );
      })}

      {rendered}
    </group>
  );
}

// Silence unused import warning in types
export type _D = typeof DISTRICT_ACCENT;
