import { BUILDINGS, districtAt } from "../worldData";
import { hash01, themeOf } from "../city/palette";
import { ROAD_LINES } from "../city/layout";

export type Fragment = {
  id: number; // 1..25, matches the server-side check
  x: number;
  y: number; // height of the crystal's resting point
  z: number;
  floor: number; // height you must be standing at to collect it
  kingdom: number;
  roof: boolean;
};

export const FRAGMENT_COUNT = 25;
const GROUND_COUNT = 13;

type Cand = { x: number; z: number; floor: number; score: number; roof: boolean };

function pick(cands: Cand[], n: number, chosen: Cand[], minSep: number): Cand[] {
  const out: Cand[] = [];
  for (const c of cands) {
    if (out.length >= n) break;
    const all = [...chosen, ...out];
    if (all.every((o) => Math.hypot(o.x - c.x, o.z - c.z) >= minSep)) out.push(c);
  }
  return out;
}

function build(): Fragment[] {
  // Street fragments sit at crossings, away from the world edge.
  const ground: Cand[] = [];
  for (let i = 1; i < ROAD_LINES.length - 1; i++) {
    for (let j = 1; j < ROAD_LINES.length - 1; j++) {
      ground.push({ x: ROAD_LINES[i], z: ROAD_LINES[j], floor: 0, roof: false, score: hash01(i, j, 201) });
    }
  }
  ground.sort((a, b) => a.score - b.score);

  // Rooftop fragments sit in the middle of tall roofs.
  const roofs: Cand[] = BUILDINGS.filter(
    (b) => ["tower", "casino", "brownstone", "bank", "pagoda", "mall"].includes(b.type) && b.h >= 10,
  )
    .map((b) => ({ x: b.x, z: b.z, floor: b.h, roof: true, score: hash01(b.x, b.z, 202) }))
    .sort((a, b) => a.score - b.score);

  let g = pick(ground, GROUND_COUNT, [], 150);
  let r = pick(roofs, FRAGMENT_COUNT - GROUND_COUNT, g, 150);
  if (g.length + r.length < FRAGMENT_COUNT) {
    // Relax the spacing if the map is too crowded.
    g = pick(ground, GROUND_COUNT, [], 100);
    r = pick(roofs, FRAGMENT_COUNT - GROUND_COUNT, g, 100);
  }

  return [...g, ...r].map((c, i) => ({
    id: i + 1,
    x: c.x,
    z: c.z,
    floor: c.floor,
    y: c.floor + 1.4,
    roof: c.roof,
    kingdom: themeOf(districtAt(c.x, c.z)).id,
  }));
}

// Deterministic: the same build always produces the same 25 places.
export const FRAGMENTS: Fragment[] = build();