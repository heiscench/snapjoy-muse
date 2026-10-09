import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { GANGS } from "../gangs";
import { territoryState } from "../territoryState";
import { hash01, INK } from "./palette";
import { basicMaterial, solidMaterial, stoneTexture } from "./textures";
import {
  Band, Banner, Block, BOX, Clock1111, Crown, Door, Glow, P, Parapets, Pilasters, PLANE,
  Rubble, Shards, TexBox, useStyle, Windows,
} from "./parts";

/** The Sanctum. */
export function Hospital({ b }: P) {
  const { theme, mat } = useStyle(b);
  return (
    <group position={[b.x, 0, b.z]}>
      <TexBox pos={[0, b.h / 2, 0]} size={[b.w, b.h, b.d]} mat={mat} />
      <Block pos={[0, 0.5, 0]} size={[b.w + 0.1, 1, b.d + 0.1]} color={theme.dark} />
      <Band b={b} y={b.h * 0.8} color={theme.trim} />
      {[b.d / 2 + 0.06, -b.d / 2 - 0.06].map((z, i) => (
        <group key={i} position={[0, b.h * 0.55, z]} rotation={[0, i ? Math.PI : 0, 0]}>
          <mesh material={basicMaterial(theme.glow)}>
            <ringGeometry args={[0.9, 1.1, 24]} />
          </mesh>
          <mesh material={basicMaterial(theme.trim)}>
            <circleGeometry args={[0.3, 12]} />
          </mesh>
        </group>
      ))}
      <Door b={b} color={theme.glow} width={2.6} height={2.8} />
      <Parapets b={b} color={theme.dark} />
      <Text position={[0, b.h + 1.6, 0]} fontSize={Math.min(1.6, b.w * 0.09)} color="#ffffff"
        outlineWidth={0.12} outlineColor="#2a2530" anchorX="center" anchorY="middle">
        THE SANCTUM
      </Text>
    </group>
  );
}

export function House({ b }: P) {
  const { theme, mat, seed } = useStyle(b);
  const floors = Math.max(1, Math.min(2, Math.floor(b.h / 4)));
  const doorW = b.w * 0.2;
  const doorH = Math.min(b.h * 0.42, 2.4);
  const chimney = hash01(b.x, b.z, 8) > 0.4;
  return (
    <group position={[b.x, 0, b.z]}>
      <TexBox pos={[0, b.h / 2, 0]} size={[b.w, b.h, b.d]} mat={mat} />
      <Block pos={[0, 0.35, 0]} size={[b.w + 0.1, 0.7, b.d + 0.1]} color={theme.dark} />
      <Pilasters b={b} color={theme.trim} />
      <Door b={b} color={theme.glow} width={doorW} height={doorH} />
      <Windows w={b.w} h={b.h} d={b.d} cols={2} rows={floors} lit={theme.glow} seed={seed}
        marginY={Math.min(1.6, b.h * 0.25)} litChance={0.7} />
      {/* thin roof rim: players can stand on the roof at b.h */}
      <Block pos={[0, b.h - 0.08, 0]} size={[b.w + 0.2, 0.16, b.d + 0.2]} color={theme.dark} />
      {chimney && <Block pos={[b.w * 0.3, b.h + 0.8, -b.d * 0.3]} size={[0.7, 1.6, 0.7]} color={theme.stone} rot={[0, 0, 0.06]} />}
      <Rubble b={b} />
    </group>
  );
}

/** Memory Garden. */
export function Plaza({ b }: P) {
  const { theme } = useStyle(b);
  const radius = Math.max(0.5, Math.min(b.w, b.d) / 2 - 0.35);
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} material={solidMaterial(theme.ground)}>
        <circleGeometry args={[radius, 28]} />
      </mesh>
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} material={basicMaterial(theme.glow, 0.6)}>
        <ringGeometry args={[radius * 0.28, radius * 0.32, 28]} />
      </mesh>
      <Block pos={[0, 1.2, 0]} size={[0.5, 2.4, 0.5]} color={theme.stone} />
      <mesh position={[0, 3.3, 0]} material={basicMaterial(theme.glow, 0.95)}>
        <icosahedronGeometry args={[0.6, 0]} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        const hh = 1.2 + hash01(i, b.x, 14) * 1.4;
        return (
          <Block key={i} pos={[Math.cos(a) * radius * 0.8, hh / 2, Math.sin(a) * radius * 0.8]}
            size={[0.5, hh, 0.4]} color={i % 2 ? theme.stone : theme.trim} rot={[0, a, (i % 2 ? 1 : -1) * 0.08]} />
        );
      })}
    </group>
  );
}

/** Relic bay: arched stone shell with a glowing mouth. */
export function Hangar({ b }: P) {
  const { theme, seed } = useStyle(b);
  const radius = Math.max(0.5, Math.min(b.h * 0.7, b.w / 2 - 0.25));
  const map = stoneTexture(Math.floor(hash01(b.x, b.z, 91) * 4)) ?? undefined;
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius, b.d * 0.92, 14, 1, true, 0, Math.PI]} />
        <meshStandardMaterial map={map} color={theme.stone} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[0, 0, -b.d * 0.42 + b.d * 0.21 * i]} rotation={[Math.PI / 2, 0, 0]}
          material={solidMaterial(theme.trim)}>
          <cylinderGeometry args={[radius + 0.1, radius + 0.1, 0.25, 14, 1, true, 0, Math.PI]} />
        </mesh>
      ))}
      <mesh geometry={PLANE} material={basicMaterial(theme.glow, 0.3)}
        position={[0, radius * 0.4, b.d / 2 + 0.05]} scale={[radius * 1.2, radius * 0.7, 1]} />
      <mesh position={[0, radius + 1.2, 0]} rotation={[0, seed, 0]} material={basicMaterial(theme.glow, 0.9)}>
        <octahedronGeometry args={[0.5, 0]} />
      </mesh>
    </group>
  );
}

/** Cathedral of Echoes: banded body, corner spires, floating orb. */
export function Casino({ b }: P) {
  const { theme, mat } = useStyle(b);
  return (
    <group position={[b.x, 0, b.z]}>
      <TexBox pos={[0, b.h / 2, 0]} size={[b.w, b.h, b.d]} mat={mat} />
      <Block pos={[0, 0.7, 0]} size={[b.w + 0.1, 1.4, b.d + 0.1]} color={theme.dark} />
      <Pilasters b={b} color={theme.trim} />
      {[0.2, 0.4, 0.6, 0.8].map((t, i) => (
        <Band key={t} b={b} y={b.h * t} color={i % 2 ? theme.glow : theme.trim} />
      ))}
      <Door b={b} color={theme.glow} width={b.w * 0.2} height={b.h * 0.3} />
      <Clock1111 position={[0, b.h * 0.62, b.d / 2 + 0.1]} scale={Math.max(1.4, Math.min(3, b.w / 5))} color={theme.glow} />
      <Parapets b={b} color={theme.dark} />
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, z], i) => (
        <Block key={i} pos={[x * (b.w / 2 - 0.5), b.h + 1.4, z * (b.d / 2 - 0.5)]} size={[0.7, 2.8, 0.7]} color={theme.stone} />
      ))}
      <mesh position={[0, b.h + 5, 0]} material={basicMaterial(theme.glow, 0.95)}>
        <octahedronGeometry args={[1, 0]} />
      </mesh>
      <Banner b={b} color={theme.cloth} glow={theme.glow} side={-1} />
      <Banner b={b} color={theme.cloth} glow={theme.glow} side={1} />
    </group>
  );
}

/** Shrine of the Warriors. */
export function Pagoda({ b }: P) {
  const { theme, mat } = useStyle(b);
  return (
    <group position={[b.x, 0, b.z]}>
      <TexBox pos={[0, b.h / 2, 0]} size={[b.w, b.h, b.d]} mat={mat} />
      <Block pos={[0, 0.6, 0]} size={[b.w + 0.1, 1.2, b.d + 0.1]} color={theme.dark} />
      <Pilasters b={b} color={theme.cloth} />
      {[0.33, 0.66, 1].map((t) => (
        <Block key={t} pos={[0, b.h * t - 0.1, 0]} size={[b.w + 0.5, 0.35, b.d + 0.5]} color={theme.cloth} />
      ))}
      <Door b={b} color={theme.glow} width={b.w * 0.2} height={b.h * 0.3} />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * b.w * 0.3, b.h * 0.45, b.d / 2 + 0.1]} material={basicMaterial(theme.glow, 0.95)}>
          <sphereGeometry args={[0.28, 8, 8]} />
        </mesh>
      ))}
      <Parapets b={b} color={theme.dark} />
      <Banner b={b} color={theme.cloth} glow={theme.glow} />
      <Shards b={b} color={theme.glow} />
    </group>
  );
}

export function Shanty({ b }: P) {
  const { theme, mat } = useStyle(b);
  const patch = hash01(b.x, b.z, 12) > 0.5;
  return (
    <group position={[b.x, 0, b.z]}>
      <TexBox pos={[0, b.h / 2, 0]} size={[b.w, b.h, b.d]} mat={mat} />
      {patch && <Block pos={[b.w * 0.2, b.h * 0.55, b.d / 2 + 0.05]} size={[b.w * 0.3, b.h * 0.25, 0.08]} color={theme.cloth} />}
      <Door b={b} color={theme.glow} width={b.w * 0.2} height={Math.min(b.h * 0.6, 2.4)} x={-b.w * 0.28} />
      <Block pos={[0, b.h - 0.08, 0]} size={[b.w + 0.2, 0.16, b.d + 0.2]} color={theme.dark} />
      <Rubble b={b} />
    </group>
  );
}

export function Brownstone({ b }: P) {
  const { theme, mat, seed } = useStyle(b);
  const floors = Math.max(2, Math.min(6, Math.floor(b.h / 4)));
  const side = hash01(b.x, b.z, 13) > 0.5 ? 1 : -1;
  return (
    <group position={[b.x, 0, b.z]}>
      <TexBox pos={[0, b.h / 2, 0]} size={[b.w, b.h, b.d]} mat={mat} />
      <Block pos={[0, 1.1, 0]} size={[b.w + 0.1, 2.2, b.d + 0.1]} color={theme.dark} />
      {Array.from({ length: floors - 1 }).map((_, i) => (
        <Band key={i} b={b} y={(i + 1) * (b.h / floors)} color={theme.trim} />
      ))}
      <Windows w={b.w} h={b.h} d={b.d} cols={Math.max(2, Math.floor(b.w / 3.2))} rows={floors}
        lit={theme.glow} seed={seed} marginY={2.6} litChance={0.78} />
      <Door b={b} color={theme.glow} width={b.w * 0.2} height={2.6} x={side * b.w * 0.15} />
      <Parapets b={b} color={theme.dark} />
      <Crown b={b} color={theme.stone} />
    </group>
  );
}

/** The Hall: a faction hall whose banners and crystal take the owner's colour. */
export function Headquarters({ b }: P) {
  const { theme, mat } = useStyle(b);
  const clothMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: theme.cloth, roughness: 1, side: THREE.DoubleSide }),
    [theme],
  );
  const crystalMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: theme.glow, toneMapped: false }),
    [theme],
  );

  useFrame(() => {
    const owner = territoryState.owners[b.district];
    const g = owner !== null && owner !== undefined ? GANGS[owner] : null;
    clothMat.color.set(g ? g.color : theme.cloth);
    crystalMat.color.set(g ? g.accent : theme.glow);
  });

  return (
    <group position={[b.x, 0, b.z]}>
      <TexBox pos={[0, b.h / 2, 0]} size={[b.w, b.h, b.d]} mat={mat} />
      <Block pos={[0, 0.5, 0]} size={[b.w + 0.1, 1, b.d + 0.1]} color={theme.dark} />
      <Pilasters b={b} color={theme.trim} />
      <Band b={b} y={b.h * 0.5} color={theme.trim} />
      <Door b={b} color={theme.glow} width={b.w * 0.22} height={b.h * 0.45} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={PLANE} material={clothMat}
          position={[s * b.w * 0.3, b.h * 0.55, b.d / 2 + 0.1]} scale={[b.w * 0.14, b.h * 0.6, 1]} />
      ))}
      <Clock1111 position={[0, b.h * 0.82, b.d / 2 + 0.1]} scale={1.6} color={theme.glow} />
      <Parapets b={b} color={theme.dark} />
      <mesh position={[0, b.h + 3, 0]} rotation={[0, Math.PI / 4, 0]} material={solidMaterial(theme.stone)}>
        <cylinderGeometry args={[0.3, 0.7, 6, 4]} />
      </mesh>
      <mesh position={[0, b.h + 7, 0]} material={crystalMat}>
        <octahedronGeometry args={[0.9, 0]} />
      </mesh>
      <Text position={[0, b.h + 10, 0]} fontSize={2} color="#ffffff" outlineWidth={0.14}
        outlineColor="#2a2530" anchorX="center" anchorY="middle">
        THE HALL
      </Text>
    </group>
  );
}