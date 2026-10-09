import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BUILDINGS, BLOCK_SIZE, GRID, HARBOR_Z, DISTRICT_LABELS, type BuildingBox } from "./worldData";
import { GANGS } from "./gangs";
import { territoryState } from "./territoryState";
import { RELIC_PALETTE as P, RuinDetails } from "./RelicVisuals";

const GOLD = "#cfb878";
const VIOLET = "#b398d3";
const STONES = ["#303735", "#3a3f3c", "#2a2e33", "#34302f"];

const DISTRICT_ACCENT: Record<string, string> = {
  downtown: "#b398d3",
  industrial: "#cfb878",
  stadium: "#9fd08a",
  bank: "#d8ac52",
  shopping: "#c78fd0",
  harbor: "#7f9fe0",
  residential: "#d8a77a",
  airport: "#c9d6e8",
  casino: "#d8ac52",
  chinatown: "#d23a5c",
  slums: "#c98a4a",
  park: "#9bd08a",
  uptown: "#d6b8ff",
};

/** Deterministic 0..1 hash from world position so detail is stable per building. */
function hash01(x: number, z: number, salt = 0) {
  const v = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
  return v - Math.floor(v);
}

function stoneOf(b: BuildingBox) {
  return STONES[Math.floor(hash01(b.x, b.z, 21) * 4) % 4];
}

const WINDOW_PLANE = new THREE.PlaneGeometry(1, 1);

/** One InstancedMesh of dim rune-lit window quads across the four facades. Decorative only. */
function WindowGrid({
  w, h, d, cols, rows, color, litColor, seed, marginY = 0.5, opacity = 1, litChance = 0.62,
}: {
  w: number; h: number; d: number; cols: number; rows: number;
  color: string; litColor: string; seed: number; marginY?: number; opacity?: number; litChance?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const count = cols * rows * 4;

  const { matrices, colors } = useMemo(() => {
    const m: THREE.Matrix4[] = [];
    const c: THREE.Color[] = [];
    const dark = new THREE.Color(color);
    const lit = new THREE.Color(litColor);
    const usableH = h - marginY * 2;
    const cellH = usableH / rows;
    const paneH = Math.min(cellH * 0.6, 1.2);
    const dummy = new THREE.Object3D();

    const faces = [
      { nx: 0, nz: 1, rot: 0, span: w },
      { nx: 0, nz: -1, rot: Math.PI, span: w },
      { nx: 1, nz: 0, rot: Math.PI / 2, span: d },
      { nx: -1, nz: 0, rot: -Math.PI / 2, span: d },
    ];

    faces.forEach((f, fi) => {
      const cellW = (f.span * 0.86) / cols;
      const paneW = Math.min(cellW * 0.6, 1.1);
      for (let r = 0; r < rows; r++) {
        for (let ci = 0; ci < cols; ci++) {
          const along = (ci + 0.5) * cellW - (f.span * 0.86) / 2;
          const y = marginY + (r + 0.5) * cellH;
          const off = (f.nz !== 0 ? d : w) / 2 + 0.03;
          dummy.position.set(
            f.nx !== 0 ? f.nx * off : along,
            y,
            f.nz !== 0 ? f.nz * off : along,
          );
          dummy.rotation.set(0, f.rot, 0);
          dummy.scale.set(paneW, paneH, 1);
          dummy.updateMatrix();
          m.push(dummy.matrix.clone());
          c.push(hash01(along + fi * 3.1, y + seed, seed) > litChance ? lit : dark);
        }
      }
    });
    return { matrices: m, colors: c };
  }, [w, h, d, cols, rows, color, litColor, seed, marginY, litChance]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((mat, i) => mesh.setMatrixAt(i, mat));
    colors.forEach((col, i) => mesh.setColorAt(i, col));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [matrices, colors]);

  return (
    <instancedMesh ref={ref} args={[WINDOW_PLANE, undefined, count]} frustumCulled>
      <meshBasicMaterial
        toneMapped={false}
        side={THREE.DoubleSide}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </instancedMesh>
  );
}

/** The 11:11 mark: two bars, two dots, two bars. Always faces +Z. */
function Clock1111({ position, scale = 1, color = GOLD }: {
  position: [number, number, number]; scale?: number; color?: string;
}) {
  return (
    <group position={position} scale={scale}>
      {[-0.62, -0.38, 0.38, 0.62].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <boxGeometry args={[0.09, 0.62, 0.04]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
      {[-0.13, 0.13].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[0.09, 0.09, 0.04]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Glowing vertical rune strips on a facade. */
function RuneStrips({ b, color = VIOLET, count = 2, z }: {
  b: BuildingBox; color?: string; count?: number; z?: number;
}) {
  const zz = z ?? b.d / 2 + 0.05;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const x = (i - (count - 1) / 2) * (b.w * 0.56);
        return (
          <mesh key={i} position={[x, b.h * 0.5, zz]}>
            <boxGeometry args={[0.1, b.h * 0.78, 0.06]} />
            <meshBasicMaterial color={color} transparent opacity={0.75} toneMapped={false} />
          </mesh>
        );
      })}
    </>
  );
}

/** Jagged broken crown + fallen rubble. Everything stays within ~the footprint. */
function Rubble({ b, color }: { b: BuildingBox; color: string }) {
  return (
    <>
      {[[-0.28, 0.22], [0.26, -0.2], [0, 0.05]].map(([sx, sz], i) => {
        const hh = 0.8 + hash01(b.x + i, b.z, 41) * 2.2;
        return (
          <mesh key={i} position={[sx * b.w, b.h + 0.35 + hh / 2, sz * b.d]}
            rotation={[0, hash01(b.x, b.z + i, 42), 0]}>
            <boxGeometry args={[b.w * 0.26, hh, b.d * 0.26]} />
            <meshStandardMaterial color={color} roughness={1} />
          </mesh>
        );
      })}
      {[[-0.5, 0.52], [0.52, 0.48], [-0.46, -0.5]].map(([sx, sz], i) => (
        <mesh key={`r${i}`} position={[sx * b.w, 0.35, sz * b.d]}
          rotation={[hash01(b.x, b.z, 50 + i), hash01(b.x, b.z, 60 + i), 0]}>
          <boxGeometry args={[0.9 + i * 0.2, 0.7, 0.8]} />
          <meshStandardMaterial color={P.stoneLight} roughness={1} />
        </mesh>
      ))}
    </>
  );
}

function Tower({ b }: { b: BuildingBox }) {
  const seed = b.x * 0.13 + b.z * 0.29;
  const rows = Math.max(4, Math.min(14, Math.floor(b.h / 4)));
  const cols = Math.max(2, Math.min(6, Math.floor(b.w / 3)));
  const stone = stoneOf(b);
  const lit = hash01(b.x, b.z, 2) > 0.5 ? GOLD : VIOLET;
  const mark = hash01(b.x, b.z, 3) > 0.74;
  return (
    <group>
      <group position={[b.x, 0, b.z]}>
        <mesh position={[0, 1, 0]}>
          <boxGeometry args={[b.w * 1.06, 2, b.d * 1.06]} />
          <meshStandardMaterial color={P.ink} roughness={0.95} />
        </mesh>
        <mesh position={[0, b.h / 2, 0]}>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial color={stone} roughness={0.95} metalness={0.05} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (b.w / 2 - 0.3), b.h / 2, b.d / 2 + 0.05]}>
            <boxGeometry args={[0.4, b.h * 0.96, 0.22]} />
            <meshStandardMaterial color={P.stoneLight} roughness={0.9} />
          </mesh>
        ))}
        <WindowGrid
          w={b.w} h={b.h} d={b.d} cols={cols} rows={rows}
          color="#0b0a10" litColor={lit} seed={seed} marginY={2.4} litChance={0.66}
        />
        <mesh position={[0, b.h + 0.35, 0]}>
          <boxGeometry args={[b.w * 1.04, 0.7, b.d * 1.04]} />
          <meshStandardMaterial color={P.ink} roughness={0.9} />
        </mesh>
        <Rubble b={b} color={stone} />
        <mesh position={[0, b.h + 4.6, 0]}>
          <sphereGeometry args={[0.22, 6, 6]} />
          <meshBasicMaterial color={VIOLET} toneMapped={false} />
        </mesh>
        {mark && <Clock1111 position={[0, Math.min(b.h * 0.55, 14), b.d / 2 + 0.12]} scale={Math.min(3, b.w / 3)} />}
      </group>
      {b.h > 24 && <RuinDetails x={b.x} z={b.z} w={b.w} d={b.d} h={b.h} banner={hash01(b.x, b.z, 4) > 0.55} />}
    </group>
  );
}

function Warehouse({ b }: { b: BuildingBox }) {
  const seed = b.x * 0.21 + b.z * 0.11;
  const ribs = Math.max(3, Math.min(7, Math.floor(b.w / 3)));
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color="#2b2a28" roughness={0.95} />
      </mesh>
      {Array.from({ length: ribs }).map((_, i) => (
        <mesh key={i} position={[(i + 0.5) * (b.w / ribs) - b.w / 2, b.h / 2, b.d / 2 + 0.04]}>
          <boxGeometry args={[0.22, b.h * 0.94, 0.14]} />
          <meshStandardMaterial color={P.stoneLight} roughness={0.9} />
        </mesh>
      ))}
      {/* collapsed roof slabs */}
      {[-1, 0, 1].map((i) => (
        <mesh key={i} position={[0, b.h + 0.45 + (i === 0 ? -0.2 : 0.1), i * (b.d / 3.2)]}
          rotation={[0.35 * (i || 1), 0, i * 0.05]}>
          <boxGeometry args={[b.w * 0.94, 0.28, b.d / 3.6]} />
          <meshStandardMaterial color={P.stone} roughness={0.95} />
        </mesh>
      ))}
      {/* sealed rune door */}
      <mesh position={[-b.w * 0.18, b.h * 0.3, b.d / 2 + 0.05]}>
        <boxGeometry args={[b.w * 0.34, b.h * 0.58, 0.12]} />
        <meshStandardMaterial color={P.ink} roughness={0.9} />
      </mesh>
      <mesh position={[-b.w * 0.18, b.h * 0.3, b.d / 2 + 0.13]}>
        <planeGeometry args={[0.12, b.h * 0.5]} />
        <meshBasicMaterial color={VIOLET} toneMapped={false} />
      </mesh>
      <WindowGrid
        w={b.w} h={b.h} d={b.d} cols={3} rows={1}
        color="#0b0a10" litColor={GOLD} seed={seed} marginY={b.h * 0.72}
      />
    </group>
  );
}

function Silo({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]}>
        <cylinderGeometry args={[b.w / 2 - 0.3, b.w / 2, b.h, 8]} />
        <meshStandardMaterial color={P.stone} roughness={0.95} />
      </mesh>
      {[0.3, 0.55, 0.8].map((t) => (
        <mesh key={t} position={[0, b.h * t, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[b.w / 2 - 0.1 + (1 - t) * 0.25, 0.06, 4, 20]} />
          <meshBasicMaterial color={VIOLET} transparent opacity={0.7} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, b.h + 0.7, 0]} rotation={[0.1, 0.6, 0.12]}>
        <octahedronGeometry args={[b.w * 0.32, 0]} />
        <meshStandardMaterial color={P.stoneLight} emissive={VIOLET} emissiveIntensity={0.18} roughness={1} />
      </mesh>
    </group>
  );
}

/** The Cache: a gold-trimmed vault temple with the 11:11 mark. */
function Bank({ b }: { b: BuildingBox }) {
  return (
    <group>
      <group position={[b.x, 0, b.z]}>
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[b.w * 1.1, 1.2, b.d * 1.1]} />
          <meshStandardMaterial color={P.ink} roughness={0.9} />
        </mesh>
        <mesh position={[0, b.h / 2, 0]}>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial color="#2a2820" emissive={GOLD} emissiveIntensity={0.22} roughness={0.8} />
        </mesh>
        <mesh position={[0, b.h + 1, 0]}>
          <boxGeometry args={[b.w * 1.1, 2, b.d * 1.1]} />
          <meshStandardMaterial color="#3a3626" roughness={0.9} />
        </mesh>
        <mesh position={[0, b.h + 2.8, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[b.w * 0.42, 2.6, 4]} />
          <meshStandardMaterial color={P.ink} roughness={0.95} />
        </mesh>
        {[-1, 0, 1].map((s) => (
          <mesh key={s} position={[s * (b.w / 2 - 1.5), b.h * 0.3, b.d / 2 + 0.6]}>
            <boxGeometry args={[1, b.h * 0.6, 1]} />
            <meshStandardMaterial color={P.stoneLight} roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[0, b.h * 0.25, b.d / 2 + 0.08]}>
          <planeGeometry args={[b.w * 0.2, b.h * 0.42]} />
          <meshBasicMaterial color={GOLD} transparent opacity={0.85} toneMapped={false} />
        </mesh>
        <Clock1111 position={[0, b.h * 0.72, b.d / 2 + 0.12]} scale={Math.max(3, b.w / 3.2)} />
      </group>
      <RuinDetails x={b.x} z={b.z} w={b.w} d={b.d} h={b.h} banner />
    </group>
  );
}

const LOWRISE_FACADES = ["#2a2c2f", "#2e2a2c", "#262b2e", "#2c2b27"];
const LOWRISE_BANNERS = ["#4a3c5c", "#5a4a30", "#3c4a46", "#5a3640"];

function LowRise({ b }: { b: BuildingBox }) {
  const seed = b.x * 0.31 + b.z * 0.17;
  const pick = Math.floor(hash01(b.x, b.z, 2) * 4) % 4;
  const rows = Math.max(1, Math.min(4, Math.floor(b.h / 4) - 1));
  const banner = LOWRISE_BANNERS[Math.floor(hash01(b.x, b.z, 5) * 4) % 4];
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color={LOWRISE_FACADES[pick]} roughness={0.95} />
      </mesh>
      {/* dark broken shopfront with a faint inner glow */}
      <mesh position={[0, 1.6, b.d / 2 + 0.04]}>
        <planeGeometry args={[b.w * 0.9, 2.6]} />
        <meshBasicMaterial color="#17131f" toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.6, b.d / 2 + 0.06]}>
        <planeGeometry args={[b.w * 0.2, 1.8]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.45} toneMapped={false} />
      </mesh>
      {/* torn cloth awning */}
      <mesh position={[0, 3.2, b.d / 2 + 0.5]} rotation={[-0.5, 0, 0.04]}>
        <boxGeometry args={[b.w * 0.9, 0.06, 1.4]} />
        <meshStandardMaterial color={banner} roughness={1} />
      </mesh>
      {/* faint rune sign instead of neon */}
      <mesh position={[0, 4.6, b.d / 2 + 0.06]}>
        <boxGeometry args={[b.w * 0.3, 0.12, 0.08]} />
        <meshBasicMaterial color={VIOLET} transparent opacity={0.7} toneMapped={false} />
      </mesh>
      {rows > 0 && (
        <WindowGrid
          w={b.w} h={b.h} d={b.d} cols={Math.max(2, Math.floor(b.w / 3))} rows={rows}
          color="#0d0b12" litColor={GOLD} seed={seed} marginY={5.4} litChance={0.7}
        />
      )}
      <mesh position={[0, b.h + 0.2, 0]}>
        <boxGeometry args={[b.w * 1.05, 0.4, b.d * 1.05]} />
        <meshStandardMaterial color={P.ink} roughness={0.9} />
      </mesh>
      <mesh position={[b.w * 0.2, b.h + 0.8, -b.d * 0.15]} rotation={[0.2, 0.4, 0.3]}>
        <boxGeometry args={[1.2, 0.9, 1]} />
        <meshStandardMaterial color={P.stoneLight} roughness={1} />
      </mesh>
    </group>
  );
}

/** The Archive: wide hall with a violet memory-glass front. */
function Mall({ b }: { b: BuildingBox }) {
  return (
    <group>
      <group position={[b.x, 0, b.z]}>
        <mesh position={[0, b.h / 2, 0]}>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial color="#2a2c33" emissive={VIOLET} emissiveIntensity={0.1} roughness={0.9} />
        </mesh>
        <mesh position={[0, b.h * 0.45, b.d / 2 + 0.02]}>
          <planeGeometry args={[b.w * 0.85, b.h * 0.6]} />
          <meshBasicMaterial color="#7f6aa8" transparent opacity={0.4} toneMapped={false} />
        </mesh>
        {[-3, -1, 1, 3].map((i) => (
          <mesh key={i} position={[(i * b.w) / 9, b.h * 0.45, b.d / 2 + 0.3]}>
            <boxGeometry args={[0.5, b.h * 0.7, 0.5]} />
            <meshStandardMaterial color={P.stoneLight} roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[0, b.h + 0.3, 0]}>
          <boxGeometry args={[b.w * 1.04, 0.6, b.d * 1.04]} />
          <meshStandardMaterial color={P.ink} roughness={0.9} />
        </mesh>
        <Rubble b={b} color="#2a2c33" />
      </group>
      <RuinDetails x={b.x} z={b.z} w={b.w} d={b.d} h={b.h} />
    </group>
  );
}

function Harbor({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color="#1c2024" roughness={0.95} />
      </mesh>
      <mesh position={[0, b.h + 0.1, b.d / 2 - 0.1]}>
        <boxGeometry args={[b.w * 0.9, 0.12, 0.12]} />
        <meshBasicMaterial color={VIOLET} transparent opacity={0.6} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Broken arch standing where the crane was. */
function Crane({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color={P.stone} roughness={0.95} />
      </mesh>
      <mesh position={[b.w * 3, b.h * 0.9, 0]} rotation={[0, 0, -0.08]}>
        <boxGeometry args={[b.w * 6, 0.7, 0.9]} />
        <meshStandardMaterial color={P.stoneLight} roughness={0.95} />
      </mesh>
      <mesh position={[b.w * 5.6, b.h * 0.55, 0]}>
        <boxGeometry args={[0.08, b.h * 0.6, 0.08]} />
        <meshBasicMaterial color={VIOLET} transparent opacity={0.6} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Ring of Echoes: a broken circle of glowing stone. */
function Stadium({ b }: { b: BuildingBox }) {
  const segs = 16;
  return (
    <group position={[b.x, 0, b.z]}>
      {Array.from({ length: segs }).map((_, i) => {
        if (i % 5 === 3) return null; // gap in the ring
        const a = (i / segs) * Math.PI * 2;
        const r = b.w / 2;
        const hh = b.h * (0.7 + hash01(i, b.x, 9) * 0.3);
        return (
          <mesh key={i} position={[Math.cos(a) * r, hh / 2, Math.sin(a) * r]} rotation={[0, -a, 0]}>
            <boxGeometry args={[(2 * Math.PI * r) / segs, hh, 3]} />
            <meshStandardMaterial color="#2c312f" emissive={VIOLET} emissiveIntensity={0.18} roughness={0.95} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[b.w / 2 - 3, 24]} />
        <meshStandardMaterial color="#14161a" roughness={1} />
      </mesh>
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[b.w * 0.18, b.w * 0.2, 32]} />
        <meshBasicMaterial color={VIOLET} transparent opacity={0.6} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** The Sanctum. */
function Hospital({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color="#6b706a" roughness={0.9} />
      </mesh>
      {[b.d / 2 + 0.03, -(b.d / 2 + 0.03)].map((zOff, i) => (
        <group key={i} position={[0, b.h * 0.55, zOff]} rotation={[0, i ? Math.PI : 0, 0]}>
          <mesh><ringGeometry args={[0.7, 0.85, 24]} /><meshBasicMaterial color={VIOLET} toneMapped={false} side={THREE.DoubleSide} /></mesh>
          <mesh><circleGeometry args={[0.25, 12]} /><meshBasicMaterial color={GOLD} toneMapped={false} side={THREE.DoubleSide} /></mesh>
        </group>
      ))}
      <mesh position={[0, b.h + 0.25, 0]}>
        <boxGeometry args={[b.w * 1.04, 0.5, b.d * 1.04]} />
        <meshStandardMaterial color={P.ink} roughness={0.9} />
      </mesh>
      <Text position={[0, b.h + 1.8, 0]} fontSize={2.2} color={VIOLET} anchorX="center" anchorY="middle">
        THE SANCTUM
      </Text>
    </group>
  );
}

const HOUSE_WALLS = ["#4a4a44", "#52504a", "#3f4540", "#4c4642", "#46484a"];
const HOUSE_ROOFS = ["#1d1a1c", "#22201f", "#1a1c22", "#26201c"];


/** Ruined cottage: half a roof, a dark arch, one candle-lit window. */
function House({ b }: { b: BuildingBox }) {
  const seed = b.x * 0.41 + b.z * 0.23;
  const wall = HOUSE_WALLS[Math.floor(hash01(b.x, b.z, 3) * 5) % 5];
  const roof = HOUSE_ROOFS[Math.floor(hash01(b.x, b.z, 4) * 4) % 4];
  const hasChimney = hash01(b.x, b.z, 8) > 0.4;
  const floors = Math.max(1, Math.min(2, Math.floor(b.h / 4)));
  const doorW = b.w * 0.2;
  const doorH = Math.min(b.h * 0.42, 2.6);
  const missing = hash01(b.x, b.z, 7) > 0.5 ? 1 : -1;

  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[b.w * 1.04, 0.5, b.d * 1.04]} />
        <meshStandardMaterial color="#26282a" roughness={1} />
      </mesh>
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color={wall} roughness={0.95} />
      </mesh>
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * (b.w / 2 - 0.12), b.h / 2, sz * (b.d / 2 - 0.12)]}>
          <boxGeometry args={[0.26, b.h, 0.26]} />
          <meshStandardMaterial color={roof} roughness={0.9} />
        </mesh>
      ))}
      <WindowGrid
        w={b.w} h={b.h} d={b.d} cols={2} rows={floors}
        color="#0d0b0c" litColor={GOLD} seed={seed} marginY={Math.min(1.4, b.h * 0.2)} litChance={0.72}
      />
      {/* one surviving roof slope */}
      <mesh position={[0, b.h + 0.85, -missing * b.d * 0.26]} rotation={[missing * 0.72, 0, 0]}>
        <boxGeometry args={[b.w * 1.14, 0.22, b.d * 0.72]} />
        <meshStandardMaterial color={roof} roughness={0.9} />
      </mesh>
      <mesh position={[0, b.h + 0.1, 0]}>
        <boxGeometry args={[b.w * 1.1, 0.16, b.d * 1.1]} />
        <meshStandardMaterial color={roof} roughness={0.9} />
      </mesh>
      {hasChimney && (
        <mesh position={[b.w * 0.28, b.h + 1.5, -b.d * 0.2]} rotation={[0, 0, 0.08]}>
          <boxGeometry args={[0.7, 2.2, 0.7]} />
          <meshStandardMaterial color="#2c2a28" roughness={1} />
        </mesh>
      )}
      {/* dark doorway */}
      <mesh position={[0, doorH / 2 + 0.5, b.d / 2 + 0.07]}>
        <boxGeometry args={[doorW + 0.22, doorH + 0.22, 0.1]} />
        <meshStandardMaterial color={roof} roughness={0.85} />
      </mesh>
      <mesh position={[0, doorH / 2 + 0.5, b.d / 2 + 0.14]}>
        <boxGeometry args={[doorW, doorH, 0.08]} />
        <meshBasicMaterial color="#07060a" />
      </mesh>
      <mesh position={[doorW * 0.9, doorH + 0.5, b.d / 2 + 0.16]}>
        <sphereGeometry args={[0.13, 6, 6]} />
        <meshBasicMaterial color={GOLD} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Memory Garden: pale ground, standing stones, a floating orb. */
function Plaza({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[b.w / 2, 24]} />
        <meshStandardMaterial color="#1a2420" roughness={1} />
      </mesh>
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[b.w * 0.16, b.w * 0.18, 28]} />
        <meshBasicMaterial color={VIOLET} transparent opacity={0.55} toneMapped={false} />
      </mesh>
      <mesh position={[0, 3.2, 0]}>
        <icosahedronGeometry args={[0.7, 0]} />
        <meshBasicMaterial color={VIOLET} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.18, 0.28, 2.8, 6]} />
        <meshStandardMaterial color={P.stone} roughness={1} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        const r = b.w / 2 - 1.5;
        const hh = 1.4 + hash01(i, b.x, 14) * 1.8;
        return (
          <mesh key={i} position={[Math.cos(a) * r, hh / 2, Math.sin(a) * r]} rotation={[0, a, (i % 2 ? 1 : -1) * 0.1]}>
            <boxGeometry args={[0.7, hh, 0.5]} />
            <meshStandardMaterial color={P.stoneLight} roughness={1} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Relic bay: arched stone shell with a violet-lit mouth. */
function Hangar({ b }: { b: BuildingBox }) {
  const r = Math.min(b.h, b.w / 2);
  const ribs = 5;
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r, r, b.d, 16, 1, true, 0, Math.PI]} />
        <meshStandardMaterial color="#2d3234" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {Array.from({ length: ribs }).map((_, i) => {
        const z = -b.d / 2 + (b.d / (ribs - 1)) * i;
        return (
          <mesh key={i} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[r + 0.12, r + 0.12, 0.3, 16, 1, true, 0, Math.PI]} />
            <meshStandardMaterial color={P.ink} roughness={0.8} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.02, b.d / 2 + 5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[b.w * 1.2, 10]} />
        <meshStandardMaterial color="#17181b" roughness={1} />
      </mesh>
      <mesh position={[0, r * 0.5, -b.d / 2]}>
        <planeGeometry args={[b.w, r]} />
        <meshStandardMaterial color="#24282a" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, r * 0.5, b.d / 2]}>
        <planeGeometry args={[b.w, r]} />
        <meshStandardMaterial color="#24282a" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, r * 0.34, b.d / 2 + 0.05]}>
        <planeGeometry args={[b.w * 0.66, r * 0.62]} />
        <meshBasicMaterial color="#8a6ac4" transparent opacity={0.35} toneMapped={false} />
      </mesh>
      <mesh position={[0, r + 0.4, 0]}>
        <octahedronGeometry args={[0.35, 0]} />
        <meshBasicMaterial color={VIOLET} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Cathedral of Echoes: stepped spire with gold and violet bands. */
function Casino({ b }: { b: BuildingBox }) {
  const bands = 6;
  return (
    <group>
      <group position={[b.x, 0, b.z]}>
        <mesh position={[0, b.h * 0.06, 0]}>
          <boxGeometry args={[b.w * 1.12, b.h * 0.12, b.d * 1.12]} />
          <meshStandardMaterial color={P.ink} roughness={0.9} />
        </mesh>
        <mesh position={[0, b.h * 0.5, 0]}>
          <boxGeometry args={[b.w, b.h * 0.78, b.d]} />
          <meshStandardMaterial color="#2a2830" emissive={VIOLET} emissiveIntensity={0.12} roughness={0.85} />
        </mesh>
        <mesh position={[0, b.h * 0.94, 0]}>
          <boxGeometry args={[b.w * 0.6, b.h * 0.18, b.d * 0.6]} />
          <meshStandardMaterial color="#34302a" emissive={GOLD} emissiveIntensity={0.18} roughness={0.8} />
        </mesh>
        {Array.from({ length: bands }).map((_, i) => {
          const y = b.h * (0.16 + i * 0.12);
          const c = i % 2 === 0 ? GOLD : VIOLET;
          return (
            <group key={i} position={[0, y, 0]}>
              <mesh position={[0, 0, b.d / 2 + 0.04]}>
                <planeGeometry args={[b.w * 0.88, 0.14]} />
                <meshBasicMaterial color={c} transparent opacity={0.75} toneMapped={false} />
              </mesh>
              <mesh position={[0, 0, -b.d / 2 - 0.04]} rotation={[0, Math.PI, 0]}>
                <planeGeometry args={[b.w * 0.88, 0.14]} />
                <meshBasicMaterial color={c} transparent opacity={0.75} toneMapped={false} />
              </mesh>
              <mesh position={[b.w / 2 + 0.04, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[b.d * 0.88, 0.14]} />
                <meshBasicMaterial color={c} transparent opacity={0.75} toneMapped={false} />
              </mesh>
              <mesh position={[-b.w / 2 - 0.04, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
                <planeGeometry args={[b.d * 0.88, 0.14]} />
                <meshBasicMaterial color={c} transparent opacity={0.75} toneMapped={false} />
              </mesh>
            </group>
          );
        })}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * b.w * 0.24, b.h * 0.09, b.d / 2 + 3.2]}>
            <cylinderGeometry args={[0.2, 0.26, b.h * 0.18, 6]} />
            <meshStandardMaterial color={P.stoneLight} roughness={0.9} />
          </mesh>
        ))}
        <Clock1111 position={[0, b.h * 1.08, 0.3]} scale={Math.max(2.5, b.w / 4)} />
        <mesh position={[0, b.h * 1.22, 0]}>
          <coneGeometry args={[0.5, 3.4, 4]} />
          <meshStandardMaterial color={P.ink} roughness={0.9} />
        </mesh>
        <mesh position={[0, b.h * 1.22 + 2.2, 0]}>
          <octahedronGeometry args={[0.35, 0]} />
          <meshBasicMaterial color={VIOLET} toneMapped={false} />
        </mesh>
      </group>
      <RuinDetails x={b.x} z={b.z} w={b.w} d={b.d} h={b.h} banner />
    </group>
  );
}

/** Shrine of the Warriors: dark tiers with crimson banners. */
function Pagoda({ b }: { b: BuildingBox }) {
  const tiers = 3;
  const tierH = b.h / tiers;
  return (
    <group>
      <group position={[b.x, 0, b.z]}>
        <mesh position={[0, 0.35, 0]}>
          <boxGeometry args={[b.w * 0.92, 0.7, b.d * 0.92]} />
          <meshStandardMaterial color="#24262a" roughness={0.95} />
        </mesh>
        {Array.from({ length: tiers }).map((_, i) => {
          const scale = 1 - i * 0.22;
          const y = tierH * i + tierH * 0.5 + 0.7;
          const halfW = (b.w * scale * 0.7) / 2;
          const halfD = (b.d * scale * 0.7) / 2;
          return (
            <group key={i} position={[0, y, 0]}>
              <mesh>
                <boxGeometry args={[b.w * scale * 0.7, tierH * 0.7, b.d * scale * 0.7]} />
                <meshStandardMaterial color="#2c2a2c" roughness={0.9} />
              </mesh>
              {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz], k) => (
                <mesh key={k} position={[sx * halfW, 0, sz * halfD]}>
                  <boxGeometry args={[0.18, tierH * 0.7, 0.18]} />
                  <meshStandardMaterial color={P.ink} roughness={0.9} />
                </mesh>
              ))}
              <mesh position={[0, 0, halfD + 0.03]}>
                <planeGeometry args={[b.w * scale * 0.4, tierH * 0.32]} />
                <meshBasicMaterial color={GOLD} transparent opacity={0.55} toneMapped={false} />
              </mesh>
              <mesh position={[0, tierH * 0.38, 0]}>
                <boxGeometry args={[b.w * scale * 0.98, 0.16, b.d * scale * 0.98]} />
                <meshStandardMaterial color={P.ink} roughness={0.9} />
              </mesh>
              <mesh position={[0, tierH * 0.55, 0]} rotation={[0, Math.PI / 4, 0]}>
                <coneGeometry args={[b.w * scale * 0.66, 1.0, 4]} />
                <meshStandardMaterial color="#3a2428" roughness={0.9} />
              </mesh>
              {[-1, 1].map((s) => (
                <mesh key={s} position={[s * halfW, tierH * 0.28, halfD]}>
                  <sphereGeometry args={[0.2, 8, 8]} />
                  <meshBasicMaterial color={VIOLET} toneMapped={false} />
                </mesh>
              ))}
            </group>
          );
        })}
        <mesh position={[0, b.h + 1.5, 0]}>
          <cylinderGeometry args={[0.06, 0.16, 1.6, 6]} />
          <meshStandardMaterial color={GOLD} metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[0, b.h * 0.5, b.d / 2 + 0.02]}>
          <planeGeometry args={[b.w * 0.2, b.h * 0.5]} />
          <meshBasicMaterial color="#8a2a3a" toneMapped={false} />
        </mesh>
      </group>
      <RuinDetails x={b.x} z={b.z} w={b.w} d={b.d} h={b.h} banner />
    </group>
  );
}

function Shanty({ b }: { b: BuildingBox }) {
  const lean = (hash01(b.x, b.z, 11) - 0.5) * 0.12;
  const patch = hash01(b.x, b.z, 12) > 0.5;
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color="#3a3b38" roughness={1} />
      </mesh>
      {patch && (
        <mesh position={[b.w * 0.2, b.h * 0.55, b.d / 2 + 0.05]} rotation={[0, 0, 0.15]}>
          <boxGeometry args={[b.w * 0.4, b.h * 0.3, 0.1]} />
          <meshStandardMaterial color="#54524c" roughness={1} />
        </mesh>
      )}
      <mesh position={[-b.w * 0.28, b.h * 0.3, b.d / 2 + 0.05]}>
        <boxGeometry args={[b.w * 0.22, b.h * 0.6, 0.08]} />
        <meshBasicMaterial color="#08070b" />
      </mesh>
      <mesh position={[0, b.h + 0.3, 0]} rotation={[0.1 + lean, 0, lean]}>
        <boxGeometry args={[b.w * 1.15, 0.28, b.d * 1.15]} />
        <meshStandardMaterial color="#4a4d4a" metalness={0.3} roughness={0.9} />
      </mesh>
      <mesh position={[b.w * 0.5, b.h * 0.5, b.d * 0.5]} rotation={[0, 0, 0.18]}>
        <cylinderGeometry args={[0.08, 0.08, b.h, 5]} />
        <meshStandardMaterial color="#22201f" roughness={1} />
      </mesh>
      <mesh position={[0, b.h * 0.55, b.d / 2 + 0.03]}>
        <planeGeometry args={[b.w * 0.2, b.h * 0.22]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.6} toneMapped={false} />
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
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color="#3c3736" roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[b.w * 1.03, 2.2, b.d * 1.03]} />
        <meshStandardMaterial color="#2a2829" roughness={1} />
      </mesh>
      {Array.from({ length: floors - 1 }).map((_, i) => (
        <mesh key={i} position={[0, (i + 1) * (b.h / floors), 0]}>
          <boxGeometry args={[b.w * 1.02, 0.16, b.d * 1.02]} />
          <meshStandardMaterial color={P.ink} roughness={0.9} />
        </mesh>
      ))}
      <WindowGrid
        w={b.w} h={b.h} d={b.d} cols={Math.max(2, Math.floor(b.w / 3.2))} rows={floors}
        color="#0d0b10" litColor={VIOLET} seed={seed} marginY={2.6} litChance={0.7}
      />
      <mesh position={[0, b.h + 0.3, 0]}>
        <boxGeometry args={[b.w * 1.1, 0.6, b.d * 1.1]} />
        <meshStandardMaterial color={P.ink} roughness={0.9} />
      </mesh>
      {Array.from({ length: floors - 1 }).map((_, i) => (
        <mesh key={i} position={[-stoopSide * b.w * 0.28, (i + 1) * (b.h / floors) + 0.4, b.d / 2 + 0.5]}
          rotation={[0, 0, (i % 2 ? 1 : -1) * 0.06]}>
          <boxGeometry args={[b.w * 0.32, 0.1, 1]} />
          <meshStandardMaterial color={P.stoneLight} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[stoopSide * b.w * 0.18, 1.4, b.d / 2 + 0.35]}>
        <boxGeometry args={[b.w * 0.28, 2.8, 0.7]} />
        <meshBasicMaterial color="#08070b" />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[stoopSide * b.w * 0.18, 0.15 + i * 0.3, b.d / 2 + 1.1 + i * 0.4]}>
          <boxGeometry args={[b.w * 0.34, 0.3, 0.5]} />
          <meshStandardMaterial color="#33302f" roughness={1} />
        </mesh>
      ))}
      <mesh position={[stoopSide * b.w * 0.18, 3.1, b.d / 2 + 0.45]}>
        <sphereGeometry args={[0.18, 6, 6]} />
        <meshBasicMaterial color={GOLD} toneMapped={false} />
      </mesh>
    </group>
  );
}
/** The Hall: an obelisk that takes the color of the faction holding the district. */
function Headquarters({ b }: { b: BuildingBox }) {
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null!);
  const flagMat = useRef<THREE.MeshBasicMaterial>(null!);

  useFrame(() => {
    const owner = territoryState.owners[b.district];
    const hasOwner = owner !== null && owner !== undefined;
    const bodyColor = hasOwner ? GANGS[owner].color : "#6a6c72";
    const flagColor = hasOwner ? GANGS[owner].accent : "#b9bac2";
    if (bodyMat.current) bodyMat.current.color.set(bodyColor);
    if (flagMat.current) flagMat.current.color.set(flagColor);
  });

  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[b.w, 0.8, b.d]} />
        <meshStandardMaterial color="#1c1d22" roughness={0.9} />
      </mesh>
      <mesh position={[0, b.h * 0.45, 0]} rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry args={[b.w * 0.14, b.w * 0.24, b.h * 0.9, 4]} />
        <meshStandardMaterial ref={bodyMat} color="#6a6c72" roughness={0.7} metalness={0.15} />
      </mesh>
      <mesh position={[0, b.h * 0.95 + 1.2, 0]}>
        <octahedronGeometry args={[1.1, 0]} />
        <meshBasicMaterial ref={flagMat} color="#b9bac2" toneMapped={false} />
      </mesh>
      <Clock1111 position={[0, b.h * 0.45, b.w * 0.2]} scale={1.4} />
      <Text position={[0, b.h + 4, 0]} fontSize={2} color="#e9e4d8" anchorX="center" anchorY="middle">
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
        case "tower": return <Tower key={i} b={b} />;
        case "warehouse": return <Warehouse key={i} b={b} />;
        case "silo": return <Silo key={i} b={b} />;
        case "bank": return <Bank key={i} b={b} />;
        case "lowrise": return <LowRise key={i} b={b} />;
        case "mall": return <Mall key={i} b={b} />;
        case "harbor": return <Harbor key={i} b={b} />;
        case "crane": return <Crane key={i} b={b} />;
        case "stadium": return <Stadium key={i} b={b} />;
        case "hospital": return <Hospital key={i} b={b} />;
        case "house": return <House key={i} b={b} />;
        case "plaza": return <Plaza key={i} b={b} />;
        case "hangar": return <Hangar key={i} b={b} />;
        case "casino": return <Casino key={i} b={b} />;
        case "pagoda": return <Pagoda key={i} b={b} />;
        case "shanty": return <Shanty key={i} b={b} />;
        case "brownstone": return <Brownstone key={i} b={b} />;
        case "hq": return <Headquarters key={i} b={b} />;
      }
    });
  }, []);

  const groundExtent = (GRID * 2 + 2) * BLOCK_SIZE;
  const roadLen = groundExtent;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[groundExtent, groundExtent]} />
        <meshStandardMaterial color="#17171b" roughness={1} />
      </mesh>

      {/* the Black Tide */}
      <mesh position={[0, 0.03, HARBOR_Z - BLOCK_SIZE * 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[groundExtent, BLOCK_SIZE * 1.4]} />
        <meshStandardMaterial color="#120e26" emissive="#2a1850" emissiveIntensity={0.25} roughness={0.4} />
      </mesh>

      {Array.from({ length: roadCount }).map((_, i) => {
        const p = (i - (roadCount - 1) / 2) * BLOCK_SIZE;
        return (
          <group key={i}>
            <mesh position={[p, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[10, roadLen]} />
              <meshStandardMaterial color="#0c0b10" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.02, p]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} receiveShadow>
              <planeGeometry args={[10, roadLen]} />
              <meshStandardMaterial color="#0c0b10" roughness={0.9} />
            </mesh>
            <mesh position={[p, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.16, roadLen]} />
              <meshBasicMaterial color="#5a4e30" />
            </mesh>
            <mesh position={[0, 0.03, p]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
              <planeGeometry args={[0.16, roadLen]} />
              <meshBasicMaterial color="#5a4e30" />
            </mesh>
          </group>
        );
      })}

      {rendered}

      {DISTRICT_LABELS.map((d, i) => (
        <Text
          key={i}
          position={[d.x, 46, d.z]}
          fontSize={5}
          color={DISTRICT_ACCENT[d.district]}
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