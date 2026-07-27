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
  | "house";

export type District =
  | "downtown"
  | "industrial"
  | "stadium"
  | "bank"
  | "shopping"
  | "harbor"
  | "residential";

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
export const GRID = 4;

export function districtFor(gx: number, gz: number): District {
  if (gz <= -3) return "harbor";
  if (gx <= -3) return "industrial";
  if (gx >= 3 && gz >= 3) return "stadium";
  if (gx >= 2 && gz <= -2) return "bank";
  if (gz >= 2) return "shopping";
  if (gx <= -1 && gx >= -2 && gz >= 0 && gz <= 1) return "residential";
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
      return { type: "tower", w: 12 + r() * 6, depth: 12 + r() * 6, h: 32 + r() * 40 };
    case "industrial":
      return { type: "warehouse", w: 22 + r() * 10, depth: 18 + r() * 8, h: 8 + r() * 4 };
    case "stadium":
      return { type: "stadium", w: 34, depth: 34, h: 14 };
    case "bank":
      return { type: "bank", w: 20 + r() * 4, depth: 20 + r() * 4, h: 42 + r() * 20 };
    case "shopping":
      return { type: "lowrise", w: 22 + r() * 6, depth: 16 + r() * 4, h: 6 + r() * 4 };
    case "harbor":
      return { type: "harbor", w: 20 + r() * 6, depth: 14 + r() * 4, h: 5 + r() * 3 };
    case "residential":
      // Not used directly — residential blocks get several small houses instead
      // of one big building (see the generation loop below).
      return { type: "house", w: 9, depth: 9, h: 6 };
  }
}

const HOSPITAL_BLOCKS: Array<[number, number]> = [
  [0, 0],
  [-3, 0],
  [4, 4],
  [3, -2],
  [0, 2],
  [0, -3],
];
function isHospitalBlock(gx: number, gz: number) {
  return HOSPITAL_BLOCKS.some(([hx, hz]) => hx === gx && hz === gz);
}

export const BUILDINGS: BuildingBox[] = (() => {
  const r = rng(20260726);
  const list: BuildingBox[] = [];
  for (let gx = -GRID; gx <= GRID; gx++) {
    for (let gz = -GRID; gz <= GRID; gz++) {
      const cx = gx * BLOCK_SIZE;
      const cz = gz * BLOCK_SIZE;
      const d = districtFor(gx, gz);

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

export const HOSPITALS: { x: number; z: number; district: District }[] = HOSPITAL_BLOCKS.map(
  ([gx, gz]) => ({ x: gx * BLOCK_SIZE, z: gz * BLOCK_SIZE, district: districtFor(gx, gz) }),
);

export function nearestHospitalDistance(x: number, z: number): number {
  let best = Infinity;
  for (const h of HOSPITALS) {
    const dx = x - h.x;
    const dz = z - h.z;
    const dist = Math.hypot(dx, dz);
    if (dist < best) best = dist;
  }
  return best;
}

export const GANG_HQ: Record<0 | 1 | 2 | 3, { x: number; z: number }> = {
  0: { x: 24, z: -24 },
  1: { x: -168, z: 24 },
  2: { x: 24, z: 152 },
  3: { x: 24, z: -168 },
};

export const DISTRICT_LABELS: { name: string; district: District; x: number; z: number }[] = [
  { name: "DOWNTOWN", district: "downtown", x: 0, z: 40 },
  { name: "INDUSTRIAL AREA", district: "industrial", x: -192, z: 60 },
  { name: "STADIUM", district: "stadium", x: 256, z: 300 },
  { name: "BANK DISTRICT", district: "bank", x: 192, z: -170 },
  { name: "SHOPPING DISTRICT", district: "shopping", x: 0, z: 170 },
  { name: "HARBOR", district: "harbor", x: 0, z: -230 },
  { name: "RESIDENTIAL AREA", district: "residential", x: -96, z: 32 },
];

export const NEUTRAL_HQS: { district: District; x: number; z: number }[] = [
  { district: "stadium", x: 256, z: 300 },
  { district: "bank", x: 192, z: -170 },
];

export const ROBBABLE_BANKS: { id: number; x: number; z: number }[] = BUILDINGS
  .map((b, i) => ({ b, i }))
  .filter(({ b }) => b.type === "bank")
  .slice(0, 3)
  .map(({ b, i }) => ({ id: i, x: b.x, z: b.z }));

export const CAPTURE_RADIUS = 15;
export const VAULT_RADIUS = 8;

export const HARBOR_Z = -GRID * BLOCK_SIZE - BLOCK_SIZE / 2;

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
    if (b.type === "crane") continue;
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
    if (b.type === "crane") continue;
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