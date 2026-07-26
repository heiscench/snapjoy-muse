import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { GANGS } from "./gangs";
import { GANG_HQ } from "./worldData";

function ParkedHelicopter({ gangId }: { gangId: 0 | 1 | 2 | 3 }) {
  const rotor = useRef<THREE.Group>(null!);
  const gang = GANGS[gangId];
  const pos = GANG_HQ[gangId];

  useFrame((_, dt) => {
    if (rotor.current) rotor.current.rotation.y += dt * 1.2; // slow idle spin
  });

  return (
    <group position={[pos.x, 0, pos.z]}>
      {/* Landing pad */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[7, 24]} />
        <meshStandardMaterial color="#141414" />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5.6, 6, 24]} />
        <meshBasicMaterial color={gang.accent} />
      </mesh>

      {/* Body */}
      <mesh position={[0, 1.4, 0]}>
        <capsuleGeometry args={[0.9, 2.4, 4, 8]} />
        <meshStandardMaterial color={gang.color} metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Cockpit glass */}
      <mesh position={[0, 1.5, 1.5]}>
        <sphereGeometry args={[0.75, 12, 10]} />
        <meshStandardMaterial color="#101820" transparent opacity={0.55} roughness={0.1} />
      </mesh>
      {/* Tail boom */}
      <mesh position={[0, 1.5, -2.6]}>
        <boxGeometry args={[0.35, 0.35, 3]} />
        <meshStandardMaterial color={gang.color} />
      </mesh>
      {/* Tail rotor */}
      <mesh position={[0.05, 1.9, -4]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.05, 1.1, 0.1]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* Skids */}
      {[-0.8, 0.8].map((s) => (
        <mesh key={s} position={[s, 0.35, 0]}>
          <boxGeometry args={[0.12, 0.12, 3]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
      {/* Main rotor (idle spin) */}
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

export function Helicopters() {
  return (
    <>
      <ParkedHelicopter gangId={0} />
      <ParkedHelicopter gangId={1} />
      <ParkedHelicopter gangId={2} />
      <ParkedHelicopter gangId={3} />
    </>
  );
}