import { BLOCK_SIZE, GRID, districtFor } from "../worldData";
import { themeOf } from "./palette";

export const ROAD_W = 14;
export const SIDEWALK_W = 3;
export const ROAD_LEN = (GRID * 2 + 2) * BLOCK_SIZE;

/** Road centre lines sit BETWEEN blocks, so every building stands inside its own block. */
export const ROAD_LINES: number[] = Array.from(
  { length: GRID * 2 + 2 },
  (_, i) => (i - GRID - 0.5) * BLOCK_SIZE,
);

export function kingdomAtBlock(gx: number, gz: number): number {
  const cx = Math.max(-GRID, Math.min(GRID, gx));
  const cz = Math.max(-GRID, Math.min(GRID, gz));
  return themeOf(districtFor(cx, cz)).id;
}

export type KingdomEdge = { x: number; z: number; alongX: boolean; a: number; b: number };

/** Every road segment where one kingdom's land meets another's. */
export const KINGDOM_EDGES: KingdomEdge[] = (() => {
  const list: KingdomEdge[] = [];
  for (let gx = -GRID; gx <= GRID; gx++) {
    for (let gz = -GRID; gz <= GRID; gz++) {
      const k = kingdomAtBlock(gx, gz);
      if (gx < GRID) {
        const o = kingdomAtBlock(gx + 1, gz);
        if (o !== k) list.push({ x: (gx + 0.5) * BLOCK_SIZE, z: gz * BLOCK_SIZE, alongX: false, a: k, b: o });
      }
      if (gz < GRID) {
        const o = kingdomAtBlock(gx, gz + 1);
        if (o !== k) list.push({ x: gx * BLOCK_SIZE, z: (gz + 0.5) * BLOCK_SIZE, alongX: true, a: k, b: o });
      }
    }
  }
  return list;
})();