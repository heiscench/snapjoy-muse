import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GRID } from "../worldData";
import { groundHeight } from "../terrain";
import { THEMES } from "./palette";
import { kingdomAtBlock, ROAD_LEN, ROAD_LINES, ROAD_W } from "./layout";
import { roadTexture } from "./roadTextures";

const STEP = 8;
const RING = new THREE.RingGeometry(4.4, 5.2, 28);
const dummy = new THREE.Object3D();
const COUNT = ROAD_LINES.length * ROAD_LINES.length;

/** A lane that follows the ground: one vertex pair every 8 m, lifted a little above the terrain. */
function ribbon(line: number, alongZ: boolean, lift: number): THREE.BufferGeometry {
  const n = Math.round(ROAD_LEN / STEP);
  const pos = new Float32Array((n + 1) * 2 * 3);
  const uv = new Float32Array((n + 1) * 2 * 2);
  const idx: number[] = [];
  const half = ROAD_W / 2;
  for (let i = 0; i <= n; i++) {
    const t = -ROAD_LEN / 2 + i * STEP;
    for (let s = 0; s < 2; s++) {
      const side = s === 0 ? -half : half;
      const x = alongZ ? line + side : t;
      const z = alongZ ? t : line + side;
      const k = i * 2 + s;
      pos[k * 3] = x;
      pos[k * 3 + 1] = groundHeight(x, z) + lift;
      pos[k * 3 + 2] = z;
      uv[k * 2] = s;
      uv[k * 2 + 1] = (i * STEP) / 16;
    }
    if (i < n) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Every junction as one patch of ground-following squares. */
function junctions(lift: number): THREE.BufferGeometry {
  const seg = 4;
  const half = ROAD_W / 2;
  const per = (seg + 1) * (seg + 1);
  const total = ROAD_LINES.length * ROAD_LINES.length;
  const pos = new Float32Array(total * per * 3);
  const idx: number[] = [];
  let n = 0;
  for (const x of ROAD_LINES) {
    for (const z of ROAD_LINES) {
      const base = n * per;
      for (let u = 0; u <= seg; u++) {
        for (let v = 0; v <= seg; v++) {
          const px = x - half + (u * ROAD_W) / seg;
          const pz = z - half + (v * ROAD_W) / seg;
          const k = base + u * (seg + 1) + v;
          pos[k * 3] = px;
          pos[k * 3 + 1] = groundHeight(px, pz) + lift;
          pos[k * 3 + 2] = pz;
          if (u < seg && v < seg) {
            const a = k, b = k + 1, c = k + seg + 1, d = k + seg + 2;
            idx.push(a, b, c, b, d, c);
          }
        }
      }
      n++;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Layers sit a few centimetres above the terrain so nothing flickers.
export function Roads() {
  const rings = useRef<THREE.InstancedMesh>(null!);

  const geos = useMemo(
    () => ({
      alongZ: ROAD_LINES.map((p) => ribbon(p, true, 0.16)),
      alongX: ROAD_LINES.map((p) => ribbon(p, false, 0.17)),
      junction: junctions(0.22),
    }),
    [],
  );
  const roadMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: roadTexture() ?? undefined, roughness: 1, side: THREE.DoubleSide }),
    [],
  );
  const junctionMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#8d7351", roughness: 1, side: THREE.DoubleSide }),
    [],
  );

  useLayoutEffect(() => {
    const r = rings.current;
    if (!r) return;
    const col = new THREE.Color();
    let n = 0;
    for (let i = 0; i < ROAD_LINES.length; i++) {
      for (let j = 0; j < ROAD_LINES.length; j++) {
        const x = ROAD_LINES[i];
        const z = ROAD_LINES[j];
        // The glowing rune circles stay in the other kingdoms; the Kings' village has none.
        const k = kingdomAtBlock(i - GRID - 1, j - GRID - 1);
        const s = k === 0 ? 0.0001 : ROAD_W / 14;
        dummy.position.set(x, groundHeight(x, z) + 0.26, z);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(s, s, 1);
        dummy.updateMatrix();
        r.setMatrixAt(n, dummy.matrix);
        col.set(THEMES[k].glow);
        r.setColorAt(n, col);
        n++;
      }
    }
    r.instanceMatrix.needsUpdate = true;
    if (r.instanceColor) r.instanceColor.needsUpdate = true;
  }, []);

  return (
    <group>
      {geos.alongZ.map((g, i) => (
        <mesh key={`z${i}`} geometry={g} material={roadMat} />
      ))}
      {geos.alongX.map((g, i) => (
        <mesh key={`x${i}`} geometry={g} material={roadMat} />
      ))}
      <mesh geometry={geos.junction} material={junctionMat} />
      <instancedMesh ref={rings} args={[RING, undefined, COUNT]} frustumCulled={false}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} toneMapped={false} side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  );
}
