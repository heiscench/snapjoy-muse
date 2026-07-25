import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import { input } from "./input";

export function Weapon() {
  const group = useRef<THREE.Group>(null!);
  const muzzle = useRef<THREE.Mesh>(null!);
  const [flash, setFlash] = useState(0);
  const cooldown = useRef(0);

  useFrame((_, dt) => {
    cooldown.current = Math.max(0, cooldown.current - dt);
    if (input.fire && cooldown.current === 0 && input.aim) {
      cooldown.current = 0.09;
      setFlash(1);
      setTimeout(() => setFlash(0), 40);
    }
    if (group.current) {
      // Slight recoil kick
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        flash > 0 ? -0.25 : 0,
        Math.min(1, dt * 20),
      );
    }
    if (muzzle.current) {
      (muzzle.current.material as THREE.MeshBasicMaterial).opacity = flash ? 1 : 0;
      muzzle.current.scale.setScalar(flash ? 1 : 0.001);
    }
  });

  return (
    <group ref={group} rotation={[0, 0, 0]}>
      {/* Grip */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.08, 0.22, 0.1]} />
        <meshStandardMaterial color="#111" roughness={0.6} />
      </mesh>
      {/* Body */}
      <mesh position={[0, 0.12, 0.18]}>
        <boxGeometry args={[0.09, 0.14, 0.4]} />
        <meshStandardMaterial color="#1e1e22" metalness={0.7} roughness={0.35} />
      </mesh>
      {/* Barrel */}
      <mesh position={[0, 0.14, 0.44]}>
        <boxGeometry args={[0.05, 0.06, 0.22]} />
        <meshStandardMaterial color="#2a2a30" metalness={0.9} roughness={0.25} />
      </mesh>
      {/* Muzzle flash */}
      <mesh ref={muzzle} position={[0, 0.14, 0.58]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshBasicMaterial color="#ffd66a" transparent opacity={0} />
      </mesh>
    </group>
  );
}
