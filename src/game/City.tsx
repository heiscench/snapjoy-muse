import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BUILDINGS, BLOCK_SIZE, GRID, HARBOR_Z, DISTRICT_LABELS, type BuildingBox } from "./worldData";
import { GANGS } from "./gangs";
import { territoryState } from "./territoryState";

const DISTRICT_ACCENT: Record<string, string> = {
  downtown: "#6ab0ff",
  industrial: "#e8c96a",
  stadium: "#7cff9a",
  bank: "#ffd66a",
  shopping: "#ff9ad6",
  harbor: "#6adfff",
  residential: "#ffb86a",
  airport: "#c9d6e8",
  casino: "#ff5c9e",
  chinatown: "#ff6a4a",
  slums: "#c98a4a",
  park: "#8aff6a",
  uptown: "#d6b8ff",
};

/** Deterministic 0..1 hash from world position so detail is stable per building. */
function hash01(x: number, z: number, salt = 0) {
  const v = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
  return v - Math.floor(v);
}

const WINDOW_PLANE = new THREE.PlaneGeometry(1, 1);

/**
 * One InstancedMesh of window quads across the four facades of a box.
 * Purely decorative: never affects footprint or collision. 1 draw call per building.
 */
function WindowGrid({
  w, h, d, cols, rows, color, litColor, seed, marginY = 0.5, opacity = 1,
}: {
  w: number; h: number; d: number; cols: number; rows: number;
  color: string; litColor: string; seed: number; marginY?: number; opacity?: number;
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
          c.push(hash01(along + fi * 3.1, y + seed, seed) > 0.42 ? lit : dark);
        }
      }
    });
    return { matrices: m, colors: c };
  }, [w, h, d, cols, rows, color, litColor, seed, marginY]);

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

function Tower({ b }: { b: BuildingBox }) {
  const seed = b.x * 0.13 + b.z * 0.29;
  const rows = Math.max(4, Math.min(14, Math.floor(b.h / 4)));
  const cols = Math.max(2, Math.min(6, Math.floor(b.w / 3)));
  const crown = hash01(b.x, b.z, 1) > 0.5;
  return (
    <group position={[b.x, 0, b.z]}>
      {/* podium base */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[b.w * 1.06, 2, b.d * 1.06]} />
        <meshStandardMaterial color="#141822" roughness={0.95} />
      </mesh>
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color="#1a1f2b" roughness={0.85} metalness={0.15} />
      </mesh>
      {/* vertical mullions */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (b.w / 2 - 0.3), b.h / 2, b.d / 2 + 0.05]}>
          <boxGeometry args={[0.35, b.h * 0.96, 0.2]} />
          <meshStandardMaterial color="#2c3444" roughness={0.7} />
        </mesh>
      ))}
      <WindowGrid
        w={b.w} h={b.h} d={b.d} cols={cols} rows={rows}
        color="#0e1622" litColor="#9fd0ff" seed={seed} marginY={2.4}
      />
      {/* parapet + crown */}
      <mesh position={[0, b.h + 0.35, 0]}>
        <boxGeometry args={[b.w * 1.04, 0.7, b.d * 1.04]} />
        <meshStandardMaterial color="#202632" roughness={0.9} />
      </mesh>
      {crown ? (
        <mesh position={[0, b.h + 2.6, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 4, 6]} />
          <meshStandardMaterial color="#2a3040" />
        </mesh>
      ) : (
        <mesh position={[0, b.h + 1.4, 0]}>
          <boxGeometry args={[b.w * 0.4, 1.4, b.d * 0.4]} />
          <meshStandardMaterial color="#202632" roughness={0.9} />
        </mesh>
      )}
      {/* aviation light */}
      <mesh position={[0, b.h + (crown ? 4.7 : 2.3), 0]}>
        <sphereGeometry args={[0.22, 6, 6]} />
        <meshBasicMaterial color="#ff4a4a" toneMapped={false} />
      </mesh>
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
        <meshStandardMaterial color="#2a2820" roughness={0.95} />
      </mesh>
      {/* corrugated ribs */}
      {Array.from({ length: ribs }).map((_, i) => (
        <mesh key={i} position={[(i + 0.5) * (b.w / ribs) - b.w / 2, b.h / 2, b.d / 2 + 0.04]}>
          <boxGeometry args={[0.22, b.h * 0.94, 0.14]} />
          <meshStandardMaterial color="#3a382c" roughness={0.9} />
        </mesh>
      ))}
      {/* sawtooth roof */}
      {Array.from({ length: 3 }).map((_, i) => (
        <mesh key={i} position={[0, b.h + 0.5, (i - 1) * (b.d / 3.2)]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[b.w * 0.96, 0.25, b.d / 3.6]} />
          <meshStandardMaterial color="#413d30" metalness={0.35} roughness={0.75} />
        </mesh>
      ))}
      {/* roll-up cargo door */}
      <mesh position={[-b.w * 0.18, b.h * 0.3, b.d / 2 + 0.05]}>
        <boxGeometry args={[b.w * 0.34, b.h * 0.58, 0.12]} />
        <meshStandardMaterial color="#5a4a26" roughness={0.85} />
      </mesh>
      <mesh position={[-b.w * 0.18, b.h * 0.62, b.d / 2 + 0.12]}>
        <planeGeometry args={[b.w * 0.34, 0.18]} />
        <meshBasicMaterial color="#e8a24a" toneMapped={false} />
      </mesh>
      <WindowGrid
        w={b.w} h={b.h} d={b.d} cols={3} rows={1}
        color="#241f14" litColor="#e8a24a" seed={seed} marginY={b.h * 0.72}
      />
      {/* loading dock lip */}
      <mesh position={[-b.w * 0.18, 0.35, b.d / 2 + 0.7]}>
        <boxGeometry args={[b.w * 0.4, 0.7, 1.4]} />
        <meshStandardMaterial color="#1e1c16" roughness={1} />
      </mesh>
    </group>
  );
}


function Silo({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]}>
        <cylinderGeometry args={[b.w / 2, b.w / 2, b.h, 16]} />
        <meshStandardMaterial color="#3a3530" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[0, b.h + 0.6, 0]}>
        <coneGeometry args={[b.w / 2 + 0.4, 1.2, 16]} />
        <meshStandardMaterial color="#2a2620" />
      </mesh>
      <mesh position={[0, b.h * 0.6, b.w / 2 + 0.02]}>
        <planeGeometry args={[0.4, b.h * 0.5]} />
        <meshBasicMaterial color="#e8a24a" />
      </mesh>
    </group>
  );
}

function Bank({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color="#2a2418" emissive="#ffd66a" emissiveIntensity={0.25} roughness={0.7} />
      </mesh>
      <mesh position={[0, b.h + 1, 0]}>
        <boxGeometry args={[b.w * 1.1, 2, b.d * 1.1]} />
        <meshStandardMaterial color="#3a3222" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (b.w / 2 - 1.5), b.h * 0.3, b.d / 2 + 0.5]}>
          <boxGeometry args={[1, b.h * 0.6, 1]} />
          <meshStandardMaterial color="#4a4230" />
        </mesh>
      ))}
    </group>
  );
}

const LOWRISE_FACADES = ["#231a2a", "#2a1c22", "#1e1e2c", "#2c2130"];
const LOWRISE_AWNINGS = ["#ff9ad6", "#6adfff", "#ffd66a", "#7cff9a"];

function LowRise({ b }: { b: BuildingBox }) {
  const seed = b.x * 0.31 + b.z * 0.17;
  const pick = Math.floor(hash01(b.x, b.z, 2) * 4) % 4;
  const rows = Math.max(1, Math.min(4, Math.floor(b.h / 4) - 1));
  const awning = LOWRISE_AWNINGS[Math.floor(hash01(b.x, b.z, 5) * 4) % 4];
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color={LOWRISE_FACADES[pick]} roughness={0.85} />
      </mesh>
      {/* shopfront glazing */}
      <mesh position={[0, 1.6, b.d / 2 + 0.04]}>
        <planeGeometry args={[b.w * 0.9, 2.6]} />
        <meshBasicMaterial color="#ffe4a3" toneMapped={false} />
      </mesh>
      {/* awning */}
      <mesh position={[0, 3.2, b.d / 2 + 0.5]} rotation={[-0.42, 0, 0]}>
        <boxGeometry args={[b.w * 0.94, 0.12, 1.5]} />
        <meshStandardMaterial color={awning} emissive={awning} emissiveIntensity={0.35} roughness={0.6} />
      </mesh>
      {/* neon sign bar */}
      <mesh position={[0, 4.6, b.d / 2 + 0.06]}>
        <boxGeometry args={[b.w * 0.5, 0.5, 0.12]} />
        <meshBasicMaterial color={awning} toneMapped={false} />
      </mesh>
      {rows > 0 && (
        <WindowGrid
          w={b.w} h={b.h} d={b.d} cols={Math.max(2, Math.floor(b.w / 3))} rows={rows}
          color="#151122" litColor="#ffd9a3" seed={seed} marginY={5.4}
        />
      )}
      {/* cornice + rooftop AC */}
      <mesh position={[0, b.h + 0.2, 0]}>
        <boxGeometry args={[b.w * 1.05, 0.4, b.d * 1.05]} />
        <meshStandardMaterial color="#191622" roughness={0.9} />
      </mesh>
      <mesh position={[b.w * 0.2, b.h + 0.9, -b.d * 0.15]}>
        <boxGeometry args={[1.4, 1, 1.2]} />
        <meshStandardMaterial color="#2e2b36" roughness={0.85} />
      </mesh>
    </group>
  );
}


function Mall({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color="#241c2c" emissive="#ff9ad6" emissiveIntensity={0.2} roughness={0.8} />
      </mesh>
      <mesh position={[0, b.h + 0.6, 0]}>
        <boxGeometry args={[b.w * 0.6, 1.2, 1]} />
        <meshBasicMaterial color="#ffd66a" />
      </mesh>
      <mesh position={[0, b.h * 0.45, b.d / 2 + 0.02]}>
        <planeGeometry args={[b.w * 0.85, b.h * 0.6]} />
        <meshBasicMaterial color="#c9f0ff" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

function Harbor({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color="#1a2a30" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Crane({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color="#8a3a1a" />
      </mesh>
      <mesh position={[b.w * 3, b.h * 0.9, 0]}>
        <boxGeometry args={[b.w * 6, 0.6, 0.8]} />
        <meshStandardMaterial color="#8a3a1a" />
      </mesh>
    </group>
  );
}

function Stadium({ b }: { b: BuildingBox }) {
  const segs = 16;
  return (
    <group position={[b.x, 0, b.z]}>
      {Array.from({ length: segs }).map((_, i) => {
        const a = (i / segs) * Math.PI * 2;
        const r = b.w / 2;
        return (
          <mesh key={i} position={[Math.cos(a) * r, b.h / 2, Math.sin(a) * r]} rotation={[0, -a, 0]}>
            <boxGeometry args={[(2 * Math.PI * r) / segs, b.h, 3]} />
            <meshStandardMaterial color="#2a2f2a" emissive="#7cff9a" emissiveIntensity={0.3} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[b.w / 2 - 3, 24]} />
        <meshStandardMaterial color="#0f3a1a" />
      </mesh>
    </group>
  );
}

function Hospital({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color="#e9edf2" roughness={0.8} />
      </mesh>
      {[b.d / 2 + 0.03, -(b.d / 2 + 0.03)].map((zOff, i) => (
        <group key={i} position={[0, b.h * 0.55, zOff]}>
          <mesh><boxGeometry args={[1.6, 0.5, 0.05]} /><meshBasicMaterial color="#ff3b3b" /></mesh>
          <mesh><boxGeometry args={[0.5, 1.6, 0.05]} /><meshBasicMaterial color="#ff3b3b" /></mesh>
        </group>
      ))}
      <Text position={[0, b.h + 1.6, 0]} fontSize={2.2} color="#ff5a5a" anchorX="center" anchorY="middle">
        HOSPITAL
      </Text>
    </group>
  );
}

const HOUSE_WALLS = ["#5a4838", "#6a5340", "#4e4a3c", "#67483a", "#544b44"];
const HOUSE_ROOFS = ["#2a1f18", "#33231c", "#242630", "#3a2418"];
const HOUSE_DOORS = ["#2a1810", "#1d2a30", "#3a1c1c", "#243020"];

function House({ b }: { b: BuildingBox }) {
  const seed = b.x * 0.41 + b.z * 0.23;
  const wall = HOUSE_WALLS[Math.floor(hash01(b.x, b.z, 3) * 5) % 5];
  const roof = HOUSE_ROOFS[Math.floor(hash01(b.x, b.z, 4) * 4) % 4];
  const door = HOUSE_DOORS[Math.floor(hash01(b.x, b.z, 6) * 4) % 4];
  const gableRoof = hash01(b.x, b.z, 7) > 0.45;
  const hasChimney = hash01(b.x, b.z, 8) > 0.4;
  const hasPorch = hash01(b.x, b.z, 9) > 0.5;
  const floors = Math.max(1, Math.min(2, Math.floor(b.h / 4)));
  const doorW = b.w * 0.2;
  const doorH = Math.min(b.h * 0.42, 2.6);

  return (
    <group position={[b.x, 0, b.z]}>
      {/* foundation plinth */}
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[b.w * 1.04, 0.5, b.d * 1.04]} />
        <meshStandardMaterial color="#33302b" roughness={1} />
      </mesh>
      {/* body */}
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color={wall} roughness={0.92} />
      </mesh>
      {/* corner trim boards */}
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * (b.w / 2 - 0.12), b.h / 2, sz * (b.d / 2 - 0.12)]}>
          <boxGeometry args={[0.26, b.h, 0.26]} />
          <meshStandardMaterial color={roof} roughness={0.9} />
        </mesh>
      ))}
      {/* mid-floor belt trim */}
      {floors > 1 && (
        <mesh position={[0, b.h * 0.5, 0]}>
          <boxGeometry args={[b.w * 1.02, 0.18, b.d * 1.02]} />
          <meshStandardMaterial color={roof} roughness={0.9} />
        </mesh>
      )}
      {/* windows */}
      <WindowGrid
        w={b.w} h={b.h} d={b.d} cols={2} rows={floors}
        color="#1a1410" litColor="#ffcf7a" seed={seed} marginY={Math.min(1.4, b.h * 0.2)}
      />
      {/* roof: gable or hip */}
      {gableRoof ? (
        <group position={[0, b.h, 0]}>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0, 0.85, s * b.d * 0.26]} rotation={[s * -0.72, 0, 0]}>
              <boxGeometry args={[b.w * 1.14, 0.22, b.d * 0.72]} />
              <meshStandardMaterial color={roof} roughness={0.88} />
            </mesh>
          ))}
          {/* ridge beam */}
          <mesh position={[0, 1.7, 0]}>
            <boxGeometry args={[b.w * 1.16, 0.2, 0.28]} />
            <meshStandardMaterial color="#1b140f" roughness={0.9} />
          </mesh>
        </group>
      ) : (
        <mesh position={[0, b.h + 0.9, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[b.w * 0.78, 1.9, 4]} />
          <meshStandardMaterial color={roof} roughness={0.88} />
        </mesh>
      )}
      {/* eaves overhang */}
      <mesh position={[0, b.h + 0.08, 0]}>
        <boxGeometry args={[b.w * 1.12, 0.16, b.d * 1.12]} />
        <meshStandardMaterial color={roof} roughness={0.9} />
      </mesh>
      {hasChimney && (
        <mesh position={[b.w * 0.28, b.h + 1.5, -b.d * 0.2]}>
          <boxGeometry args={[0.7, 2.2, 0.7]} />
          <meshStandardMaterial color="#3a2c24" roughness={1} />
        </mesh>
      )}
      {/* door with frame + step + lamp */}
      <mesh position={[0, doorH / 2 + 0.5, b.d / 2 + 0.06]}>
        <boxGeometry args={[doorW + 0.22, doorH + 0.22, 0.1]} />
        <meshStandardMaterial color={roof} roughness={0.85} />
      </mesh>
      <mesh position={[0, doorH / 2 + 0.5, b.d / 2 + 0.13]}>
        <boxGeometry args={[doorW, doorH, 0.08]} />
        <meshStandardMaterial color={door} roughness={0.7} />
      </mesh>
      <mesh position={[doorW * 0.3, doorH * 0.55, b.d / 2 + 0.2]}>
        <sphereGeometry args={[0.07, 6, 6]} />
        <meshStandardMaterial color="#c9a24a" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[doorW * 0.9, doorH + 0.5, b.d / 2 + 0.16]}>
        <sphereGeometry args={[0.16, 6, 6]} />
        <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.55, b.d / 2 + 0.6]}>
        <boxGeometry args={[doorW + 0.8, 0.2, 1]} />
        <meshStandardMaterial color="#3b3833" roughness={1} />
      </mesh>
      {hasPorch && (
        <group>
          <mesh position={[0, doorH + 1.0, b.d / 2 + 0.9]}>
            <boxGeometry args={[b.w * 0.62, 0.16, 1.9]} />
            <meshStandardMaterial color={roof} roughness={0.9} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * b.w * 0.26, (doorH + 1) / 2, b.d / 2 + 1.7]}>
              <cylinderGeometry args={[0.1, 0.1, doorH + 1, 6]} />
              <meshStandardMaterial color={wall} roughness={0.9} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}


function Plaza({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[b.w / 2, 20]} />
        <meshStandardMaterial color="#14361f" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 3, 8]} />
        <meshStandardMaterial color="#2a2a30" />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        const r = b.w / 2 - 1.5;
        return (
          <mesh key={i} position={[Math.cos(a) * r, 1, Math.sin(a) * r]}>
            <sphereGeometry args={[0.8, 8, 8]} />
            <meshStandardMaterial color="#0f3a1a" />
          </mesh>
        );
      })}
    </group>
  );
}

function Hangar({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[b.h / 2, b.h / 2, b.w, 12, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#3a3f45" metalness={0.3} roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, b.h * 0.35, b.d / 2 - 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[b.h * 0.32, b.h * 0.32, 0.4, 12, 1, false, 0, Math.PI]} />
        <meshBasicMaterial color="#8ac9ff" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

function Casino({ b }: { b: BuildingBox }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color="#241018" emissive="#ff5c9e" emissiveIntensity={0.4} roughness={0.6} />
      </mesh>
      {Array.from({ length: 4 }).map((_, i) => (
        <mesh key={i} position={[0, b.h * (0.2 + i * 0.2), b.d / 2 + 0.03]}>
          <planeGeometry args={[b.w * 0.85, 0.3]} />
          <meshBasicMaterial color="#ffe36a" />
        </mesh>
      ))}
      <mesh position={[0, b.h + 1, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 2, 8]} />
        <meshBasicMaterial color="#ff5c9e" />
      </mesh>
    </group>
  );
}

function Pagoda({ b }: { b: BuildingBox }) {
  const tiers = 3;
  return (
    <group position={[b.x, 0, b.z]}>
      {Array.from({ length: tiers }).map((_, i) => {
        const scale = 1 - i * 0.22;
        const y = (b.h / tiers) * i + (b.h / tiers) * 0.5;
        return (
          <group key={i} position={[0, y, 0]}>
            <mesh>
              <boxGeometry args={[b.w * scale * 0.7, b.h / tiers * 0.7, b.d * scale * 0.7]} />
              <meshStandardMaterial color="#5a1e18" roughness={0.7} />
            </mesh>
            <mesh position={[0, b.h / tiers * 0.42, 0]}>
              <coneGeometry args={[b.w * scale * 0.62, 0.9, 4]} />
              <meshStandardMaterial color="#8a2a1a" />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, b.h * 0.5, b.d / 2 + 0.02]}>
        <planeGeometry args={[b.w * 0.3, b.h * 0.5]} />
        <meshBasicMaterial color="#ff6a4a" />
      </mesh>
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
        <meshStandardMaterial color="#4a3f30" roughness={1} />
      </mesh>
      {/* mismatched plank patches */}
      {patch && (
        <mesh position={[b.w * 0.2, b.h * 0.55, b.d / 2 + 0.05]} rotation={[0, 0, 0.15]}>
          <boxGeometry args={[b.w * 0.4, b.h * 0.3, 0.1]} />
          <meshStandardMaterial color="#6a5a44" roughness={1} />
        </mesh>
      )}
      <mesh position={[-b.w * 0.28, b.h * 0.3, b.d / 2 + 0.05]}>
        <boxGeometry args={[b.w * 0.22, b.h * 0.6, 0.08]} />
        <meshStandardMaterial color="#33291f" roughness={1} />
      </mesh>
      {/* corrugated tin roof, leaning */}
      <mesh position={[0, b.h + 0.3, 0]} rotation={[0.1 + lean, 0, lean]}>
        <boxGeometry args={[b.w * 1.15, 0.28, b.d * 1.15]} />
        <meshStandardMaterial color="#5a5248" metalness={0.55} roughness={0.8} />
      </mesh>
      {/* weight blocks on roof */}
      <mesh position={[b.w * 0.2, b.h + 0.65, b.d * 0.15]}>
        <boxGeometry args={[0.5, 0.4, 0.5]} />
        <meshStandardMaterial color="#3b352c" roughness={1} />
      </mesh>
      {/* lean-to prop pole */}
      <mesh position={[b.w * 0.5, b.h * 0.5, b.d * 0.5]} rotation={[0, 0, 0.18]}>
        <cylinderGeometry args={[0.08, 0.08, b.h, 5]} />
        <meshStandardMaterial color="#2e2820" roughness={1} />
      </mesh>
      <mesh position={[0, b.h * 0.55, b.d / 2 + 0.03]}>
        <planeGeometry args={[b.w * 0.26, b.h * 0.26]} />
        <meshBasicMaterial color="#ffcf7a" toneMapped={false} />
      </mesh>
    </group>
  );
}


function Brownstone({ b }: { b: BuildingBox }) {
  const floors = Math.max(2, Math.floor(b.h / 4));
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color="#5a3a2a" roughness={0.85} />
      </mesh>
      {Array.from({ length: floors }).map((_, i) => (
        <mesh key={i} position={[0, (i + 0.5) * (b.h / floors), b.d / 2 + 0.02]}>
          <planeGeometry args={[b.w * 0.8, b.h / floors * 0.55]} />
          <meshBasicMaterial color="#d6b8ff" transparent opacity={0.55} />
        </mesh>
      ))}
      <mesh position={[0, 1.4, b.d / 2 + 0.4]}>
        <boxGeometry args={[b.w * 0.3, 2.8, 0.8]} />
        <meshStandardMaterial color="#3a2418" />
      </mesh>
    </group>
  );
}

function Headquarters({ b }: { b: BuildingBox }) {
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null!);
  const flagMat = useRef<THREE.MeshBasicMaterial>(null!);

  useFrame(() => {
    const owner = territoryState.owners[b.district];
    const hasOwner = owner !== null && owner !== undefined;
    const bodyColor = hasOwner ? GANGS[owner].color : "#7a7a82";
    const flagColor = hasOwner ? GANGS[owner].accent : "#c9c9d0";
    if (bodyMat.current) bodyMat.current.color.set(bodyColor);
    if (flagMat.current) flagMat.current.color.set(flagColor);
  });

  return (
    <group position={[b.x, 0, b.z]}>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[b.w, 0.8, b.d]} />
        <meshStandardMaterial color="#232328" roughness={0.85} />
      </mesh>
      <mesh position={[0, b.h * 0.45, 0]}>
        <boxGeometry args={[b.w * 0.4, b.h * 0.8, b.d * 0.4]} />
        <meshStandardMaterial ref={bodyMat} color="#7a7a82" roughness={0.55} metalness={0.2} />
      </mesh>
      <mesh position={[0, b.h + 0.6, 0]}>
        <coneGeometry args={[b.w * 0.3, 2, 4]} />
        <meshStandardMaterial color="#181820" />
      </mesh>
      <mesh position={[b.w * 0.28, b.h * 0.55, 0]}>
        <cylinderGeometry args={[0.12, 0.12, b.h * 1.1, 6]} />
        <meshStandardMaterial color="#0f0f12" />
      </mesh>
      <mesh position={[b.w * 0.28 + 0.9, b.h * 0.9, 0]}>
        <planeGeometry args={[1.8, 1.1]} />
        <meshBasicMaterial ref={flagMat} color="#c9c9d0" side={THREE.DoubleSide} />
      </mesh>
      <Text position={[0, b.h + 3.2, 0]} fontSize={2} color="#ffffff" anchorX="center" anchorY="middle">
        HEADQUARTERS
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
        <meshStandardMaterial color="#0a0b10" roughness={1} />
      </mesh>

      <mesh position={[0, 0.03, HARBOR_Z - BLOCK_SIZE * 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[groundExtent, BLOCK_SIZE * 1.4]} />
        <meshStandardMaterial color="#0d2a3f" emissive="#0a1a30" emissiveIntensity={0.2} roughness={0.4} />
      </mesh>

      {Array.from({ length: roadCount }).map((_, i) => {
        const p = (i - (roadCount - 1) / 2) * BLOCK_SIZE;
        return (
          <group key={i}>
            <mesh position={[p, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[10, roadLen]} />
              <meshStandardMaterial color="#04050a" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.02, p]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} receiveShadow>
              <planeGeometry args={[10, roadLen]} />
              <meshStandardMaterial color="#04050a" roughness={0.7} />
            </mesh>
            <mesh position={[p, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.2, roadLen]} />
              <meshBasicMaterial color="#e8c96a" />
            </mesh>
            <mesh position={[0, 0.03, p]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
              <planeGeometry args={[0.2, roadLen]} />
              <meshBasicMaterial color="#e8c96a" />
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