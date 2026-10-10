import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { playerState } from "../playerState";
import { hash01 } from "../city/palette";
import { mistTexture, puffTexture } from "./fxTextures";

const PLANE = new THREE.PlaneGeometry(1, 1);
const WHITE = new THREE.Color("#ffffff");
const dummy = new THREE.Object3D();

function wrap(v: number, size: number) {
  return ((((v + size / 2) % size) + size) % size) - size / 2;
}

const CLUSTERS = 16;
const PUFFS = 5;
const AREA = 700;

type Cluster = {
  bx: number; bz: number; y: number; speed: number;
  puffs: { dx: number; dy: number; dz: number; s: number }[];
};

const clusters: Cluster[] = Array.from({ length: CLUSTERS }, (_, i) => ({
  bx: (hash01(i, 1, 1) - 0.5) * AREA,
  bz: (hash01(i, 2, 2) - 0.5) * AREA,
  y: 95 + hash01(i, 3, 3) * 55,
  speed: 1.5 + hash01(i, 4, 4) * 2.5,
  puffs: Array.from({ length: PUFFS }, (_, j) => ({
    dx: (hash01(i, j, 5) - 0.5) * 70,
    dy: (hash01(i, j, 6) - 0.5) * 8,
    dz: (hash01(i, j, 7) - 0.5) * 50,
    s: 45 + hash01(i, j, 8) * 45,
  })),
}));

/** Slow cloud banks that always surround the player and take the sky's color. */
export function Clouds() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const { camera, scene } = useThree();
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: puffTexture() ?? undefined,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    [],
  );

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    const px = playerState.pos.x;
    const pz = playerState.pos.z;
    let n = 0;
    for (const c of clusters) {
      const cx = px + wrap(c.bx + t * c.speed - px, AREA);
      const cz = pz + wrap(c.bz - pz, AREA);
      for (const p of c.puffs) {
        dummy.position.set(cx + p.dx, c.y + p.dy, cz + p.dz);
        dummy.quaternion.copy(camera.quaternion);
        dummy.scale.set(p.s, p.s * 0.5, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(n++, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    const fog = scene.fog as THREE.Fog | null;
    if (fog) mat.color.copy(fog.color).lerp(WHITE, 0.35);
  });

  return <instancedMesh ref={ref} args={[PLANE, mat, CLUSTERS * PUFFS]} frustumCulled={false} />;
}

/** Thin low fog that creeps around the player. */
export function Mist() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const { scene } = useThree();
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: mistTexture() ?? undefined,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const px = playerState.pos.x;
    const pz = playerState.pos.z;
    for (let i = 0; i < 3; i++) {
      const m = refs.current[i];
      if (!m) continue;
      const a = t * 0.025 * (i % 2 ? 1 : -1) + i * 2.1;
      const r = 25 + i * 12;
      m.position.set(px + Math.cos(a) * r, 0.9 + i * 0.9, pz + Math.sin(a) * r);
      m.rotation.set(-Math.PI / 2, 0, t * 0.02 + i);
    }
    const fog = scene.fog as THREE.Fog | null;
    if (fog) mat.color.copy(fog.color).lerp(WHITE, 0.2);
  });

  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => { refs.current[i] = el; }} rotation={[-Math.PI / 2, 0, 0]} material={mat}>
          <planeGeometry args={[110, 110]} />
        </mesh>
      ))}
    </group>
  );
}