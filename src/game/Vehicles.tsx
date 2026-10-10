import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GANGS } from "./gangs";
import { BLOCK_SIZE, GRID } from "./worldData";
import { initCarHealth, carDestroyed, carRespawn } from "./vehicleState";
import { CAR_LIVE, initCarLive, carPilot } from "./carState";
import { HuskModel } from "./RelicVisuals";
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
      <HuskModel color={car.color} variant={car.type} />
      {car.personalId && (
        <mesh position={[0, 1.9, 0]}>
          <coneGeometry args={[0.16, 0.32, 4]} />
          <meshBasicMaterial color="#ffd66a" toneMapped={false} />
        </mesh>
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
      const x = alongX ? gx * BLOCK_SIZE + jitter : (gx + 0.5) * BLOCK_SIZE + laneOffset;
      const z = alongX ? (gz + 0.5) * BLOCK_SIZE + laneOffset : gz * BLOCK_SIZE + jitter;
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
