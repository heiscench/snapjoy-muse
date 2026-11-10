import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import {
  CYCLE_SECONDS,
  daylightWeight,
  MIN_AMBIENT_INTENSITY,
  MIN_HEMISPHERE_INTENSITY,
  MIN_SUN_INTENSITY,
  MAX_SUN_INTENSITY,
} from "./dayNightConfig";
import { PLAYER_GANG } from "./gangs";
import { playerState } from "./playerState";
import { territoryState } from "./territoryState";
import { districtAt } from "./worldData";

// Extra light on top of the config values. Less flat ambient and a stronger sun give the land form
// and shadow (hillsides, tree trunks) like the reference art, instead of a bright washed-out look.
const BOOST_AMBIENT = 0.12;
const BOOST_HEMI = 0.22;
const BOOST_SUN = 0.55;

type Pal = {
  daySky: THREE.Color;
  dayFog: THREE.Color;
  duskSky: THREE.Color;
  duskFog: THREE.Color;
  daySun: THREE.Color;
  duskSun: THREE.Color;
};
const KEYS = ["daySky", "dayFog", "duskSky", "duskFog", "daySun", "duskSun"] as const;

function pal(v: [string, string, string, string, string, string]): Pal {
  return {
    daySky: new THREE.Color(v[0]),
    dayFog: new THREE.Color(v[1]),
    duskSky: new THREE.Color(v[2]),
    duskFog: new THREE.Color(v[3]),
    daySun: new THREE.Color(v[4]),
    duskSun: new THREE.Color(v[5]),
  };
}

// Land nobody holds: a natural pale-blue sky with a soft warm haze (was lavender).
const NEUTRAL_VALUES: [string, string, string, string, string, string] = [
  "#b3d3e8", "#e2e6e0", "#8d86a8", "#a9a0b8", "#fff4dc", "#ffcf9a",
];
const NEUTRAL = pal(NEUTRAL_VALUES);

// Each kingdom's sky: daySky, dayFog, duskSky, duskFog, daySun, duskSun.
const FACTION: Pal[] = [
  // 0 The Kings: rich summer blue, warm golden haze, amber sunsets
  pal(["#6fb2ee", "#efe6c6", "#c98f5e", "#d9b07c", "#fff0c0", "#ffb866"]),
  // 1 The Warriors: crimson
  pal(["#f0a6ab", "#f2bcc0", "#a34758", "#b8606f", "#ffd9d6", "#ff8a8f"]),
  // 2 The Outcasts: acid green
  pal(["#c9e58a", "#d6eca6", "#6f9a3e", "#86ad55", "#f4ffd0", "#d2ff7a"]),
  // 3 The Monsters: violet
  pal(["#c2a4f0", "#d0b8f5", "#6c4aa8", "#8460bd", "#eadcff", "#b992ff"]),
];

export function DayNight() {
  const dirRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const ambRef = useRef<THREE.AmbientLight>(null);
  const { scene } = useThree();

  const state = useMemo(() => {
    const cur = pal(NEUTRAL_VALUES);
    const tgt = pal(NEUTRAL_VALUES);
    return { cur, tgt, sky: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color() };
  }, []);

  useFrame(({ clock }, dt) => {
    // Atmosphere takes the color of the kingdom that holds the land you stand on.
    // On unclaimed land it blends toward your own kingdom's color.
    const district = districtAt(playerState.pos.x, playerState.pos.z);
    const owner = territoryState.owners[district];
    const blend = 1 - Math.exp(-Math.min(dt, 0.1) * 1.4);
    for (const k of KEYS) {
      if (owner !== null && owner !== undefined) {
        state.tgt[k].copy(FACTION[owner][k]);
      } else {
        state.tgt[k].copy(NEUTRAL[k]).lerp(FACTION[PLAYER_GANG][k], 0.5);
      }
      state.cur[k].lerp(state.tgt[k], blend);
    }

    const weight = daylightWeight((clock.elapsedTime / CYCLE_SECONDS + 0.35) % 1);
    state.sky.copy(state.cur.duskSky).lerp(state.cur.daySky, weight);
    state.fog.copy(state.cur.duskFog).lerp(state.cur.dayFog, weight);
    state.sun.copy(state.cur.duskSun).lerp(state.cur.daySun, weight);

    const intensity =
      MIN_SUN_INTENSITY + weight * (MAX_SUN_INTENSITY - MIN_SUN_INTENSITY) + BOOST_SUN;

    if (scene.background instanceof THREE.Color) scene.background.copy(state.sky);
    else scene.background = state.sky.clone();
    if (scene.fog && "color" in scene.fog) (scene.fog as THREE.Fog).color.copy(state.fog);

    if (dirRef.current) {
      dirRef.current.color.copy(state.sun);
      dirRef.current.intensity = intensity;
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = MIN_HEMISPHERE_INTENSITY + weight * 0.3 + BOOST_HEMI;
      hemiRef.current.color.copy(state.sky);
    }
    if (ambRef.current) {
      ambRef.current.intensity = MIN_AMBIENT_INTENSITY + weight * 0.2 + BOOST_AMBIENT;
      ambRef.current.color.copy(state.sun);
    }
  });

  return (
    <>
      <ambientLight ref={ambRef} intensity={MIN_AMBIENT_INTENSITY + BOOST_AMBIENT} />
      {/* Sky light from above, and a green bounce from the meadow below. */}
      <hemisphereLight
        ref={hemiRef}
        args={["#cfe3f5", "#7d8a4a", MIN_HEMISPHERE_INTENSITY + BOOST_HEMI]}
      />
      <directionalLight
        ref={dirRef}
        position={[40, 70, 20]}
        intensity={MAX_SUN_INTENSITY}
        color="#fff4dc"
      />
    </>
  );
}
