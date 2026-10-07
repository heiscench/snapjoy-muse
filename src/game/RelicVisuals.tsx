import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

export const RELIC_PALETTE = {
  stone: "#303735", stoneLight: "#4b514b", ink: "#161a1c",
  ash: "#757c70", rune: "#cfb878", violet: "#b398d3", pale: "#d6dfc4",
};
const RUNE_RING_SPEED = 0.22;
const HOVER_RATE = 0.8;
const HOVER_HEIGHT = 0.07;

export function RuneGlyph({ color = RELIC_PALETTE.rune }: { color?: string }) {
  return <group>
    {[-0.6, -0.3, 0.3, 0.6].map((x) => <mesh key={x} position={[x, 0, 0]}><boxGeometry args={[0.06, 0.7, 0.025]} /><meshBasicMaterial color={color} transparent opacity={0.6} toneMapped={false} /></mesh>)}
    {[-0.1, 0.1].map((y) => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[0.04, 0.04, 0.025]} /><meshBasicMaterial color={color} transparent opacity={0.6} /></mesh>)}
  </group>;
}

export function RelicSkiff({ color }: { color: string }) {
  const rings = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (rings.current) rings.current.rotation.y += dt * RUNE_RING_SPEED; });
  return <group>
    <mesh position={[0, 1.3, -0.2]} scale={[1, 0.7, 2.5]} rotation={[0, Math.PI / 4, 0]}><octahedronGeometry args={[1.4, 0]} /><meshStandardMaterial color={RELIC_PALETTE.ink} roughness={0.96} /></mesh>
    {[-1, 1].map((x) => <group key={x} position={[x * 0.7, 1.65, -0.3]}>
      <mesh rotation={[0.12, 0, x * -0.2]}><coneGeometry args={[0.35, 2.8, 4]} /><meshStandardMaterial color={RELIC_PALETTE.stone} roughness={1} /></mesh>
      <mesh position={[0, 0.05, 0.25]}><boxGeometry args={[0.035, 1.5, 0.03]} /><meshBasicMaterial color={RELIC_PALETTE.violet} toneMapped={false} /></mesh>
    </group>)}
    <mesh position={[0, 1.25, 1.1]} rotation={[0.25, Math.PI / 4, 0]}><octahedronGeometry args={[0.55, 0]} /><meshStandardMaterial color={color} emissive={RELIC_PALETTE.violet} emissiveIntensity={0.35} roughness={0.7} /></mesh>
    <group ref={rings} position={[0, 0.65, -0.2]}>
      {[1.3, 1.8].map((r, i) => <group key={r} rotation={[i * 0.22, 0, i * 0.15]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[r, 0.025, 4, 32]} /><meshBasicMaterial color={RELIC_PALETTE.violet} transparent opacity={0.4} toneMapped={false} /></mesh>
        {Array.from({ length: 8 }, (_, j) => { const a = j * Math.PI / 4; return <mesh key={j} position={[Math.cos(a) * r, 0, Math.sin(a) * r]} rotation={[0, -a, 0]}><boxGeometry args={[0.06, 0.16, 0.025]} /><meshBasicMaterial color={RELIC_PALETTE.violet} transparent opacity={0.55} /></mesh>; })}
      </group>)}
    </group>
    <group position={[0, 1.45, 1.6]} scale={0.45}><RuneGlyph color={color} /></group>
  </group>;
}

export function HuskModel({ color, variant = "sedan" }: { color: string; variant?: "sedan" | "suv" | "sport" }) {
  const body = useRef<THREE.Group>(null);
  const width = variant === "suv" ? 1.85 : 1.6;
  const length = variant === "sport" ? 4 : 3.6;
  useFrame(({ clock }) => { if (body.current) body.current.position.y = Math.sin(clock.elapsedTime * HOVER_RATE) * HOVER_HEIGHT; });
  return <group ref={body}>
    <mesh position={[0, 0.55, 0]}><boxGeometry args={[width, 0.42, length]} /><meshStandardMaterial color={RELIC_PALETTE.ink} roughness={1} /></mesh>
    <mesh position={[0, 0.8, -0.3]} scale={[width * 0.65, variant === "suv" ? 0.6 : 0.3, length * 0.38]} rotation={[0, Math.PI / 4, 0]}><octahedronGeometry args={[1, 0]} /><meshStandardMaterial color={RELIC_PALETTE.stone} roughness={0.95} /></mesh>
    {[-1, 1].map((s) => <group key={s}>
      <mesh position={[s * width / 2, 0.4, 0]}><boxGeometry args={[0.035, 0.045, length * 0.82]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
      {[-1, 0, 1].map((z) => <mesh key={z} position={[s * width / 2, 0.6, z]} rotation={[s * 0.35, 0, 0]}><boxGeometry args={[0.035, 0.22, 0.04]} /><meshBasicMaterial color={color} /></mesh>)}
      <mesh position={[s * width * 0.32, 0.2, 0]}><boxGeometry args={[0.24, 0.08, length * 0.72]} /><meshBasicMaterial color={color} transparent opacity={0.16} /></mesh>
    </group>)}
    <group position={[0, 0.58, length / 2 + 0.015]} scale={0.6}><RuneGlyph color={color} /></group>
  </group>;
}

/** Decorative only; all fragments remain within the existing building footprint. */
export function RuinDetails({ x, z, w, d, h, banner = false }: { x: number; z: number; w: number; d: number; h: number; banner?: boolean }) {
  const shard = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (shard.current) { shard.current.position.y = h + 2 + Math.sin(clock.elapsedTime * 0.5 + x) * 0.3; shard.current.rotation.y = clock.elapsedTime * 0.08; } });
  return <group position={[x, 0, z]}>
    <mesh ref={shard} position={[w * 0.2, h + 2, 0]} scale={[0.4, 1.8, 0.4]}><octahedronGeometry args={[1, 0]} /><meshStandardMaterial color={RELIC_PALETTE.stone} emissive={RELIC_PALETTE.violet} emissiveIntensity={0.12} roughness={1} /></mesh>
    {[-1, 1].map((s) => <mesh key={s} position={[s * w * 0.38, h + 0.8, d * 0.2]} rotation={[0, 0, s * 0.16]}><cylinderGeometry args={[0.45, 0.65, 1.8 + s * 0.5, 5]} /><meshStandardMaterial color={RELIC_PALETTE.stoneLight} roughness={1} /></mesh>)}
    <group position={[0, Math.min(h * 0.7, 7), d / 2 + 0.15]} scale={Math.min(1.5, w / 9)}><RuneGlyph /></group>
    {banner && <group position={[w * 0.25, h * 0.6, d / 2 + 0.12]}>
      <mesh rotation={[0, 0, 0.08]}><planeGeometry args={[1.3, 3]} /><meshStandardMaterial color={RELIC_PALETTE.ash} roughness={1} side={THREE.DoubleSide} /></mesh>
      <group position={[0, 0, 0.025]} scale={0.55}><RuneGlyph color={RELIC_PALETTE.ink} /></group>
    </group>}
  </group>;
}