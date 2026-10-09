import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { BuildingBox } from "../worldData";
import { hash01, themeOf, RUBBLE, INK } from "./palette";
import { basicMaterial, clothMaterial, solidMaterial, stoneMaterial, TILE } from "./textures";

export type V3 = [number, number, number];
export type P = { b: BuildingBox };

export const BOX = new THREE.BoxGeometry(1, 1, 1);
export const PLANE = new THREE.PlaneGeometry(1, 1);
const OCTA = new THREE.OctahedronGeometry(1, 0);

/** Theme, shared stone material and a stable seed for one building. */
export function useStyle(b: BuildingBox) {
  return useMemo(() => {
    const theme = themeOf(b.district);
    const variant = Math.floor(hash01(b.x, b.z, 91) * 4);
    return { theme, mat: stoneMaterial(variant, theme.stone), seed: b.x * 0.13 + b.z * 0.29 };
  }, [b]);
}

// Box whose UVs are scaled to the box size so stone blocks keep one real-world size.
const geoCache = new Map<string, THREE.BoxGeometry>();
function texBoxGeometry(w: number, h: number, d: number) {
  const key = `${w.toFixed(2)}|${h.toFixed(2)}|${d.toFixed(2)}`;
  const cached = geoCache.get(key);
  if (cached) return cached;
  const g = new THREE.BoxGeometry(w, h, d);
  const n = g.attributes.normal;
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(n.getX(i));
    const ny = Math.abs(n.getY(i));
    let su: number;
    let sv: number;
    if (nx > 0.5) { su = d / TILE; sv = h / TILE; }
    else if (ny > 0.5) { su = w / TILE; sv = d / TILE; }
    else { su = w / TILE; sv = h / TILE; }
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  uv.needsUpdate = true;
  geoCache.set(key, g);
  return g;
}

export function TexBox({ pos, size, mat }: { pos: V3; size: V3; mat: THREE.Material }) {
  const geo = useMemo(() => texBoxGeometry(size[0], size[1], size[2]), [size[0], size[1], size[2]]);
  return <mesh geometry={geo} material={mat} position={pos} />;
}

export function Block({ pos, size, color, rot }: { pos: V3; size: V3; color: string; rot?: V3 }) {
  return <mesh geometry={BOX} material={solidMaterial(color)} position={pos} scale={size} rotation={rot} />;
}

export function Glow({ pos, size, color, opacity = 1, rot }: { pos: V3; size: V3; color: string; opacity?: number; rot?: V3 }) {
  return <mesh geometry={BOX} material={basicMaterial(color, opacity)} position={pos} scale={size} rotation={rot} />;
}

/** Small windows on all four faces; most are dark, a few glow in the kingdom color. */
export function Windows({
  w, h, d, cols, rows, lit, seed, marginY = 1.5, litChance = 0.78,
}: {
  w: number; h: number; d: number; cols: number; rows: number;
  lit: string; seed: number; marginY?: number; litChance?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const c = Math.max(1, cols);
  const r = Math.max(1, rows);
  const count = c * r * 4;

  const { matrices, colors } = useMemo(() => {
    const m: THREE.Matrix4[] = [];
    const col: THREE.Color[] = [];
    const dark = new THREE.Color("#2b2535");
    const on = new THREE.Color(lit);
    const usable = Math.max(0.4, h - marginY * 2);
    const cellH = usable / r;
    const paneH = Math.min(0.9, cellH * 0.42);
    const dummy = new THREE.Object3D();
    const faces = [
      { nx: 0, nz: 1, rot: 0, span: w },
      { nx: 0, nz: -1, rot: Math.PI, span: w },
      { nx: 1, nz: 0, rot: Math.PI / 2, span: d },
      { nx: -1, nz: 0, rot: -Math.PI / 2, span: d },
    ];
    faces.forEach((f, fi) => {
      const cellW = (f.span * 0.82) / c;
      const paneW = Math.min(0.55, cellW * 0.38);
      for (let ri = 0; ri < r; ri++) {
        for (let ci = 0; ci < c; ci++) {
          const along = (ci + 0.5) * cellW - (f.span * 0.82) / 2;
          const y = marginY + (ri + 0.5) * cellH;
          const off = (f.nz !== 0 ? d : w) / 2 + 0.03;
          dummy.position.set(f.nx !== 0 ? f.nx * off : along, y, f.nz !== 0 ? f.nz * off : along);
          dummy.rotation.set(0, f.rot, 0);
          dummy.scale.set(paneW, paneH, 1);
          dummy.updateMatrix();
          m.push(dummy.matrix.clone());
          col.push(hash01(along + fi * 3.1, y + seed, seed) > litChance ? on : dark);
        }
      }
    });
    return { matrices: m, colors: col };
  }, [w, h, d, c, r, lit, seed, marginY, litChance]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((mat, i) => mesh.setMatrixAt(i, mat));
    colors.forEach((cl, i) => mesh.setColorAt(i, cl));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [matrices, colors]);

  return (
    <instancedMesh ref={ref} args={[PLANE, undefined, count]}>
      <meshBasicMaterial color="#ffffff" toneMapped={false} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

/** Belt of trim colour around the whole building. */
export function Band({ b, y, color }: { b: BuildingBox; y: number; color: string }) {
  return <Block pos={[0, y, 0]} size={[b.w + 0.12, 0.2, b.d + 0.12]} color={color} />;
}

/** Four corner pillars. */
export function Pilasters({ b, color }: { b: BuildingBox; color: string }) {
  const sx = b.w / 2 - 0.15;
  const sz = b.d / 2 - 0.15;
  return (
    <>
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, c], i) => (
        <Block key={i} pos={[a * sx, b.h / 2, c * sz]} size={[0.5, b.h, 0.5]} color={color} />
      ))}
    </>
  );
}

/** Dark doorway with a glowing lintel on the front face. */
export function Door({ b, color, width, height, x = 0 }: { b: BuildingBox; color: string; width: number; height: number; x?: number }) {
  return (
    <>
      <Block pos={[x, height / 2, b.d / 2 + 0.05]} size={[width, height, 0.1]} color={INK} />
      <Glow pos={[x, height + 0.12, b.d / 2 + 0.09]} size={[width + 0.5, 0.16, 0.1]} color={color} />
    </>
  );
}

/** The 11:11 mark: two bars, two dots, two bars. */
export function Clock1111({ position, scale = 1, color }: { position: V3; scale?: number; color: string }) {
  return (
    <group position={position} scale={scale}>
      {[-0.62, -0.38, 0.38, 0.62].map((x) => (
        <Glow key={x} pos={[x, 0, 0]} size={[0.08, 0.55, 0.03]} color={color} />
      ))}
      {[-0.13, 0.13].map((y) => (
        <Glow key={y} pos={[0, y, 0]} size={[0.08, 0.08, 0.03]} color={color} />
      ))}
    </group>
  );
}

/** Thin ring along the roof edge. Never a solid slab: players stand on the roof. */
export function Parapets({ b, color }: { b: BuildingBox; color: string }) {
  if (b.w < 2 || b.d < 2) return null;
  const hh = Math.min(0.4, b.h * 0.04);
  const t = Math.min(0.28, b.w * 0.035, b.d * 0.035);
  return (
    <>
      <Block pos={[0, b.h + hh / 2, -b.d / 2 + t / 2]} size={[b.w, hh, t]} color={color} />
      <Block pos={[0, b.h + hh / 2, b.d / 2 - t / 2]} size={[b.w, hh, t]} color={color} />
      <Block pos={[-b.w / 2 + t / 2, b.h + hh / 2, 0]} size={[t, hh, b.d]} color={color} />
      <Block pos={[b.w / 2 - t / 2, b.h + hh / 2, 0]} size={[t, hh, b.d]} color={color} />
    </>
  );
}

/** Small fallen stones at roof corners and edges only. */
export function Rubble({ b, color = RUBBLE }: { b: BuildingBox; color?: string }) {
  const ex = Math.max(0.3, b.w / 2 - 0.55);
  const ez = Math.max(0.3, b.d / 2 - 0.55);
  const spots: [number, number][] = [[-ex, -ez * 0.8], [ex, ez * 0.7], [ex * 0.2, -ez]];
  return (
    <>
      {spots.map(([x, z], i) => {
        const s = 0.4 + hash01(b.x, b.z, 50 + i) * 0.5;
        return (
          <Block key={i} pos={[x, b.h + s * 0.45, z]} size={[s, s * 0.9, s * 1.1]} color={color}
            rot={[0, hash01(b.x, b.z, 60 + i) * 3, 0.15]} />
        );
      })}
    </>
  );
}

/** One broken tooth at a roof corner. */
export function Crown({ b, color }: { b: BuildingBox; color: string }) {
  if (hash01(b.x, b.z, 77) < 0.45 || b.w < 3 || b.d < 3) return null;
  const sx = hash01(b.x, b.z, 78) > 0.5 ? 1 : -1;
  const w = Math.min(0.9, b.w * 0.14);
  const d = Math.min(0.9, b.d * 0.14);
  const hh = 1.2 + hash01(b.x, b.z, 79) * 1.3;
  return (
    <Block pos={[sx * (b.w / 2 - w / 2 - 0.1), b.h + hh / 2, sx * (b.d / 2 - d / 2 - 0.1)]}
      size={[w, hh, d]} color={color} rot={[0, 0, sx * 0.05]} />
  );
}

/** Cloth banner hanging from the roofline. */
export function Banner({ b, color, glow, side = 0 }: { b: BuildingBox; color: string; glow: string; side?: number }) {
  const bh = Math.min(7, b.h * 0.42);
  const bw = Math.min(2.2, b.w * 0.22);
  return (
    <group position={[side * b.w * 0.3, b.h - bh / 2 - 0.5, b.d / 2 + 0.08]}>
      <mesh geometry={PLANE} material={clothMaterial(color)} scale={[bw, bh, 1]} />
      <mesh geometry={PLANE} material={basicMaterial(glow)} position={[0, bh * 0.12, 0.01]}
        scale={[bw * 0.34, bw * 0.34, 1]} rotation={[0, 0, Math.PI / 4]} />
    </group>
  );
}

/** Glowing shards floating well above the roof. */
export function Shards({ b, color }: { b: BuildingBox; color: string }) {
  const spots: [number, number][] = [[-0.3, 0.2], [0.28, -0.22], [0.05, 0.3]];
  return (
    <>
      {spots.map(([sx, sz], i) => {
        const s = 0.45 + hash01(b.x, b.z, 20 + i) * 0.5;
        return (
          <mesh key={i} geometry={OCTA} material={basicMaterial(color, 0.85)}
            position={[sx * b.w, b.h + 4 + hash01(b.x, b.z, i) * 2.5, sz * b.d]}
            scale={[s, s * 1.7, s]}
            rotation={[hash01(b.x, b.z, 30 + i) * 0.6, hash01(b.x, b.z, 40 + i) * 3, 0.2]} />
        );
      })}
    </>
  );
}