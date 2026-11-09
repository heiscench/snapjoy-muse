import { useMemo } from "react";
import * as THREE from "three";
import { BLOCK_SIZE, GRID, districtAt } from "../worldData";
import { autumnAt, groundHeight, roadDistance } from "../terrain";
import { hash01, themeOf } from "./palette";
import { ROAD_W } from "./layout";

// The ground of the whole world: one mesh, 8 m grid, painted with vertex colours.
// Flat everywhere except the Kings' village, which rolls (see terrain.ts).

const STEP = 8;
const HALF = ((GRID * 2 + 2) * BLOCK_SIZE) / 2;
const N = (HALF * 2) / STEP;

// A rich, varied meadow: yellow-green, fresh green, deeper olive, and golden autumn hillsides.
const GRASS_A = new THREE.Color("#8fb84a");
const GRASS_B = new THREE.Color("#6c9a3a");
const GRASS_C = new THREE.Color("#a9bf4c");
const GOLD = new THREE.Color("#cdb355");
const AUTUMN = new THREE.Color("#d6a93a");
const SAND = new THREE.Color("#d9c88f");

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
      const n2 = hash01(Math.floor(x / 9), Math.floor(z / 9), 4);
      const n3 = hash01(Math.floor(x / 24), Math.floor(z / 24), 5);
      if (d === "downtown") {
        c.copy(GRASS_B).lerp(GRASS_A, n1).lerp(GRASS_C, n3 * 0.55).lerp(GOLD, Math.max(0, n2 - 0.7) * 1.8);
        c.lerp(AUTUMN, autumnAt(x, z) * 0.8);
      } else {
        c.set(themeOf(d).ground).multiplyScalar(0.92 + n1 * 0.16);
      }
      const rd = roadDistance(x, z);
      c.lerp(SAND, 1 - smooth(ROAD_W / 2, ROAD_W / 2 + 5, rd));
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
