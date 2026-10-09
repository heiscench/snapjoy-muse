import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  BUILDINGS,
  BLOCK_SIZE,
  GRID,
  HARBOR_Z,
  DISTRICT_LABELS,
  type BuildingBox,
} from "./worldData";
import { GANGS } from "./gangs";
import { territoryState } from "./territoryState";
import { RELIC_PALETTE as P, RuinDetails } from "./RelicVisuals";

const GOLD = "#cfb878";
const VIOLET = "#b398d3";
const CRIMSON = "#8a2a3a";
const STONES = ["#303735", "#3a3f3c", "#2a2e33", "#34302f"];
const INK = "#161a1c";

const DISTRICT_ACCENT: Record<string, string> = {
  downtown: VIOLET,
  industrial: GOLD,
  stadium: "#9da58e",
  bank: GOLD,
  shopping: "#9986a2",
  harbor: "#777b91",
  residential: "#a18b77",
  airport: "#9a9e9c",
  casino: GOLD,
  chinatown: "#8a555a",
  slums: "#a08767",
  park: "#8a9b80",
  uptown: "#b3a5c0",
};

const BOX_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const WINDOW_PLANE = new THREE.PlaneGeometry(1, 1);
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);
const STONE_TEXTURES = new Map<string, THREE.CanvasTexture>();

function hash01(x: number, z: number, salt = 0): number {
  const v = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
  return v - Math.floor(v);
}

function stoneOf(b: BuildingBox): string {
  return STONES[Math.floor(hash01(b.x, b.z, 21) * STONES.length) % STONES.length];
}

function makeStoneTexture(variant: number): THREE.CanvasTexture {
  const existing = STONE_TEXTURES.get(String(variant));
  if (existing) return existing;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    fallback.colorSpace = THREE.SRGBColorSpace;
    STONE_TEXTURES.set(String(variant), fallback);
    return fallback;
  }

  const palettes = [
    ["#353a37", "#252a28", "#474b44"],
    ["#3a3f3c", "#292e2b", "#4b4c43"],
    ["#2a2e33", "#1c2125", "#3b4040"],
    ["#34302f", "#252322", "#45403a"],
  ];
  const palette = palettes[variant % palettes.length];

  ctx.fillStyle = palette[0];
  ctx.fillRect(0, 0, 256, 256);

  const blockH = 32;
  const blockW = 64;

  for (let row = 0; row < 8; row++) {
    const offset = row % 2 === 0 ? 0 : -blockW / 2;

    for (let col = -1; col < 5; col++) {
      const x = col * blockW + offset;
      const y = row * blockH;

      ctx.fillStyle = palette[(row + col + variant + 3) % palette.length];
      ctx.globalAlpha = 0.16 + hash01(x, y, variant) * 0.18;
      ctx.fillRect(x + 1, y + 1, blockW - 2, blockH - 2);

      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "#141817";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + blockH);
      ctx.lineTo(x + blockW, y + blockH);
      ctx.moveTo(x + blockW, y);
      ctx.lineTo(x + blockW, y + blockH);
      ctx.stroke();

      const crack = hash01(x, y, 10 + variant);
      if (crack > 0.56) {
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = "#111614";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 8 + crack * 18, y + 3);
        ctx.lineTo(x + 17 + crack * 12, y + 12);
        ctx.lineTo(x + 12 + crack * 16, y + 21);
        ctx.lineTo(x + 25 + crack * 9, y + 28);
        ctx.stroke();
      }

      if (hash01(x, y, 25 + variant) > 0.67) {
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = "#111514";
        ctx.fillRect(x + 4, y + 4, 12 + crack * 24, 3);
      }
    }
  }

  // Faint, scratched glyphs are part of the shared texture, not separate meshes.
  for (let i = 0; i < 14; i++) {
    const x = hash01(i, variant, 31) * 256;
    const y = hash01(i, variant, 32) * 256;

    ctx.globalAlpha = 0.13 + hash01(i, variant, 33) * 0.08;
    ctx.strokeStyle = i % 3 === 0 ? GOLD : "#8e958b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 4, y + 7);
    ctx.lineTo(x + 1, y + 12);
    ctx.moveTo(x + 7, y + 2);
    ctx.lineTo(x + 11, y + 10);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 2;
  texture.needsUpdate = true;
  STONE_TEXTURES.set(String(variant), texture);
  return texture;
}

function stoneTextureFor(b: BuildingBox): THREE.CanvasTexture {
  return makeStoneTexture(Math.floor(hash01(b.x, b.z, 91) * 4));
}

function StoneMaterial({
  b,
  color,
  roughness = 0.98,
}: {
  b: BuildingBox;
  color?: string;
  roughness?: number;
}) {
  const map = useMemo(() => stoneTextureFor(b), [b.x, b.z]);

  return (
    <meshStandardMaterial
      map={map}
      color={color ?? stoneOf(b)}
      roughness={roughness}
      metalness={0}
    />
  );
}

function StoneBlock({
  b,
  position,
  size,
  color,
  rotation,
}: {
  b: BuildingBox;
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={position} scale={size} rotation={rotation}>
      <primitive object={BOX_GEOMETRY} attach="geometry" />
      <StoneMaterial b={b} color={color} />
    </mesh>
  );
}

/** Small, dark windows with occasional candle-like light. */
function WindowGrid({
  w,
  h,
  d,
  cols,
  rows,
  color = "#111412",
  litColor = GOLD,
  seed,
  marginY = 0.5,
  litChance = 0.83,
}: {
  w: number;
  h: number;
  d: number;
  cols: number;
  rows: number;
  color?: string;
  litColor?: string;
  seed: number;
  marginY?: number;
  litChance?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const count = Math.max(0, cols * rows * 4);

  const { matrices, colors } = useMemo(() => {
    const m: THREE.Matrix4[] = [];
    const c: THREE.Color[] = [];
    const dark = new THREE.Color(color);
    const lit = new THREE.Color(litColor);
    const usableH = Math.max(0.2, h - marginY * 2);
    const cellH = usableH / Math.max(1, rows);
    const paneH = Math.min(0.42, cellH * 0.34);
    const dummy = new THREE.Object3D();

    const faces = [
      { nx: 0, nz: 1, rot: 0, span: w },
      { nx: 0, nz: -1, rot: Math.PI, span: w },
      { nx: 1, nz: 0, rot: Math.PI / 2, span: d },
      { nx: -1, nz: 0, rot: -Math.PI / 2, span: d },
    ];

    faces.forEach((face, fi) => {
      const cellW = (face.span * 0.82) / Math.max(1, cols);
      const paneW = Math.min(0.38, cellW * 0.32);

      for (let r = 0; r < rows; r++) {
        for (let ci = 0; ci < cols; ci++) {
          const along = (ci + 0.5) * cellW - (face.span * 0.82) / 2;
          const y = marginY + (r + 0.5) * cellH;
          const off = (face.nz !== 0 ? d : w) / 2 + 0.025;

          dummy.position.set(
            face.nx !== 0 ? face.nx * off : along,
            y,
            face.nz !== 0 ? face.nz * off : along,
          );
          dummy.rotation.set(0, face.rot, 0);
          dummy.scale.set(paneW, paneH, 1);
          dummy.updateMatrix();

          m.push(dummy.matrix.clone());
          const litWindow =
            hash01(along + fi * 3.1, y + seed, seed) > litChance;
          c.push(litWindow ? lit : dark);
        }
      }
    });

    return { matrices: m, colors: c };
  }, [w, h, d, cols, rows, color, litColor, seed, marginY, litChance]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;

    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    colors.forEach((col, i) => mesh.setColorAt(i, col));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [matrices, colors]);

  return (
    <instancedMesh ref={ref} args={[WINDOW_PLANE, undefined, count]} frustumCulled>
      <meshBasicMaterial
        side={THREE.DoubleSide}
        toneMapped={false}
        color="#b8a78c"
      />
    </instancedMesh>
  );
}

/** A subdued 11:11 mark, engraved or dimly illuminated. */
function Clock1111({
  position,
  scale = 1,
  color = GOLD,
}: {
  position: [number, number, number];
  scale?: number;
  color?: string;
}) {
  return (
    <group position={position} scale={scale}>
      {[-0.62, -0.38, 0.38, 0.62].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <boxGeometry args={[0.07, 0.48, 0.025]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
      {[-0.13, 0.13].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[0.065, 0.065, 0.025]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Broken masonry fragments are confined to roof edges and corners. */
function Rubble({ b, color }: { b: BuildingBox; color?: string }) {
  const pieces = useMemo(() => {
    const result: {
      x: number;
      z: number;
      y: number;
      w: number;
      h: number;
      d: number;
      ry: number;
    }[] = [];

    const edgeX = Math.max(0.25, b.w / 2 - 0.55);
    const edgeZ = Math.max(0.25, b.d / 2 - 0.55);

    for (let i = 0; i < 3; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * edgeX;
      const z = (hash01(b.x, b.z, 41 + i) - 0.5) * b.d * 0.7;
      result.push({
        x,
        z,
        y: b.h + 0.12 + hash01(b.x, b.z, 45 + i) * 0.2,
        w: 0.35 + hash01(b.x, b.z, 49 + i) * 0.35,
        h: 0.2 + hash01(b.x, b.z, 53 + i) * 0.55,
        d: 0.3 + hash01(b.x, b.z, 57 + i) * 0.35,
        ry: hash01(b.x, b.z, 61 + i) * Math.PI,
      });
    }

    return result;
  }, [b]);

  return (
    <group>
      {pieces.map((piece, i) => (
        <StoneBlock
          key={i}
          b={b}
          position={[piece.x, piece.y, piece.z]}
          size={[piece.w, piece.h, piece.d]}
          color={color ?? P.stone}
          rotation={[0, piece.ry, (hash01(b.x, b.z, 71 + i) - 0.5) * 0.2]}
        />
      ))}
    </group>
  );
}

/** A few deterministic broken upper corners, never a roof-covering slab. */
function BrokenCrown({ b, color }: { b: BuildingBox; color?: string }) {
  const enabled = hash01(b.x, b.z, 77) > 0.48;
  if (!enabled || b.w < 3 || b.d < 3) return null;

  const side = hash01(b.x, b.z, 78) > 0.5 ? 1 : -1;
  const pieceW = Math.min(0.8, b.w * 0.15);
  const pieceD = Math.min(0.8, b.d * 0.15);
  const x = side * Math.max(0, b.w / 2 - pieceW / 2 - 0.12);
  const z = (hash01(b.x, b.z, 79) - 0.5) * b.d * 0.5;

  return (
    <StoneBlock
      b={b}
      position={[x, b.h + 0.22, z]}
      size={[pieceW, 0.44, pieceD]}
      color={color ?? P.stoneLight}
      rotation={[0, hash01(b.x, b.z, 80) * 0.4, 0.06]}
    />
  );
}

/** Thin parapets occupy only the outer edge of the roof. */
function Parapets({ b, color }: { b: BuildingBox; color?: string }) {
  const h = Math.min(0.45, b.h * 0.04);
  const thickness = Math.min(0.28, b.w * 0.035, b.d * 0.035);
  if (b.w < 2 || b.d < 2) return null;

  return (
    <group>
      <StoneBlock
        b={b}
        position={[0, b.h + h / 2, -b.d / 2 + thickness / 2]}
        size={[b.w, h, thickness]}
        color={color ?? P.ink}
      />
      <StoneBlock
        b={b}
        position={[0, b.h + h / 2, b.d / 2 - thickness / 2]}
        size={[b.w, h, thickness]}
        color={color ?? P.ink}
      />
      <StoneBlock
        b={b}
        position={[-b.w / 2 + thickness / 2, b.h + h / 2, 0]}
        size={[thickness, h, b.d]}
        color={color ?? P.ink}
      />
      <StoneBlock
        b={b}
        position={[b.w / 2 - thickness / 2, b.h + h / 2, 0]}
        size={[thickness, h, b.d]}
        color={color ?? P.ink}
      />
    </group>
  );
}

function RuneStrips({
  b,
  color = VIOLET,
  count = 2,
}: {
  b: BuildingBox;
  color?: string;
  count?: number;
}) {
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => {
        const x = (i - (count - 1) / 2) * b.w * 0.3;
        return (
          <mesh key={i} position={[x, b.h * 0.5, b.d / 2 + 0.025]}>
            <boxGeometry args={[0.045, b.h * 0.42, 0.025]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.36}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function Tower({ b }: { b: BuildingBox }) {
  const seed = b.x * 0.13 + b.z * 0.29;
  const rows = Math.max(2, Math.min(14, Math.floor(b.h / 4)));
  const cols = Math.max(2, Math.min(6, Math.floor(b.w / 3)));
  const mark = hash01(b.x, b.z, 3) > 0.74;

  return (
    <group position={[b.x, 0, b.z]}>
      <StoneBlock
        b={b}
        position={[0, b.h / 2, 0]}
        size={[b.w, b.h, b.d]}
      />
      <WindowGrid
        w={b.w}
        h={b.h}
        d={b.d}
        cols={cols}
        rows={rows}
        color="#111412"
        litColor={hash01(b.x, b.z, 2) > 0.5 ? GOLD : VIOLET}
        seed={seed}
        marginY={1.5}
        litChance={0.84}
      />
      <Parapets b={b} />
      <BrokenCrown b={b} />
      <Rubble b={b} />
      {mark && (
        <Clock1111
          position={[0, Math.min(b.h * 0.55, 14), b.d / 2 + 0.025]}
          scale={Math.min(2.1, b.w / 4)}
        />
      )}
      {b.h > 24 && (
        <RuinDetails
          x={b.x}
          z={b.z}
          w={b.w}
          d={b.d}
          h={b.h}
          banner={hash01(b.x, b.z, 4) > 0.55}
        />
      )}
    </group>
  );
}

function Warehouse({ b }: { b: BuildingBox }) {
  const seed = b.x * 0.21 + b.z * 0.11;
  const ribs = Math.max(3, Math.min(7, Math.floor(b.w / 3)));

  return (
    <group position={[b.x, 0, b.z]}>
      <StoneBlock b={b} position={[0, b.h / 2, 0]} size={[b.w, b.h, b.d]} />
      {Array.from({ length: ribs }).map((_, i) => {
        const x = (i + 0.5) * (b.w / ribs) - b.w / 2;
        return (
          <StoneBlock
            key={i}
            b={b}
            position={[x, b.h / 2, b.d / 2 - 0.08]}
            size={[0.16, b.h * 0.92, 0.12]}
            color={P.stoneLight}
          />
        );
      })}
      <StoneBlock
        b={b}
        position={[-b.w * 0.18, Math.min(b.h * 0.28, 2), b.d / 2 + 0.025]}
        size={[b.w * 0.3, Math.min(b.h * 0.5, 3), 0.04]}
        color={INK}
      />
      <WindowGrid
        w={b.w}
        h={b.h}
        d={b.d}
        cols={3}
        rows={1}
        color="#111412"
        litColor={GOLD}
        seed={seed}
        marginY={b.h * 0.72}
        litChance={0.86}
      />
      <Parapets b={b} />
      <Rubble b={b} />
    </group>
  );
}

function Silo({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]}>
        <cylinderGeometry args={[Math.max(0.2, b.w / 2 - 0.3), b.w / 2, b.h, 8]} />
        <meshStandardMaterial
          map={stoneTextureFor(b)}
          color={P.stone}
          roughness={0.98}
        />
      </mesh>
      {[0.3, 0.55, 0.8].map((t) => (
        <mesh
          key={t}
          position={[0, b.h * t, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[Math.max(0.15, b.w / 2 - 0.38), 0.035, 4, 20]} />
          <meshStandardMaterial color="#55594f" roughness={1} />
        </mesh>
      ))}
      {hash01(b.x, b.z, 81) > 0.65 && (
        <mesh
          position={[b.w * 0.25, b.h + 0.25, -b.d * 0.25]}
          rotation={[0.2, 0.6, 0.12]}
        >
          <octahedronGeometry args={[Math.min(0.45, b.w * 0.06), 0]} />
          <meshStandardMaterial color={P.stoneLight} roughness={1} />
        </mesh>
      )}
    </group>
  );
}

/** The Cache: the 11:11 vault-temple. */
function Bank({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <StoneBlock
        b={b}
        position={[0, b.h / 2, 0]}
        size={[b.w, b.h, b.d]}
        color="#302e27"
      />
      <StoneBlock
        b={b}
        position={[0, 0.5, 0]}
        size={[b.w, 1, b.d]}
        color={INK}
      />
      {[-1, 0, 1].map((s) => (
        <StoneBlock
          key={s}
          b={b}
          position={[s * b.w * 0.28, b.h * 0.28, b.d / 2 - 0.12]}
          size={[Math.min(0.5, b.w * 0.08), b.h * 0.52, 0.24]}
          color={P.stoneLight}
        />
      ))}
      <mesh position={[0, b.h * 0.25, b.d / 2 + 0.025]}>
        <primitive object={UNIT_PLANE} attach="geometry" />
        <meshBasicMaterial
          color={GOLD}
          transparent
          opacity={0.3}
          toneMapped={false}
        />
      </mesh>
      <Clock1111
        position={[0, b.h * 0.7, b.d / 2 + 0.035]}
        scale={Math.max(1, Math.min(2.5, b.w / 5))}
      />
      <Parapets b={b} />
      <Rubble b={b} color="#38352d" />
      <RuinDetails x={b.x} z={b.z} w={b.w} d={b.d} h={b.h} banner />
    </group>
  );
}

const LOWRISE_BANNERS = ["#403844", "#4a4030", "#343d39", "#463438"];

function LowRise({ b }: { b: BuildingBox }) {
  const seed = b.x * 0.31 + b.z * 0.17;
  const banner = LOWRISE_BANNERS[Math.floor(hash01(b.x, b.z, 5) * 4) % 4];
  const rows = Math.max(1, Math.min(4, Math.floor(b.h / 4) - 1));

  return (
    <group position={[b.x, 0, b.z]}>
      <StoneBlock b={b} position={[0, b.h / 2, 0]} size={[b.w, b.h, b.d]} />
      <mesh position={[0, Math.min(1.6, b.h * 0.25), b.d / 2 + 0.025]}>
        <planeGeometry args={[b.w * 0.7, Math.min(2, b.h * 0.4)]} />
        <meshBasicMaterial color="#111412" />
      </mesh>
      <StoneBlock
        b={b}
        position={[0, Math.min(3.2, b.h - 0.3), b.d / 2 - 0.1]}
        size={[b.w * 0.78, 0.06, 0.2]}
        color={banner}
        rotation={[-0.15, 0, 0]}
      />
      <mesh position={[0, Math.min(4.4, b.h * 0.72), b.d / 2 + 0.03]}>
        <boxGeometry args={[Math.min(0.7, b.w * 0.18), 0.045, 0.025]} />
        <meshBasicMaterial
          color={VIOLET}
          transparent
          opacity={0.38}
          toneMapped={false}
        />
      </mesh>
      <WindowGrid
        w={b.w}
        h={b.h}
        d={b.d}
        cols={Math.max(2, Math.floor(b.w / 3))}
        rows={rows}
        color="#111412"
        litColor={GOLD}
        seed={seed}
        marginY={Math.min(1.8, b.h * 0.18)}
        litChance={0.84}
      />
      <Parapets b={b} />
      <BrokenCrown b={b} />
    </group>
  );
}

/** The Archive. */
function Mall({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <StoneBlock b={b} position={[0, b.h / 2, 0]} size={[b.w, b.h, b.d]} />
      <mesh position={[0, b.h * 0.45, b.d / 2 + 0.025]}>
        <planeGeometry args={[b.w * 0.72, b.h * 0.48]} />
        <meshBasicMaterial
          color="#49434f"
          transparent
          opacity={0.3}
          toneMapped={false}
        />
      </mesh>
      {[-3, -1, 1, 3].map((i) => (
        <StoneBlock
          key={i}
          b={b}
          position={[
            THREE.MathUtils.clamp((i * b.w) / 9, -b.w / 2 + 0.25, b.w / 2 - 0.25),
            b.h * 0.45,
            b.d / 2 - 0.15,
          ]}
          size={[0.28, b.h * 0.58, 0.28]}
          color={P.stoneLight}
        />
      ))}
      <Parapets b={b} />
      <Rubble b={b} color="#303235" />
      <RuinDetails x={b.x} z={b.z} w={b.w} d={b.d} h={b.h} />
    </group>
  );
}

function Harbor({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <StoneBlock
        b={b}
        position={[0, b.h / 2, 0]}
        size={[b.w, b.h, b.d]}
        color="#292e31"
      />
      <StoneBlock
        b={b}
        position={[0, b.h * 0.8, b.d / 2 - 0.08]}
        size={[b.w * 0.82, 0.08, 0.12]}
        color="#454941"
      />
      <Parapets b={b} />
    </group>
  );
}

/** A ruined crane remnant contained inside its assigned box. */
function Crane({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <StoneBlock b={b} position={[0, b.h / 2, 0]} size={[b.w, b.h, b.d]} />
      <StoneBlock
        b={b}
        position={[0, b.h * 0.9, 0]}
        size={[b.w * 0.88, 0.35, Math.min(0.7, b.d * 0.18)]}
        color={P.stoneLight}
        rotation={[0, 0, -0.06]}
      />
      <StoneBlock
        b={b}
        position={[b.w * 0.2, b.h * 0.65, 0]}
        size={[0.08, b.h * 0.42, 0.08]}
        color={INK}
      />
      <BrokenCrown b={b} />
    </group>
  );
}

/** Ring of Echoes. */
function Stadium({ b }: { b: BuildingBox }) {
  const segs = 16;
  const radius = Math.max(1, Math.min(b.w, b.d) / 2 - 0.4);

  return (
    <group position={[b.x, 0, b.z]}>
      {Array.from({ length: segs }).map((_, i) => {
        if (i % 5 === 3) return null;

        const a = (i / segs) * Math.PI * 2;
        const hh = b.h * (0.55 + hash01(i, b.x, 9) * 0.25);
        const segmentW = Math.min(2, (2 * Math.PI * radius) / segs);
        const x = Math.cos(a) * radius;
        const z = Math.sin(a) * radius;

        return (
          <StoneBlock
            key={i}
            b={b}
            position={[x, hh / 2, z]}
            size={[segmentW, hh, Math.min(1.2, b.d * 0.16)]}
            color="#303632"
            rotation={[0, -a, 0]}
          />
        );
      })}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[Math.max(0.5, radius - 2), 24]} />
        <meshStandardMaterial color="#171a19" roughness={1} />
      </mesh>
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.35, radius * 0.37, 32]} />
        <meshBasicMaterial
          color="#655a43"
          transparent
          opacity={0.35}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/** The Sanctum. */
function Hospital({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <StoneBlock
        b={b}
        position={[0, b.h / 2, 0]}
        size={[b.w, b.h, b.d]}
        color="#555b55"
      />
      {[b.d / 2 + 0.025, -b.d / 2 - 0.025].map((zOff, i) => (
        <group
          key={i}
          position={[0, b.h * 0.55, zOff]}
          rotation={[0, i ? Math.PI : 0, 0]}
        >
          <mesh>
            <ringGeometry args={[0.55, 0.68, 20]} />
            <meshBasicMaterial
              color="#716480"
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh>
            <circleGeometry args={[0.18, 12]} />
            <meshBasicMaterial
              color={GOLD}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}
      <Parapets b={b} />
      <Text
        position={[0, b.h + 1.1, 0]}
        fontSize={Math.min(1.4, b.w * 0.08)}
        color="#c2b9a5"
        anchorX="center"
        anchorY="middle"
      >
        THE SANCTUM
      </Text>
    </group>
  );
}

function House({ b }: { b: BuildingBox }) {
  const seed = b.x * 0.41 + b.z * 0.23;
  const floors = Math.max(1, Math.min(2, Math.floor(b.h / 4)));
  const doorW = b.w * 0.2;
  const doorH = Math.min(b.h * 0.42, 2.2);
  const missing = hash01(b.x, b.z, 7) > 0.5 ? 1 : -1;

  return (
    <group position={[b.x, 0, b.z]}>
      <StoneBlock
        b={b}
        position={[0, b.h / 2, 0]}
        size={[b.w, b.h, b.d]}
        color={["#45463f", "#4a4842", "#3f4540", "#48413e"][
          Math.floor(hash01(b.x, b.z, 3) * 4) % 4
        ]}
      />
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <StoneBlock
            key={`${sx}-${sz}`}
            b={b}
            position={[
              sx * (b.w / 2 - 0.15),
              b.h / 2,
              sz * (b.d / 2 - 0.15),
            ]}
            size={[0.22, b.h, 0.22]}
            color={INK}
          />
        )),
      )}
      <WindowGrid
        w={b.w}
        h={b.h}
        d={b.d}
        cols={2}
        rows={floors}
        color="#111412"
        litColor={GOLD}
        seed={seed}
        marginY={Math.min(1.2, b.h * 0.2)}
        litChance={0.83}
      />
      <StoneBlock
        b={b}
        position={[
          0,
          b.h + 0.12,
          -missing * Math.max(0, b.d * 0.25),
        ]}
        size={[b.w * 0.52, 0.18, Math.min(0.45, b.d * 0.22)]}
        color="#242322"
        rotation={[missing * 0.1, 0, 0]}
      />
      <mesh position={[0, doorH / 2 + 0.1, b.d / 2 + 0.025]}>
        <boxGeometry args={[doorW, doorH, 0.035]} />
        <meshBasicMaterial color="#080a09" />
      </mesh>
      <mesh position={[doorW * 0.8, doorH + 0.18, b.d / 2 + 0.05]}>
        <sphereGeometry args={[0.07, 6, 6]} />
        <meshBasicMaterial color={GOLD} toneMapped={false} />
      </mesh>
      <Parapets b={b} />
      <BrokenCrown b={b} />
    </group>
  );
}

/** Memory Garden. */
function Plaza({ b }: { b: BuildingBox }) {
  const radius = Math.max(0.5, Math.min(b.w, b.d) / 2 - 0.35);

  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius, 24]} />
        <meshStandardMaterial color="#202721" roughness={1} />
      </mesh>
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.28, radius * 0.31, 28]} />
        <meshBasicMaterial
          color="#655a43"
          transparent
          opacity={0.4}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, Math.min(2.4, b.h * 0.7), 0]}>
        <icosahedronGeometry args={[Math.min(0.35, radius * 0.1), 0]} />
        <meshStandardMaterial color={P.stoneLight} roughness={1} />
      </mesh>
      <mesh position={[0, Math.min(0.7, b.h * 0.4), 0]}>
        <cylinderGeometry args={[0.14, 0.22, Math.min(1.4, b.h), 6]} />
        <meshStandardMaterial color={P.stone} roughness={1} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        const r = radius * 0.8;
        const hh = Math.min(1.8, 0.7 + hash01(i, b.x, 14) * 0.9);

        return (
          <StoneBlock
            key={i}
            b={b}
            position={[Math.cos(a) * r, hh / 2, Math.sin(a) * r]}
            size={[0.35, hh, 0.3]}
            color={P.stoneLight}
            rotation={[0, a, (i % 2 ? 1 : -1) * 0.08]}
          />
        );
      })}
    </group>
  );
}

/** Relic bay. */
function Hangar({ b }: { b: BuildingBox }) {
  const radius = Math.max(0.4, Math.min(b.h * 0.55, b.w / 2 - 0.25));
  const ribs = 5;

  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, radius * 0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry
          args={[radius, radius, b.d * 0.88, 12, 1, true, 0, Math.PI]}
        />
        <meshStandardMaterial
          map={stoneTextureFor(b)}
          color="#303638"
          roughness={0.98}
          side={THREE.DoubleSide}
        />
      </mesh>
      {Array.from({ length: ribs }).map((_, i) => {
        const z = -b.d * 0.4 + (b.d * 0.8 / (ribs - 1)) * i;
        return (
          <mesh
            key={i}
            position={[0, radius * 0.55, z]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry
              args={[radius + 0.08, radius + 0.08, 0.12, 12, 1, true, 0, Math.PI]}
            />
            <meshStandardMaterial
              color={INK}
              roughness={0.95}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
      <mesh position={[0, radius * 0.24, b.d / 2 + 0.025]}>
        <planeGeometry args={[b.w * 0.5, radius * 0.38]} />
        <meshBasicMaterial
          color="#5e536b"
          transparent
          opacity={0.25}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/** Cathedral of Echoes. */
function Casino({ b }: { b: BuildingBox }) {
  const bands = 4;

  return (
    <group position={[b.x, 0, b.z]}>
      <StoneBlock
        b={b}
        position={[0, b.h / 2, 0]}
        size={[b.w, b.h * 0.78, b.d]}
        color="#302f32"
      />
      <StoneBlock
        b={b}
        position={[0, b.h * 0.9, 0]}
        size={[b.w * 0.55, b.h * 0.16, b.d * 0.55]}
        color="#34332e"
      />
      {Array.from({ length: bands }).map((_, i) => {
        const y = b.h * (0.2 + i * 0.14);
        return (
          <group key={i}>
            <mesh position={[0, y, b.d / 2 + 0.025]}>
              <planeGeometry args={[b.w * 0.72, 0.045]} />
              <meshBasicMaterial
                color={i % 2 === 0 ? GOLD : "#5f5868"}
                transparent
                opacity={0.4}
                toneMapped={false}
              />
            </mesh>
            <mesh
              position={[0, y, -b.d / 2 - 0.025]}
              rotation={[0, Math.PI, 0]}
            >
              <planeGeometry args={[b.w * 0.72, 0.045]} />
              <meshBasicMaterial
                color={i % 2 === 0 ? GOLD : "#5f5868"}
                transparent
                opacity={0.4}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}
      <Clock1111
        position={[0, b.h * 0.82, b.d / 2 + 0.035]}
        scale={Math.max(1, Math.min(2.2, b.w / 5))}
      />
      <Parapets b={b} />
      <BrokenCrown b={b} />
      <RuinDetails x={b.x} z={b.z} w={b.w} d={b.d} h={b.h} banner />
    </group>
  );
}

/** Shrine of the Warriors. Crimson is reserved for this structure. */
function Pagoda({ b }: { b: BuildingBox }) {
  const tiers = 3;
  const tierH = b.h / tiers;

  return (
    <group position={[b.x, 0, b.z]}>
      {Array.from({ length: tiers }).map((_, i) => {
        const scale = 1 - i * 0.2;
        const y = tierH * i + tierH * 0.42;
        const width = b.w * scale * 0.7;
        const depth = b.d * scale * 0.7;
        const height = Math.min(tierH * 0.55, b.h - y);

        return (
          <group key={i} position={[0, y, 0]}>
            <StoneBlock
              b={b}
              position={[0, 0, 0]}
              size={[width, height, depth]}
              color="#302b2c"
            />
            <StoneBlock
              b={b}
              position={[0, height * 0.48, 0]}
              size={[
                Math.max(0.3, width * 0.88),
                0.12,
                Math.max(0.3, depth * 0.88),
              ]}
              color={INK}
            />
            <mesh position={[0, 0, depth / 2 + 0.025]}>
              <planeGeometry args={[width * 0.35, height * 0.35]} />
              <meshBasicMaterial
                color={CRIMSON}
                transparent
                opacity={0.55}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, b.h + 0.25, 0]}>
        <cylinderGeometry args={[0.05, 0.1, 0.45, 6]} />
        <meshStandardMaterial color="#655b49" roughness={0.8} />
      </mesh>
      <mesh position={[0, b.h * 0.5, b.d / 2 + 0.025]}>
        <planeGeometry args={[b.w * 0.18, b.h * 0.36]} />
        <meshBasicMaterial color={CRIMSON} toneMapped={false} />
      </mesh>
      <RuinDetails x={b.x} z={b.z} w={b.w} d={b.d} h={b.h} banner />
    </group>
  );
}

function Shanty({ b }: { b: BuildingBox }) {
  const lean = (hash01(b.x, b.z, 11) - 0.5) * 0.08;
  const patch = hash01(b.x, b.z, 12) > 0.5;

  return (
    <group position={[b.x, 0, b.z]}>
      <StoneBlock
        b={b}
        position={[0, b.h / 2, 0]}
        size={[b.w, b.h, b.d]}
        color="#3a3d39"
      />
      {patch && (
        <StoneBlock
          b={b}
          position={[b.w * 0.2, b.h * 0.55, b.d / 2 + 0.025]}
          size={[b.w * 0.3, b.h * 0.25, 0.04]}
          color="#54534c"
          rotation={[0, 0, 0.1]}
        />
      )}
      <StoneBlock
        b={b}
        position={[-b.w * 0.28, b.h * 0.3, b.d / 2 + 0.025]}
        size={[b.w * 0.2, b.h * 0.55, 0.04]}
        color="#080a09"
      />
      <StoneBlock
        b={b}
        position={[0, b.h + 0.12, 0]}
        size={[b.w * 0.9, 0.2, b.d * 0.9]}
        color="#454843"
        rotation={[0.04 + lean, 0, lean]}
      />
      <mesh
        position={[b.w * 0.35, b.h * 0.5, b.d * 0.35]}
        rotation={[0, 0, 0.12]}
      >
        <cylinderGeometry args={[0.06, 0.06, b.h, 5]} />
        <meshStandardMaterial color="#242422" roughness={1} />
      </mesh>
      <mesh position={[0, b.h * 0.55, b.d / 2 + 0.035]}>
        <planeGeometry args={[b.w * 0.16, b.h * 0.2]} />
        <meshBasicMaterial
          color={GOLD}
          transparent
          opacity={0.28}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function Brownstone({ b }: { b: BuildingBox }) {
  const seed = b.x * 0.53 + b.z * 0.37;
  const floors = Math.max(2, Math.min(6, Math.floor(b.h / 4)));
  const stoopSide = hash01(b.x, b.z, 13) > 0.5 ? 1 : -1;

  return (
    <group position={[b.x, 0, b.z]}>
      <StoneBlock
        b={b}
        position={[0, b.h / 2, 0]}
        size={[b.w, b.h, b.d]}
        color="#3c3736"
      />
      {Array.from({ length: floors - 1 }).map((_, i) => (
        <StoneBlock
          key={i}
          b={b}
          position={[0, (i + 1) * (b.h / floors), 0]}
          size={[b.w * 0.98, 0.1, b.d * 0.98]}
          color={INK}
        />
      ))}
      <WindowGrid
        w={b.w}
        h={b.h}
        d={b.d}
        cols={Math.max(2, Math.floor(b.w / 3.2))}
        rows={floors}
        color="#111412"
        litColor={VIOLET}
        seed={seed}
        marginY={1.5}
        litChance={0.84}
      />
      {Array.from({ length: floors - 1 }).map((_, i) => (
        <StoneBlock
          key={`ledge-${i}`}
          b={b}
          position={[
            THREE.MathUtils.clamp(-stoopSide * b.w * 0.22, -b.w / 2 + 0.3, b.w / 2 - 0.3),
            (i + 1) * (b.h / floors) + 0.25,
            b.d / 2 - 0.1,
          ]}
          size={[b.w * 0.25, 0.08, 0.25]}
          color={P.stoneLight}
        />
      ))}
      <StoneBlock
        b={b}
        position={[
          stoopSide * b.w * 0.15,
          1.2,
          b.d / 2 - 0.08,
        ]}
        size={[b.w * 0.2, 2.4, 0.1]}
        color="#080a09"
      />
      <mesh position={[stoopSide * b.w * 0.15, 2.7, b.d / 2 + 0.025]}>
        <sphereGeometry args={[0.09, 6, 6]} />
        <meshBasicMaterial color={GOLD} toneMapped={false} />
      </mesh>
      <Parapets b={b} />
      <BrokenCrown b={b} />
    </group>
  );
}

/** The Hall: the faction-owned obelisk. */
function Headquarters({ b }: { b: BuildingBox }) {
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null!);
  const flagMat = useRef<THREE.MeshBasicMaterial>(null!);

  useFrame(() => {
    const owner = territoryState.owners[b.district];
    const hasOwner = owner !== null && owner !== undefined;
    const bodyColor = hasOwner ? GANGS[owner].color : "#62665f";
    const flagColor = hasOwner ? GANGS[owner].accent : "#a9a99f";

    if (bodyMat.current) bodyMat.current.color.set(bodyColor);
    if (flagMat.current) flagMat.current.color.set(flagColor);
  });

  return (
    <group position={[b.x, 0, b.z]}>
      <StoneBlock
        b={b}
        position={[0, 0.35, 0]}
        size={[b.w, 0.7, b.d]}
        color="#202422"
      />
      <mesh position={[0, b.h * 0.45, 0]} rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry={[
          Math.max(0.25, b.w * 0.1),
          Math.max(0.35, b.w * 0.19),
          b.h * 0.85,
          4,
        ]} />
        <meshStandardMaterial
          ref={bodyMat}
          map={stoneTextureFor(b)}
          color="#62665f"
          roughness={0.95}
          metalness={0}
        />
      </mesh>
      <mesh position={[0, Math.min(b.h + 0.35, b.h * 0.95 + 0.35), 0]}>
        <octahedronGeometry args={[Math.min(0.65, b.w * 0.1), 0]} />
        <meshBasicMaterial
          ref={flagMat}
          color="#a9a99f"
          toneMapped={false}
        />
      </mesh>
      <Clock1111
        position={[0, b.h * 0.45, b.d / 2 + 0.025]}
        scale={Math.min(1.4, b.w * 0.1)}
      />
      <Text
        position={[0, b.h + 1.4, 0]}
        fontSize={Math.min(1.6, b.w * 0.12)}
        color="#d2cbbb"
        anchorX="center"
        anchorY="middle"
      >
        THE HALL
      </Text>
    </group>
  );
}

export function City() {
  const roadCount = GRID * 2 + 1;

  const rendered = useMemo(() => {
    return BUILDINGS.map((b, i) => {
      switch (b.type) {
        case "tower":
          return <Tower key={i} b={b} />;
        case "warehouse":
          return <Warehouse key={i} b={b} />;
        case "silo":
          return <Silo key={i} b={b} />;
        case "bank":
          return <Bank key={i} b={b} />;
        case "lowrise":
          return <LowRise key={i} b={b} />;
        case "mall":
          return <Mall key={i} b={b} />;
        case "harbor":
          return <Harbor key={i} b={b} />;
        case "crane":
          return <Crane key={i} b={b} />;
        case "stadium":
          return <Stadium key={i} b={b} />;
        case "hospital":
          return <Hospital key={i} b={b} />;
        case "house":
          return <House key={i} b={b} />;
        case "plaza":
          return <Plaza key={i} b={b} />;
        case "hangar":
          return <Hangar key={i} b={b} />;
        case "casino":
          return <Casino key={i} b={b} />;
        case "pagoda":
          return <Pagoda key={i} b={b} />;
        case "shanty":
          return <Shanty key={i} b={b} />;
        case "brownstone":
          return <Brownstone key={i} b={b} />;
        case "hq":
          return <Headquarters key={i} b={b} />;
      }
    });
  }, []);

  const groundExtent = (GRID * 2 + 2) * BLOCK_SIZE;
  const roadLen = groundExtent;

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.015, 0]}
      >
        <planeGeometry args={[groundExtent, groundExtent]} />
        <meshStandardMaterial color="#171a18" roughness={1} />
      </mesh>

     {/* The Black Tide: dark violet harbor water. */}
      <mesh
        position={[0, 0.015, HARBOR_Z - BLOCK_SIZE * 0.5]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[groundExtent, BLOCK_SIZE * 1.4]} />
        <meshStandardMaterial
          color="#171321"
          roughness={0.45}
          metalness={0}
        />
      </mesh>

      {Array.from({ length: roadCount }).map((_, i) => {
        const p = (i - (roadCount - 1) / 2) * BLOCK_SIZE;

        return (
          <group key={i}>
            <mesh
              position={[p, 0.005, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[10, roadLen]} />
              <meshStandardMaterial color="#111311" roughness={0.98} />
            </mesh>
            <mesh
              position={[0, 0.005, p]}
              rotation={[-Math.PI / 2, 0, Math.PI / 2]}
            >
              <planeGeometry args={[10, roadLen]} />
              <meshStandardMaterial color="#111311" roughness={0.98} />
            </mesh>

            {/* Short, dull-gold dashes rather than continuous bright lines. */}
            {Array.from({ length: Math.max(1, Math.ceil(roadLen / 14)) }).map(
              (_, dashIndex) => {
                const dashZ = -roadLen / 2 + dashIndex * 14 + 3;
                const dashX = -roadLen / 2 + dashIndex * 14 + 3;

                return (
                  <group key={`dash-${dashIndex}`}>
                    <mesh
                      position={[p, 0.012, dashZ]}
                      rotation={[-Math.PI / 2, 0, 0]}
                    >
                      <planeGeometry args={[0.075, 2.5]} />
                      <meshBasicMaterial
                        color="#655b40"
                        transparent
                        opacity={0.45}
                        toneMapped={false}
                      />
                    </mesh>
                    <mesh
                      position={[dashX, 0.012, p]}
                      rotation={[-Math.PI / 2, 0, Math.PI / 2]}
                    >
                      <planeGeometry args={[0.075, 2.5]} />
                      <meshBasicMaterial
                        color="#655b40"
                        transparent
                        opacity={0.45}
                        toneMapped={false}
                      />
                    </mesh>
                  </group>
                );
              },
            )}
          </group>
        );
      })}

      {rendered}

      {DISTRICT_LABELS.map((d, i) => (
        <Text
          key={i}
          position={[d.x, 46, d.z]}
          fontSize={5}
          color={DISTRICT_ACCENT[d.district] ?? "#aaa79c"}
          anchorX="center"
          anchorY="middle"
        >
          {d.name}
        </Text>
      ))}
    </group>
  );
}

export type _D = typeof DISTRICT_ACCENT;