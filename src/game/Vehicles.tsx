import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GANGS } from "./gangs";
import { BLOCK_SIZE, GRID } from "./worldData";
import { initCarHealth, carDestroyed, carRespawn } from "./vehicleState";
import { CAR_LIVE, initCarLive, carPilot } from "./carState";
import { useFrame } from "@react-three/fiber";
import {
  ownedPersonalVehicles,
  personalParkSpot,
  personalVehicleState,
  type PersonalVehicleId,
} from "./personalVehicleState";

type CarType = "sedan" | "suv" | "sport";

type Car = {
  type: CarType;
  x: number;
  z: number;
  rotY: number;
  color: string;
  /** Set for player-owned personal vehicles — these respawn at HQ. */
  personalId?: PersonalVehicleId;
};

const PERSONAL_POLL_MS = 400;

const CAR_SCALE = 1.6;

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
      <mesh position={[0, 0.6, -0.1]}>
        <boxGeometry args={[1.6, 0.4, 1.2]} />
        <meshStandardMaterial color="#0a0a0e" metalness={0.6} roughness={0.15} />
      </mesh>
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

function CarUnit({ index, car }: { index: number; car: Car }) {
  const group = useRef<THREE.Group>(null!);
  useFrame(() => {
    const live = CAR_LIVE[index];
    if (!group.current || !live) return;
    group.current.position.set(live.x, 0, live.z);
    group.current.rotation.y = live.rotY;
    group.current.visible = !carDestroyed[index];
  });
  return (
    <group ref={group} scale={CAR_SCALE}>
      {car.type === "sedan" && <Sedan color={car.color} />}
      {car.type === "suv" && <SUV color={car.color} />}
      {car.type === "sport" && <Sport color={car.color} />}
      {car.personalId && (
        <mesh position={[0, 1.9, 0]}>
          <coneGeometry args={[0.16, 0.32, 4]} />
          <meshBasicMaterial color="#ffd66a" toneMapped={false} />
        </mesh>
      )}
      {carPilot.driving && carPilot.drivingIndex === index && (
        <>
          <spotLight
            position={[-0.5, 0.5, 2.2]}
            target-position={[-0.5, 0, 12]}
            angle={0.4}
            penumbra={0.5}
            intensity={6}
            distance={30}
            color="#fff6d8"
          />
          <spotLight
            position={[0.5, 0.5, 2.2]}
            target-position={[0.5, 0, 12]}
            angle={0.4}
            penumbra={0.5}
            intensity={6}
            distance={30}
            color="#fff6d8"
          />
        </>
      )}
    </group>
  );
}

export function Vehicles({ count = 22 }: { count?: number }) {
  // Owning a car changes the roster, so poll the shared version counter and
  // rebuild only when it actually changes.
  const [garageVersion, setGarageVersion] = useState(personalVehicleState.version);
  useEffect(() => {
    const id = setInterval(() => {
      if (personalVehicleState.version !== garageVersion) {
        setGarageVersion(personalVehicleState.version);
      }
    }, PERSONAL_POLL_MS);
    return () => clearInterval(id);
  }, [garageVersion]);

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
    // Personal vehicles live in the same array, so all existing driving,
    // collision, damage and destruction logic applies to them unchanged.
    for (const v of ownedPersonalVehicles()) {
      const spot = personalParkSpot(v.id);
      list.push({ type: v.body, x: spot.x, z: spot.z, rotY: spot.rotY, color: v.color, personalId: v.id });
    }
    return list;
  }, [count, garageVersion]);

  useEffect(() => {
    initCarHealth(cars.length);
    initCarLive(cars);
  }, [cars]);

  const [, force] = useState(0);
  useFrame((_, dt) => {
    let changed = false;
    for (let i = 0; i < carDestroyed.length; i++) {
      if (carDestroyed[i]) {
        carRespawn[i] -= dt;
        if (carRespawn[i] <= 0) {
          carDestroyed[i] = false;
          const personal = cars[i]?.personalId;
          if (personal) {
            // Your own car always comes back to the HQ parking pad.
            const spot = personalParkSpot(personal);
            const live = CAR_LIVE[i];
            if (live) { live.x = spot.x; live.z = spot.z; live.rotY = spot.rotY; live.speed = 0; }
          }
          changed = true;
        }
      }
    }
    if (changed) force((n) => n + 1);
  });

  return (
    <group>
      {cars.map((c, i) => <CarUnit key={i} index={i} car={c} />)}
    </group>
  );
}

void CAR_MAX_HP;