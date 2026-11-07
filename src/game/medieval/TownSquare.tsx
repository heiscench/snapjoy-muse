import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BLOCK_SIZE } from "../worldData";
import { hash01 } from "../city/palette";
import { SQUARE_BLOCK, SQUARE_SIZE, squareLayout } from "./colliders";

// The Kings' town square: cobbled ground, a fountain, a ring of market stalls and gold banners.
// Everything is built from simple shapes with vertex colours; each kind is ONE instanced mesh.

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

function build(fn: (add: (g: THREE.BufferGeometry, color: string, x: number, y: number, z: number) => void) => void) {
  const parts: THREE.BufferGeometry[] = [];
  fn((g, color, x, y, z) => {
    g.translate(x, y, z);
    parts.push(paint(g, color));
  });
  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  return merged;
}

const WOOD = "#5a3f26";
const WOOD_LIGHT = "#8b6a45";
const STONE = "#9a9285";
const WATER = "#3b6f8f";

function fountainGeometry() {
  return build((add) => {
    add(new THREE.CylinderGeometry(2.7, 2.9, 0.7, 20), STONE, 0, 0.35, 0);
    const w1 = new THREE.CircleGeometry(2.3, 20);
    w1.rotateX(-Math.PI / 2);
    add(w1, WATER, 0, 0.62, 0);
    add(new THREE.CylinderGeometry(0.35, 0.5, 1.8, 10), STONE, 0, 1.3, 0);
    add(new THREE.CylinderGeometry(1.1, 0.5, 0.35, 14), STONE, 0, 2.3, 0);
    const w2 = new THREE.CircleGeometry(0.95, 14);
    w2.rotateX(-Math.PI / 2);
    add(w2, WATER, 0, 2.49, 0);
    add(new THREE.SphereGeometry(0.3, 10, 8), "#f2c75c", 0, 2.85, 0);
  });
}

// Three awning colour pairs; the stall's front faces local +z.
const AWNINGS: [string, string][] = [
  ["#b03a2e", "#e8dcc0"],
  ["#2f5d8a", "#e8dcc0"],
  ["#c9962b", "#e8dcc0"],
];

function stallGeometry(c1: string, c2: string) {
  return build((add) => {
    add(new THREE.BoxGeometry(2.6, 0.9, 0.9), WOOD_LIGHT, 0, 0.45, 0.35); // counter
    add(new THREE.BoxGeometry(2.8, 0.08, 1.05), WOOD, 0, 0.94, 0.35); // counter top
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.12, 2.5, 0.12), WOOD, s * 1.3, 1.25, -0.45); // back posts
      add(new THREE.BoxGeometry(0.1, 2.1, 0.1), WOOD, s * 1.3, 1.05, 0.85); // front posts
    }
    for (let i = 0; i < 6; i++) {
      const g = new THREE.BoxGeometry(0.5, 0.06, 1.75);
      g.rotateX(0.26); // front edge lower than the back
      add(g, i % 2 ? c2 : c1, -1.25 + i * 0.5, 2.3, 0.2); // striped awning
    }
    add(new THREE.BoxGeometry(0.5, 0.3, 0.4), "#c0572e", -0.8, 1.13, 0.3); // goods
    add(new THREE.BoxGeometry(0.4, 0.25, 0.4), "#6a9b3a", 0.0, 1.1, 0.3);
    add(new THREE.BoxGeometry(0.5, 0.35, 0.45), "#d6a23a", 0.8, 1.15, 0.3);
  });
}

function bannerGeometry() {
  return build((add) => {
    add(new THREE.CylinderGeometry(0.1, 0.13, 6, 6), WOOD, 0, 3, 0);
    add(new THREE.BoxGeometry(1.2, 2.4, 0.04), "#f2c75c", 0.7, 4.6, 0);
    add(new THREE.BoxGeometry(0.5, 0.5, 0.05), "#b03a2e", 0.7, 4.9, 0.02);
    add(new THREE.BoxGeometry(1.2, 0.2, 0.05), "#b03a2e", 0.7, 3.5, 0.02);
  });
}

function cobbleTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "#5a4a3a";
    g.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 16; row++) {
      let x = row % 2 ? -10 : 0;
      let i = 0;
      while (x < 256) {
        const w = 20 + hash01(row, i, 31) * 22;
        const s = 0.82 + hash01(row, i, 32) * 0.3;
        g.fillStyle = `rgb(${Math.round(128 * s)},${Math.round(114 * s)},${Math.round(96 * s)})`;
        g.fillRect(x + 1, row * 16 + 1, w - 2, 14);
        x += w;
        i++;
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(SQUARE_SIZE / 10, SQUARE_SIZE / 10);
  t.anisotropy = 4;
  return t;
}

type Spot = { x: number; z: number; rot: number };

function Instances({ geometry, spots, material }: { geometry: THREE.BufferGeometry; spots: Spot[]; material: THREE.Material }) {
  const mesh = useMemo(() => {
    if (!spots.length) return null;
    return new THREE.InstancedMesh(geometry, material, spots.length);
  }, [geometry, spots, material]);

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

export function TownSquare() {
  const cx = SQUARE_BLOCK.gx * BLOCK_SIZE;
  const cz = SQUARE_BLOCK.gz * BLOCK_SIZE;
  const layout = useMemo(() => squareLayout(cx, cz), [cx, cz]);

  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), []);
  const floorTex = useMemo(() => cobbleTexture(), []);
  const fountain = useMemo(() => fountainGeometry(), []);
  const banner = useMemo(() => bannerGeometry(), []);
  const stallGeos = useMemo(() => AWNINGS.map(([a, b]) => stallGeometry(a, b)), []);
  const stallSpots = useMemo(
    () => AWNINGS.map((_, v) => layout.stalls.filter((s) => s.variant === v).map((s) => ({ x: s.x, z: s.z, rot: s.rot }))),
    [layout],
  );

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.06, cz]}>
        <planeGeometry args={[SQUARE_SIZE, SQUARE_SIZE]} />
        <meshStandardMaterial map={floorTex} roughness={1} />
      </mesh>
      <Instances geometry={fountain} spots={[{ x: layout.fountain.x, z: layout.fountain.z, rot: 0 }]} material={mat} />
      {stallGeos.map((g, v) => (
        <Instances key={v} geometry={g} spots={stallSpots[v]} material={mat} />
      ))}
      <Instances geometry={banner} spots={layout.banners} material={mat} />
    </group>
  );
}
