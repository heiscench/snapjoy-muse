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
  | "hq";

export type District =
  | "downtown"
  | "industrial"
  | "stadium"
  | "bank"
  | "shopping"
  | "harbor"
  | "residential";

export const ALL_DISTRICTS: District[] = [
  "downtown",
  "industrial",
  "stadium",
  "bank",
  "shopping",
  "harbor",
  "residential",
];

// Districts that get unarmed wandering civilians. Industrial + harbor are
// treated as gang/worker-only turf, so they're left out.
export const CIVILIAN_DISTRICTS: District[] = [
  "downtown",
  "stadium",
  "bank",
  "shopping",
  "residential",
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
export const GRID = 6;

export function districtFor(gx: number, gz: number): District {
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
        list.push({ x: cx, z: cz, w: 16, d: 16, h: 11, type: "hq", district: d });
        continue;
      }

      if (isHospitalBlock(gx, gz)) {
        list.push({ x: cx, z: cz, w: 26, d: 20, h: 16, type: "hospital", district: d });
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
  { name: "DOWNTOWN", district: "downtown", ...hqWorld("downtown") },
  { name: "INDUSTRIAL AREA", district: "industrial", ...hqWorld("industrial") },
  { name: "STADIUM", district: "stadium", ...hqWorld("stadium") },
  { name: "BANK DISTRICT", district: "bank", ...hqWorld("bank") },
  { name: "SHOPPING DISTRICT", district: "shopping", ...hqWorld("shopping") },
  { name: "HARBOR", district: "harbor", ...hqWorld("harbor") },
  { name: "RESIDENTIAL AREA", district: "residential", ...hqWorld("residential") },
];

/** Human-readable label for a district, e.g. "downtown" -> "DOWNTOWN". */
export function districtLabel(d: District): string {
  return DISTRICT_LABELS.find((l) => l.district === d)?.name ?? d.toUpperCase();
}

export const NEUTRAL_HQS: { district: District; x: number; z: number }[] = [
  { district: "stadium", ...hqWorld("stadium") },
  { district: "bank", ...hqWorld("bank") },
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

export function resolveCollision(
  prevX: number,
  prevZ: number,
  nextX: number,
  nextZ: number,
  radius = 0.6,
): { x: number; z: number } {
  let x = nextX;
  let z = nextZ;
  for (const b of BUILDINGS) {
    if (b.type === "crane" || b.type === "plaza") continue;
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

// Rooftop landing: returns the highest building-roof height directly under
// (x,z), or 0 if none. Every real building counts as landable roof surface —
// only crane (near-zero footprint) and plaza (ground-level decoration) are
// excluded. Houses and HQ buildings used to be excluded here too, which was
// the actual cause of players/helicopters sinking through them: with no
// registered roof, gravity just pulled straight through to y=0 inside the
// building, with no valid direction to resolve back out to.
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