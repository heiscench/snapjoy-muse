import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import {
  CYCLE_SECONDS,
  DAYLIGHT_END,
  DAYLIGHT_START,
  MIN_AMBIENT_INTENSITY,
  MIN_HEMISPHERE_INTENSITY,
} from "./dayNightConfig";

const KEYS = [
  { t: 0.0,  sky: "#101629", fog: "#11182a", sun: "#a8baff", intensity: 0.35 },
  { t: 0.08, sky: "#503848", fog: "#5a414d", sun: "#ffad78", intensity: 1.15 },
  { t: DAYLIGHT_START, sky: "#a9d1eb", fog: "#b8d7e8", sun: "#fff2d0", intensity: 2.2 },
  { t: 0.50, sky: "#c9e9fa", fog: "#d4ebf5", sun: "#fffbed", intensity: 2.8 },
  { t: 0.78, sky: "#afd8ef", fog: "#bfdce9", sun: "#fff0cc", intensity: 2.3 },
  { t: DAYLIGHT_END, sky: "#704557", fog: "#744b58", sun: "#ff9565", intensity: 1.05 },
  { t: 0.96, sky: "#171b31", fog: "#192037", sun: "#a8baff", intensity: 0.42 },
  { t: 1.0,  sky: "#101629", fog: "#11182a", sun: "#a8baff", intensity: 0.35 },
];

function lerpColor(a: string, b: string, k: number, out: THREE.Color) {
  out.set(a).lerp(new THREE.Color(b), k);
}

export function DayNight() {
  const dirRef = useRef<THREE.DirectionalLight>(null!);
  const hemiRef = useRef<THREE.HemisphereLight>(null!);
  const ambRef = useRef<THREE.AmbientLight>(null!);
  const { scene } = useThree();
  const start = useMemo(() => performance.now() / 1000, []);
  const skyColor = useMemo(() => new THREE.Color("#05060a"), []);
  const fogColor = useMemo(() => new THREE.Color("#05060a"), []);
  const sunColor = useMemo(() => new THREE.Color("#8ea6ff"), []);

  useFrame(() => {
    const now = performance.now() / 1000 - start;
    const t = (now / CYCLE_SECONDS) % 1;

    let i = 0;
    while (i < KEYS.length - 1 && KEYS[i + 1].t < t) i++;
    const a = KEYS[i];
    const b = KEYS[Math.min(i + 1, KEYS.length - 1)];
    const span = Math.max(0.0001, b.t - a.t);
    const k = Math.min(1, Math.max(0, (t - a.t) / span));

    lerpColor(a.sky, b.sky, k, skyColor);
    lerpColor(a.fog, b.fog, k, fogColor);
    lerpColor(a.sun, b.sun, k, sunColor);
    const intensity = a.intensity + (b.intensity - a.intensity) * k;

    if (scene.background instanceof THREE.Color) scene.background.copy(skyColor);
    else scene.background = skyColor.clone();
    if (scene.fog && "color" in scene.fog) (scene.fog as THREE.Fog).color.copy(fogColor);

    if (dirRef.current) {
      dirRef.current.color.copy(sunColor);
      dirRef.current.intensity = intensity;
      const ang = t * Math.PI * 2 - Math.PI / 2;
      const r = 90;
      dirRef.current.position.set(Math.cos(ang) * r, Math.max(15, Math.sin(ang) * r + 30), 20);
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = MIN_HEMISPHERE_INTENSITY + intensity * 0.35;
      hemiRef.current.color.copy(skyColor).lerp(new THREE.Color("#eaf4ff"), 0.5);
    }
    if (ambRef.current) {
      ambRef.current.intensity = MIN_AMBIENT_INTENSITY + intensity * 0.12;
    }
  });

  return (
    <>
      <ambientLight ref={ambRef} intensity={MIN_AMBIENT_INTENSITY} />
      <hemisphereLight ref={hemiRef} args={["#7588b8", "#14182a", MIN_HEMISPHERE_INTENSITY]} />
      <directionalLight ref={dirRef} position={[40, 70, 20]} intensity={0.7} color="#b8c6ff" />
    </>
  );
}