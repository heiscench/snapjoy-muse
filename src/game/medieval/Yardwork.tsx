import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BLOCK_SIZE, type BuildingBox } from "../worldData";
import { hayFor, yardLayout } from "./houseKit";

// Wells and hay bales, built from plain shapes (none of the model kits has them).
// Each is ONE merged geometry with vertex colours, drawn as a single instanced mesh.

type Block = { key: string; cx: number; cz: number; houses: BuildingBox[] };
type Spot = { x: number; z: number; rot: number };

function paint(g: THREE.BufferGeometry, hex: string) {
  for (const n of Object.keys(g.attributes)) {
    if (n !== "position" && n !== "normal") g.deleteAttribute(n);
  }
  const c = new THREE.Color(hex);
  const count = g.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}

function wellGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, color: string, x: number, y: number, z: number) => {
    g.translate(x, y, z);
    parts.push(paint(g, color));
  };
  add(new THREE.CylinderGeometry(1.2, 1.3, 0.95, 12), "#8f877a", 0, 0.475, 0); // stone ring
  const water = new THREE.CircleGeometry(0.9, 12);
  water.rotateX(-Math.PI / 2);
  add(water, "#2d4a63", 0, 0.9, 0); // water
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.16, 2.4, 0.16), "#5a3f26", s * 1.0, 1.2, 0); // posts
  add(new THREE.BoxGeometry(2.3, 0.12, 0.12), "#5a3f26", 0, 2.0, 0); // beam for the bucket rope
  const roof = new THREE.ConeGeometry(1.6, 0.9, 4);
  roof.rotateY(Math.PI / 4);
  add(roof, "#b5563a", 0, 2.85, 0); // little roof
  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  return merged;
}

function hayGeometry() {
  const g = new THREE.CylinderGeometry(0.55, 0.55, 0.95, 10);
  g.rotateZ(Math.PI / 2);
  g.translate(0, 0.55, 0);
  return paint(g, "#d4b04a");
}

function Instances({ geometry, spots }: { geometry: THREE.BufferGeometry | null; spots: Spot[] }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), []);
  const mesh = useMemo(() => {
    if (!geometry || !spots.length) return null;
    return new THREE.InstancedMesh(geometry, mat, spots.length);
  }, [geometry, spots, mat]);

  useLayoutEffect(() => {
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    spots.forEach((s, i) => {
      dummy.position.set(s.x, 0, s.z);
      dummy.rotation.set(0, s.rot, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
  }, [mesh, spots]);

  return mesh ? <primitive object={mesh} /> : null;
}

export function Yardwork({ blocks }: { blocks: Block[] }) {
  const wells = useMemo<Spot[]>(() => {
    const out: Spot[] = [];
    for (const b of blocks) {
      const gx = Math.round(b.cx / BLOCK_SIZE);
      const gz = Math.round(b.cz / BLOCK_SIZE);
      for (const w of yardLayout(gx, gz, b.cx, b.cz, b.houses).wells) out.push({ x: w.x, z: w.z, rot: 0 });
    }
    return out;
  }, [blocks]);

  const hay = useMemo<Spot[]>(() => {
    const out: Spot[] = [];
    for (const b of blocks) {
      for (const h of b.houses) {
        const c = h.cottage;
        if (!c) continue;
        const cs = Math.cos(c.rot);
        const sn = Math.sin(c.rot);
        for (const p of hayFor(c)) {
          out.push({ x: h.x + p.x * cs + p.z * sn, z: h.z - p.x * sn + p.z * cs, rot: p.rot + c.rot });
        }
      }
    }
    return out;
  }, [blocks]);

  const wellGeo = useMemo(() => wellGeometry(), []);
  const hayGeo = useMemo(() => hayGeometry(), []);

  return (
    <>
      <Instances geometry={wellGeo} spots={wells} />
      <Instances geometry={hayGeo} spots={hay} />
    </>
  );
}
