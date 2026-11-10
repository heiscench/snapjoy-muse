import { yardLayout } from "./houseKit";
import { VILLAGE_BUILDINGS } from "./mode";

// Pure data for the Kings' town square and for collision of village props (no three.js).

/** The block just south of the castle becomes the town square. */
export const SQUARE_BLOCK = { gx: 1, gz: 0 };
export const SQUARE_SIZE = 40;

/** A solid box. `h` is the absolute height of its top (ground + height), since the village is hilly. */
export type Solid = { x: number; z: number; w: number; d: number; h: number };
export type Stall = { x: number; z: number; rot: number; variant: number };

const STALL_RING = 12;
const STALL_COUNT = 8;

export function squareLayout(cx: number, cz: number) {
  const stalls: Stall[] = [];
  for (let k = 0; k < STALL_COUNT; k++) {
    const a = (k / STALL_COUNT) * Math.PI * 2 + Math.PI / 8;
    const x = cx + Math.cos(a) * STALL_RING;
    const z = cz + Math.sin(a) * STALL_RING;
    // Local +z (the stall's front) must point at the fountain: direction (-cos a, -sin a).
    stalls.push({ x, z, rot: Math.atan2(-Math.cos(a), -Math.sin(a)), variant: k % 3 });
  }
  const m = SQUARE_SIZE / 2 - 2.5;
  const banners = [
    { x: cx - m, z: cz - m, rot: 0.6 },
    { x: cx + m, z: cz - m, rot: -0.6 },
    { x: cx - m, z: cz + m, rot: 2.5 },
    { x: cx + m, z: cz + m, rot: -2.5 },
  ];
  return { fountain: { x: cx, z: cz }, stalls, banners };
}

/**
 * Solid boxes for village props, so wells, tree trunks, market stalls and the fountain stop you.
 * `buildings` is the world's building list; only the cottages are used to find each block's yard.
 * `ground` gives the height of the terrain, so each box's top is ground + its own height.
 */
export function computePropColliders(
  buildings: { x: number; z: number; w: number; d: number; cottage?: unknown }[],
  blockSize: number,
  ground: (x: number, z: number) => number = () => 0,
): Solid[] {
  const blocks = new Map<string, { gx: number; gz: number; rects: { x: number; z: number; w: number; d: number }[] }>();
  for (const b of buildings) {
    if (!b.cottage) continue;
    const gx = Math.round(b.x / blockSize);
    const gz = Math.round(b.z / blockSize);
    const key = `${gx},${gz}`;
    let e = blocks.get(key);
    if (!e) {
      e = { gx, gz, rects: [] };
      blocks.set(key, e);
    }
    e.rects.push({ x: b.x, z: b.z, w: b.w, d: b.d });
  }

  const out: Solid[] = [];
  blocks.forEach(({ gx, gz, rects }) => {
    const y = yardLayout(gx, gz, gx * blockSize, gz * blockSize, rects);
    for (const w of y.wells) out.push({ x: w.x, z: w.z, w: 2.8, d: 2.8, h: ground(w.x, w.z) + 1.0 });
    for (const t of y.trees) {
      if (t.id === "tree-large" || t.id === "tree-small") {
        out.push({ x: t.x, z: t.z, w: 1.0, d: 1.0, h: ground(t.x, t.z) + (t.fit ? t.fit.size : 5) });
      }
    }
  });

  if (VILLAGE_BUILDINGS) {
    const sq = squareLayout(SQUARE_BLOCK.gx * blockSize, SQUARE_BLOCK.gz * blockSize);
    out.push({ x: sq.fountain.x, z: sq.fountain.z, w: 5.4, d: 5.4, h: ground(sq.fountain.x, sq.fountain.z) + 1.0 });
    for (const s of sq.stalls) out.push({ x: s.x, z: s.z, w: 3.2, d: 3.2, h: ground(s.x, s.z) + 2.4 });
  }
  return out;
}
