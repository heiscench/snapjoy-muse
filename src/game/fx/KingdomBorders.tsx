import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { playerState } from "../playerState";
import { pushAlert } from "../alertState";
import { districtAt } from "../worldData";
import { hash01, THEMES, themeOf } from "../city/palette";
import { KINGDOM_EDGES } from "../city/layout";
import { puffTexture } from "./fxTextures";

const PLANE = new THREE.PlaneGeometry(1, 1);
const dummy = new THREE.Object3D();
const VIEW = 380;

type Puff = { x: number; y: number; z: number; s: number; c: number };

// Three stacked layers of cloud along every kingdom border.
const PUFFS: Puff[] = (() => {
  const out: Puff[] = [];
  KINGDOM_EDGES.forEach((e, ei) => {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const along = ((i + 0.5) / n - 0.5) * 64;
      for (let layer = 0; layer < 3; layer++) {
        const jx = (hash01(ei, i * 3 + layer, 81) - 0.5) * 6;
        const jz = (hash01(ei, i * 3 + layer, 82) - 0.5) * 6;
        out.push({
          x: e.x + (e.alongX ? along : 0) + jx,
          z: e.z + (e.alongX ? 0 : along) + jz,
          y: 4 + layer * 7 + hash01(ei, i + layer, 83) * 4,
          s: 20 + hash01(ei, i, 84 + layer) * 12 - layer * 2,
          c: hash01(ei, i + layer, 85) > 0.5 ? e.a : e.b,
        });
      }
    }
  });
  return out;
})();

/** Cloud walls on the roads where one kingdom meets another. They thin out as you pass through. */
export function KingdomClouds() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const { camera } = useThree();
  const mat = useMemo(
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
  const colors = useMemo(
    () => THEMES.map((t) => new THREE.Color(t.glow).lerp(new THREE.Color("#ffffff"), 0.55)),
    [],
  );

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh || PUFFS.length === 0) return;
    const cp = camera.position;
    const t = clock.elapsedTime;
    let n = 0;
    for (const p of PUFFS) {
      const dx = p.x - cp.x;
      const dz = p.z - cp.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > VIEW * VIEW) continue;
      const dy = p.y - cp.y;
      const dist = Math.sqrt(d2 + dy * dy);
      // Vanish when the camera is inside the puff, so you pass through instead of whiting out.
      const fade = Math.max(0, Math.min(1, (dist - 6) / 12));
      if (fade <= 0.01) continue;
      dummy.position.set(
        p.x + Math.sin(t * 0.15 + p.z * 0.03) * 2,
        p.y + Math.sin(t * 0.4 + p.x * 0.05) * 1.2,
        p.z,
      );
      dummy.quaternion.copy(camera.quaternion);
      const s = p.s * fade;
      dummy.scale.set(s, s * 0.75, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
      mesh.setColorAt(n, colors[p.c]);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return <instancedMesh ref={ref} args={[PLANE, mat, Math.max(1, PUFFS.length)]} frustumCulled={false} />;
}

/** "Entering the realm of the Warriors" when you cross into another kingdom. */
export function KingdomEntry() {
  const last = useRef(-1);
  useFrame(() => {
    const k = themeOf(districtAt(playerState.pos.x, playerState.pos.z)).id;
    if (last.current === -1) {
      last.current = k;
      return;
    }
    if (k !== last.current) {
      last.current = k;
      pushAlert(`Entering the realm of the ${THEMES[k].name}`);
    }
  });
  return null;
}