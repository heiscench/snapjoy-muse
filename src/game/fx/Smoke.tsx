import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { BUILDINGS } from "../worldData";
import { hash01 } from "../city/palette";
import { puffTexture, softDotTexture } from "./fxTextures";

const PLANE = new THREE.PlaneGeometry(1, 1);
const dummy = new THREE.Object3D();
const SMOKE_DARK = new THREE.Color("#2a252e");
const PUFFS_PER = 9;
const MAX_SOURCES = 10;

type Source = { x: number; z: number; y: number };

// Spread the burning ruins evenly across the city.
const SOURCES: Source[] = (() => {
  const cand: Source[] = [];
  for (const b of BUILDINGS) {
    if (
      (b.type === "tower" || b.type === "warehouse" || b.type === "lowrise" || b.type === "casino") &&
      hash01(b.x, b.z, 123) > 0.88
    ) {
      cand.push({ x: b.x, z: b.z, y: b.h });
    }
  }
  const step = Math.max(1, Math.floor(cand.length / MAX_SOURCES));
  const out: Source[] = [];
  for (let i = 0; i < cand.length && out.length < MAX_SOURCES; i += step) out.push(cand[i]);
  return out;
})();

export function Smoke() {
  const smoke = useRef<THREE.InstancedMesh>(null!);
  const glow = useRef<THREE.InstancedMesh>(null!);
  const { camera, scene } = useThree();
  const tmp = useMemo(() => new THREE.Color(), []);
  const fallbackFog = useMemo(() => new THREE.Color("#9a90b3"), []);

  const smokeMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: puffTexture() ?? undefined,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  const glowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: softDotTexture() ?? undefined,
        color: "#ff7a2e",
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );

  useFrame(({ clock }) => {
    const sm = smoke.current;
    const gl = glow.current;
    if (!sm || !gl || SOURCES.length === 0) return;
    const t = clock.elapsedTime;
    const fog = (scene.fog as THREE.Fog | null)?.color ?? fallbackFog;

    let n = 0;
    SOURCES.forEach((s, si) => {
      for (let pi = 0; pi < PUFFS_PER; pi++) {
        const age = (t * 0.07 + pi / PUFFS_PER + si * 0.13) % 1;
        const size = 2.5 + age * 16;
        dummy.position.set(
          s.x + age * 10 + Math.sin(t * 0.5 + pi + si) * age * 3,
          s.y + 1 + age * 48,
          s.z + Math.cos(t * 0.4 + pi * 1.3 + si) * age * 3,
        );
        dummy.quaternion.copy(camera.quaternion);
        dummy.scale.set(size, size, 1);
        dummy.updateMatrix();
        sm.setMatrixAt(n, dummy.matrix);
        // Smoke starts dark and dissolves into the sky color as it rises.
        tmp.copy(SMOKE_DARK).lerp(fog, Math.pow(age, 0.8));
        sm.setColorAt(n, tmp);
        n++;
      }
      const pulse = 5 + Math.sin(t * 3 + si * 2) * 1.2;
      dummy.position.set(s.x, s.y + 0.6, s.z);
      dummy.quaternion.copy(camera.quaternion);
      dummy.scale.set(pulse, pulse, 1);
      dummy.updateMatrix();
      gl.setMatrixAt(si, dummy.matrix);
    });
    sm.instanceMatrix.needsUpdate = true;
    if (sm.instanceColor) sm.instanceColor.needsUpdate = true;
    gl.instanceMatrix.needsUpdate = true;
  });

  if (SOURCES.length === 0) return null;
  return (
    <>
      <instancedMesh ref={smoke} args={[PLANE, smokeMat, SOURCES.length * PUFFS_PER]} frustumCulled={false} />
      <instancedMesh ref={glow} args={[PLANE, glowMat, SOURCES.length]} frustumCulled={false} />
    </>
  );
}