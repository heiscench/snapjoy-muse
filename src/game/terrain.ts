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
