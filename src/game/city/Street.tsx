import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { BLOCK_SIZE, BUILDINGS, GRID } from "../worldData";
import { THEMES, hash01, themeOf } from "./palette";
import { kingdomAtBlock, ROAD_LINES, ROAD_W } from "./layout";

const dummy = new THREE.Object3D();
const col = new THREE.Color();
const PLANE = new THREE.PlaneGeometry(1, 1);

// ---- Lamps along every road, staggered on both sides --------------------
type LampSpot = { x: number; z: number; k: number };
const LAMPS: LampSpot[] = (() => {
  const out: LampSpot[] = [];
  const side = ROAD_W / 2 + 1.4;
  const kAt = (x: number, z: number) => kingdomAtBlock(Math.round(x / BLOCK_SIZE), Math.round(z / BLOCK_SIZE));
  for (const p of ROAD_LINES) {
    for (let g = -GRID; g <= GRID; g++) {
      const m = g * BLOCK_SIZE;
      const s = g % 2 === 0 ? 1 : -1;
      // road running along Z (x = p)
      out.push({ x: p + side * s, z: m - 14, k: kAt(p + side * s, m - 14) });
      out.push({ x: p - side * s, z: m + 14, k: kAt(p - side * s, m + 14) });
      // road running along X (z = p)
      out.push({ x: m - 14, z: p + side * s, k: kAt(m - 14, p + side * s) });
      out.push({ x: m + 14, z: p - side * s, k: kAt(m + 14, p - side * s) });
    }
  }
  return out;
})();

export function Lamps() {
  const posts = useRef<THREE.InstancedMesh>(null!);
  const orbs = useRef<THREE.InstancedMesh>(null!);

  useLayoutEffect(() => {
    const p = posts.current;
    const o = orbs.current;
    if (!p || !o) return;
    LAMPS.forEach((l, i) => {
      dummy.position.set(l.x, 2.5, l.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 5, 1);
      dummy.updateMatrix();
      p.setMatrixAt(i, dummy.matrix);
      dummy.position.set(l.x, 5.3, l.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      o.setMatrixAt(i, dummy.matrix);
      col.set(THEMES[l.k].glow);
      o.setColorAt(i, col);
    });
    p.instanceMatrix.needsUpdate = true;
    o.instanceMatrix.needsUpdate = true;
    if (o.instanceColor) o.instanceColor.needsUpdate = true;
  }, []);

  return (
    <group>
      <instancedMesh ref={posts} args={[undefined, undefined, LAMPS.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.1, 0.16, 1, 6]} />
        <meshStandardMaterial color="#2a2530" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={orbs} args={[undefined, undefined, LAMPS.length]} frustumCulled={false}>
        <octahedronGeometry args={[0.34, 0]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

// ---- A paved plot under every building ----------------------------------
const LOT_BUILDINGS = BUILDINGS.filter((b) => b.type !== "plaza" && b.type !== "crane");

export function Lots() {
  const ref = useRef<THREE.InstancedMesh>(null!);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    LOT_BUILDINGS.forEach((b, i) => {
      dummy.position.set(b.x, 0.03, b.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(b.w + 8, b.d + 8, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      col.set(themeOf(b.district).ground).multiplyScalar(0.5);
      m.setColorAt(i, col);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);

  return (
    <instancedMesh ref={ref} args={[PLANE, undefined, LOT_BUILDINGS.length]} frustumCulled={false}>
      <meshStandardMaterial color="#ffffff" roughness={1} />
    </instancedMesh>
  );
}

// ---- Broken pillars and boulders scattered in the empty parts of each block
type Prop = { x: number; z: number; h: number; r: number; k: number; rot: number };
const PILLARS: Prop[] = [];
const BOULDERS: Prop[] = [];

(() => {
  const byBlock = new Map<string, { x: number; z: number; w: number; d: number }[]>();
  for (const b of BUILDINGS) {
    const key = `${Math.round(b.x / BLOCK_SIZE)},${Math.round(b.z / BLOCK_SIZE)}`;
    const arr = byBlock.get(key) ?? [];
    arr.push({ x: b.x, z: b.z, w: b.w, d: b.d });
    byBlock.set(key, arr);
  }
  for (let gx = -GRID; gx <= GRID; gx++) {
    for (let gz = -GRID; gz <= GRID; gz++) {
      const blds = byBlock.get(`${gx},${gz}`) ?? [];
      for (let i = 0; i < 4; i++) {
        const x = gx * BLOCK_SIZE + (hash01(gx, gz, 101 + i * 5) - 0.5) * 44;
        const z = gz * BLOCK_SIZE + (hash01(gx, gz, 102 + i * 5) - 0.5) * 44;
        if (blds.some((b) => Math.abs(x - b.x) < b.w / 2 + 3 && Math.abs(z - b.z) < b.d / 2 + 3)) continue;
        const prop: Prop = {
          x, z,
          h: 1.6 + hash01(gx, gz, 103 + i * 5) * 3.6,
          r: 0.5 + hash01(gx, gz, 104 + i * 5) * 0.5,
          k: kingdomAtBlock(gx, gz),
          rot: hash01(gx, gz, 105 + i * 5) * 3,
        };
        (hash01(gx, gz, 106 + i * 5) > 0.55 ? BOULDERS : PILLARS).push(prop);
      }
    }
  }
})();

export function Props() {
  const pillars = useRef<THREE.InstancedMesh>(null!);
  const boulders = useRef<THREE.InstancedMesh>(null!);

  useLayoutEffect(() => {
    const p = pillars.current;
    const b = boulders.current;
    if (!p || !b) return;
    PILLARS.forEach((s, i) => {
      dummy.position.set(s.x, s.h / 2, s.z);
      dummy.rotation.set(0, s.rot, (hash01(s.x, s.z, 7) - 0.5) * 0.25);
      dummy.scale.set(s.r, s.h, s.r);
      dummy.updateMatrix();
      p.setMatrixAt(i, dummy.matrix);
      col.set(THEMES[s.k].stone).multiplyScalar(0.75);
      p.setColorAt(i, col);
    });
    BOULDERS.forEach((s, i) => {
      dummy.position.set(s.x, s.r * 0.5, s.z);
      dummy.rotation.set(0, s.rot, 0);
      dummy.scale.set(s.r * 1.6, s.r, s.r * 1.4);
      dummy.updateMatrix();
      b.setMatrixAt(i, dummy.matrix);
      col.set(THEMES[s.k].stone).multiplyScalar(0.6);
      b.setColorAt(i, col);
    });
    p.instanceMatrix.needsUpdate = true;
    b.instanceMatrix.needsUpdate = true;
    if (p.instanceColor) p.instanceColor.needsUpdate = true;
    if (b.instanceColor) b.instanceColor.needsUpdate = true;
  }, []);

  return (
    <group>
      <instancedMesh ref={pillars} args={[undefined, undefined, PILLARS.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.7, 1, 1, 6]} />
        <meshStandardMaterial color="#ffffff" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={boulders} args={[undefined, undefined, BOULDERS.length]} frustumCulled={false}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={1} />
      </instancedMesh>
    </group>
  );
}