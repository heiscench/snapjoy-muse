import { makeCottages } from "./medieval/houseKit";

// Rolling hills for the whole map. Plain maths (no three.js), so the world, the player, the
// villagers and the renderer all agree on how high the ground is at any point.

const BLOCK = 64;
const GRID = 8;

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** True for every block of the map (the name is historic: it used to mean just the Kings' village). */
export function isVillageBlock(gx: number, gz: number): boolean {
  return Math.abs(gx) <= GRID && Math.abs(gz) <= GRID;
}

// Level ground around every headquarters and hospital, so spawns, vaults and shops sit flat.
const HQ: [number, number][] = [
  [1, -1], [-5, 1], [5, 5], [4, -2], [0, 4], [0, -5], [-2, 1], [6, -7], [-6, -7], [7, 1], [-7, 1], [-3, 7], [3, 7],
];
const HOSPITAL: [number, number][] = [
  [2, -2], [-5, -1], [6, 6], [5, -3], [1, 5], [1, -5], [-1, 2], [6, -8], [-6, -8], [8, 1], [-8, 1], [-3, 8], [3, 8],
];
const FLAT = [
  ...HQ.map(([gx, gz]) => ({ x: gx * BLOCK, z: gz * BLOCK, r0: 30, r1: 62 })),
  ...HOSPITAL.map(([gx, gz]) => ({ x: gx * BLOCK, z: gz * BLOCK, r0: 22, r1: 48 })),
];
const NO_COTTAGES = new Set(["1,-1", "2,-2", "1,0"]);

function hills(x: number, z: number) {
  return (
    1.5 * (
      3.0 * Math.sin(x * 0.021 + 1.1) * Math.cos(z * 0.017 + 0.4) +
      1.6 * Math.sin((x + z) * 0.033 + 2.0) +
      0.8 * Math.sin(x * 0.057 - z * 0.049 + 0.7)
    ) +
    4.0 * Math.sin(x * 0.009 + 0.3) * Math.cos(z * 0.008 - 0.9) - // broad swells
    z * 0.006 // an overall fall toward +z: the land runs downhill
  );
}

/** 0 at the map edge, 1 well inside it. */
function edgeMask(x: number, z: number) {
  const gx = Math.round(x / BLOCK);
  const gz = Math.round(z / BLOCK);
  if (!isVillageBlock(gx, gz)) return 0;
  const lx = x - gx * BLOCK;
  const lz = z - gz * BLOCK;
  let d = 32;
  if (!isVillageBlock(gx + 1, gz)) d = Math.min(d, 32 - lx);
  if (!isVillageBlock(gx - 1, gz)) d = Math.min(d, 32 + lx);
  if (!isVillageBlock(gx, gz + 1)) d = Math.min(d, 32 - lz);
  if (!isVillageBlock(gx, gz - 1)) d = Math.min(d, 32 + lz);
  return smoothstep(0, 32, d);
}

function baseHeight(x: number, z: number) {
  let m = edgeMask(x, z);
  if (m <= 0) return 0;
  for (const f of FLAT) m *= smoothstep(f.r0, f.r1, Math.hypot(x - f.x, z - f.z));
  return m * hills(x, z);
}

type Pad = { x: number; z: number; w: number; d: number; level: number };
const padCache = new Map<string, Pad[]>();

/** Each cottage stands on its own level terrace (none while the village buildings are off). */
function padsOf(gx: number, gz: number): Pad[] {
  const key = `${gx},${gz}`;
  let p = padCache.get(key);
  if (p) return p;
  p = [];
  if (isVillageBlock(gx, gz) && !NO_COTTAGES.has(key)) {
    for (const c of makeCottages(gx, gz, gx * BLOCK, gz * BLOCK)) {
      p.push({ x: c.x, z: c.z, w: c.w, d: c.d, level: baseHeight(c.x, c.z) });
    }
  }
  padCache.set(key, p);
  return p;
}

/** Height of the ground at (x, z) in metres. */
export function groundHeight(x: number, z: number): number {
  const gx = Math.round(x / BLOCK);
  const gz = Math.round(z / BLOCK);
  if (!isVillageBlock(gx, gz)) return 0;
  let h = baseHeight(x, z);
  for (const p of padsOf(gx, gz)) {
    const dx = Math.max(Math.abs(x - p.x) - p.w / 2, 0);
    const dz = Math.max(Math.abs(z - p.z) - p.d / 2, 0);
    const m = 1 - smoothstep(2.5, 9, Math.hypot(dx, dz));
    if (m > 0) h += (p.level - h) * m;
  }
  return h;
}

// ---- Winding lanes ---------------------------------------------------------------------
// The lanes lie between blocks; they wander up to 5 m to either side so the trails curve.

const LINES: number[] = Array.from({ length: GRID * 2 + 2 }, (_, i) => (i - GRID - 0.5) * BLOCK);
const WIND = 5;

function wave(line: number, t: number, salt: number) {
  return 0.65 * Math.sin(t * 0.026 + line * 0.83 + salt) + 0.35 * Math.sin(t * 0.061 + line * 1.9 + salt * 2);
}

/** x of the lane that runs along z, at height z. */
export function roadX(line: number, z: number): number {
  return line + WIND * edgeMask(line, z) * wave(line, z, 0);
}

/** z of the lane that runs along x, at position x. */
export function roadZ(line: number, x: number): number {
  return line + WIND * edgeMask(x, line) * wave(line, x, 1.3);
}

/** Where the lane along z at `X` meets the lane along x at `Z`. */
export function junctionAt(X: number, Z: number): { x: number; z: number } {
  let x = X;
  let z = Z;
  for (let k = 0; k < 4; k++) {
    x = roadX(X, z);
    z = roadZ(Z, x);
  }
  return { x, z };
}

/** Sideways distance from (x, z) to the nearest lane centre line. */
export function roadDistance(x: number, z: number): number {
  let best = Infinity;
  for (const p of LINES) {
    if (Math.abs(x - p) < 48) best = Math.min(best, Math.abs(x - roadX(p, z)));
    if (Math.abs(z - p) < 48) best = Math.min(best, Math.abs(z - roadZ(p, x)));
  }
  return best;
}

// ---- Woods and autumn --------------------------------------------------------------------

/** 0..1: how thickly wooded the land is here (clumps of forest between open meadow). */
export function forestAt(x: number, z: number): number {
  const f = 0.5 + 0.28 * Math.sin(x * 0.013 + 1.0) + 0.22 * Math.cos(z * 0.011 - 0.5) + 0.18 * Math.sin((x + z) * 0.02);
  return smoothstep(0.35, 0.75, f);
}

/** 0..1: patches of hillside that have turned autumn orange. */
export function autumnAt(x: number, z: number): number {
  const f = 0.5 + 0.35 * Math.sin(x * 0.0075 + 2.1) * Math.cos(z * 0.0069 - 0.8) + 0.2 * Math.sin((x - z) * 0.012);
  return smoothstep(0.55, 0.8, f);
}
