import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import { weaponState, type WeaponId } from "./weaponState";
import { shotFeedback } from "./shotFeedback";

type Proportions = {
  bodyColor: string;
  barrelColor: string;
  runeColor: string;
  bodySize: [number, number, number];
  barrelSize: [number, number, number];
  barrelZ: number;
  muzzleZ: number;
};

const VIOLET = "#b398d3";
const GOLD = "#d8ac52";
const CRIMSON = "#d23a5c";

// Carved dark stone bodies, each with its own rune color.
const PROPS: Record<WeaponId, Proportions> = {
  pistol:  { bodyColor: "#25222e", barrelColor: "#16141c", runeColor: VIOLET,  bodySize: [0.09, 0.14, 0.40], barrelSize: [0.05, 0.06, 0.22], barrelZ: 0.44, muzzleZ: 0.58 },
  smg:     { bodyColor: "#2a2630", barrelColor: "#16141c", runeColor: GOLD,    bodySize: [0.10, 0.16, 0.55], barrelSize: [0.05, 0.05, 0.30], barrelZ: 0.55, muzzleZ: 0.72 },
  rifle:   { bodyColor: "#2c2a2a", barrelColor: "#1a1820", runeColor: VIOLET,  bodySize: [0.11, 0.17, 0.75], barrelSize: [0.06, 0.06, 0.42], barrelZ: 0.70, muzzleZ: 0.94 },
  shotgun: { bodyColor: "#2e2226", barrelColor: "#141214", runeColor: CRIMSON, bodySize: [0.12, 0.18, 0.65], barrelSize: [0.09, 0.09, 0.40], barrelZ: 0.62, muzzleZ: 0.86 },
  sniper:  { bodyColor: "#1e1c28", barrelColor: "#0c0b12", runeColor: GOLD,    bodySize: [0.10, 0.16, 0.95], barrelSize: [0.05, 0.05, 0.60], barrelZ: 0.85, muzzleZ: 1.20 },
  grenade: { bodyColor: "#2a2038", barrelColor: "#1a1428", runeColor: VIOLET,  bodySize: [0.14, 0.16, 0.16], barrelSize: [0.05, 0.05, 0.06], barrelZ: 0.10, muzzleZ: 0.18 },
  tank:    { bodyColor: "#2a2428", barrelColor: "#16121a", runeColor: CRIMSON, bodySize: [0.16, 0.18, 0.70], barrelSize: [0.10, 0.10, 0.55], barrelZ: 0.68, muzzleZ: 1.00 },
};

const FLASH_CORE = "#efe0ff";
const FLASH_CONE = "#a56bff";

export function Weapon() {
  const group = useRef<THREE.Group>(null!);
  const orb = useRef<THREE.Group>(null!);
  const muzzleCore = useRef<THREE.Mesh>(null!);
  const muzzleCone = useRef<THREE.Mesh>(null!);
  const flashLight = useRef<THREE.PointLight>(null!);
  const [flash, setFlash] = useState(0);
  const [wid, setWid] = useState<WeaponId>(weaponState.current);
  const lastShot = useRef(shotFeedback.shotAt);
  const kick = useRef(0);

  useFrame(({ clock }, dt) => {
    if (weaponState.current !== wid) setWid(weaponState.current);

    // Flash and kick only when a bullet was actually fired.
    if (shotFeedback.shotAt !== lastShot.current) {
      lastShot.current = shotFeedback.shotAt;
      setFlash(1);
      kick.current = 1;
      setTimeout(() => setFlash(0), 55);
    }

    kick.current = Math.max(0, kick.current - dt * 9);
    if (group.current) {
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        -0.4 * kick.current,
        Math.min(1, dt * 25),
      );
      group.current.position.z = THREE.MathUtils.lerp(group.current.position.z, -0.06 * kick.current, Math.min(1, dt * 25));
    }
    if (orb.current) {
      orb.current.rotation.y += dt * 1.4;
      orb.current.position.y = 0.15 + Math.sin(clock.elapsedTime * 2) * 0.012;
    }
    if (muzzleCore.current && muzzleCone.current && flashLight.current) {
      const on = flash ? 1 : 0;
      (muzzleCore.current.material as THREE.MeshBasicMaterial).opacity = on;
      (muzzleCone.current.material as THREE.MeshBasicMaterial).opacity = on * 0.85;
      muzzleCore.current.scale.setScalar(on ? 1 + Math.random() * 0.3 : 0.001);
      muzzleCone.current.scale.set(on ? 1 : 0.001, on ? 1 : 0.001, on ? 1 + Math.random() * 0.4 : 0.001);
      flashLight.current.intensity = on * 6;
    }
  });

  const p = PROPS[wid];
  const isOrb = wid === "grenade";
  const bodyTopY = 0.12 + p.bodySize[1] / 2 + 0.004;

  return (
    <group ref={group} rotation={[0, 0, 0]}>
      {/* Grip: dark wrapped stone */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.08, 0.22, 0.1]} />
        <meshStandardMaterial color="#0d0c12" roughness={0.9} />
      </mesh>

      {isOrb ? (
        /* Void Seed: a floating orb with a rune ring */
        <group ref={orb} position={[0, 0.15, 0.18]}>
          <mesh>
            <sphereGeometry args={[0.12, 12, 12]} />
            <meshStandardMaterial color={p.bodyColor} emissive={p.runeColor} emissiveIntensity={0.7} roughness={0.5} />
          </mesh>
          <mesh rotation={[Math.PI / 2.4, 0, 0]}>
            <torusGeometry args={[0.18, 0.008, 6, 24]} />
            <meshBasicMaterial color={p.runeColor} toneMapped={false} />
          </mesh>
        </group>
      ) : (
        <>
          {/* Body: carved stone */}
          <mesh position={[0, 0.12, 0.18]}>
            <boxGeometry args={p.bodySize} />
            <meshStandardMaterial color={p.bodyColor} metalness={0.15} roughness={0.9} />
          </mesh>
          {/* Rune line along the top */}
          <mesh position={[0, bodyTopY, 0.18]}>
            <boxGeometry args={[0.02, 0.008, p.bodySize[2] * 0.8]} />
            <meshBasicMaterial color={p.runeColor} toneMapped={false} />
          </mesh>
          {/* Rune lines down both sides */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (p.bodySize[0] / 2 + 0.003), 0.12, 0.18]}>
              <boxGeometry args={[0.006, 0.02, p.bodySize[2] * 0.7]} />
              <meshBasicMaterial color={p.runeColor} toneMapped={false} />
            </mesh>
          ))}
          {/* Barrel */}
          <mesh position={[0, 0.14, p.barrelZ]}>
            <boxGeometry args={p.barrelSize} />
            <meshStandardMaterial color={p.barrelColor} metalness={0.4} roughness={0.7} />
          </mesh>
          {/* Glowing barrel ring */}
          <mesh position={[0, 0.14, p.muzzleZ - 0.03]}>
            <boxGeometry args={[p.barrelSize[0] + 0.02, p.barrelSize[1] + 0.02, 0.02]} />
            <meshBasicMaterial color={p.runeColor} toneMapped={false} />
          </mesh>
        </>
      )}

      {/* Last Witness scope: a glowing eye lens */}
      {wid === "sniper" && (
        <group position={[0, 0.25, 0.35]}>
          <mesh>
            <boxGeometry args={[0.05, 0.06, 0.22]} />
            <meshStandardMaterial color="#07060a" />
          </mesh>
          <mesh position={[0, 0, 0.115]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshBasicMaterial color={VIOLET} toneMapped={false} />
          </mesh>
        </group>
      )}

      {/* Muzzle flash: violet core + forward burst cone + flickering light */}
      <mesh ref={muzzleCore} position={[0, 0.14, p.muzzleZ]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshBasicMaterial color={FLASH_CORE} transparent opacity={0} />
      </mesh>
      <mesh ref={muzzleCone} position={[0, 0.14, p.muzzleZ + 0.16]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.13, 0.4, 6]} />
        <meshBasicMaterial color={FLASH_CONE} transparent opacity={0} />
      </mesh>
      <pointLight ref={flashLight} position={[0, 0.14, p.muzzleZ]} distance={4} intensity={0} color={FLASH_CONE} />
    </group>
  );
}