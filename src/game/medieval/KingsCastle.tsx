import { Text, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { modelUrl } from "../assets/manifest";
import { themeOf } from "../city/palette";
import { PLANE } from "../city/parts";
import { GANGS } from "../gangs";
import { territoryState } from "../territoryState";
import { KINGS_CASTLE_H, type BuildingBox } from "../worldData";

// Kenney pieces are 1x1 tiles centred on their origin. 5 x 5 tiles of 3.2 m = the 16 m Hall block.
const TILE = 3.2;
const SIDE = 5;
const MID = (SIDE - 1) / 2;
const TOWER_H = 11;
const KEEP_H = KINGS_CASTLE_H;
const KEEP_FOOTPRINT = 2.5; // keep is 2.5 tiles wide (8 m)
// If the gate faces INTO the courtyard, change this to Math.PI.
const FACE_OFFSET = 0;

const WALL_A = "wall-fortified";
const WALL_B = "wall-fortified-window";
const GATE = "wall-fortified-gate";
const TOWER_STACK = ["tower-square-base", "tower-square-mid-windows", "tower-square-top-roof-high"];
const KEEP_STACK = [
  "tower-square-base-border",
  "tower-square-mid-windows",
  "tower-square-mid-windows",
  "tower-square-top-roof-high-windows",
];
const ALL_IDS = Array.from(new Set([WALL_A, WALL_B, GATE, ...TOWER_STACK, ...KEEP_STACK]));

// Add ?oldhall=1 to the address to see the old Hall (for comparing fps).
const OLD_HALL = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("oldhall");

type Placement = {
  id: string; x: number; y: number; z: number; rotY: number; sx: number; sy: number; sz: number;
};

function stack(
  ids: string[], x: number, z: number, footprint: number, targetH: number,
  heightOf: (id: string) => number, out: Placement[],
) {
  const natural = ids.reduce((s, id) => s + heightOf(id), 0);
  const sy = targetH / natural;
  let y = 0;
  for (const id of ids) {
    out.push({ id, x, y, z, rotY: 0, sx: footprint, sy, sz: footprint });
    y += heightOf(id) * sy;
  }
}

function layout(heightOf: (id: string) => number): Placement[] {
  const out: Placement[] = [];
  for (let i = 0; i < SIDE; i++) {
    for (let j = 0; j < SIDE; j++) {
      const edgeI = i === 0 || i === SIDE - 1;
      const edgeJ = j === 0 || j === SIDE - 1;
      if (!edgeI && !edgeJ) continue;
      const x = (i - MID) * TILE;
      const z = (j - MID) * TILE;
      if (edgeI && edgeJ) {
        stack(TOWER_STACK, x, z, TILE, TOWER_H, heightOf, out);
        continue;
      }
      // Outward direction: south (+z) = 0, north = PI, east (+x) = PI/2, west = -PI/2.
      let rotY = 0;
      if (j === SIDE - 1) rotY = 0;
      else if (j === 0) rotY = Math.PI;
      else if (i === SIDE - 1) rotY = Math.PI / 2;
      else rotY = -Math.PI / 2;
      const isGate = j === SIDE - 1 && i === MID;
      const id = isGate ? GATE : (i + j) % 2 ? WALL_B : WALL_A;
      out.push({ id, x, y: 0, z, rotY: rotY + FACE_OFFSET, sx: TILE, sy: TILE, sz: TILE });
    }
  }
  stack(KEEP_STACK, 0, 0, TILE * KEEP_FOOTPRINT, KEEP_H, heightOf, out);
  return out;
}

const uvTmp = new THREE.Vector2();

type Bucket = { geoms: THREE.BufferGeometry[]; material: THREE.Material };
type BakedMesh = { geometry: THREE.BufferGeometry; material: THREE.Material };

/** Pieces that use the same texture land in the same bucket and become one mesh. */
function materialKey(mat: THREE.Material) {
  const m = mat as THREE.MeshBasicMaterial;
  const img = m.map?.image as { width?: number; height?: number } | undefined;
  return [mat.type, m.map?.name ?? "", img?.width ?? 0, img?.height ?? 0, m.color ? m.color.getHexString() : ""].join("|");
}

/** One material's share of a mesh. glTF files with several materials store them as index ranges (groups). */
function sliceGroup(g: THREE.BufferGeometry, start: number, count: number) {
  const out = g.clone();
  out.clearGroups();
  if (g.index) {
    out.setIndex(Array.from(g.index.array as ArrayLike<number>).slice(start, start + count));
  }
  return out;
}

/**
 * Bakes every piece into a few merged meshes, ONE PER TEXTURE.
 * Wall pieces use tiled planks / cobblestone / brick textures while towers use the colour palette,
 * so they cannot share one material. Each piece's own texture offset is baked into its UVs first.
 */
function bake(scenes: Map<string, THREE.Object3D>, placements: Placement[]): BakedMesh[] {
  const buckets = new Map<string, Bucket>();
  const placeM = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const axisY = new THREE.Vector3(0, 1, 0);

  for (const p of placements) {
    const scene = scenes.get(p.id);
    if (!scene) continue;
    q.setFromAxisAngle(axisY, p.rotY);
    placeM.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.sx, p.sy, p.sz));
    scene.updateMatrixWorld(true);

    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const base = mesh.geometry;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

      const parts: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
      if (Array.isArray(mesh.material) && base.groups.length > 0) {
        for (const grp of base.groups) {
          parts.push({ geo: sliceGroup(base, grp.start, grp.count), mat: mats[grp.materialIndex ?? 0] });
        }
      } else {
        parts.push({ geo: base.clone(), mat: mats[0] });
      }

      for (const { geo: g, mat } of parts) {
        for (const name of Object.keys(g.attributes)) {
          if (name !== "position" && name !== "normal" && name !== "uv") g.deleteAttribute(name);
        }
        if (!g.attributes.normal) g.computeVertexNormals();

        const map = (mat as THREE.MeshBasicMaterial).map;
        const uv = g.attributes.uv;
        if (uv && map) {
          map.updateMatrix();
          const out = new Float32Array(uv.count * 2);
          for (let i = 0; i < uv.count; i++) {
            uvTmp.set(uv.getX(i), uv.getY(i)).applyMatrix3(map.matrix);
            out[i * 2] = uvTmp.x;
            out[i * 2 + 1] = uvTmp.y;
          }
          g.setAttribute("uv", new THREE.BufferAttribute(out, 2));
        }

        g.applyMatrix4(placeM.clone().multiply(mesh.matrixWorld));

        const key = materialKey(mat);
        let bucket = buckets.get(key);
        if (!bucket) {
          const m = mat.clone() as THREE.MeshBasicMaterial;
          if (map) {
            m.map = map.clone();
            m.map.offset.set(0, 0);
            m.map.repeat.set(1, 1);
            m.map.rotation = 0;
            m.map.center.set(0, 0);
            m.map.needsUpdate = true;
          }
          bucket = { geoms: [], material: m };
          buckets.set(key, bucket);
        }
        bucket.geoms.push(g);
      }
    });
  }

  const result: BakedMesh[] = [];
  buckets.forEach((b) => {
    const geometry = mergeGeometries(b.geoms, false);
    b.geoms.forEach((g) => g.dispose());
    if (geometry) result.push({ geometry, material: b.material });
  });
  if (result.length === 0) throw new Error("[castle] could not merge the castle pieces");
  return result;
}

function CastleKit({ b }: { b: BuildingBox }) {
  const gltfs = useGLTF(ALL_IDS.map(modelUrl)) as unknown as { scene: THREE.Group }[];
  const key = gltfs.map((g) => g.scene.uuid).join();

  const kit = useMemo(() => {
    const scenes = new Map<string, THREE.Object3D>();
    ALL_IDS.forEach((id, i) => scenes.set(id, gltfs[i].scene));
    const heightOf = (id: string) => {
      const s = scenes.get(id)!;
      s.updateMatrixWorld(true);
      return new THREE.Box3().setFromObject(s).max.y || 1;
    };
    return bake(scenes, layout(heightOf));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => () => kit.forEach((k) => k.geometry.dispose()), [kit]);

  const theme = themeOf(b.district);
  const clothMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: theme.cloth, roughness: 1, side: THREE.DoubleSide }),
    [theme],
  );
  const crystalMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: theme.glow, toneMapped: false }),
    [theme],
  );

  // Banners and crystal take the colour of whichever kingdom owns the Hall, like before.
  useFrame(() => {
    const owner = territoryState.owners[b.district];
    const g = owner !== null && owner !== undefined ? GANGS[owner] : null;
    clothMat.color.set(g ? g.color : theme.cloth);
    crystalMat.color.set(g ? g.accent : theme.glow);
  });

  const gateZ = MID * TILE + TILE / 2 + 0.1;
  return (
    <group position={[b.x, 0, b.z]}>
      {kit.map((k, i) => (
        <mesh key={i} geometry={k.geometry} material={k.material} />
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={PLANE} material={clothMat}
          position={[s * TILE * 1.5, 2.6, gateZ]} scale={[1.4, 3.4, 1]} />
      ))}
      <mesh position={[0, KEEP_H + 3, 0]} material={crystalMat}>
        <octahedronGeometry args={[0.9, 0]} />
      </mesh>
      <Text position={[0, KEEP_H + 6.5, 0]} fontSize={2} color="#ffffff" outlineWidth={0.14}
        outlineColor="#2a2530" anchorX="center" anchorY="middle">
        THE HALL
      </Text>
    </group>
  );
}

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn("[castle] using the old Hall instead:", e); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** The Kings' Hall as a castle. While loading, or if anything fails, the old Hall is shown. */
export function KingsCastle({ b, fallback }: { b: BuildingBox; fallback: ReactNode }) {
  if (OLD_HALL) return <>{fallback}</>;
  return (
    <Boundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <CastleKit b={b} />
      </Suspense>
    </Boundary>
  );
}