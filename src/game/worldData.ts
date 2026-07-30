
// Shared world layout: districts, building AABBs used for rendering + collision.

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
  | "hangar"
  | "casino"
  | "pagoda"
  | "shanty"
  | "brownstone"
  | "hq";

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
  "downtown", "industrial", "stadium", "bank", "shopping", "harbor",
  "residential", "airport", "casino", "chinatown", "slums", "park", "uptown",
];

export type BuildingBox = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  type: BuildingType;
  district: District;
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
// Grew from 6 -> 8 to make room for the six new dominatable districts.
export const GRID = 8;

export function districtFor(gx: number, gz: number): District {
  if (gz <= -6) return "harbor";
  if (gx <= -6) return "industrial";
  if (gx >= 6 && gz >= 6) return "stadium";
  if (gz >= 6) return "shopping";
  if (gx >= 5 && gz <= -3) return "bank";
  if (gx <= -4 && gz <= -3) return "airport";
  if (gx >= 2 && gx <= 4 && gz <= -2) return "casino";
  if (gx >= 4 && gz >= 2) return "chinatown";
  if (gx <= -4 && gz >= 2) return "slums";
  if (gx >= -3 && gx <= -1 && gz >= 0 && gz <= 2) return "residential";
  if (gz >= 3 && gz <= 5 && gx >= -3 && gx <= 3) return "park";
  if (gx <= -4) return "uptown";
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
      return { type: "hangar", w: 30 + r() * 8, depth: 24 + r() * 6, h: 11 + r() * 3 };
    case "casino":
      return { type: "casino", w: 24 + r() * 6, depth: 22 + r() * 5, h: 20 + r() * 14 };
    case "chinatown":
      return { type: "pagoda", w: 16 + r() * 4, depth: 16 + r() * 4, h: 12 + r() * 8 };
    case "slums":
      return { type: "shanty", w: 12 + r() * 5, depth: 11 + r() * 5, h: 5 + r() * 3 };
    case "park":
      if (r() < 0.65) return { type: "plaza", w: 24, depth: 24, h: 1 };
      return { type: "lowrise", w: 14 + r() * 4, depth: 12 + r() * 4, h: 5 + r() * 3 };
    case "uptown":
      return { type: "brownstone", w: 16 + r() * 5, depth: 14 + r() * 4, h: 16 + r() * 12 };
  }
}

const HQ_BLOCKS: Record<District, [number, number]> = {
  downtown: [1, -1],
  industrial: [-7, 1],
  stadium: [7, 7],
  bank: [6, -4],
  shopping: [0, 7],
  harbor: [0, -7],
  residential: [-2, 1],
  airport: [-5, -4],
  casino: [3, -3],
  chinatown: [5, 3],
  slums: [-5, 3],
  park: [0, 4],
  uptown: [-5, 0],
};
function hqBlockFor(gx: number, gz: number): District | null {
  for (const d of Object.keys(HQ_BLOCKS) as District[]) {
    const [hx, hz] = HQ_BLOCKS[d];
    if (hx === gx && hz === gz) return d;
  }
  return null;
}

const HOSPITAL_BLOCKS: Record<District, [number, number]> = {
  downtown: [2, -1],
  industrial: [-7, -1],
  stadium: [6, 7],
  bank: [6, -5],
  shopping: [1, 7],
  harbor: [1, -7],
  residential: [-1, 2],
  airport: [-5, -5],
  casino: [4, -3],
  chinatown: [5, 4],
  slums: [-5, 4],
  park: [2, 5],
  uptown: [-4, 0],
};
function isHospitalBlock(gx: number, gz: number) {
  return (Object.values(HOSPITAL_BLOCKS) as [number, number][]).some(([hx, hz]) => hx === gx && hz === gz);
}

// Sub-lot offsets used to break single-building blocks into denser clusters so
// the larger map doesn't read as empty.
const CLUSTER_OFFSETS: Array<[number, number]> = [
  [-17, -15],
  [16, -11],
  [-9, 17],
  [15, 15],
];

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
        list.push({ x: cx, z: cz, w: 16, d: 16, h: 11, type: "hq", district: d });
        continue;
      }

      if (isHospitalBlock(gx, gz)) {
        list.push({ x: cx, z: cz, w: 26, d: 20, h: 16, type: "hospital", district: d });
        continue;
      }

      // Low-rise districts fill their block with a cluster of small buildings.
      if (d === "residential" || d === "slums" || d === "chinatown") {
        const count = d === "chinatown" ? 3 : 4;
        for (let i = 0; i < count; i++) {
          const [ox, oz] = CLUSTER_OFFSETS[i];
          const spec = buildingForDistrict(d, r);
          list.push({
            x: cx + ox,
            z: cz + oz,
            w: Math.min(spec.w, 14),
            d: Math.min(spec.depth, 14),
            h: spec.h,
            type: spec.type,
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

      // Secondary filler building on larger lots keeps density up.
      if (r() > 0.45 && d !== "stadium" && d !== "park") {
        const filler = buildingForDistrict(d, r);
        list.push({
          x: cx + 20,
          z: cz + 18,
          w: Math.min(filler.w, 15),
          d: Math.min(filler.depth, 14),
          h: filler.h * 0.7,
          type: filler.type === "plaza" ? "lowrise" : filler.type,
          district: d,
        });
      }

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

/** World position of a district's headquarters (capture point). */
export function districtHQ(d: District): { x: number; z: number } {
  return hqWorld(d);
}

export const GANG_HQ: Record<0 | 1 | 2 | 3, { x: number; z: number }> = {
  0: hqWorld("downtown"),
  1: hqWorld("industrial"),
  2: hqWorld("shopping"),
  3: hqWorld("harbor"),
};

/** The four gang home districts, indexed by gang id. */
export const GANG_HOME_DISTRICT: Record<0 | 1 | 2 | 3, District> = {
  0: "downtown",
  1: "industrial",
  2: "shopping",
  3: "harbor",
};

// Dedicated helicopter pad, offset away from the HQ building itself so the
// two don't overlap (they used to share a spot, which buried the helicopter
// inside the HQ building — that was the "missing helicopter" bug).
export const HELI_PADS: Record<0 | 1 | 2 | 3, { x: number; z: number }> = {
  0: { x: GANG_HQ[0].x, z: GANG_HQ[0].z - 20 },
  1: { x: GANG_HQ[1].x, z: GANG_HQ[1].z - 20 },
  2: { x: GANG_HQ[2].x, z: GANG_HQ[2].z - 20 },
  3: { x: GANG_HQ[3].x, z: GANG_HQ[3].z - 20 },
};

export const DISTRICT_LABELS: { name: string; district: District; x: number; z: number }[] = [
  { name: "DOWNTOWN", district: "downtown", ...hqWorld("downtown") },
  { name: "INDUSTRIAL AREA", district: "industrial", ...hqWorld("industrial") },
  { name: "STADIUM", district: "stadium", ...hqWorld("stadium") },
  { name: "BANK DISTRICT", district: "bank", ...hqWorld("bank") },
  { name: "SHOPPING DISTRICT", district: "shopping", ...hqWorld("shopping") },
  { name: "HARBOR", district: "harbor", ...hqWorld("harbor") },
  { name: "RESIDENTIAL AREA", district: "residential", ...hqWorld("residential") },
  { name: "AIRPORT", district: "airport", ...hqWorld("airport") },
  { name: "CASINO STRIP", district: "casino", ...hqWorld("casino") },
  { name: "CHINATOWN", district: "chinatown", ...hqWorld("chinatown") },
  { name: "THE SLUMS", district: "slums", ...hqWorld("slums") },
  { name: "CENTRAL PARK", district: "park", ...hqWorld("park") },
  { name: "UPTOWN", district: "uptown", ...hqWorld("uptown") },
];

export function districtLabel(d: District): string {
  return DISTRICT_LABELS.find((l) => l.district === d)?.name ?? d.toUpperCase();
}

/** Districts that start unowned and can be dominated by any gang. */
export const NEUTRAL_DISTRICTS: District[] = [
  "stadium", "bank", "residential", "airport", "casino", "chinatown", "slums", "park", "uptown",
];

export const NEUTRAL_HQS: { district: District; x: number; z: number }[] =
  NEUTRAL_DISTRICTS.map((district) => ({ district, ...hqWorld(district) }));

/** Districts whose streets get unarmed civilian residents. */
export const CIVILIAN_DISTRICTS: District[] = [
  "residential", "slums", "chinatown", "park", "uptown", "casino", "airport", "shopping",
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

/**
 * Building collision. `y` lets an entity that is above a building's roof pass
 * over it (used for rooftop walking and low-flying helicopters).
 */
export function resolveCollision(
  prevX: number,
  prevZ: number,
  nextX: number,
  nextZ: number,
  radius = 0.6,
  y = 0,
): { x: number; z: number } {
  let x = nextX;
  let z = nextZ;
  for (const b of BUILDINGS) {
    if (b.type === "crane" || b.type === "plaza") continue;
    if (y >= b.h) continue;
    const minX = b.x - b.w / 2 - radius;
    const maxX = b.x + b.w / 2 + radius;
    const minZ = b.z - b.d / 2 - radius;
    const maxZ = b.z + b.d / 2 + radius;
    if (x > minX && x < maxX && z > minZ && z < maxZ) {
      if (!(prevX > minX && prevX < maxX && z > minZ && z < maxZ)) {
        x = prevX;
      } else if (!(x > minX && x < maxX && prevZ > minZ && prevZ < maxZ)) {
        z = prevZ;
      } else {
        x = prevX;
        z = prevZ;
      }
    }
  }
  return { x, z };
}

export function resolveHeliCollision(
  prevX: number,
  prevZ: number,
  nextX: number,
  nextZ: number,
  y: number,
  radius = 4,
): { x: number; z: number } {
  return resolveCollision(prevX, prevZ, nextX, nextZ, radius, y);
}

export function rooftopHeightAt(x: number, z: number): number {
  let best = 0;
  for (const b of BUILDINGS) {
    if (b.type === "crane" || b.type === "plaza") continue;
    if (x > b.x - b.w / 2 && x < b.x + b.w / 2 && z > b.z - b.d / 2 && z < b.z + b.d / 2) {
      if (b.h > best) best = b.h;
    }
  }
  return best;
}
