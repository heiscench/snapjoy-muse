import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Component, Suspense, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BLOCK_SIZE, BUILDINGS, districtAt } from "../worldData";
import { autumnAt, forestAt, groundHeight, isVillageBlock, roadDistance } from "../terrain";
import { ROAD_W } from "../city/layout";
import { hash01, themeOf } from "../city/palette";

// The living landscape: pines, trees, bushes, ferns, grass, flowers, mushrooms, mossy boulders,
// pebbles and stone edging along the trails, all from the Stylized Nature kit.
// Each kingdom is its own biome: Kings = green meadow with pines, Warriors = red-orange autumn,
// Outcasts = dense deep forest with ferns and mushrooms, Monsters = sparse dry land with dead trees.
// Only what is near you is drawn: the world around the camera is rebuilt as you move, using a few
// instanced meshes per plant type, so thousands of plants cost only a few dozen draw calls.

type GroupKey = "tree" | "bush" | "plant" | "grass" | "flower" | "rock" | "mush" | "pebble" | "edgestone";

type Group = {
  cell: number; // size of one placement cell (m)
  radius: number; // drawn within this distance of the camera (m)
  cap: number; // most instances of one plant type
  roadPad: number; // keep this far from the trail edge (m)
  rectPad: number; // keep this far from buildings (m)
  salt: number;
  prob: (x: number, z: number, forest: number) => number;
  edge?: boolean; // only along the trail edge
};

const HALF_ROAD = ROAD_W / 2;

const GROUPS: Record<GroupKey, Group> = {
  tree: { cell: 14, radius: 110, cap: 90, roadPad: 3.0, rectPad: 6.0, salt: 10, prob: (_x, _z, f) => 0.12 + 0.6 * f },
  bush: { cell: 8, radius: 65, cap: 70, roadPad: 1.4, rectPad: 2.5, salt: 20, prob: (_x, _z, f) => 0.2 + 0.3 * f },
  plant: { cell: 6, radius: 50, cap: 120, roadPad: 0.6, rectPad: 1.5, salt: 30, prob: (_x, _z, f) => 0.28 + 0.3 * f },
  grass: { cell: 2.4, radius: 34, cap: 520, roadPad: 0.2, rectPad: 0.8, salt: 40, prob: () => 0.85 },
  flower: {
    cell: 5, radius: 46, cap: 130, roadPad: 0.4, rectPad: 1.0, salt: 50,
    prob: (x, z) => (0.5 + 0.5 * Math.sin(x * 0.045 + z * 0.031) * Math.cos(z * 0.052 - x * 0.02) > 0.62 ? 0.8 : 0.1),
  },
  rock: { cell: 16, radius: 80, cap: 40, roadPad: 1.5, rectPad: 3.5, salt: 60, prob: (_x, _z, f) => 0.22 + 0.2 * f },
  mush: { cell: 9, radius: 46, cap: 40, roadPad: 0.8, rectPad: 1.5, salt: 70, prob: (_x, _z, f) => (f > 0.45 ? 0.35 : 0.02) },
  pebble: { cell: 3, radius: 44, cap: 160, roadPad: 0, rectPad: 0.5, salt: 80, prob: () => 1, edge: true },
  edgestone: { cell: 7, radius: 60, cap: 60, roadPad: 0, rectPad: 0.5, salt: 90, prob: () => 0.55, edge: true },
};

// How much of each group a kingdom's biome has (1 = the Kings' meadow).
const KINGDOM_MULT: Record<number, Partial<Record<GroupKey, number>>> = {
  0: {},
  1: { tree: 0.8, bush: 1.3, plant: 0.6, grass: 0.8, flower: 0.4, rock: 1.6, mush: 0.5 },
  2: { tree: 1.5, bush: 1.2, plant: 1.6, grass: 1.1, flower: 0.7, mush: 2.2 },
  3: { tree: 0.55, bush: 0.4, plant: 0.3, grass: 0.45, flower: 0, rock: 2, mush: 0.2 },
};

type Spec = {
  id: string;
  group: GroupKey;
  weight: number;
  size: [number, number]; // target size in metres (height, or longest side when by === "len")
  by?: "len";
  leaf?: string[]; // leaf colours (green season)
  leafAlt?: string[]; // leaf colours in autumn
  kw?: [number, number, number, number]; // weight multiplier per kingdom (Kings, Warriors, Outcasts, Monsters)
};

const TREE_GREENS = ["#78aa2e", "#8cbc34", "#62952a", "#a3c43c"];
const TREE_AUTUMN = ["#e8932a", "#d96a1e", "#f0b030", "#e07a1c", "#c8402a"];
const PINE_GREENS = ["#2f7a2c", "#3a8a30", "#2a6a2a", "#4a9a34"];
const PINE_AUTUMN = ["#3a7a2a", "#6a8a22", "#a8902a"];
const BUSH_GREENS = ["#6fa82e", "#88bc36", "#5d9a2a"];
const BUSH_AUTUMN = ["#e07a1c", "#f0a030", "#c85a1a"];

const SPECS: Spec[] = [
  ...[1, 2, 3, 4, 5].map((n): Spec => ({ id: `nature-pine-${n}`, group: "tree", weight: n === 5 ? 3 : 2, size: [13, 24], leaf: PINE_GREENS, leafAlt: PINE_AUTUMN, kw: [1, 0.7, 1.8, 0.2] })),
  ...[1, 2, 3, 4, 5].map((n): Spec => ({ id: `nature-commontree-${n}`, group: "tree", weight: n >= 3 ? 3 : 2, size: [8, 13], leaf: TREE_GREENS, leafAlt: TREE_AUTUMN, kw: [1, 1.8, 0.8, 0.1] })),
  { id: "nature-deadtree-1", group: "tree", weight: 1, size: [7, 11], kw: [0.05, 0.3, 0.05, 6] },
  { id: "nature-bush-common", group: "bush", weight: 3, size: [1.0, 1.7], leaf: BUSH_GREENS, leafAlt: BUSH_AUTUMN, kw: [1, 1.3, 1, 0.6] },
  { id: "nature-bush-common-flowers", group: "bush", weight: 2, size: [1.0, 1.6], leaf: BUSH_GREENS, leafAlt: BUSH_AUTUMN, kw: [1, 1.3, 1, 0.6] },
  { id: "nature-fern-1", group: "plant", weight: 3, size: [0.7, 1.2], kw: [1, 0.5, 1.6, 0.2] },
  { id: "nature-plant-1", group: "plant", weight: 2, size: [0.5, 0.9], kw: [1, 0.5, 1.4, 0.4] },
  { id: "nature-plant-1-big", group: "plant", weight: 1, size: [0.8, 1.3], kw: [1, 0.5, 1.4, 0.4] },
  { id: "nature-clover-1", group: "plant", weight: 1, size: [0.3, 0.5] },
  { id: "nature-clover-2", group: "plant", weight: 1, size: [0.3, 0.5] },
  { id: "nature-grass-common-short", group: "grass", weight: 4, size: [0.5, 0.9] },
  { id: "nature-grass-common-tall", group: "grass", weight: 3, size: [0.7, 1.2] },
  { id: "nature-grass-wispy-short", group: "grass", weight: 3, size: [0.5, 0.9] },
  { id: "nature-grass-wispy-tall", group: "grass", weight: 2, size: [0.7, 1.2] },
  { id: "nature-flower-3-group", group: "flower", weight: 2, size: [0.4, 0.7] },
  { id: "nature-flower-3-single", group: "flower", weight: 3, size: [0.4, 0.7] },
  { id: "nature-flower-4-group", group: "flower", weight: 1, size: [0.4, 0.7] },
  { id: "nature-flower-4-single", group: "flower", weight: 3, size: [0.4, 0.7] },
  { id: "nature-rock-medium-1", group: "rock", weight: 1, size: [0.8, 1.7] },
  { id: "nature-rock-medium-2", group: "rock", weight: 1, size: [0.8, 1.7] },
  { id: "nature-rock-medium-3", group: "rock", weight: 1, size: [0.8, 1.7] },
  { id: "nature-mushroom-common", group: "mush", weight: 1, size: [0.3, 0.5] },
  { id: "nature-pebble-round-1", group: "pebble", weight: 1, size: [0.3, 0.6], by: "len" },
  { id: "nature-pebble-round-2", group: "pebble", weight: 1, size: [0.3, 0.6], by: "len" },
  { id: "nature-pebble-square-1", group: "pebble", weight: 1, size: [0.3, 0.6], by: "len" },
  // Clusters of flat stones that edge the trails.
  { id: "nature-rockpath-round-small-1", group: "edgestone", weight: 2, size: [1.4, 2.4], by: "len" },
  { id: "nature-rockpath-round-small-2", group: "edgestone", weight: 2, size: [1.4, 2.4], by: "len" },
  { id: "nature-rockpath-round-thin", group: "edgestone", weight: 1, size: [1.6, 2.6], by: "len" },
  { id: "nature-rockpath-round-wide", group: "edgestone", weight: 1, size: [1.6, 2.6], by: "len" },
  { id: "nature-rockpath-square-small-1", group: "edgestone", weight: 1, size: [1.4, 2.4], by: "len" },
  { id: "nature-rockpath-square-small-2", group: "edgestone", weight: 1, size: [1.4, 2.4], by: "len" },
];

// ---- Where things may NOT grow (any building that is still standing) --------------------
const RECTS = new Map<string, { x: number; z: number; w: number; d: number }[]>();
for (const b of BUILDINGS) {
  if (b.type === "crane" || b.type === "plaza") continue;
  const gx = Math.round(b.x / BLOCK_SIZE);
  const gz = Math.round(b.z / BLOCK_SIZE);
  const key = `${gx},${gz}`;
  const arr = RECTS.get(key) ?? [];
  arr.push({ x: b.x, z: b.z, w: b.w, d: b.d });
  RECTS.set(key, arr);
}

function blocked(x: number, z: number, pad: number) {
  const rs = RECTS.get(`${Math.round(x / BLOCK_SIZE)},${Math.round(z / BLOCK_SIZE)}`);
  if (!rs) return false;
  for (const b of rs) {
    if (Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad) return true;
  }
  return false;
}

// ---- Turning a loaded model into instanced meshes --------------------------------------
type Part = { mesh: THREE.InstancedMesh; tinted: boolean };
type SpeciesData = { spec: Spec; ref: number; minY: number; parts: Part[] };

// The models carry baked shading in per-vertex colours (COLOR_0). Their materials multiply by it,
// so it MUST be kept; without it the plants render solid black.
const KEEP = new Set(["position", "normal", "uv", "color"]);

function sliceGroup(g: THREE.BufferGeometry, start: number, count: number) {
  const out = g.clone();
  out.clearGroups();
  if (g.index) out.setIndex(Array.from(g.index.array as ArrayLike<number>).slice(start, start + count));
  return out;
}

function extract(scene: THREE.Object3D) {
  scene.updateMatrixWorld(true);
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const box = new THREE.Box3();
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const pieces: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
    if (Array.isArray(mesh.material) && mesh.geometry.groups.length > 0) {
      for (const grp of mesh.geometry.groups) {
        pieces.push({ geo: sliceGroup(mesh.geometry, grp.start, grp.count), mat: mats[grp.materialIndex ?? 0] });
      }
    } else {
      pieces.push({ geo: mesh.geometry.clone(), mat: mats[0] });
    }
    for (const { geo, mat } of pieces) {
      for (const n of Object.keys(geo.attributes)) {
        if (!KEEP.has(n)) geo.deleteAttribute(n);
      }
      if (!geo.attributes.normal) geo.computeVertexNormals();
      const flat = geo.index ? geo.toNonIndexed() : geo;
      flat.applyMatrix4(mesh.matrixWorld);
      flat.computeBoundingBox();
      if (flat.boundingBox) box.union(flat.boundingBox);
      const list = byMat.get(mat) ?? [];
      list.push(flat);
      byMat.set(mat, list);
    }
  });
  const size = box.getSize(new THREE.Vector3());
  return { byMat, h0: size.y || 1, len0: Math.max(size.x, size.z) || 1, minY: box.min.y };
}

/** Leaf cards are flat-colour cut-outs, so the leaf colour comes from the instance, not the texture. */
function leafMaterial(src: THREE.Material): THREE.Material {
  const m = src.clone() as THREE.MeshStandardMaterial;
  m.side = THREE.DoubleSide;
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      "#include <map_fragment>\n  diffuseColor.rgb = vColor.rgb;",
    );
  };
  m.customProgramCacheKey = () => "foliage-leaf";
  return m;
}

function buildSpecies(spec: Spec, scene: THREE.Object3D): SpeciesData {
  const cap = GROUPS[spec.group].cap;
  const { byMat, h0, len0, minY } = extract(scene);
  const parts: Part[] = [];
  byMat.forEach((geos, mat) => {
    const geometry = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!geometry) return;
    const leaf = !!spec.leaf && /leaf|leaves/i.test(mat.name);
    let material: THREE.Material = mat;
    if (leaf) {
      material = leafMaterial(mat);
    } else if ((mat as THREE.MeshStandardMaterial).alphaTest > 0 || /grass|flower|leaves/i.test(mat.name)) {
      material = mat.clone();
      material.side = THREE.DoubleSide;
    }
    const mesh = new THREE.InstancedMesh(geometry, material, cap);
    mesh.frustumCulled = false;
    mesh.count = 0;
    if (leaf) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    parts.push({ mesh, tinted: leaf });
  });
  return { spec, ref: spec.by === "len" ? len0 : h0, minY, parts };
}

const dummy = new THREE.Object3D();
const col = new THREE.Color();

/** Cumulative weights per kingdom, so each biome favours its own plants. */
type Pool = { list: SpeciesData[]; cum: number[][]; total: number[] };

function kingdomAt(x: number, z: number) {
  return themeOf(districtAt(x, z)).id;
}

function rebuild(cx: number, cz: number, pools: Map<GroupKey, Pool>) {
  pools.forEach((pool) => pool.list.forEach((d) => d.parts.forEach((p) => { p.mesh.count = 0; })));

  pools.forEach((pool, gk) => {
    const g = GROUPS[gk];
    const i0 = Math.floor((cx - g.radius) / g.cell);
    const i1 = Math.floor((cx + g.radius) / g.cell);
    const j0 = Math.floor((cz - g.radius) / g.cell);
    const j1 = Math.floor((cz + g.radius) / g.cell);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const r = (s: number) => hash01(i, j, g.salt + s);
        const x = (i + r(2)) * g.cell;
        const z = (j + r(3)) * g.cell;
        if (Math.hypot(x - cx, z - cz) > g.radius) continue;
        if (!isVillageBlock(Math.round(x / BLOCK_SIZE), Math.round(z / BLOCK_SIZE))) continue;
        const kd = kingdomAt(x, z);
        const mult = KINGDOM_MULT[kd][gk] ?? 1;
        if (mult <= 0) continue;
        const f = forestAt(x, z);
        if (r(1) > g.prob(x, z, f) * mult) continue;
        if (blocked(x, z, g.rectPad)) continue;
        const rd = roadDistance(x, z);
        if (g.edge) {
          if (rd < HALF_ROAD - 0.1 || rd > HALF_ROAD + 1.2) continue;
        } else if (rd < HALF_ROAD + g.roadPad) continue;

        const total = pool.total[kd];
        if (total <= 0) continue;
        const cum = pool.cum[kd];
        const t = r(4) * total;
        let k = 0;
        while (k < cum.length - 1 && t > cum[k]) k++;
        const d = pool.list[k];
        const size = d.spec.size[0] + (d.spec.size[1] - d.spec.size[0]) * r(5);
        const s = size / d.ref;
        dummy.position.set(x, groundHeight(x, z) - d.minY * s, z);
        dummy.rotation.set(0, r(6) * Math.PI * 2, 0);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();

        let colour: string | null = null;
        if (d.spec.leaf) {
          const autumn = kd === 1 || kd === 3 || (kd === 0 && autumnAt(x, z) > 0.6);
          const pal = autumn && d.spec.leafAlt ? d.spec.leafAlt : d.spec.leaf;
          colour = pal[Math.floor(r(7) * pal.length) % pal.length];
        }
        for (const p of d.parts) {
          if (p.mesh.count >= g.cap) continue;
          const n = p.mesh.count++;
          p.mesh.setMatrixAt(n, dummy.matrix);
          if (p.tinted && colour) {
            col.set(colour);
            p.mesh.setColorAt(n, col);
          }
        }
      }
    }
  });

  pools.forEach((pool) =>
    pool.list.forEach((d) =>
      d.parts.forEach((p) => {
        p.mesh.instanceMatrix.needsUpdate = true;
        if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
      }),
    ),
  );
}

function FoliageInner() {
  const gltfs = useGLTF(SPECS.map((s) => `/models/props/${s.id}.glb`)) as unknown as { scene: THREE.Group }[];
  const key = gltfs.map((g) => g.scene.uuid).join();

  const data = useMemo(
    () => SPECS.map((spec, i) => buildSpecies(spec, gltfs[i].scene)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  const pools = useMemo(() => {
    const m = new Map<GroupKey, Pool>();
    for (const d of data) {
      let p = m.get(d.spec.group);
      if (!p) {
        p = { list: [], cum: [[], [], [], []], total: [0, 0, 0, 0] };
        m.set(d.spec.group, p);
      }
      p.list.push(d);
      for (let k = 0; k < 4; k++) {
        p.total[k] += d.spec.weight * (d.spec.kw ? d.spec.kw[k] : 1);
        p.cum[k].push(p.total[k]);
      }
    }
    return m;
  }, [data]);

  const last = useRef<{ x: number; z: number } | null>(null);
  const clock = useRef(0);
  useFrame(({ camera }, dt) => {
    clock.current += dt;
    if (clock.current < 0.3) return;
    clock.current = 0;
    const { x, z } = camera.position;
    const l = last.current;
    if (l && Math.hypot(x - l.x, z - l.z) < 7) return;
    last.current = { x, z };
    rebuild(x, z, pools);
  });

  return (
    <>
      {data.flatMap((d) =>
        d.parts.map((p, i) => <primitive key={`${d.spec.id}-${i}`} object={p.mesh} />),
      )}
    </>
  );
}

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn("[foliage] could not load the plants:", e); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function Foliage() {
  return (
    <Boundary>
      <Suspense fallback={null}>
        <FoliageInner />
      </Suspense>
    </Boundary>
  );
}
