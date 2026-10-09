import { Text } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  BUILDINGS,
  BLOCK_SIZE,
  GRID,
  HARBOR_Z,
  DISTRICT_LABELS,
  districtFor,
} from "./worldData";
import { themeOf } from "./city/palette";
import {
  Bank, Crane, Harbor, LowRise, Mall, Silo, Stadium, Tower, Warehouse,
} from "./city/buildingsA";
import {
  Brownstone, Casino, Hangar, Headquarters, Hospital, House, Pagoda, Plaza, Shanty,
} from "./city/buildingsB";

const GROUND_PLANE = new THREE.PlaneGeometry(1, 1);

/** One instanced mesh tints every block of land in its kingdom's color. */
function GroundTiles() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const tiles = useMemo(() => {
    const list: { x: number; z: number; color: THREE.Color }[] = [];
    for (let gx = -GRID; gx <= GRID; gx++) {
      for (let gz = -GRID; gz <= GRID; gz++) {
        list.push({
          x: gx * BLOCK_SIZE,
          z: gz * BLOCK_SIZE,
          color: new THREE.Color(themeOf(districtFor(gx, gz)).ground),
        });
      }
    }
    return list;
  }, []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    tiles.forEach((t, i) => {
      dummy.position.set(t.x, 0.004, t.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(BLOCK_SIZE, BLOCK_SIZE, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, t.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [tiles]);

  return (
    <instancedMesh ref={ref} args={[GROUND_PLANE, undefined, tiles.length]} frustumCulled={false}>
      <meshStandardMaterial color="#ffffff" roughness={1} />
    </instancedMesh>
  );
}

export function City() {
  const roadCount = GRID * 2 + 1;

  const rendered = useMemo(() => {
    return BUILDINGS.map((b, i) => {
      switch (b.type) {
        case "tower": return <Tower key={i} b={b} />;
        case "warehouse": return <Warehouse key={i} b={b} />;
        case "silo": return <Silo key={i} b={b} />;
        case "bank": return <Bank key={i} b={b} />;
        case "lowrise": return <LowRise key={i} b={b} />;
        case "mall": return <Mall key={i} b={b} />;
        case "harbor": return <Harbor key={i} b={b} />;
        case "crane": return <Crane key={i} b={b} />;
        case "stadium": return <Stadium key={i} b={b} />;
        case "hospital": return <Hospital key={i} b={b} />;
        case "house": return <House key={i} b={b} />;
        case "plaza": return <Plaza key={i} b={b} />;
        case "hangar": return <Hangar key={i} b={b} />;
        case "casino": return <Casino key={i} b={b} />;
        case "pagoda": return <Pagoda key={i} b={b} />;
        case "shanty": return <Shanty key={i} b={b} />;
        case "brownstone": return <Brownstone key={i} b={b} />;
        case "hq": return <Headquarters key={i} b={b} />;
        default: return null;
      }
    });
  }, []);

  const groundExtent = (GRID * 2 + 2) * BLOCK_SIZE;
  const roadLen = groundExtent;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]}>
        <planeGeometry args={[groundExtent, groundExtent]} />
        <meshStandardMaterial color="#8b8794" roughness={1} />
      </mesh>

      <GroundTiles />

      {/* The Black Tide: violet harbor water. */}
      <mesh position={[0, 0.03, HARBOR_Z - BLOCK_SIZE * 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[groundExtent, BLOCK_SIZE * 1.4]} />
        <meshStandardMaterial color="#6b52b8" emissive="#3a2a80" emissiveIntensity={0.35} roughness={0.4} />
      </mesh>

      {Array.from({ length: roadCount }).map((_, i) => {
        const p = (i - (roadCount - 1) / 2) * BLOCK_SIZE;
        return (
          <group key={i}>
            <mesh position={[p, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[10, roadLen]} />
              <meshStandardMaterial color="#55505c" roughness={0.95} />
            </mesh>
            <mesh position={[0, 0.02, p]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
              <planeGeometry args={[10, roadLen]} />
              <meshStandardMaterial color="#55505c" roughness={0.95} />
            </mesh>
            <mesh position={[p, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.16, roadLen]} />
              <meshBasicMaterial color="#d8c27a" transparent opacity={0.5} />
            </mesh>
            <mesh position={[0, 0.03, p]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
              <planeGeometry args={[0.16, roadLen]} />
              <meshBasicMaterial color="#d8c27a" transparent opacity={0.5} />
            </mesh>
          </group>
        );
      })}

      {rendered}

      {DISTRICT_LABELS.map((d, i) => (
        <Text
          key={i}
          position={[d.x, 46, d.z]}
          fontSize={5}
          color={themeOf(d.district).trim}
          outlineWidth={0.25}
          outlineColor="#2a2530"
          anchorX="center"
          anchorY="middle"
        >
          {d.name}
        </Text>
      ))}
    </group>
  );
}