// Models added after the generated manifest was last built:
//  - the Quaternius Medieval Village MegaKit (176 pieces, shared textures live next to the .glb files)
//  - the four complete character outfits (skinned, Unreal-style skeleton, textures embedded)
// Kept in its own file so regenerating manifest.ts cannot wipe it out.
// Use anyModelUrl(id) for any model, old or new.

import { MODELS, type ModelEntry } from "./manifest";

const village = (rows: [string, number][]): ModelEntry[] =>
  rows.map(([id, sizeKb]) => ({
    id,
    url: `/models/buildings/${id}.glb`,
    category: "buildings",
    format: "glb",
    sizeKb,
  }));

export const VILLAGE_MODELS: ModelEntry[] = village([
  ["village-balcony-cross-corner",19],["village-balcony-cross-straight",10],["village-balcony-simple-corner",122],["village-balcony-simple-straight",62],
  ["village-corner-exterior-brick",95],["village-corner-exterior-topdown",2],["village-corner-exterior-toponly",2],["village-corner-exterior-wood",2],
  ["village-corner-exteriorwide-brick",89],["village-corner-exteriorwide-wood",3],["village-corner-interior-big",3],["village-corner-interior-small",2],
  ["village-door-1-flat",27],["village-door-1-round",35],["village-door-2-flat",194],["village-door-2-round",208],
  ["village-door-4-flat",69],["village-door-4-round",78],["village-door-8-flat",57],["village-door-8-round",70],
  ["village-doorframe-flat-brick",59],["village-doorframe-flat-wooddark",5],["village-doorframe-round-brick",64],["village-doorframe-round-wooddark",15],
  ["village-floor-brick",2],["village-floor-redbrick",2],["village-floor-unevenbrick",2],["village-floor-wooddark-half1",3],
  ["village-floor-wooddark-half2",3],["village-floor-wooddark-half3",2],["village-floor-wooddark-overhangcorner",2],["village-floor-wooddark-overhangcorner2",3],
  ["village-floor-wooddark",3],["village-floor-woodlight-overhangcorner",2],["village-floor-woodlight-overhangcorner2",3],["village-floor-woodlight",3],
  ["village-holecover-90angle",3],["village-holecover-90half",2],["village-holecover-90stairs",3],["village-holecover-straight",2],
  ["village-holecover-straighthalf",2],["village-overhang-plaster-corner-front",11],["village-overhang-plaster-corner",22],["village-overhang-plaster-long",14],
  ["village-overhang-plaster-short",14],["village-overhang-roof-plaster",5],["village-overhang-roof-unevenbricks",5],["village-overhang-roofincline-plaster",5],
  ["village-overhang-roofincline-unevenbricks",5],["village-overhang-side-plaster-long-l",22],["village-overhang-side-plaster-long-r",22],["village-overhang-side-plaster-short-l",21],
  ["village-overhang-side-plaster-short-r",21],["village-overhang-side-unevenbrick-long-l",21],["village-overhang-side-unevenbrick-long-r",21],["village-overhang-side-unevenbrick-short-l",21],
  ["village-overhang-side-unevenbrick-short-r",21],["village-overhang-unevenbrick-corner-front",7],["village-overhang-unevenbrick-corner",21],["village-overhang-unevenbrick-long",14],
  ["village-overhang-unevenbrick-short",14],["village-prop-brick1",5],["village-prop-brick2",4],["village-prop-brick3",5],
  ["village-prop-brick4",5],["village-prop-chimney",22],["village-prop-chimney2",6],["village-prop-crate",17],
  ["village-prop-exteriorborder-corner",3],["village-prop-exteriorborder-straight1",2],["village-prop-exteriorborder-straight2",2],["village-prop-metalfence-ornament",149],
  ["village-prop-metalfence-simple",102],["village-prop-support",2],["village-prop-vine1",7],["village-prop-vine2",4],
  ["village-prop-vine4",4],["village-prop-vine5",8],["village-prop-vine6",8],["village-prop-vine9",4],
  ["village-prop-wagon",102],["village-prop-woodenfence-extension1",4],["village-prop-woodenfence-extension2",3],["village-prop-woodenfence-single",4],
  ["village-roof-2x4-roundtile",62],["village-roof-dormer-roundtile",64],["village-roof-front-brick2",7],["village-roof-front-brick4-half-l",10],
  ["village-roof-front-brick4-half-r",10],["village-roof-front-brick4",15],["village-roof-front-brick6-half-l",13],["village-roof-front-brick6-half-r",13],
  ["village-roof-front-brick6",21],["village-roof-front-brick8-half-l",14],["village-roof-front-brick8-half-r",14],["village-roof-front-brick8",24],
  ["village-roof-frontsupports",5],["village-roof-log",8],["village-roof-modular-roundtiles",9],["village-roof-roundtile-2x1-long",42],
  ["village-roof-roundtile-2x1",40],["village-roof-roundtiles-4x4",107],["village-roof-roundtiles-4x6",129],["village-roof-roundtiles-4x8",156],
  ["village-roof-roundtiles-6x10",208],["village-roof-roundtiles-6x12",227],["village-roof-roundtiles-6x14",249],["village-roof-roundtiles-6x4",114],
  ["village-roof-roundtiles-6x6",166],["village-roof-roundtiles-6x8",186],["village-roof-roundtiles-8x10",223],["village-roof-roundtiles-8x12",313],
  ["village-roof-roundtiles-8x14",260],["village-roof-roundtiles-8x8",193],["village-roof-support2",6],["village-roof-tower-roundtiles",203],
  ["village-roof-wooden-2x1-center-mirror",7],["village-roof-wooden-2x1-center",7],["village-roof-wooden-2x1-corner",9],["village-roof-wooden-2x1-l",16],
  ["village-roof-wooden-2x1-middle",3],["village-roof-wooden-2x1-r",16],["village-roof-wooden-2x1",21],["village-stair-interior-rails",134],
  ["village-stair-interior-simple",16],["village-stair-interior-solid",22],["village-stair-interior-solidextended",26],["village-stairs-exterior-nofirststep",6],
  ["village-stairs-exterior-platform",4],["village-stairs-exterior-platform45",5],["village-stairs-exterior-platform45clean",5],["village-stairs-exterior-platformu",6],
  ["village-stairs-exterior-sideplatform",4],["village-stairs-exterior-sides",2],["village-stairs-exterior-sides45",3],["village-stairs-exterior-sidesu",4],
  ["village-stairs-exterior-singleside",2],["village-stairs-exterior-singlesidethick",2],["village-stairs-exterior-straight-center",4],["village-stairs-exterior-straight-l",6],
  ["village-stairs-exterior-straight-r",6],["village-stairs-exterior-straight",6],["village-wall-arch",11],["village-wall-bottomcover",3],
  ["village-wall-plaster-door-flat",10],["village-wall-plaster-door-round",12],["village-wall-plaster-door-roundinset",13],["village-wall-plaster-straight-base",7],
  ["village-wall-plaster-straight-l",8],["village-wall-plaster-straight-r",8],["village-wall-plaster-straight",8],["village-wall-plaster-window-thin-round",13],
  ["village-wall-plaster-window-wide-flat",9],["village-wall-plaster-window-wide-flat2",10],["village-wall-plaster-window-wide-round",10],["village-wall-plaster-woodgrid",19],
  ["village-wall-unevenbrick-door-flat",6],["village-wall-unevenbrick-door-round",8],["village-wall-unevenbrick-straight",6],["village-wall-unevenbrick-window-thin-round",11],
  ["village-wall-unevenbrick-window-wide-flat",8],["village-wall-unevenbrick-window-wide-round",9],["village-window-roof-thin",6],["village-window-roof-wide",8],
  ["village-window-thin-flat1",10],["village-window-thin-round1",28],["village-window-wide-flat1",13],["village-window-wide-round1",24],
  ["village-windowshutters-thin-flat-closed",10],["village-windowshutters-thin-flat-open",10],["village-windowshutters-thin-round-closed",11],["village-windowshutters-thin-round-open",11],
  ["village-windowshutters-wide-flat-closed",12],["village-windowshutters-wide-flat-open",12],["village-windowshutters-wide-round-closed",13],["village-windowshutters-wide-round-open",13],
]);

/** Complete skinned outfits (peasant / ranger). They need the Universal Base Characters heads and a matching skeleton animation set. */
export const OUTFIT_MODELS: ModelEntry[] = [
  ["female-peasant-outfit", 746],
  ["female-ranger-outfit", 2095],
  ["male-peasant-outfit", 807],
  ["male-ranger-outfit", 1883],
].map(([id, sizeKb]) => ({
  id: id as string,
  url: `/models/characters/${id}.glb`,
  category: "characters" as const,
  format: "glb" as const,
  sizeKb: sizeKb as number,
}));

const seen = new Set<string>();
/** Every model: the generated manifest plus the extras above (no duplicates). */
export const ALL_MODELS: ModelEntry[] = [...MODELS, ...VILLAGE_MODELS, ...OUTFIT_MODELS].filter((m) => {
  if (seen.has(m.id)) return false;
  seen.add(m.id);
  return true;
});

const BY_ID = new Map(ALL_MODELS.map((m) => [m.id, m]));

export function anyModelUrl(id: string): string {
  const entry = BY_ID.get(id);
  if (!entry) throw new Error(`Unknown model id: ${id}`);
  return entry.url;
}

export function anyModel(id: string): ModelEntry | undefined {
  return BY_ID.get(id);
}
