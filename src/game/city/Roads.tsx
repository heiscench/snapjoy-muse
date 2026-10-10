import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GRID } from "../worldData";
import { THEMES } from "./palette";
import { kingdomAtBlock, ROAD_LEN, ROAD_LINES, ROAD_W, SIDEWALK_W } from "./layout";
import { roadGlowTexture, roadTexture } from "./roadTextures";

const PLANE = new THREE.PlaneGeometry(1, 1);
const RING = new THREE.RingGeometry(4.4, 5.2, 28);
const dummy = new THREE.Object3D();
const COUNT = ROAD_LINES.length * ROAD_LINES.length;

// Layers sit a few centimetres apart so nothing flickers: ground .01, lots .03,
// sidewalks .05, roads .07, crossings .09, rune rings .10.
export function Roads() {
  const plates = useRef<THREE.InstancedMesh>(null!);
  const rings = useRef<THREE.InstancedMesh>(null!);

  const roadMat = useMemo(() => {
    const map = roadTexture();
    const glow = roadGlowTexture();
    if (map) map.repeat.set(1, ROAD_LEN / 16);
    if (glow) glow.repeat.set(1, ROAD_LEN / 16);
    return new THREE.MeshStandardMaterial({
      map: map ?? undefined,
      emissiveMap: glow ?? undefined,
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: 0.85,
      roughness: 0.95,
    });
  }, []);
  const sideMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#6d6678", roughness: 1 }), []);

  useLayoutEffect(() => {
    const p = plates.current;
    const r = rings.current;
    if (!p || !r) return;
    const col = new THREE.Color();
    let n = 0;
    for (let i = 0; i < ROAD_LINES.length; i++) {
      for (let j = 0; j < ROAD_LINES.length; j++) {
        const x = ROAD_LINES[i];
        const z = ROAD_LINES[j];
        dummy.position.set(x, 0.09, z);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(ROAD_W, ROAD_W, 1);
        dummy.updateMatrix();
        p.setMatrixAt(n, dummy.matrix);

        dummy.position.set(x, 0.1, z);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        r.setMatrixAt(n, dummy.matrix);
        col.set(THEMES[kingdomAtBlock(i - GRID - 1, j - GRID - 1)].glow);
        r.setColorAt(n, col);
        n++;
      }
    }
    p.instanceMatrix.needsUpdate = true;
    r.instanceMatrix.needsUpdate = true;
    if (r.instanceColor) r.instanceColor.needsUpdate = true;
  }, []);

  return (
    <group>
      {ROAD_LINES.map((p, i) => (
        <group key={i}>
          <mesh position={[p, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} material={sideMat}>
            <planeGeometry args={[ROAD_W + SIDEWALK_W * 2, ROAD_LEN]} />
          </mesh>
          <mesh position={[0, 0.052, p]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} material={sideMat}>
            <planeGeometry args={[ROAD_W + SIDEWALK_W * 2, ROAD_LEN]} />
          </mesh>
          <mesh position={[p, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]} material={roadMat}>
            <planeGeometry args={[ROAD_W, ROAD_LEN]} />
          </mesh>
          <mesh position={[0, 0.075, p]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} material={roadMat}>
            <planeGeometry args={[ROAD_W, ROAD_LEN]} />
          </mesh>
        </group>
      ))}
      <instancedMesh ref={plates} args={[PLANE, undefined, COUNT]} frustumCulled={false}>
        <meshStandardMaterial color="#3d3846" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={rings} args={[RING, undefined, COUNT]} frustumCulled={false}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} toneMapped={false} side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  );
}