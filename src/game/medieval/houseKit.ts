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

/** Pieces from other kits have unknown sizes, so they are measured in the game and scaled to this target. */
export type Fit = { axis: "h" | "len"; size: number };

export type Piece = {
  id: string;
  x: number; y: number; z: number;
  rotY: number;
  sx: number; sy: number; sz: number;
  fit?: Fit;
};

export const STOREY_H = 3.12;
/** The wall plane sits 0.10 m behind the origin, so shift pieces so the outer face is on the footprint edge. */
const FACE_SHIFT = 0.1;
/** If the plaster faces INTO the house, change this to Math.PI. */
export const FACE_OFFSET = 0;
/** Door leaves, chimneys, crates, barrels and fences. Set to false to switch them all off. */
const DECORATIONS = true;
/** The old cone-shaped Kenney trees. Off: the Foliage system (Stylized Nature kit) grows the trees now. */
const TREES = false;

// Total roof height above the eaves (model height), and how far the roof model reaches below its origin.
const ROOF_RISE: Record<number, number> = { 4: 4.25, 6: 5.67, 8: 6.78 };
const ROOF_Y0: Record<number, number> = { 4: 0.52, 6: 0.78, 8: 0.78 };
export const roofRise = (W: number) => ROOF_RISE[W] ?? 5;

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
const DOOR_LEAF = "village-door-1-flat";
const CHIMNEY = "village-prop-chimney";
const CRATE = "village-prop-crate";
const FENCE = "village-prop-woodenfence-single"; // 2.06 m long, along x
const BARREL = "detail-barrel";

// Target sizes (metres) for pieces whose real size is not known.
const FIT: Record<string, Fit> = {
  "tree-large": { axis: "h", size: 7.5 },
  "tree-small": { axis: "h", size: 4.8 },
  "tree-shrub": { axis: "h", size: 1.4 },
  "rocks-small": { axis: "h", size: 0.7 },
  "detail-barrel": { axis: "h", size: 1.05 },
};
const TREE_IDS = ["tree-large", "tree-small", "tree-shrub", "rocks-small"];

/** Every model id the cottages and their yards need (loaded once, then baked into merged meshes). */
export const KIT_IDS: string[] = Array.from(
  new Set([
    ...Object.values(PLASTER),
    ...Object.values(BRICK),
    CORNER,
    DOOR_LEAF,
    CHIMNEY,
    CRATE,
    FENCE,
    BARREL,
    ...(TREES ? TREE_IDS : []),
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

/** A stable 0..1 value per cottage (no extra random numbers, so the village layout does not change). */
function decoValue(c: Cottage) {
  const n = c.W * 7 + c.D * 13 + c.seed * 31 + (c.brick ? 5 : 0) + Math.round((c.rot * 2) / Math.PI) * 17 + c.storeys * 3;
  return (n % 10) / 10;
}

/** Hay bales beside some cottages, around the cottage centre before rotation (drawn by Yardwork). */
export function hayFor(c: Cottage): { x: number; z: number; rot: number }[] {
  const deco = decoValue(c);
  if (deco >= 0.6) {
    return [
      { x: -c.W / 2 - 1.7, z: -c.D / 4, rot: deco * 5 },
      { x: -c.W / 2 - 1.7, z: -c.D / 4 + 1.15, rot: deco * 3 },
    ];
  }
  if (deco < 0.2) return [{ x: c.W / 2 + 1.7, z: c.D / 4, rot: deco * 7 }];
  return [];
}

/**
 * Block-level yard: a well at the centre of some blocks (and, if TREES is on, old-style trees).
 * `rects` are the cottages of the block (their x, z and rotated width / depth).
 */
export function yardLayout(
  gx: number,
  gz: number,
  cx: number,
  cz: number,
  rects: { x: number; z: number; w: number; d: number }[],
): { wells: { x: number; z: number }[]; trees: Piece[] } {
  const r = rng((gx + 30) * 2003 + (gz + 30) * 7919 + 555);
  r(); r();
  const free = (x: number, z: number, pad: number) =>
    !rects.some((b) => Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad);

  const wells: { x: number; z: number }[] = [];
  if (r() < 0.6 && free(cx, cz, 3.4)) wells.push({ x: cx, z: cz });

  const trees: Piece[] = [];
  if (TREES) {
    for (let k = 0; k < 16 && trees.length < 6; k++) {
      const x = cx + (r() - 0.5) * 40;
      const z = cz + (r() - 0.5) * 40;
      const kind = r();
      const rot = r() * Math.PI * 2;
      if (!free(x, z, 3.6)) continue;
      if (wells.length && Math.hypot(x - cx, z - cz) < 4.5) continue;
      const id = kind < 0.35 ? "tree-large" : kind < 0.65 ? "tree-small" : kind < 0.85 ? "tree-shrub" : "rocks-small";
      trees.push({ id, x, y: 0, z, rotY: rot, sx: 1, sy: 1, sz: 1, fit: FIT[id] });
    }
  }
  return { wells, trees };
}

/** The pieces of one cottage, around its own centre, before the house rotation is applied. */
export function buildHouseLocal(c: Cottage): Piece[] {
  const set = c.brick ? BRICK : PLASTER;
  const out: Piece[] = [];
  const nx = c.W / 2;
  const nz = c.D / 2;
  const wall = (id: string, x: number, y: number, z: number, rotY: number) =>
    out.push({ id, x, y, z, rotY: rotY + FACE_OFFSET, sx: 1, sy: 1, sz: 1 });
  const mid = Math.floor((nx - 1) / 2);
  const doorX = -c.W / 2 + 1 + 2 * mid;

  for (let s = 0; s < c.storeys; s++) {
    const y = s * STOREY_H;
    const ground = s === 0;
    const plain = ground ? set.base : set.straight;

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

  const wallTop = c.storeys * STOREY_H;
  out.push({
    id: `village-roof-roundtiles-${c.W}x${c.D}`,
    x: 0,
    y: wallTop + (ROOF_Y0[c.W] ?? 0.6),
    z: 0,
    rotY: 0,
    sx: 1, sy: 1, sz: 1,
  });

  if (DECORATIONS) {
    const deco = decoValue(c);
    // The door leaf hangs on its left edge; the model is centred 0.51 m to the right of its origin.
    out.push({ id: DOOR_LEAF, x: doorX - 0.51, y: 0, z: c.D / 2 - FACE_SHIFT - 0.11, rotY: FACE_OFFSET, sx: 1, sy: 1, sz: 1 });
    // A chimney through the ridge on most cottages.
    if (deco >= 0.3) {
      const zc = (deco > 0.65 ? -1 : 1) * (c.D / 4);
      out.push({ id: CHIMNEY, x: 0, y: wallTop + roofRise(c.W) - 1.5, z: zc, rotY: 0, sx: 1, sy: 1, sz: 1 });
    }
    // A crate by the front corner on some.
    if (deco < 0.5) {
      out.push({ id: CRATE, x: c.W / 2 - 0.2, y: 0, z: c.D / 2 + 0.7, rotY: deco * 3, sx: 1, sy: 1, sz: 1 });
    }
    // A barrel by the other front corner.
    if (deco >= 0.3 && deco < 0.8) {
      out.push({ id: BARREL, x: -c.W / 2 + 0.3, y: 0, z: c.D / 2 + 0.7, rotY: 0, sx: 1, sy: 1, sz: 1, fit: FIT[BARREL] });
    }
    // A picket fence across the front yard, with a gap at the door.
    if (deco >= 0.5 && deco < 0.9) {
      for (let x = -c.W / 2 - 1; x <= c.W / 2 + 1.01; x += 2) {
        if (Math.abs(x - doorX) < 1.2) continue;
        out.push({ id: FENCE, x, y: 0, z: c.D / 2 + 2.6, rotY: 0, sx: 1, sy: 1, sz: 1 });
      }
    }
  }
  return out;
}
