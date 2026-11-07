import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Component, Suspense, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { anyModelUrl } from "../assets/manifestExtra";
import { BUILDINGS, BLOCK_SIZE, type BuildingBox } from "../worldData";
import { KIT_IDS, STOREY_H, buildHouseLocal, roofRise, yardLayout, type Piece } from "./houseKit";
import { Yardwork } from "./Yardwork";

// Village cottages of the Kings' district.
//  - Far away: every cottage is a simple coloured box + pyramid roof, all merged into ONE mesh.
//  - Close (a block within NEAR metres of the camera): the real kit pieces (cottages, fences, trees,
//    barrels...), baked into a few merged meshes (one per texture) and kept in a cache so walking
//    back costs nothing.
//  - Wells and hay bales are always shown (see Yardwork).

const NEAR = 120;

type Block = { key: string; cx: number; cz: number; houses: BuildingBox[] };

function groupBlocks(houses: BuildingBox[]): Block[] {
  const m = new Map<string, Block>();
  for (const h of houses) {
    const gx = Math.round(h.x / BLOCK_SIZE);
    const gz = Math.round(h.z / BLOCK_SIZE);
    const key = `${gx},${gz}`;
    let b = m.get(key);
    if (!b) {
      b = { key, cx: gx * BLOCK_SIZE, cz: gz * BLOCK_SIZE, houses: [] };
      m.set(key, b);
    }
    b.houses.push(h);
  }
  return [...m.values()];
}

// ---- Far version ------------------------------------------------------------------------
const WALL_COL = new THREE.Color("#d9c9a8");
const ROOF_COL = new THREE.Color("#b5563a");

function colored(g: THREE.BufferGeometry, c: THREE.Color) {
  for (const n of Object.keys(g.attributes)) {
    if (n !== "position" && n !== "normal") g.deleteAttribute(n);
  }
  const count = g.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}

function silhouette(houses: BuildingBox[]): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (const h of houses) {
    const c = h.cottage;
    if (!c) continue;
    const wallH = c.storeys * STOREY_H;
    const rise = roofRise(c.W);
    q.setFromAxisAngle(up, c.rot);
    m.compose(new THREE.Vector3(h.x, 0, h.z), q, new THREE.Vector3(1, 1, 1));
    // Slightly smaller than the real walls so the detailed version covers it when close.
    const wall = new THREE.BoxGeometry(c.W - 0.6, wallH, c.D - 0.6);
    wall.translate(0, wallH / 2, 0);
    const roof = new THREE.ConeGeometry(1, 1, 4, 1);
    roof.rotateY(Math.PI / 4);
    roof.scale((c.W + 0.4) / Math.SQRT2, rise, (c.D + 0.4) / Math.SQRT2);
    roof.translate(0, wallH + rise / 2, 0);
    for (const g of [colored(wall, WALL_COL), colored(roof, ROOF_COL)]) {
      g.applyMatrix4(m);
      parts.push(g);
    }
  }
  if (!parts.length) return null;
  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  return merged;
}

function Silhouettes({ houses }: { houses: BuildingBox[] }) {
  const geo = useMemo(() => silhouette(houses), [houses]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), []);
  if (!geo) return null;
  return <mesh geometry={geo} material={mat} />;
}

// ---- Close version ----------------------------------------------------------------------
type BakedMesh = { geometry: THREE.BufferGeometry; material: THREE.Material };
const matCache = new Map<string, THREE.Material>();
const blockCache = new Map<string, BakedMesh[]>();
const measureCache = new Map<string, { h: number; len: number; minY: number }>();
const uvTmp = new THREE.Vector2();

/** Pieces that use the same texture share one mesh. */
function materialKey(mat: THREE.Material) {
  const m = mat as THREE.MeshStandardMaterial;
  const img = m.map?.image as { width?: number; height?: number } | undefined;
  return [mat.type, m.map?.name ?? "", img?.width ?? 0, img?.height ?? 0, m.color ? m.color.getHexString() : ""].join("|");
}

function sliceGroup(g: THREE.BufferGeometry, start: number, count: number) {
  const out = g.clone();
  out.clearGroups();
  if (g.index) out.setIndex(Array.from(g.index.array as ArrayLike<number>).slice(start, start + count));
  return out;
}

function sharedMaterial(key: string, mat: THREE.Material): THREE.Material {
  let m = matCache.get(key);
  if (!m) {
    const c = mat.clone() as THREE.MeshStandardMaterial;
    const map = (mat as THREE.MeshStandardMaterial).map;
    if (map) {
      c.map = map.clone();
      c.map.offset.set(0, 0);
      c.map.repeat.set(1, 1);
      c.map.rotation = 0;
      c.map.center.set(0, 0);
      c.map.needsUpdate = true;
    }
    m = c;
    matCache.set(key, m);
  }
  return m;
}

/** Real size of a model (used to scale pieces from kits whose size is unknown). */
function measure(id: string, scene: THREE.Object3D) {
  let m = measureCache.get(id);
  if (!m) {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    m = { h: size.y || 1, len: Math.max(size.x, size.z) || 1, minY: box.min.y };
    measureCache.set(id, m);
  }
  return m;
}

function bakeBlock(block: Block, scenes: Map<string, THREE.Object3D>): BakedMesh[] {
  // World placements of every piece of every cottage in this block, plus the yard (trees, rocks).
  const placements: Piece[] = [];
  for (const h of block.houses) {
    const c = h.cottage;
    if (!c) continue;
    const cs = Math.cos(c.rot);
    const sn = Math.sin(c.rot);
    for (const p of buildHouseLocal(c)) {
      placements.push({
        ...p,
        x: h.x + p.x * cs + p.z * sn,
        z: h.z - p.x * sn + p.z * cs,
        rotY: p.rotY + c.rot,
      });
    }
  }
  const gx = Math.round(block.cx / BLOCK_SIZE);
  const gz = Math.round(block.cz / BLOCK_SIZE);
  placements.push(...yardLayout(gx, gz, block.cx, block.cz, block.houses).trees);

  const buckets = new Map<string, { geoms: THREE.BufferGeometry[]; material: THREE.Material }>();
  const placeM = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const axisY = new THREE.Vector3(0, 1, 0);

  for (const p of placements) {
    const scene = scenes.get(p.id);
    if (!scene) continue;

    let sx = p.sx, sy = p.sy, sz = p.sz, py = p.y;
    if (p.fit) {
      const m = measure(p.id, scene);
      const k = p.fit.size / (p.fit.axis === "h" ? m.h : m.len);
      sx = sy = sz = k;
      py = p.y - m.minY * k; // stand on the ground
    }
    q.setFromAxisAngle(axisY, p.rotY);
    placeM.compose(new THREE.Vector3(p.x, py, p.z), q, new THREE.Vector3(sx, sy, sz));
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

        const map = (mat as THREE.MeshStandardMaterial).map;
        const uv = g.attributes.uv;
        if (uv && map) {
          map.updateMatrix();
          const arr = new Float32Array(uv.count * 2);
          for (let i = 0; i < uv.count; i++) {
            uvTmp.set(uv.getX(i), uv.getY(i)).applyMatrix3(map.matrix);
            arr[i * 2] = uvTmp.x;
            arr[i * 2 + 1] = uvTmp.y;
          }
          g.setAttribute("uv", new THREE.BufferAttribute(arr, 2));
        }

        g.applyMatrix4(placeM.clone().multiply(mesh.matrixWorld));

        const key = materialKey(mat);
        let bucket = buckets.get(key);
        if (!bucket) {
          bucket = { geoms: [], material: sharedMaterial(key, mat) };
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
  return result;
}

function BlockMesh({ block, scenes }: { block: Block; scenes: Map<string, THREE.Object3D> }) {
  const baked = useMemo(() => {
    let b = blockCache.get(block.key);
    if (!b) {
      b = bakeBlock(block, scenes);
      blockCache.set(block.key, b);
    }
    return b;
  }, [block, scenes]);
  return (
    <>
      {baked.map((k, i) => (
        <mesh key={i} geometry={k.geometry} material={k.material} />
      ))}
    </>
  );
}

function NearBlocks({ blocks }: { blocks: Block[] }) {
  const gltfs = useGLTF(KIT_IDS.map(anyModelUrl)) as unknown as { scene: THREE.Group }[];
  const sceneKey = gltfs.map((g) => g.scene.uuid).join();
  const scenes = useMemo(() => {
    const m = new Map<string, THREE.Object3D>();
    KIT_IDS.forEach((id, i) => m.set(id, gltfs[i].scene));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey]);
  const byKey = useMemo(() => new Map(blocks.map((b) => [b.key, b])), [blocks]);

  const [near, setNear] = useState<string[]>([]);
  const last = useRef("");
  const clock = useRef(0);
  useFrame(({ camera }, dt) => {
    clock.current += dt;
    if (clock.current < 0.25) return;
    clock.current = 0;
    const keys = blocks
      .filter((b) => Math.hypot(b.cx - camera.position.x, b.cz - camera.position.z) < NEAR)
      .map((b) => b.key)
      .sort();
    const s = keys.join("|");
    if (s !== last.current) {
      last.current = s;
      setNear(keys);
    }
  });

  return (
    <>
      {near.map((k) => {
        const b = byKey.get(k);
        return b ? <BlockMesh key={k} block={b} scenes={scenes} /> : null;
      })}
    </>
  );
}

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn("[village] detailed cottages unavailable, showing simple ones:", e); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** All cottages of the Kings' district. */
export function VillageBlocks() {
  const houses = useMemo(() => BUILDINGS.filter((b) => b.cottage), []);
  const blocks = useMemo(() => groupBlocks(houses), [houses]);
  if (!houses.length) return null;
  return (
    <>
      <Silhouettes houses={houses} />
      <Yardwork blocks={blocks} />
      <Boundary>
        <Suspense fallback={null}>
          <NearBlocks blocks={blocks} />
        </Suspense>
      </Boundary>
    </>
  );
}
