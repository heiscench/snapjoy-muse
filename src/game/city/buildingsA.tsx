import * as THREE from "three";
import { hash01, INK } from "./palette";
import { stoneTexture } from "./textures";
import {
  Band, Banner, Block, BOX, Clock1111, Crown, Door, Glow, P, Parapets, Pilasters, PLANE,
  Rubble, Shards, TexBox, useStyle, Windows,
} from "./parts";
import { basicMaterial, solidMaterial } from "./textures";

export function Tower({ b }: P) {
  const { theme, mat, seed } = useStyle(b);
  const rows = Math.max(2, Math.min(14, Math.floor(b.h / 4)));
  const cols = Math.max(2, Math.min(6, Math.floor(b.w / 3)));
  const banner = hash01(b.x, b.z, 4) > 0.5;
  const mark = hash01(b.x, b.z, 3) > 0.74;
  return (
    <group position={[b.x, 0, b.z]}>
      <TexBox pos={[0, b.h / 2, 0]} size={[b.w, b.h, b.d]} mat={mat} />
      <Block pos={[0, 0.6, 0]} size={[b.w + 0.1, 1.2, b.d + 0.1]} color={theme.dark} />
      <Pilasters b={b} color={theme.stone} />
      <Band b={b} y={b.h * 0.33} color={theme.trim} />
      <Band b={b} y={b.h * 0.66} color={theme.trim} />
      <Door b={b} color={theme.glow} width={Math.min(2.4, b.w * 0.2)} height={2.6} />
      <Windows w={b.w} h={b.h} d={b.d} cols={cols} rows={rows} lit={theme.glow} seed={seed} marginY={3.5} litChance={0.8} />
      <Parapets b={b} color={theme.dark} />
      <Crown b={b} color={theme.stone} />
      <Rubble b={b} />
      {banner && <Banner b={b} color={theme.cloth} glow={theme.glow} />}
      {mark && <Clock1111 position={[0, Math.min(b.h * 0.5, 14), b.d / 2 + 0.1]} scale={Math.min(2.4, b.w / 4)} color={theme.glow} />}
      {b.h > 30 && <Shards b={b} color={theme.glow} />}
    </group>
  );
}

export function Warehouse({ b }: P) {
  const { theme, mat, seed } = useStyle(b);
  const ribs = Math.max(3, Math.min(7, Math.floor(b.w / 3)));
  return (
    <group position={[b.x, 0, b.z]}>
      <TexBox pos={[0, b.h / 2, 0]} size={[b.w, b.h, b.d]} mat={mat} />
      <Block pos={[0, 0.5, 0]} size={[b.w + 0.1, 1, b.d + 0.1]} color={theme.dark} />
      {Array.from({ length: ribs }).map((_, i) => (
        <Block key={i} pos={[(i + 0.5) * (b.w / ribs) - b.w / 2, b.h / 2, b.d / 2 + 0.04]}
          size={[0.28, b.h * 0.94, 0.16]} color={theme.stone} />
      ))}
      <Door b={b} color={theme.trim} width={b.w * 0.3} height={Math.min(b.h * 0.6, 4)} x={-b.w * 0.18} />
      <Band b={b} y={b.h * 0.9} color={theme.trim} />
      <Windows w={b.w} h={b.h} d={b.d} cols={3} rows={1} lit={theme.glow} seed={seed} marginY={b.h * 0.62} litChance={0.7} />
      <Parapets b={b} color={theme.dark} />
      <Rubble b={b} />
    </group>
  );
}

export function Silo({ b }: P) {
  const { theme, seed } = useStyle(b);
  const r = b.w / 2;
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]}>
        <cylinderGeometry args={[Math.max(0.3, r - 0.3), r, b.h, 10]} />
        <meshStandardMaterial map={stoneTexture(Math.floor(hash01(b.x, b.z, 91) * 4)) ?? undefined}
          color={theme.stone} roughness={0.95} />
      </mesh>
      {[0.3, 0.55, 0.8].map((t) => (
        <mesh key={t} position={[0, b.h * t, 0]} rotation={[Math.PI / 2, 0, 0]}
          material={solidMaterial(theme.trim)}>
          <torusGeometry args={[Math.max(0.3, r - 0.15 + (1 - t) * 0.2), 0.12, 6, 20]} />
        </mesh>
      ))}
      <mesh position={[0, b.h + 1.1, 0]} rotation={[0, seed, 0]} material={basicMaterial(theme.glow, 0.9)}>
        <octahedronGeometry args={[0.6, 0]} />
      </mesh>
    </group>
  );
}

/** The Cache: gold vault-temple with the big 11:11. */
export function Bank({ b }: P) {
  const { theme, mat } = useStyle(b);
  return (
    <group position={[b.x, 0, b.z]}>
      <TexBox pos={[0, b.h / 2, 0]} size={[b.w, b.h, b.d]} mat={mat} />
      <Block pos={[0, 0.6, 0]} size={[b.w + 0.1, 1.2, b.d + 0.1]} color={theme.dark} />
      <Pilasters b={b} color={theme.trim} />
      {[0.25, 0.5, 0.75].map((t) => <Band key={t} b={b} y={b.h * t} color={theme.trim} />)}
      {[-1, 0, 1].map((s) => (
        <Block key={s} pos={[s * b.w * 0.28, b.h * 0.3, b.d / 2 + 0.12]} size={[0.8, b.h * 0.55, 0.3]} color={theme.stone} />
      ))}
      <Door b={b} color={theme.glow} width={b.w * 0.2} height={b.h * 0.38} />
      <Clock1111 position={[0, b.h * 0.72, b.d / 2 + 0.1]} scale={Math.max(1.6, Math.min(3.4, b.w / 4.5))} color={theme.glow} />
      <Parapets b={b} color={theme.trim} />
      <Rubble b={b} />
      <Banner b={b} color={theme.cloth} glow={theme.glow} side={-1} />
      <Banner b={b} color={theme.cloth} glow={theme.glow} side={1} />
      <Shards b={b} color={theme.glow} />
    </group>
  );
}

export function LowRise({ b }: P) {
  const { theme, mat, seed } = useStyle(b);
  const rows = Math.max(1, Math.min(4, Math.floor(b.h / 4) - 1));
  return (
    <group position={[b.x, 0, b.z]}>
      <TexBox pos={[0, b.h / 2, 0]} size={[b.w, b.h, b.d]} mat={mat} />
      <Block pos={[0, 0.5, 0]} size={[b.w + 0.1, 1, b.d + 0.1]} color={theme.dark} />
      <Block pos={[0, 1.5, b.d / 2 + 0.04]} size={[b.w * 0.7, 2.2, 0.08]} color={INK} />
      <Glow pos={[0, 2.8, b.d / 2 + 0.09]} size={[b.w * 0.7 + 0.4, 0.14, 0.1]} color={theme.glow} />
      <mesh geometry={BOX} material={solidMaterial(theme.cloth)}
        position={[0, 3.3, b.d / 2 + 0.1]} scale={[b.w * 0.8, 0.06, 0.6]} rotation={[-0.4, 0, 0]} />
      <Band b={b} y={b.h * 0.85} color={theme.trim} />
      <Windows w={b.w} h={b.h} d={b.d} cols={Math.max(2, Math.floor(b.w / 3))} rows={rows}
        lit={theme.glow} seed={seed} marginY={Math.min(4.2, b.h * 0.45)} litChance={0.78} />
      <Parapets b={b} color={theme.dark} />
      <Crown b={b} color={theme.stone} />
    </group>
  );
}

/** The Archive: wide hall with a glowing memory-glass front. */
export function Mall({ b }: P) {
  const { theme, mat } = useStyle(b);
  return (
    <group position={[b.x, 0, b.z]}>
      <TexBox pos={[0, b.h / 2, 0]} size={[b.w, b.h, b.d]} mat={mat} />
      <Block pos={[0, 0.5, 0]} size={[b.w + 0.1, 1, b.d + 0.1]} color={theme.dark} />
      <mesh geometry={PLANE} material={basicMaterial(theme.glow, 0.3)}
        position={[0, b.h * 0.45, b.d / 2 + 0.05]} scale={[b.w * 0.72, b.h * 0.5, 1]} />
      {[-3, -1, 1, 3].map((i) => (
        <Block key={i} pos={[(i * b.w) / 9, b.h * 0.45, b.d / 2 + 0.1]} size={[0.5, b.h * 0.62, 0.3]} color={theme.stone} />
      ))}
      <Band b={b} y={b.h * 0.92} color={theme.trim} />
      <Parapets b={b} color={theme.dark} />
      <Rubble b={b} />
      <Banner b={b} color={theme.cloth} glow={theme.glow} side={-1} />
      <Banner b={b} color={theme.cloth} glow={theme.glow} side={1} />
    </group>
  );
}

export function Harbor({ b }: P) {
  const { theme, mat } = useStyle(b);
  return (
    <group position={[b.x, 0, b.z]}>
      <TexBox pos={[0, b.h / 2, 0]} size={[b.w, b.h, b.d]} mat={mat} />
      <Band b={b} y={b.h * 0.8} color={theme.trim} />
      <Glow pos={[0, b.h * 0.6, b.d / 2 + 0.05]} size={[b.w * 0.6, 0.12, 0.06]} color={theme.glow} opacity={0.8} />
      <Parapets b={b} color={theme.dark} />
    </group>
  );
}

/** A broken arch where the crane stood. */
export function Crane({ b }: P) {
  const { theme } = useStyle(b);
  return (
    <group position={[b.x, 0, b.z]}>
      <Block pos={[0, b.h / 2, 0]} size={[b.w, b.h, b.d]} color={theme.stone} />
      <Block pos={[0, b.h * 0.9, 0]} size={[b.w * 0.9, 0.35, b.d * 0.9]} color={theme.trim} rot={[0, 0, -0.06]} />
      <Glow pos={[b.w * 0.2, b.h * 0.65, 0]} size={[0.08, b.h * 0.4, 0.08]} color={theme.glow} opacity={0.8} />
    </group>
  );
}

/** Ring of Echoes: broken ring of stone with banners. */
export function Stadium({ b }: P) {
  const { theme } = useStyle(b);
  const segs = 16;
  const radius = Math.max(1, Math.min(b.w, b.d) / 2 - 0.4);
  const segW = Math.min(2.4, (2 * Math.PI * radius) / segs);
  return (
    <group position={[b.x, 0, b.z]}>
      {Array.from({ length: segs }).map((_, i) => {
        if (i % 5 === 3) return null;
        const a = (i / segs) * Math.PI * 2;
        const hh = b.h * (0.6 + hash01(i, b.x, 9) * 0.35);
        return (
          <group key={i}>
            <Block pos={[Math.cos(a) * radius, hh / 2, Math.sin(a) * radius]} size={[segW, hh, 1.2]}
              color={theme.stone} rot={[0, -a, 0]} />
            {i % 4 === 0 && (
              <Block pos={[Math.cos(a) * radius, hh + 0.6, Math.sin(a) * radius]} size={[0.7, 1.2, 0.7]}
                color={theme.trim} rot={[0, -a, 0]} />
            )}
          </group>
        );
      })}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} material={solidMaterial(theme.dark)}>
        <circleGeometry args={[Math.max(0.5, radius - 2), 24]} />
      </mesh>
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} material={basicMaterial(theme.glow, 0.5)}>
        <ringGeometry args={[radius * 0.3, radius * 0.33, 32]} />
      </mesh>
    </group>
  );
}