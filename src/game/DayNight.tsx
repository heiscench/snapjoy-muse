import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { CYCLE_SECONDS, daylightWeight, MIN_AMBIENT_INTENSITY, MIN_HEMISPHERE_INTENSITY, MIN_SUN_INTENSITY, MAX_SUN_INTENSITY } from "./dayNightConfig";

const DAY_SKY = "#afbdb7";
const DUSK_SKY = "#686178";
const DAY_FOG = "#bbc7bd";
const DUSK_FOG = "#7d7289";
const DAY_SUN = "#fff0cc";
const DUSK_SUN = "#d6b8ec";

export function DayNight() {
  const dirRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const ambRef = useRef<THREE.AmbientLight>(null);
  const { scene } = useThree();
  const colors = useMemo(() => ({ sky: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(), daySky: new THREE.Color(DAY_SKY), duskSky: new THREE.Color(DUSK_SKY), dayFog: new THREE.Color(DAY_FOG), duskFog: new THREE.Color(DUSK_FOG), daySun: new THREE.Color(DAY_SUN), duskSun: new THREE.Color(DUSK_SUN) }), []);
  useFrame(({ clock }) => {
    const weight = daylightWeight((clock.elapsedTime / CYCLE_SECONDS + 0.35) % 1);
    colors.sky.copy(colors.duskSky).lerp(colors.daySky, weight);
    colors.fog.copy(colors.duskFog).lerp(colors.dayFog, weight);
    colors.sun.copy(colors.duskSun).lerp(colors.daySun, weight);
    const intensity = MIN_SUN_INTENSITY + weight * (MAX_SUN_INTENSITY - MIN_SUN_INTENSITY);
    if (scene.background instanceof THREE.Color) scene.background.copy(colors.sky);
    else scene.background = colors.sky.clone();
    if (scene.fog && "color" in scene.fog) (scene.fog as THREE.Fog).color.copy(colors.fog);
    if (dirRef.current) { dirRef.current.color.copy(colors.sun); dirRef.current.intensity = intensity; }
    if (hemiRef.current) { hemiRef.current.intensity = MIN_HEMISPHERE_INTENSITY + weight * 0.3; hemiRef.current.color.copy(colors.sky); }
    if (ambRef.current) ambRef.current.intensity = MIN_AMBIENT_INTENSITY + weight * 0.2;
  });
  return <><ambientLight ref={ambRef} intensity={MIN_AMBIENT_INTENSITY} /><hemisphereLight ref={hemiRef} args={[DAY_SKY, "#343332", MIN_HEMISPHERE_INTENSITY]} /><directionalLight ref={dirRef} position={[40, 70, 20]} intensity={MAX_SUN_INTENSITY} color={DAY_SUN} /></>;
}
