import { makeCottages } from "./medieval/houseKit";

// Rolling hills for the Kings' village. Plain maths (no three.js), so the world, the player, the
// villagers and the renderer all agree on how high the ground is at any point.
// Everything outside the village stays perfectly flat (height 0), so the other kingdoms are unchanged.

const BLOCK = 64;
const GRID = 8;

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Same test as districtFor() === "downtown" (kept here so this file has no imports from worldData). */
export function isVillageBlock(gx: number, gz: number): boolean {
  if (Math.abs(gx) > GRID || Math.abs(gz) > GRID) return false;
  if (gz <= -6 && gx >= 3) return false;
  if (gz <= -6 && gx <= -3) return false;
  if (gx >= 6 && gz >= -2 && gz <= 3) return false;
  if (gx <= -6 && gz >= -2 && gz <= 3) return false;
  if (gz >= 6) return false;
  if (gz <= -4) return false;
  if (gx <= -4) return false;
  if (gx >= 4 && gz >= 4) return false;
  if (gx >= 3 && gz <= -2) return false;
  if (gz >= 3) return false;
  if (gx <= -1 && gx >= -3 && gz >= 0 && gz <= 2) return false;
  return true;
}

// Level ground around the castle, the hospital and the town square.
const FLAT = [
  { x: 1 * BLOCK, z: -1 * BLOCK, r0: 38, r1: 80 },
  { x: 2 * BLOCK, z: -2 * BLOCK, r0: 34, r1: 70 },
  { x: 1 * BLOCK, z: 0, r0: 28, r1: 58 },
];
const NO_COTTAGES = new Set(["1,-1", "2,-2", "1,0"]);

function hills(x: number, z: number) {
  return (
    3.0 * Math.sin(x * 0.021 + 1.1) * Math.cos(z * 0.017 + 0.4) +
    1.6 * Math.sin((x + z) * 0.033 + 2.0) +
    0.8 * Math.sin(x * 0.057 - z * 0.049 + 0.7) -
    z * 0.006 // an overall fall toward +z: the village runs downhill
  );
}

/** 0 at the edge of the village, 1 well inside it. */
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
  return smoothstep(0, 22, d);
}

function baseHeight(x: number, z: number) {
  let m = edgeMask(x, z);
  if (m <= 0) return 0;
  for (const f of FLAT) m *= smoothstep(f.r0, f.r1, Math.hypot(x - f.x, z - f.z));
  return m * hills(x, z);
}

type Pad = { x: number; z: number; w: number; d: number; level: number };
const padCache = new Map<string, Pad[]>();

/** Each cottage stands on its own level terrace, so walls never float or sink on a slope. */
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
// The lanes lie between blocks; inside the village they wander up to 5 m to either side so the
// trails curve instead of running ruler-straight. Outside the village they stay straight.

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
