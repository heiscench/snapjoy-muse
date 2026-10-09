import { BUILDINGS } from "./worldData";

// A spot is "free" when it is at least this far outside every building box.
const CLEARANCE = 1.4;

function isFree(x: number, z: number): boolean {
  for (const b of BUILDINGS) {
    if (b.type === "crane" || b.type === "plaza") continue;
    if (
      x > b.x - b.w / 2 - CLEARANCE &&
      x < b.x + b.w / 2 + CLEARANCE &&
      z > b.z - b.d / 2 - CLEARANCE &&
      z < b.z + b.d / 2 + CLEARANCE
    ) {
      return false;
    }
  }
  return true;
}

/** Nearest open ground to (x, z), searching outward in rings. */
export function findFreeSpot(x: number, z: number): { x: number; z: number } {
  if (isFree(x, z)) return { x, z };
  for (let r = 2; r <= 120; r += 2) {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const nx = x + Math.cos(a) * r;
      const nz = z + Math.sin(a) * r;
      if (isFree(nx, nz)) return { x: nx, z: nz };
    }
  }
  return { x, z };
}