import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  createSunState,
  daylightPhase,
  daylightWeight,
  MIN_AMBIENT_INTENSITY,
  MIN_HEMISPHERE_INTENSITY,
  MIN_SUN_INTENSITY,
  MAX_SUN_INTENSITY,
  updateSun,
} from "./dayNightConfig";
import { PLAYER_GANG } from "./gangs";
import { playerState } from "./playerState";
import { quality } from "./quality";
import { groundHeight } from "./terrain";
import { territoryState } from "./territoryState";
import { districtAt } from "./worldData";

// Extra light on top of the config values. Less flat ambient and a stronger sun give the land form
// and shadow (hillsides, tree trunks) like the reference art, instead of a bright washed-out look.
const BOOST_AMBIENT = 0.12;
const BOOST_HEMI = 0.22;
const BOOST_SUN = 0.55;

// How far you can see before the haze takes over (metres).
const FOG_NEAR = 140;
const FOG_FAR = 560;

// Sun shadows: one shadow map that follows the player. Only used where quality.shadows is on.
const SHADOW_RANGE = 70; // half-width of the shadowed square around the player (m)
const SHADOW_DISTANCE = 160; // how far the sun's shadow camera sits from the player (m)
const SHADOW_MAP = 2048;

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

// Land nobody holds: a natural pale-blue sky with a soft warm haze.
const NEUTRAL_VALUES: [string, string, string, string, string, string] = [
  "#b3d3e8", "#e2e6e0", "#8d86a8", "#a9a0b8", "#fff4dc", "#ffcf9a",
];
const NEUTRAL = pal(NEUTRAL_VALUES);

// Each kingdom's sky: daySky, dayFog, duskSky, duskFog, daySun, duskSun.
// All four are natural blue summer skies, with a different warmth of haze to match the biome.
const FACTION: Pal[] = [
  // 0 The Kings: rich blue, warm golden haze, amber sunsets
  pal(["#6fb2ee", "#efe6c6", "#c98f5e", "#d9b07c", "#fff0c0", "#ffb866"]),
  // 1 The Warriors: clear blue over red-orange autumn, peach haze
  pal(["#7db4ea", "#f3d3a6", "#b5553a", "#d98a62", "#fff0c8", "#ff9a5a"]),
  // 2 The Outcasts: clear blue over deep forest, cool green haze
  pal(["#6fb8e6", "#d7ebd0", "#5f8a4a", "#86ad70", "#f4ffd8", "#d9ff9a"]),
  // 3 The Monsters: pale blue over dry golden land, sandy haze
  pal(["#8cc0ea", "#f2deb0", "#a8744a", "#d0a070", "#fff2c8", "#ffb870"]),
];

export function DayNight() {
  const dirRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const ambRef = useRef<THREE.AmbientLight>(null);
  const { scene, gl } = useThree();

  const state = useMemo(() => {
    const cur = pal(NEUTRAL_VALUES);
    const tgt = pal(NEUTRAL_VALUES);
    return { cur, tgt, sky: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color() };
  }, []);
  const sun = useMemo(() => createSunState(), []);

  // One-time shadow set-up. castShadow itself is switched on in the frame loop (below) so the
  // quality setting can turn it on and off without rebuilding anything.
  useEffect(() => {
    const light = dirRef.current;
    if (!light) return;
    scene.add(light.target);
    const cam = light.shadow.camera;
    cam.left = -SHADOW_RANGE;
    cam.right = SHADOW_RANGE;
    cam.top = SHADOW_RANGE;
    cam.bottom = -SHADOW_RANGE;
    cam.near = 1;
    cam.far = SHADOW_DISTANCE * 2.2;
    cam.updateProjectionMatrix();
    if (light.shadow.map) {
      light.shadow.map.dispose();
      light.shadow.map = null;
    }
    light.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
    light.shadow.bias = -0.0004;
    light.shadow.normalBias = 0.08;
    return () => {
      scene.remove(light.target);
    };
  }, [scene]);

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

    const phase = daylightPhase(clock.elapsedTime);
    const weight = daylightWeight(phase);
    updateSun(phase, sun);
    state.sky.copy(state.cur.duskSky).lerp(state.cur.daySky, weight);
    state.fog.copy(state.cur.duskFog).lerp(state.cur.dayFog, weight);
    state.sun.copy(state.cur.duskSun).lerp(state.cur.daySun, weight);

    // Golden hour: a low sun is warmer and a little weaker than a high one.
    const low = Math.max(0, 1 - Math.max(sun.altitude, 0) / 0.5);
    state.sun.lerp(state.cur.duskSun, low * 0.65 * weight);

    const intensity =
      (MIN_SUN_INTENSITY + weight * (MAX_SUN_INTENSITY - MIN_SUN_INTENSITY) + BOOST_SUN) *
      (1 - 0.25 * low * weight);

    if (scene.background instanceof THREE.Color) scene.background.copy(state.sky);
    else scene.background = state.sky.clone();
    if (scene.fog && "color" in scene.fog) {
      const fog = scene.fog as THREE.Fog;
      fog.color.copy(state.fog);
      fog.near = FOG_NEAR;
      fog.far = FOG_FAR;
    }

    const light = dirRef.current;
    if (light) {
      light.color.copy(state.sun);
      light.intensity = intensity;

      // The light travels with the sun across the sky; its shadow box stays centred on the player.
      const cx = Math.round(playerState.pos.x);
      const cz = Math.round(playerState.pos.z);
      light.target.position.set(cx, groundHeight(cx, cz), cz);
      light.position.set(
        light.target.position.x + sun.lightX * SHADOW_DISTANCE,
        light.target.position.y + sun.lightY * SHADOW_DISTANCE,
        light.target.position.z + sun.lightZ * SHADOW_DISTANCE,
      );
      light.target.updateMatrixWorld();

      if (light.castShadow !== quality.shadows) {
        light.castShadow = quality.shadows;
        gl.shadowMap.enabled = quality.shadows;
      }
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
