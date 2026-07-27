import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { GANGS } from "./gangs";
import { HELICOPTERS } from "./vehicleState";
import { GANG_HQ } from "./worldData";

function ParkedHelicopter({ gangId }: { gangId: 0 | 1 | 2 | 3 }) {
  const group = useRef<THREE.Group>(null!);
  const rotor = useRef<THREE.Group>(null!);
  const gang = GANGS[gangId];
  const lastPos = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const h = HELICOPTERS[gangId];
    if (!group.current || !rotor.current) return;

    // Destroyed → hide + respawn at HQ after a delay.
    if (h.destroyed) {
      group.current.visible = false;
      h.respawn -= dt;
      if (h.respawn <= 0) {
        const hq = GANG_HQ[gangId];
        h.pos.set(hq.x, 0, hq.z);
        h.yaw = 0; h.vy = 0;
        h.hp = 300;
        h.destroyed = false;
      }
      return;
    }
    group.current.visible = true;

    const flying = h.pos.y > 0.5 || Math.abs(h.vy) > 0.5;
    rotor.current.rotation.y += dt * (flying ? 22 : 1.2);

    const vx = h.pos.x - lastPos.current.x;
    const vz = h.pos.z - lastPos.current.z;
    lastPos.current.set(h.pos.x, h.pos.y, h.pos.z);

    group.current.position.set(h.pos.x, h.pos.y, h.pos.z);
    group.current.rotation.y = h.yaw;
    const localX = Math.cos(-h.yaw) * vx - Math.sin(-h.yaw) * vz;
    group.current.rotation.z = THREE.MathUtils.lerp(
      group.current.rotation.z,
      THREE.MathUtils.clamp(-localX * 6, -0.35, 0.35),
      Math.min(1, dt * 4),
    );
  });

  return (
    <group ref={group} position={[GANG_HQ[gangId].x, 0, GANG_HQ[gangId].z]}>
      <mesh position={[0, 1.4, 0]}>
        <capsuleGeometry args={[0.9, 2.4, 4, 8]} />
        <meshStandardMaterial color={gang.color} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.5, 1.5]}>
        <sphereGeometry args={[0.75, 12, 10]} />
        <meshStandardMaterial color="#101820" transparent opacity={0.55} roughness={0.1} />
      </mesh>
      <mesh position={[0, 1.5, -2.6]}>
        <boxGeometry args={[0.35, 0.35, 3]} />
        <meshStandardMaterial color={gang.color} />
      </mesh>
      <mesh position={[0.05, 1.9, -4]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.05, 1.1, 0.1]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {[-0.8, 0.8].map((s) => (
        <mesh key={s} position={[s, 0.35, 0]}>
          <boxGeometry args={[0.12, 0.12, 3]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
      <group ref={rotor} position={[0, 2.75, 0]}>
        <mesh>
          <boxGeometry args={[7.5, 0.06, 0.28]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[7.5, 0.06, 0.28]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
      </group>
    </group>
  );
}

function LandingPad({ gangId }: { gangId: 0 | 1 | 2 | 3 }) {
  const gang = GANGS[gangId];
  const pos = GANG_HQ[gangId];
  return (
    <group position={[pos.x, 0, pos.z]}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[7, 24]} />
        <meshStandardMaterial color="#141414" />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5.6, 6, 24]} />
        <meshBasicMaterial color={gang.accent} />
      </mesh>
    </group>
  );
}

export function Helicopters() {
  const ids = [0, 1, 2, 3] as const;
  return (
    <>
      {ids.map((g) => <LandingPad key={`pad-${g}`} gangId={g} />)}
      {ids.map((g) => <ParkedHelicopter key={`heli-${g}`} gangId={g} />)}
    </>
  );
}