import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

type Car = {
  lane: number; // road position
  axis: "x" | "z";
  dir: 1 | -1;
  pos: number; // along axis
  speed: number;
  color: string;
};

const CAR_COLORS = ["#c93b3b", "#3b7cc9", "#2f9d55", "#e0a13a", "#8b3bc9", "#111", "#e8e8e8"];

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function Vehicles({ count = 18 }: { count?: number }) {
  const cars = useMemo<Car[]>(() => {
    const r = rng(99);
    return Array.from({ length: count }, () => {
      const axis: "x" | "z" = r() < 0.5 ? "x" : "z";
      const laneIdx = Math.floor(r() * 9) - 4; // -4..4
      const lane = laneIdx * 40 + (r() < 0.5 ? -1.6 : 1.6);
      const dir: 1 | -1 = r() < 0.5 ? 1 : -1;
      return {
        lane,
        axis,
        dir,
        pos: r() * 320 - 160,
        speed: 8 + r() * 8,
        color: CAR_COLORS[Math.floor(r() * CAR_COLORS.length)],
      };
    });
  }, [count]);

  return (
    <group>
      {cars.map((c, i) => (
        <Car key={i} car={c} />
      ))}
    </group>
  );
}

function Car({ car }: { car: Car }) {
  const ref = useRef<THREE.Group>(null!);
  const wheelPhase = useRef(0);

  useFrame((_, dt) => {
    const dtc = Math.min(dt, 0.05);
    car.pos += car.speed * car.dir * dtc;
    if (car.pos > 170) car.pos = -170;
    if (car.pos < -170) car.pos = 170;
    wheelPhase.current += dtc * car.speed;

    if (!ref.current) return;
    if (car.axis === "x") {
      ref.current.position.set(car.pos, 0.35, car.lane);
      ref.current.rotation.y = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      ref.current.position.set(car.lane, 0.35, car.pos);
      ref.current.rotation.y = car.dir === 1 ? 0 : Math.PI;
    }
  });

  const headlightColor = "#fff5c9";
  const tailColor = "#ff2a2a";

  return (
    <group ref={ref}>
      {/* Body */}
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[1.6, 0.55, 3.4]} />
        <meshStandardMaterial color={car.color} metalness={0.55} roughness={0.35} />
      </mesh>
      {/* Cabin */}
      <mesh position={[0, 0.7, -0.1]}>
        <boxGeometry args={[1.45, 0.55, 1.7]} />
        <meshStandardMaterial color="#0a0a0e" metalness={0.4} roughness={0.2} />
      </mesh>
      {/* Wheels (static-ish, faked) */}
      {[
        [-0.75, -0.15, 1.1],
        [0.75, -0.15, 1.1],
        [-0.75, -0.15, -1.1],
        [0.75, -0.15, -1.1],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <boxGeometry args={[0.2, 0.4, 0.5]} />
          <meshStandardMaterial color="#050505" />
        </mesh>
      ))}
      {/* Headlights (front = +z) */}
      <mesh position={[-0.45, 0.25, 1.72]}>
        <boxGeometry args={[0.32, 0.14, 0.05]} />
        <meshBasicMaterial color={headlightColor} />
      </mesh>
      <mesh position={[0.45, 0.25, 1.72]}>
        <boxGeometry args={[0.32, 0.14, 0.05]} />
        <meshBasicMaterial color={headlightColor} />
      </mesh>
      {/* Tail lights */}
      <mesh position={[-0.55, 0.3, -1.72]}>
        <boxGeometry args={[0.28, 0.1, 0.05]} />
        <meshBasicMaterial color={tailColor} />
      </mesh>
      <mesh position={[0.55, 0.3, -1.72]}>
        <boxGeometry args={[0.28, 0.1, 0.05]} />
        <meshBasicMaterial color={tailColor} />
      </mesh>
    </group>
  );
}
