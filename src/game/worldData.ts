
// Height allowance: if you're within this much of a roof top you pass over it
// instead of hitting the wall, so stepping off a roof edge never snags.
const ROOF_CLEARANCE = 0.3;

/** Shared building collision with proper push-out and wall sliding.
 * `y` is the mover's height (-Infinity = ground level, always blocked). */
function resolveAgainstBuildings(
  prevX: number,
  prevZ: number,
  nextX: number,
  nextZ: number,
  y: number,
  radius: number,
): { x: number; z: number } {
  let x = nextX;
  let z = nextZ;
  for (const b of BUILDINGS) {
    if (b.type === "crane" || b.type === "plaza") continue;
    if (y >= b.h - ROOF_CLEARANCE) continue;

    const minX = b.x - b.w / 2 - radius;
    const maxX = b.x + b.w / 2 + radius;
    const minZ = b.z - b.d / 2 - radius;
    const maxZ = b.z + b.d / 2 + radius;
    if (!(x > minX && x < maxX && z > minZ && z < maxZ)) continue;

    const prevInX = prevX > minX && prevX < maxX;
    const prevInZ = prevZ > minZ && prevZ < maxZ;
    const dl = x - minX;
    const dr = maxX - x;
    const db = z - minZ;
    const df = maxZ - z;

    if (prevInX && prevInZ) {
      // Already overlapping (fell into the edge band, spawned inside, exited a
      // vehicle into a wall): push out through the nearest face.
      const m = Math.min(dl, dr, db, df);
      if (m === dl) x = minX;
      else if (m === dr) x = maxX;
      else if (m === db) z = minZ;
      else z = maxZ;
    } else if (!prevInX && prevInZ) {
      // Entered sideways: slide along the wall instead of freezing.
      x = prevX <= minX ? minX : maxX;
    } else if (prevInX && !prevInZ) {
      z = prevZ <= minZ ? minZ : maxZ;
    } else {
      // Corner entry: resolve along the shallower axis.
      if (Math.min(dl, dr) < Math.min(db, df)) x = dl < dr ? minX : maxX;
      else z = db < df ? minZ : maxZ;
    }
  }
  return { x, z };
}

export function resolveCollision(
  prevX: number,
  prevZ: number,
  nextX: number,
  nextZ: number,
  radius = 0.6,
): { x: number; z: number } {
  return resolveAgainstBuildings(prevX, prevZ, nextX, nextZ, -Infinity, radius);
}

export function resolveHeliCollision(
  prevX: number,
  prevZ: number,
  nextX: number,
  nextZ: number,
  y: number,
  radius = 4,
): { x: number; z: number } {
  return resolveAgainstBuildings(prevX, prevZ, nextX, nextZ, y, radius);
}