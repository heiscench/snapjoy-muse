import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { hash01 } from "../city/palette";
import { playerState } from "../playerState";
import { puffTexture, softDotTexture } from "./fxTextures";

const FALLBACK = new THREE.Color("#9a90b3");
const DEEP = new THREE.Color("#2d2552");
const MTN_DARK = new THREE.Color("#2e2744");
const WHITE = new THREE.Color("#ffffff");
const tmp = new THREE.Color();
const v3 = new THREE.Vector3();
const dummy = new THREE.Object3D();
const PLANE = new THREE.PlaneGeometry(1, 1);

function haze(scene: THREE.Scene): THREE.Color {
  const f = scene.fog as THREE.Fog | null;
  return f ? f.color : FALLBACK;
}

const DOME_R = 2300;

/** Gradient dome: horizon haze (same as the fog, so the horizon is seamless) up to a deeper zenith. */
export function SkyDome() {
  const mesh = useRef<THREE.Mesh>(null!);
  const { camera, scene } = useThree();
  const zenith = useMemo(() => new THREE.Color(), []);
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(DOME_R, 24, 24);
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
    return g;
  }, []);

  useFrame(() => {
    if (!mesh.current) return;
    mesh.current.position.copy(camera.position);
    const hor = haze(scene);
    zenith.copy(hor).multiplyScalar(0.55).lerp(DEEP, 0.4);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = geo.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const h = Math.max(0, pos.getY(i) / DOME_R);
      tmp.copy(hor).lerp(zenith, Math.pow(h, 0.5));
      col.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    col.needsUpdate = true;
  });

  return (
    <mesh ref={mesh} geometry={geo} renderOrder={-100} frustumCulled={false}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  );
}

const SUN_DIR = new THREE.Vector3(0.78, 0.2, 0.59).normalize();

/** A low sun with a big soft halo. */
export function Sun() {
  const core = useRef<THREE.Sprite>(null);
  const halo = useRef<THREE.Sprite>(null);
  const { camera, scene } = useThree();
  const coreMat = useMemo(
    () => new THREE.SpriteMaterial({
      map: softDotTexture() ?? undefined, transparent: true, opacity: 0.95,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
    }),
    [],
  );
  const haloMat = useMemo(
    () => new THREE.SpriteMaterial({
      map: softDotTexture() ?? undefined, transparent: true, opacity: 0.35,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
    }),
    [],
  );

  useFrame(() => {
    v3.copy(SUN_DIR).multiplyScalar(2000).add(camera.position);
    core.current?.position.copy(v3);
    halo.current?.position.copy(v3);
    const h = haze(scene);
    coreMat.color.copy(h).lerp(WHITE, 0.75);
    haloMat.color.copy(h).lerp(WHITE, 0.35);
  });

  return (
    <>
      <sprite ref={halo} material={haloMat} scale={[1300, 1300, 1]} renderOrder={-91} />
      <sprite ref={core} material={coreMat} scale={[320, 320, 1]} renderOrder={-90} />
    </>
  );
}

/** Ground beyond the city; it fades into the fog like real distance. */
export function Wasteland() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]}>
      <circleGeometry args={[2400, 64]} />
      <meshStandardMaterial color="#4a4256" roughness={1} />
    </mesh>
  );
}

const LAYERS = [
  { r: 720, count: 46, hMin: 70, hMax: 190, w: 150, mix: 0.42 },
  { r: 1050, count: 56, hMin: 110, hMax: 280, w: 230, mix: 0.62 },
  { r: 1500, count: 64, hMin: 150, hMax: 360, w: 340, mix: 0.8 },
];

/** Three rings of peaks and spires. Farther rings are hazier (aerial perspective). */
export function Mountains() {
  const group = useRef<THREE.Group>(null!);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const { scene } = useThree();
  const mats = useMemo(() => LAYERS.map(() => new THREE.MeshBasicMaterial({ fog: false })), []);

  useLayoutEffect(() => {
    LAYERS.forEach((L, li) => {
      const mesh = refs.current[li];
      if (!mesh) return;
      for (let i = 0; i < L.count; i++) {
        const a = ((i + hash01(i, li, 11) * 0.9) / L.count) * Math.PI * 2;
        const r = L.r + (hash01(i, li, 12) - 0.5) * 120;
        const spire = hash01(i, li, 13) > 0.72;
        const h = (L.hMin + hash01(i, li, 14) * (L.hMax - L.hMin)) * (spire ? 1.35 : 1);
        const w = L.w * (0.7 + hash01(i, li, 15) * 0.8) * (spire ? 0.45 : 1);
        dummy.position.set(Math.cos(a) * r, h / 2 - 30, Math.sin(a) * r);
        dummy.rotation.set(0, hash01(i, li, 16) * 3, 0);
        dummy.scale.set(w, h, w);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    });
  }, []);

  useFrame(() => {
    const f = haze(scene);
    LAYERS.forEach((L, li) => {
      mats[li].color.copy(MTN_DARK).lerp(f, L.mix);
    });
    // Follow the player at 85%: a touch of parallax as you cross the map.
    group.current.position.set(playerState.pos.x * 0.85, 0, playerState.pos.z * 0.85);
  });

  return (
    <group ref={group}>
      {LAYERS.map((L, li) => (
        <instancedMesh
          key={li}
          ref={(el) => { refs.current[li] = el; }}
          args={[undefined, mats[li], L.count]}
          frustumCulled={false}
        >
          <coneGeometry args={[1, 1, 5]} />
        </instancedMesh>
      ))}
    </group>
  );
}

const BANKS = 40;

/** Huge cloud banks piled on the horizon. */
export function CloudBanks() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const { camera, scene } = useThree();
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({
      map: puffTexture() ?? undefined, transparent: true, opacity: 0.8,
      depthWrite: false, fog: false, toneMapped: false,
    }),
    [],
  );

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const px = camera.position.x;
    const pz = camera.position.z;
    for (let i = 0; i < BANKS; i++) {
      const a = (i / BANKS) * Math.PI * 2 + hash01(i, 1, 21) * 0.3;
      const r = 950 + hash01(i, 2, 22) * 450;
      const w = 380 + hash01(i, 3, 23) * 260;
      dummy.position.set(px + Math.cos(a) * r, 30 + hash01(i, 4, 24) * 150, pz + Math.sin(a) * r);
      dummy.quaternion.copy(camera.quaternion);
      dummy.scale.set(w, w * 0.4, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mat.color.copy(haze(scene)).lerp(WHITE, 0.45);
  });

  return <instancedMesh ref={ref} args={[PLANE, mat, BANKS]} frustumCulled={false} />;
}