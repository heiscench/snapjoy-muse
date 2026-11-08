import { useMemo } from "react";
import * as THREE from "three";
import { BLOCK_SIZE, GRID, districtAt } from "../worldData";
import { groundHeight } from "../terrain";
import { hash01, themeOf } from "./palette";
import { ROAD_LINES, ROAD_W } from "./layout";

// The ground of the whole world: one mesh, 8 m grid, painted with vertex colours.
// Flat everywhere except the Kings' village, which rolls (see terrain.ts).

const STEP = 8;
const HALF = ((GRID * 2 + 2) * BLOCK_SIZE) / 2;
const N = (HALF * 2) / STEP;

const GRASS_A = new THREE.Color("#86b04e");
const GRASS_B = new THREE.Color("#6a9440");
const GOLD = new THREE.Color("#c4b050");
const DIRT = new THREE.Color("#8d7351");

function roadDist(v: number) {
  let best = Infinity;
  for (const p of ROAD_LINES) best = Math.min(best, Math.abs(v - p));
  return best;
}

function smooth(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function buildTerrain() {
  const side = N + 1;
  const pos = new Float32Array(side * side * 3);
  const col = new Float32Array(side * side * 3);
  const idx: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < side; i++) {
    for (let j = 0; j < side; j++) {
      const x = -HALF + i * STEP;
      const z = -HALF + j * STEP;
      const k = i * side + j;
      pos[k * 3] = x;
      pos[k * 3 + 1] = groundHeight(x, z);
      pos[k * 3 + 2] = z;

      const d = districtAt(x, z);
      const n1 = hash01(Math.floor(x / 16), Math.floor(z / 16), 3);
      const n2 = hash01(Math.floor(x / 7), Math.floor(z / 7), 4);
      if (d === "downtown") {
        c.copy(GRASS_A).lerp(GRASS_B, n1).lerp(GOLD, Math.max(0, n2 - 0.62) * 1.6);
      } else {
        c.set(themeOf(d).ground).multiplyScalar(0.92 + n1 * 0.16);
      }
      const rd = Math.min(roadDist(x), roadDist(z));
      c.lerp(DIRT, 1 - smooth(ROAD_W / 2, ROAD_W / 2 + 6, rd));
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;

      if (i < N && j < N) {
        const a = k, b = k + 1, e = k + side, f = k + side + 1;
        idx.push(a, b, e, b, f, e);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function Terrain() {
  const geo = useMemo(() => buildTerrain(), []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} />
    </mesh>
  );
}
