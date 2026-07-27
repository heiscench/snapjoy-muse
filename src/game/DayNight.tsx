import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const CYCLE_SECONDS = 12 * 60;

const KEYS = [
  { t: 0.0,  sky: "#05060a", fog: "#05060a", sun: "#8ea6ff", intensity: 0.18 },
  { t: 0.22, sky: "#3d2a3a", fog: "#3d2a3a", sun: "#ff9b6a", intensity: 1.0  },
  { t: 0.5,  sky: "#bfe0f7", fog: "#cfe6f2", sun: "#fff8e0", intensity: 2.6  },
  { t: 0.78, sky: "#5b2c3a", fog: "#5b2c3a", sun: "#ff7a4a", intensity: 0.9  },
  { t: 1.0,  sky: "#05060a", fog: "#05060a", sun: "#8ea6ff", intensity: 0.18 },
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
      hemiRef.current.intensity = 0.3 + intensity * 0.35;
      hemiRef.current.color.copy(skyColor).lerp(new THREE.Color("#eaf4ff"), 0.5);
    }
    if (ambRef.current) {
      ambRef.current.intensity = 0.08 + intensity * 0.12;
    }
  });

  return (
    <>
      <ambientLight ref={ambRef} intensity={0.15} />
      <hemisphereLight ref={hemiRef} args={["#5a6a95", "#08080f", 0.6]} />
      <directionalLight ref={dirRef} position={[40, 70, 20]} intensity={0.5} color="#a9b8ff" />
    </>
  );
}