// Medieval cottages for the Kings' district, built from the Quaternius Medieval Village MegaKit.
// Plain data only (no three.js), so worldData.ts can use it for layout and collision.
//
// Measured piece sizes (metres): wall modules are 2.0 wide x 3.12 high x 0.41 thick, origin at the
// bottom centre, wall plane runs from z=-0.31 to z=+0.10. Roofs are whole pre-built roofs named
// roundtiles-WxD (W = width along x, D = length along z, ridge runs along z, gables included).

export type Cottage = {
  /** Rotation around Y in quarter turns (0, PI/2, PI, 3PI/2). 0 = front door faces +z. */
  rot: number;
  /** Footprint width (x) and depth (z) before rotation, in metres. Multiples of 2. */
  W: number;
  D: number;
  storeys: 1 | 2;
  brick: boolean;
  seed: number;
};

export type CottageBox = { x: number; z: number; w: number; d: number; h: number; cottage: Cottage };

export type Piece = {
  id: string;
  x: number; y: number; z: number;
  rotY: number;
  sx: number; sy: number; sz: number;
};

export const STOREY_H = 3.12;
/** The wall plane sits 0.10 m behind the origin, so shift pieces so the outer face is on the footprint edge. */
const FACE_SHIFT = 0.1;
/** If the plaster faces INTO the house, change this to Math.PI. */
export const FACE_OFFSET = 0;

// Roof height above the eaves, and how far the roof model reaches below its origin.
const ROOF_RISE: Record<number, number> = { 4: 3.73, 6: 4.89, 8: 6.0 };
const ROOF_Y0: Record<number, number> = { 4: 0.52, 6: 0.78, 8: 0.78 };
export const roofRise = (W: number) => ROOF_RISE[W] ?? 4.5;

// Footprints that have a matching pre-built roof.
const DESIGNS: [number, number][] = [[4, 4], [4, 6], [4, 8], [6, 6], [6, 8], [6, 10], [8, 8], [8, 10]];

const PLASTER = {
  base: "village-wall-plaster-straight-base",
  straight: "village-wall-plaster-straight",
  door: "village-wall-plaster-door-flat",
  windowA: "village-wall-plaster-window-wide-flat",
  windowB: "village-wall-plaster-window-thin-round",
};
const BRICK = {
  base: "village-wall-unevenbrick-straight",
  straight: "village-wall-unevenbrick-straight",
  door: "village-wall-unevenbrick-door-flat",
  windowA: "village-wall-unevenbrick-window-wide-flat",
  windowB: "village-wall-unevenbrick-window-thin-round",
};
const CORNER = "village-corner-exterior-wood";

/** Every model id the cottages need (loaded once, then baked into merged meshes). */
export const KIT_IDS: string[] = Array.from(
  new Set([
    ...Object.values(PLASTER),
    ...Object.values(BRICK),
    CORNER,
    ...DESIGNS.map(([w, d]) => `village-roof-roundtiles-${w}x${d}`),
  ]),
);

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// Four building slots per 64 m block (the street takes 10 m on each side, leaving +-22 m of land).
const SLOTS: [number, number][] = [[-11, -11], [11, -11], [-11, 11], [11, 11]];

/** The cottages of one block. Uses its own random generator so the rest of the city is unchanged. */
export function makeCottages(gx: number, gz: number, cx: number, cz: number): CottageBox[] {
  const r = rng((gx + 20) * 1009 + (gz + 20) * 9176 + 12345);
  r(); r();
  const out: CottageBox[] = [];
  SLOTS.forEach(([ox, oz], i) => {
    const keep = r(), di = r(), st = r(), br = r(), ro = r(), jx = r(), jz = r();
    if (i >= 2 && keep > 0.8) return;
    const [W, D] = DESIGNS[Math.floor(di * DESIGNS.length)];
    const storeys: 1 | 2 = st < 0.35 ? 2 : 1;
    const rotIdx = Math.floor(ro * 4);
    const odd = rotIdx % 2 === 1;
    out.push({
      x: cx + ox + (jx - 0.5) * 2,
      z: cz + oz + (jz - 0.5) * 2,
      w: odd ? D : W,
      d: odd ? W : D,
      h: storeys * STOREY_H + roofRise(W),
      cottage: { rot: (rotIdx * Math.PI) / 2, W, D, storeys, brick: br < 0.35, seed: i },
    });
  });
  return out;
}

/** The pieces of one cottage, around its own centre, before the house rotation is applied. */
export function buildHouseLocal(c: Cottage): Piece[] {
  const set = c.brick ? BRICK : PLASTER;
  const out: Piece[] = [];
  const nx = c.W / 2;
  const nz = c.D / 2;
  const wall = (id: string, x: number, y: number, z: number, rotY: number) =>
    out.push({ id, x, y, z, rotY: rotY + FACE_OFFSET, sx: 1, sy: 1, sz: 1 });

  for (let s = 0; s < c.storeys; s++) {
    const y = s * STOREY_H;
    const ground = s === 0;
    const plain = ground ? set.base : set.straight;
    const mid = Math.floor((nx - 1) / 2);

    // Front (+z, outward = +z) and back (-z).
    for (let i = 0; i < nx; i++) {
      const x = -c.W / 2 + 1 + 2 * i;
      const front = ground && i === mid ? set.door : i % 2 === 0 ? set.windowA : plain;
      wall(front, x, y, c.D / 2 - FACE_SHIFT, 0);
      wall(i % 2 === 1 ? set.windowB : plain, x, y, -c.D / 2 + FACE_SHIFT, Math.PI);
    }
    // Sides (+x and -x).
    for (let j = 0; j < nz; j++) {
      const z = -c.D / 2 + 1 + 2 * j;
      const id = j % 2 === 1 ? set.windowA : plain;
      wall(id, c.W / 2 - FACE_SHIFT, y, z, Math.PI / 2);
      wall(id, -c.W / 2 + FACE_SHIFT, y, z, -Math.PI / 2);
    }
    // Corner posts.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        out.push({ id: CORNER, x: (sx * c.W) / 2, y, z: (sz * c.D) / 2, rotY: 0, sx: 1, sy: 1, sz: 1 });
      }
    }
  }

  out.push({
    id: `village-roof-roundtiles-${c.W}x${c.D}`,
    x: 0,
    y: c.storeys * STOREY_H + (ROOF_Y0[c.W] ?? 0.6),
    z: 0,
    rotY: 0,
    sx: 1, sy: 1, sz: 1,
  });
  return out;
}
