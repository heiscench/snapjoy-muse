import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { createSunState, daylightPhase, updateSun } from "../dayNightConfig";

// A painted sky: a blue gradient with soft cloud banks, thin wispy streaks that drift slowly, and a
// warm sun. It takes its colours from the day/night system (scene background and fog), so dawn,
// dusk and night still tint it. The sun disc travels along the same path that lights the world.

const VERT = `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = `
varying vec3 vDir;
uniform float uTime;
uniform float uDay;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uCloud;
uniform vec3 uSunDir;
uniform vec3 uSunCol;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.55, h));

  vec2 uv = d.xz / (d.y + 0.28);
  float big = fbm(uv * 1.1 + vec2(uTime * 0.012, 0.0));
  float puffs = smoothstep(0.55, 0.78, big) * smoothstep(0.03, 0.22, h);
  float streak = fbm(vec2(uv.x * 0.35 + uTime * 0.02, uv.y * 2.4));
  float wisps = smoothstep(0.52, 0.82, streak) * 0.6 * smoothstep(0.08, 0.5, h);
  float c = clamp(max(puffs, wisps), 0.0, 1.0);

  col = mix(col, uCloud, c * 0.92);

  float sd = max(dot(d, uSunDir), 0.0);
  vec3 sun = uSunCol * (pow(sd, 500.0) * 2.2 + pow(sd, 14.0) * 0.3);
  col += sun * uDay * (1.0 - c * 0.7);

  gl_FragColor = vec4(col, 1.0);
}
`;

export function SkyDome() {
  const { scene } = useThree();
  const mesh = useRef<THREE.Mesh>(null!);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTime: { value: 0 },
          uDay: { value: 1 },
          uTop: { value: new THREE.Color("#4d95e8") },
          uHorizon: { value: new THREE.Color("#cfe6f2") },
          uCloud: { value: new THREE.Color("#ffffff") },
          uSunDir: { value: new THREE.Vector3(40, 70, 20).normalize() },
          uSunCol: { value: new THREE.Color("#fff1c4") },
        },
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
        toneMapped: false,
      }),
    [],
  );
  const tmp = useMemo(() => new THREE.Color(), []);
  const sun = useMemo(() => createSunState(), []);

  useFrame(({ camera, clock }) => {
    if (mesh.current) mesh.current.position.copy(camera.position);
    mat.uniforms.uTime.value = clock.elapsedTime;
    updateSun(daylightPhase(clock.elapsedTime), sun);
    mat.uniforms.uSunDir.value.set(sun.x, sun.y, sun.z);
    // The day/night system keeps scene.background (sky) and scene.fog (horizon haze) up to date.
    if (scene.background instanceof THREE.Color) {
      mat.uniforms.uTop.value.copy(scene.background).multiplyScalar(0.82);
      const lum = 0.3 * scene.background.r + 0.59 * scene.background.g + 0.11 * scene.background.b;
      mat.uniforms.uDay.value = Math.min(1, Math.max(0, (lum - 0.2) / 0.4));
    }
    if (scene.fog) {
      const fogColor = (scene.fog as THREE.Fog).color;
      mat.uniforms.uHorizon.value.copy(fogColor).lerp(tmp.set("#ffffff"), 0.25);
      mat.uniforms.uCloud.value.set("#ffffff").lerp(fogColor, 0.3);
    }
  });

  return (
    <mesh ref={mesh} renderOrder={-1000} frustumCulled={false} material={mat}>
      <sphereGeometry args={[250, 32, 20]} />
    </mesh>
  );
}
