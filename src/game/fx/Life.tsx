import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { hash01 } from "../city/palette";
import { playerState } from "../playerState";
import { cloudNoiseTexture } from "./fxTextures";

const dummy = new THREE.Object3D();
const tmp = new THREE.Color();
const FALLBACK = new THREE.Color("#9a90b3");
const ROCK = new THREE.Color("#2e2744");
const TOP = new THREE.Color("#4a4358");

function haze(scene: THREE.Scene): THREE.Color {
  const f = scene.fog as THREE.Fog | null;
  return f ? f.color : FALLBACK;
}

function wrap(v: number, size: number) {
  return ((((v + size / 2) % size) + size) % size) - size / 2;
}

const ISLANDS = 9;

/** Giant floating shard-islands drifting in the far sky. */
export function Islands() {
  const rocks = useRef<THREE.InstancedMesh>(null!);
  const tops = useRef<THREE.InstancedMesh>(null!);
  const crystals = useRef<THREE.InstancedMesh>(null!);
  const { scene } = useThree();
  const rockMat = useMemo(() => new THREE.MeshBasicMaterial({ fog: false }), []);
  const topMat = useMemo(() => new THREE.MeshBasicMaterial({ fog: false }), []);
  const data = useMemo(
    () =>
      Array.from({ length: ISLANDS }, (_, i) => ({
        a: (i / ISLANDS) * Math.PI * 2 + hash01(i, 1, 31),
        r: 520 + hash01(i, 2, 32) * 780,
        y: 150 + hash01(i, 3, 33) * 280,
        s: 28 + hash01(i, 4, 34) * 70,
        spin: 0.03 + hash01(i, 5, 35) * 0.05,
        bob: hash01(i, 6, 36) * 6.28,
      })),
    [],
  );

  useFrame(({ clock }) => {
    const r = rocks.current, tp = tops.current, cr = crystals.current;
    if (!r || !tp || !cr) return;
    const t = clock.elapsedTime;
    const px = playerState.pos.x * 0.9;
    const pz = playerState.pos.z * 0.9;
    const hz = haze(scene);
    rockMat.color.copy(ROCK).lerp(hz, 0.35);
    topMat.color.copy(TOP).lerp(hz, 0.3);

    data.forEach((d, i) => {
      const x = px + Math.cos(d.a) * d.r;
      const z = pz + Math.sin(d.a) * d.r;
      const y = d.y + Math.sin(t * 0.3 + d.bob) * 4;

      dummy.position.set(x, y - d.s * 0.55, z);
      dummy.rotation.set(Math.PI, t * d.spin, 0); // inverted cone: rock hanging below
      dummy.scale.set(d.s, d.s * 1.1, d.s);
      dummy.updateMatrix();
      r.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, y, z);
      dummy.rotation.set(0, t * d.spin, 0);
      dummy.scale.set(d.s * 1.02, d.s * 0.1, d.s * 1.02);
      dummy.updateMatrix();
      tp.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, y + d.s * 0.35, z);
      dummy.rotation.set(0, t * 0.4 + d.bob, 0);
      dummy.scale.set(d.s * 0.12, d.s * 0.4, d.s * 0.12);
      dummy.updateMatrix();
      cr.setMatrixAt(i, dummy.matrix);
    });
    r.instanceMatrix.needsUpdate = true;
    tp.instanceMatrix.needsUpdate = true;
    cr.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={rocks} args={[undefined, rockMat, ISLANDS]} frustumCulled={false}>
        <coneGeometry args={[1, 1, 6]} />
      </instancedMesh>
      <instancedMesh ref={tops} args={[undefined, topMat, ISLANDS]} frustumCulled={false}>
        <cylinderGeometry args={[1, 0.9, 1, 8]} />
      </instancedMesh>
      <instancedMesh ref={crystals} args={[undefined, undefined, ISLANDS]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#c9a8ff" fog={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

const SHADOW_SIZE = 900;
const SHADOW_REPEAT = 3;

/** Big soft shadows of clouds sliding across the ground. */
export function CloudShadows() {
  const mesh = useRef<THREE.Mesh>(null!);
  const tex = useMemo(() => cloudNoiseTexture(), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#000000",
        transparent: true,
        opacity: 0.32,
        alphaMap: tex ?? undefined,
        depthWrite: false,
        toneMapped: false,
      }),
    [tex],
  );

  useFrame(({ clock }) => {
    if (!mesh.current || !tex) return;
    const px = playerState.pos.x;
    const pz = playerState.pos.z;
    mesh.current.position.set(px, 0.09, pz);
    // Keep the pattern fixed to the world, then drift it with the wind.
    tex.offset.set((px / SHADOW_SIZE) * SHADOW_REPEAT + clock.elapsedTime * 0.004, -(pz / SHADOW_SIZE) * SHADOW_REPEAT);
  });

  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} material={mat} renderOrder={1}>
      <planeGeometry args={[SHADOW_SIZE, SHADOW_SIZE]} />
    </mesh>
  );
}

const FLOCKS = 4;
const PER = 9;
const BIRD_AREA = 500;

const birdGeo = (() => {
  const g = new THREE.BufferGeometry();
  // Two wing triangles forming a "V"; the nose points along +Z.
  const v = new Float32Array([
    0, 0, 0.5, -1.4, 0.35, -0.25, 0, 0, -0.35,
    0, 0, 0.5, 0, 0, -0.35, 1.4, 0.35, -0.25,
  ]);
  g.setAttribute("position", new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
})();

/** Flocks of dark birds circling above the city. */
export function Birds() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const flocks = useMemo(
    () =>
      Array.from({ length: FLOCKS }, (_, i) => ({
        bx: (hash01(i, 1, 41) - 0.5) * BIRD_AREA,
        bz: (hash01(i, 2, 42) - 0.5) * BIRD_AREA,
        r: 35 + hash01(i, 3, 43) * 50,
        w: (0.12 + hash01(i, 4, 44) * 0.12) * (i % 2 ? 1 : -1),
        y: 40 + hash01(i, 5, 45) * 60,
      })),
    [],
  );

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    const px = playerState.pos.x;
    const pz = playerState.pos.z;
    let n = 0;
    flocks.forEach((f, fi) => {
      const cx = px + wrap(f.bx + t * 1.2 - px, BIRD_AREA);
      const cz = pz + wrap(f.bz - pz, BIRD_AREA);
      const dir = f.w > 0 ? 1 : -1;
      for (let k = 0; k < PER; k++) {
        const a = t * f.w + (k / PER) * 6.28 + hash01(fi, k, 46) * 0.6;
        const rr = f.r * (0.8 + hash01(fi, k, 47) * 0.5);
        const y = f.y + Math.sin(t * 0.7 + k + fi) * 4 + hash01(fi, k, 48) * 10;
        const flap = Math.sin(t * (7 + hash01(fi, k, 49) * 3) + k);
        dummy.position.set(cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr);
        dummy.rotation.set(0, Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir), 0);
        dummy.scale.set(1.6, flap * 1.6 + 0.0001, 1.6);
        dummy.updateMatrix();
        mesh.setMatrixAt(n++, dummy.matrix);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[birdGeo, undefined, FLOCKS * PER]} frustumCulled={false}>
      <meshBasicMaterial color="#1a1620" side={THREE.DoubleSide} />
    </instancedMesh>
  );
}