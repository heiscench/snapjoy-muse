import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import { input } from "./input";
import { currentWeapon, weaponState, type WeaponId } from "./weaponState";

type Proportions = {
  bodyColor: string;
  barrelColor: string;
  bodySize: [number, number, number];
  barrelSize: [number, number, number];
  barrelZ: number;
  muzzleZ: number;
};

const PROPS: Record<WeaponId, Proportions> = {
  pistol:  { bodyColor: "#1e1e22", barrelColor: "#2a2a30", bodySize: [0.09, 0.14, 0.40], barrelSize: [0.05, 0.06, 0.22], barrelZ: 0.44, muzzleZ: 0.58 },
  smg:     { bodyColor: "#20242a", barrelColor: "#2a2f35", bodySize: [0.10, 0.16, 0.55], barrelSize: [0.05, 0.05, 0.30], barrelZ: 0.55, muzzleZ: 0.72 },
  rifle:   { bodyColor: "#2a2418", barrelColor: "#3a3020", bodySize: [0.11, 0.17, 0.75], barrelSize: [0.06, 0.06, 0.42], barrelZ: 0.70, muzzleZ: 0.94 },
  shotgun: { bodyColor: "#3a1e14", barrelColor: "#141414", bodySize: [0.12, 0.18, 0.65], barrelSize: [0.09, 0.09, 0.40], barrelZ: 0.62, muzzleZ: 0.86 },
  sniper:  { bodyColor: "#181820", barrelColor: "#0a0a10", bodySize: [0.10, 0.16, 0.95], barrelSize: [0.05, 0.05, 0.60], barrelZ: 0.85, muzzleZ: 1.20 },
};

export function Weapon() {
  const group = useRef<THREE.Group>(null!);
  const muzzle = useRef<THREE.Mesh>(null!);
  const [flash, setFlash] = useState(0);
  const [wid, setWid] = useState<WeaponId>(weaponState.current);
  const cooldown = useRef(0);

  useFrame((_, dt) => {
    // React to weapon swap without hammering setState every frame.
    if (weaponState.current !== wid) setWid(weaponState.current);

    cooldown.current = Math.max(0, cooldown.current - dt);
    const w = currentWeapon();
    if (input.fire && cooldown.current === 0 && input.aim) {
      cooldown.current = w.fireRate;
      setFlash(1);
      setTimeout(() => setFlash(0), 40);
    }
    if (group.current) {
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

  const p = PROPS[wid];
  return (
    <group ref={group} rotation={[0, 0, 0]}>
      {/* Grip */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.08, 0.22, 0.1]} />
        <meshStandardMaterial color="#111" roughness={0.6} />
      </mesh>
      {/* Body */}
      <mesh position={[0, 0.12, 0.18]}>
        <boxGeometry args={p.bodySize} />
        <meshStandardMaterial color={p.bodyColor} metalness={0.7} roughness={0.35} />
      </mesh>
      {/* Barrel */}
      <mesh position={[0, 0.14, p.barrelZ]}>
        <boxGeometry args={p.barrelSize} />
        <meshStandardMaterial color={p.barrelColor} metalness={0.9} roughness={0.25} />
      </mesh>
      {/* Sniper scope */}
      {wid === "sniper" && (
        <mesh position={[0, 0.24, 0.35]}>
          <boxGeometry args={[0.05, 0.06, 0.22]} />
          <meshStandardMaterial color="#050505" />
        </mesh>
      )}
      {/* Muzzle flash */}
      <mesh ref={muzzle} position={[0, 0.14, p.muzzleZ]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshBasicMaterial color="#ffd66a" transparent opacity={0} />
      </mesh>
    </group>
  );
}
