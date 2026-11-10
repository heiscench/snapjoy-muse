// Shared world layout: districts, building AABBs used for rendering + collision.

import { makeCottages, type Cottage } from "./medieval/houseKit";
import { SQUARE_BLOCK, computePropColliders, type Solid } from "./medieval/colliders";
import { VILLAGE_BUILDINGS } from "./medieval/mode";
import { groundHeight } from "./terrain";

export type BuildingType =
  | "tower"
  | "warehouse"
  | "stadium"
  | "bank"
  | "lowrise"
  | "harbor"
  | "crane"
  | "hospital"
  | "house"
  | "plaza"
  | "silo"
  | "mall"
  | "hq"
  | "hangar"
  | "casino"
  | "pagoda"
  | "shanty"
  | "brownstone";

export type District =
  | "downtown"
  | "industrial"
  | "stadium"
  | "bank"
  | "shopping"
  | "harbor"
  | "residential"
  | "airport"
  | "casino"
  | "chinatown"
  | "slums"
  | "park"
  | "uptown";

export const ALL_DISTRICTS: District[] = [
  "downtown",
  "industrial",
  "stadium",
  "bank",
  "shopping",
  "harbor",
  "residential",
  "airport",
  "casino",
  "chinatown",
  "slums",
  "park",
  "uptown",
];

// Districts that get unarmed wandering civilians. Industrial, harbor, and
// airport are treated as restricted/worker-only turf, so they're left out.
export const CIVILIAN_DISTRICTS: District[] = [
  "downtown",
  "stadium",
  "bank",
  "shopping",
  "residential",
  "casino",
  "chinatown",
  "slums",
  "park",
  "uptown",
];

export type BuildingBox = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  type: BuildingType;
  district: District;
  /** Set for the medieval village cottages of the Kings' district (drawn by medieval/VillageBlocks). */
  cottage?: Cottage;
  /** Height of the ground the building stands on (the village is hilly). Collision tops are y0 + h. */
  y0?: number;
};

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export const BLOCK_SIZE = 64;
export const ROAD_WIDTH = 20;
export const GRID = 8; // widened from 6 to make room for the outer-ring districts
export const KINGS_CASTLE_H = 16; // collision height of the Kings' castle

export function districtFor(gx: number, gz: number): District {
  // Outer ring — the six newly-wired districts sit beyond the original
  // 13x13 core (gx, gz in [-6,6]), which keeps its original footprint below.
  if (gz <= -6 && gx >= 3) return "airport";
  if (gz <= -6 && gx <= -3) return "casino";
  if (gx >= 6 && gz >= -2 && gz <= 3) return "uptown";
  if (gx <= -6 && gz >= -2 && gz <= 3) return "chinatown";
  if (gz >= 6 && gx <= 0) return "park";
  if (gz >= 6 && gx > 0) return "slums";

  if (gz <= -4) return "harbor";
  if (gx <= -4) return "industrial";
  if (gx >= 4 && gz >= 4) return "stadium";
  if (gx >= 3 && gz <= -2) return "bank";
  if (gz >= 3) return "shopping";
  if (gx <= -1 && gx >= -3 && gz >= 0 && gz <= 2) return "residential";
  return "downtown";
}

export function districtAt(x: number, z: number): District {
  const gx = Math.round(x / BLOCK_SIZE);
  const gz = Math.round(z / BLOCK_SIZE);
  return districtFor(
    Math.max(-GRID, Math.min(GRID, gx)),
    Math.max(-GRID, Math.min(GRID, gz)),
  );
}

function buildingForDistrict(d: District, r: () => number): { type: BuildingType; w: number; depth: number; h: number } {
  switch (d) {
    case "downtown":
      if (r() < 0.12) return { type: "plaza", w: 20, depth: 20, h: 1 };
      return { type: "tower", w: 12 + r() * 6, depth: 12 + r() * 6, h: 32 + r() * 40 };
    case "industrial":
      if (r() < 0.25) return { type: "silo", w: 10, depth: 10, h: 14 + r() * 6 };
      return { type: "warehouse", w: 22 + r() * 10, depth: 18 + r() * 8, h: 8 + r() * 4 };
    case "stadium":
      return { type: "stadium", w: 34, depth: 34, h: 14 };
    case "bank":
      return { type: "bank", w: 20 + r() * 4, depth: 20 + r() * 4, h: 42 + r() * 20 };
    case "shopping":
      if (r() < 0.3) return { type: "mall", w: 30 + r() * 8, depth: 20 + r() * 4, h: 9 + r() * 2 };
      return { type: "lowrise", w: 22 + r() * 6, depth: 16 + r() * 4, h: 6 + r() * 4 };
    case "harbor":
      return { type: "harbor", w: 20 + r() * 6, depth: 14 + r() * 4, h: 5 + r() * 3 };
    case "residential":
      return { type: "house", w: 9, depth: 9, h: 6 };
    case "airport":
      return { type: "hangar", w: 40 + r() * 10, depth: 24 + r() * 6, h: 12 + r() * 4 };
    case "casino":
      return { type: "casino", w: 24 + r() * 6, depth: 24 + r() * 6, h: 20 + r() * 10 };
    case "chinatown":
      return { type: "pagoda", w: 16 + r() * 4, depth: 16 + r() * 4, h: 14 + r() * 6 };
    case "slums":
      return { type: "shanty", w: 10 + r() * 4, depth: 10 + r() * 4, h: 5 + r() * 2 };
    case "park":
      return { type: "plaza", w: 26 + r() * 8, depth: 26 + r() * 8, h: 1 };
    case "uptown":
      return { type: "brownstone", w: 14 + r() * 4, depth: 14 + r() * 4, h: 16 + r() * 10 };
  }
}

const HQ_BLOCKS: Record<District, [number, number]> = {
  downtown: [1, -1],
  industrial: [-5, 1],
  stadium: [5, 5],
  bank: [4, -2],
  shopping: [0, 4],
  harbor: [0, -5],
  residential: [-2, 1],
  airport: [6, -7],
  casino: [-6, -7],
  uptown: [7, 1],
  chinatown: [-7, 1],
  park: [-3, 7],
  slums: [3, 7],
};
function hqBlockFor(gx: number, gz: number): District | null {
  for (const d of Object.keys(HQ_BLOCKS) as District[]) {
    const [hx, hz] = HQ_BLOCKS[d];
    if (hx === gx && hz === gz) return d;
  }
  return null;
}

const HOSPITAL_BLOCKS: Record<District, [number, number]> = {
  downtown: [2, -2],
  industrial: [-5, -1],
  stadium: [6, 6],
  bank: [5, -3],
  shopping: [1, 5],
  harbor: [1, -5],
  residential: [-1, 2],
  airport: [6, -8],
  casino: [-6, -8],
  uptown: [8, 1],
  chinatown: [-8, 1],
  park: [-3, 8],
  slums: [3, 8],
};
function isHospitalBlock(gx: number, gz: number) {
  return (Object.values(HOSPITAL_BLOCKS) as [number, number][]).some(([hx, hz]) => hx === gx && hz === gz);
}

export const BUILDINGS: BuildingBox[] = (() => {
  const r = rng(20260726);
  const list: BuildingBox[] = [];
  for (let gx = -GRID; gx <= GRID; gx++) {
    for (let gz = -GRID; gz <= GRID; gz++) {
      const cx = gx * BLOCK_SIZE;
      const cz = gz * BLOCK_SIZE;
      const d = districtFor(gx, gz);

      const hqDistrict = hqBlockFor(gx, gz);
      if (hqDistrict) {
        if (!VILLAGE_BUILDINGS && d === "downtown") {
          // Environment-first mode: the Kings' castle is gone (a flat, invisible, non-solid marker stays).
          list.push({ x: cx, z: cz, w: 16, d: 16, h: 1, type: "plaza", district: d });
        } else {
          list.push({ x: cx, z: cz, w: 16, d: 16, h: d === "downtown" ? KINGS_CASTLE_H : 11, type: "hq", district: d });
        }
        continue;
      }

      if (isHospitalBlock(gx, gz)) {
        // Environment-first mode: no hospital building in the Kings' land (healing still works).
        if (VILLAGE_BUILDINGS || d !== "downtown") {
          list.push({ x: cx, z: cz, w: 26, d: 20, h: 16, type: "hospital", district: d });
        }
        continue;
      }

      if (d === "downtown") {
        // The Kings' district is a medieval village. The shared random sequence is still advanced
        // exactly as before, so every other district keeps its old layout.
        const old = buildingForDistrict(d, r);
        if (gx === SQUARE_BLOCK.gx && gz === SQUARE_BLOCK.gz) {
          // The town square (drawn by medieval/TownSquare). A flat marker keeps random props out of it.
          list.push({ x: cx, z: cz, w: 44, d: 44, h: 1, type: "plaza", district: d });
        } else if (old.type === "plaza") {
          list.push({ x: cx, z: cz, w: old.w, d: old.depth, h: old.h, type: "plaza", district: d });
        } else {
          for (const c of makeCottages(gx, gz, cx, cz)) {
            list.push({
              x: c.x, z: c.z, w: c.w, d: c.d, h: c.h,
              type: "house", district: d, cottage: c.cottage,
              y0: groundHeight(c.x, c.z),
            });
          }
        }
        continue;
      }

      if (d === "residential") {
        const offsets: Array<[number, number]> = [
          [-16, -14],
          [15, -10],
          [-8, 16],
        ];
        for (const [ox, oz] of offsets) {
          list.push({
            x: cx + ox,
            z: cz + oz,
            w: 8 + r() * 4,
            d: 8 + r() * 4,
            h: 5 + r() * 3,
            type: "house",
            district: d,
          });
        }
        continue;
      }

      const spec = buildingForDistrict(d, r);
      list.push({
        x: cx,
        z: cz,
        w: spec.w,
        d: spec.depth,
        h: spec.h,
        type: spec.type,
        district: d,
      });
      if (d === "harbor" && r() > 0.4) {
        list.push({
          x: cx + 14,
          z: cz + 6,
          w: 2,
          d: 2,
          h: 20 + r() * 8,
          type: "crane",
          district: d,
        });
      }
    }
  }
  return list;
})();

/** Village props you cannot walk through: wells, tree trunks, market stalls, the fountain. */
export const PROP_COLLIDERS: Solid[] = computePropColliders(BUILDINGS, BLOCK_SIZE, groundHeight);

// Collision tops are absolute heights (ground + building height), because the village is hilly.
const BUILDING_SOLIDS: Solid[] = BUILDINGS
  .filter((b) => b.type !== "crane" && b.type !== "plaza")
  .map((b) => ({ x: b.x, z: b.z, w: b.w, d: b.d, h: b.h + (b.y0 ?? 0) }));
const SOLIDS: Solid[] = [...BUILDING_SOLIDS, ...PROP_COLLIDERS];
// Things you can stand on top of: every building, plus low props (stalls, fountain, wells) but not trees.
const ROOFS: Solid[] = [
  ...BUILDING_SOLIDS,
  ...PROP_COLLIDERS.filter((p) => p.h - groundHeight(p.x, p.z) <= 2.6),
];

export const HOSPITALS: { x: number; z: number; district: District }[] = (
  Object.keys(HOSPITAL_BLOCKS) as District[]
).map((d) => {
  const [gx, gz] = HOSPITAL_BLOCKS[d];
  return { x: gx * BLOCK_SIZE, z: gz * BLOCK_SIZE, district: d };
});

export function nearestHospitalDistance(x: number, z: number): number {
  let best = Infinity;
  for (const h of HOSPITALS) {
    const dist = Math.hypot(x - h.x, z - h.z);
    if (dist < best) best = dist;
  }
  return best;
}

function hqWorld(d: District): { x: number; z: number } {
  const [gx, gz] = HQ_BLOCKS[d];
  return { x: gx * BLOCK_SIZE, z: gz * BLOCK_SIZE };
}

/** Public HQ-coordinate lookup for any district (not just the 4 gang HQs). */
export function districtHQ(d: District): { x: number; z: number } {
  return hqWorld(d);
}

export const GANG_HQ: Record<0 | 1 | 2 | 3, { x: number; z: number }> = {
  0: hqWorld("downtown"),
  1: hqWorld("industrial"),
  2: hqWorld("shopping"),
  3: hqWorld("harbor"),
};

export const HELI_PADS: Record<0 | 1 | 2 | 3, { x: number; z: number }[]> = {
  0: [{ x: GANG_HQ[0].x - 14, z: GANG_HQ[0].z - 20 }, { x: GANG_HQ[0].x + 14, z: GANG_HQ[0].z - 20 }],
  1: [{ x: GANG_HQ[1].x - 14, z: GANG_HQ[1].z - 20 }, { x: GANG_HQ[1].x + 14, z: GANG_HQ[1].z - 20 }],
  2: [{ x: GANG_HQ[2].x - 14, z: GANG_HQ[2].z - 20 }, { x: GANG_HQ[2].x + 14, z: GANG_HQ[2].z - 20 }],
  3: [{ x: GANG_HQ[3].x - 14, z: GANG_HQ[3].z - 20 }, { x: GANG_HQ[3].x + 14, z: GANG_HQ[3].z - 20 }],
};

export const DISTRICT_LABELS: { name: string; district: District; x: number; z: number }[] = [
  { name: "THE HOLLOW QUARTER", district: "downtown", ...hqWorld("downtown") },
  { name: "THE ASHEN FORGE", district: "industrial", ...hqWorld("industrial") },
  { name: "THE RING OF ECHOES", district: "stadium", ...hqWorld("stadium") },
  { name: "THE ARCHIVE OF NOTHING", district: "bank", ...hqWorld("bank") },
  { name: "THE VEILED EXCHANGE", district: "shopping", ...hqWorld("shopping") },
  { name: "THE STILL SHORE", district: "harbor", ...hqWorld("harbor") },
  { name: "THE LOST HEARTHS", district: "residential", ...hqWorld("residential") },
  { name: "THE SHARD SANCTUM", district: "airport", ...hqWorld("airport") },
  { name: "THE HALL OF FATES", district: "casino", ...hqWorld("casino") },
  { name: "MEMORY GATE", district: "chinatown", ...hqWorld("chinatown") },
  { name: "THE FRACTURED REFUGE", district: "slums", ...hqWorld("slums") },
  { name: "THE SILENT GROVE", district: "park", ...hqWorld("park") },
  { name: "THE PALE ASCENT", district: "uptown", ...hqWorld("uptown") },
];

/** Human-readable label for a district, e.g. "downtown" -> "DOWNTOWN". */
export function districtLabel(d: District): string {
  return DISTRICT_LABELS.find((l) => l.district === d)?.name ?? d.toUpperCase();
}

export const NEUTRAL_HQS: { district: District; x: number; z: number }[] = [
  { district: "stadium", ...hqWorld("stadium") },
  { district: "bank", ...hqWorld("bank") },
  { district: "airport", ...hqWorld("airport") },
  { district: "casino", ...hqWorld("casino") },
  { district: "chinatown", ...hqWorld("chinatown") },
  { district: "slums", ...hqWorld("slums") },
  { district: "park", ...hqWorld("park") },
  { district: "uptown", ...hqWorld("uptown") },
];

export const ROBBABLE_BANKS: { id: number; x: number; z: number }[] = BUILDINGS
  .map((b, i) => ({ b, i }))
  .filter(({ b }) => b.type === "bank")
  .slice(0, 3)
  .map(({ b, i }) => ({ id: i, x: b.x, z: b.z }));

export const CAPTURE_RADIUS = 16;
export const VAULT_RADIUS = 8;

export const HARBOR_Z = -GRID * BLOCK_SIZE - BLOCK_SIZE / 2;

export const WEAPON_SHOPS: Record<0 | 1 | 2 | 3, { x: number; z: number }> = {
  0: { x: GANG_HQ[0].x + 16, z: GANG_HQ[0].z },
  1: { x: GANG_HQ[1].x + 16, z: GANG_HQ[1].z },
  2: { x: GANG_HQ[2].x + 16, z: GANG_HQ[2].z },
  3: { x: GANG_HQ[3].x + 16, z: GANG_HQ[3].z },
};
export const SHOP_RADIUS = 7;

// ---------------------------------------------------------------------------
// Collision
// ---------------------------------------------------------------------------

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
  for (const b of SOLIDS) {
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

// Height of the surface under (x,z): the rolling ground, or the highest building roof / low prop on top
// of it. Every real building counts as landable roof surface — only crane (near-zero footprint) and
// plaza (ground-level decoration) are excluded.
export function rooftopHeightAt(x: number, z: number): number {
  let best = groundHeight(x, z);
  for (const b of ROOFS) {
    if (x > b.x - b.w / 2 && x < b.x + b.w / 2 && z > b.z - b.d / 2 && z < b.z + b.d / 2) {
      if (b.h > best) best = b.h;
    }
  }
  return best;
}
