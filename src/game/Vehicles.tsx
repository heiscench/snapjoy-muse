import { useEffect, useMemo, useState } from "react";
import { GANGS } from "./gangs";
import { BLOCK_SIZE, GRID } from "./worldData";
import { initCarHealth, carDestroyed, carRespawn, CAR_MAX_HP } from "./vehicleState";
import { useFrame } from "@react-three/fiber";

type CarType = "sedan" | "suv" | "sport";

type Car = {
  type: CarType;
  x: number;
  z: number;
  rotY: number;
  color: string;
};

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function Sedan({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[1.6, 0.5, 3.6]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.75, -0.1]}>
        <boxGeometry args={[1.45, 0.5, 1.9]} />
        <meshStandardMaterial color="#0a0a0e" metalness={0.4} roughness={0.2} />
      </mesh>
      {/* Wheels */}
      {[[-0.75, 0.15, 1.1], [0.75, 0.15, 1.1], [-0.75, 0.15, -1.1], [0.75, 0.15, -1.1]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.32, 0.32, 0.25, 12]} />
          <meshStandardMaterial color="#050505" />
        </mesh>
      ))}
      <mesh position={[-0.45, 0.4, 1.82]}><boxGeometry args={[0.32, 0.14, 0.05]} /><meshBasicMaterial color="#fff5c9" /></mesh>
      <mesh position={[0.45, 0.4, 1.82]}><boxGeometry args={[0.32, 0.14, 0.05]} /><meshBasicMaterial color="#fff5c9" /></mesh>
    </group>
  );
}

function SUV({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[2.0, 0.9, 4.2]} />
        <meshStandardMaterial color={color} metalness={0.45} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.15, -0.2]}>
        <boxGeometry args={[1.85, 0.7, 2.4]} />
        <meshStandardMaterial color="#0a0a0e" metalness={0.4} roughness={0.2} />
      </mesh>
      {[[-0.95, 0.25, 1.4], [0.95, 0.25, 1.4], [-0.95, 0.25, -1.4], [0.95, 0.25, -1.4]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.48, 0.48, 0.35, 12]} />
          <meshStandardMaterial color="#050505" />
        </mesh>
      ))}
      <mesh position={[-0.55, 0.6, 2.12]}><boxGeometry args={[0.4, 0.2, 0.05]} /><meshBasicMaterial color="#fff5c9" /></mesh>
      <mesh position={[0.55, 0.6, 2.12]}><boxGeometry args={[0.4, 0.2, 0.05]} /><meshBasicMaterial color="#fff5c9" /></mesh>
      {/* Roof rack */}
      <mesh position={[0, 1.55, -0.2]}><boxGeometry args={[1.7, 0.06, 2.2]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
    </group>
  );
}

function Sport({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.28, 0]}>
        <boxGeometry args={[1.9, 0.36, 4.0]} />
        <meshStandardMaterial color={color} metalness={0.75} roughness={0.2} />
      </mesh>
      {/* Low cabin */}
      <mesh position={[0, 0.6, -0.1]}>
        <boxGeometry args={[1.6, 0.4, 1.2]} />
        <meshStandardMaterial color="#0a0a0e" metalness={0.6} roughness={0.15} />
      </mesh>
      {/* Rear spoiler */}
      <mesh position={[0, 0.55, -1.85]}>
        <boxGeometry args={[1.9, 0.06, 0.3]} />
        <meshStandardMaterial color="#0a0a0e" />
      </mesh>
      {[[-0.85, 0.22, 1.25], [0.85, 0.22, 1.25], [-0.85, 0.22, -1.25], [0.85, 0.22, -1.25]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.32, 0.32, 0.28, 12]} />
          <meshStandardMaterial color="#050505" />
        </mesh>
      ))}
      <mesh position={[-0.5, 0.32, 2.02]}><boxGeometry args={[0.42, 0.1, 0.05]} /><meshBasicMaterial color="#c9f0ff" /></mesh>
      <mesh position={[0.5, 0.32, 2.02]}><boxGeometry args={[0.42, 0.1, 0.05]} /><meshBasicMaterial color="#c9f0ff" /></mesh>
    </group>
  );
}

const CIVILIAN_COLORS = ["#7a7a80", "#3b3b40", "#8a4a2a", "#2a4a6a", "#c9c9cf"];

export function Vehicles({ count = 22 }: { count?: number }) {
  const cars = useMemo<Car[]>(() => {
    const r = rng(20260726);
    const list: Car[] = [];
    for (let i = 0; i < count; i++) {
      const gx = Math.floor(r() * (GRID * 2 + 1)) - GRID;
      const gz = Math.floor(r() * (GRID * 2 + 1)) - GRID;
      const alongX = r() < 0.5;
      const jitter = (r() - 0.5) * (BLOCK_SIZE - 20);
      const laneOffset = r() < 0.5 ? -6 : 6;
      const x = alongX ? gx * BLOCK_SIZE + jitter : gx * BLOCK_SIZE + laneOffset;
      const z = alongX ? gz * BLOCK_SIZE + laneOffset : gz * BLOCK_SIZE + jitter;
      const rotY = alongX ? Math.PI / 2 : 0;
      const typeRoll = r();
      const type: CarType = typeRoll < 0.45 ? "sedan" : typeRoll < 0.8 ? "suv" : "sport";
      let color: string;
      if (r() < 0.4) color = CIVILIAN_COLORS[Math.floor(r() * CIVILIAN_COLORS.length)];
      else color = GANGS[Math.floor(r() * 4)].color;
      list.push({ type, x, z, rotY, color });
    }
    return list;
  }, [count]);

  useEffect(() => { initCarHealth(cars.length); }, [cars.length]);

  const [, force] = useState(0);
  useFrame((_, dt) => {
    let changed = false;
    for (let i = 0; i < carDestroyed.length; i++) {
      if (carDestroyed[i]) {
        carRespawn[i] -= dt;
        if (carRespawn[i] <= 0) {
          carDestroyed[i] = false;
          changed = true;
        }
      }
    }
    if (changed) force((n) => n + 1);
  });

  return (
    <group>
      {cars.map((c, i) => (
        <group
          key={i}
          position={[c.x, 0, c.z]}
          rotation={[0, c.rotY, 0]}
          visible={!carDestroyed[i]}
        >
          {c.type === "sedan" && <Sedan color={c.color} />}
          {c.type === "suv" && <SUV color={c.color} />}
          {c.type === "sport" && <Sport color={c.color} />}
        </group>
      ))}
    </group>
  );
}

// Expose CAR_MAX_HP for callers reasoning about damage scaling (unused directly here).
void CAR_MAX_HP;
