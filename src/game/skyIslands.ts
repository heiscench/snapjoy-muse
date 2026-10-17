import { GANG_HQ, rooftopHeightAt } from "./worldData";

export type SkyIsland = { kingdom: 0 | 1 | 2 | 3; x: number; z: number; top: number; r: number };

// One Sky Hall floating above each kingdom's Hall. The top is above the tallest tower (72 m).
export const SKY_ISLAND_TOP = 78;
export const SKY_ISLAND_R = 34;

export const SKY_ISLANDS: SkyIsland[] = ([0, 1, 2, 3] as const).map((k) => ({
  kingdom: k,
  x: GANG_HQ[k].x,
  z: GANG_HQ[k].z,
  top: SKY_ISLAND_TOP,
  r: SKY_ISLAND_R,
}));

/**
 * The surface under (x, z) for something at height y: the ground or a building roof, or a Sky Hall
 * if you are at or above it. Anything below an island ignores it, so walking under one is safe.
 */
export function floorAt(x: number, z: number, y: number): number {
  let best = rooftopHeightAt(x, z);
  for (const i of SKY_ISLANDS) {
    if (i.top > best && y >= i.top - 1.2 && Math.hypot(x - i.x, z - i.z) < i.r) best = i.top;
  }
  return best;
}