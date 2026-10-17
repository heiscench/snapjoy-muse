import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { healPlayer, playerState } from "./playerState";
import { THEMES, hash01 } from "./city/palette";
import { SKY_ISLANDS, type SkyIsland } from "./skyIslands";

const HEAL_PER_SEC = 16;
const BOULDERS = 6;

function Island({ island }: { island: SkyIsland }) {
  const theme = THEMES[island.kingdom];
  const crystal = useRef<THREE.Mesh>(null!);
  const label = useRef<THREE.Object3D>(null!);
  const { r, top } = island;
  const top1 = top + 0.06;
  const ground = new THREE.Color(theme.ground).lerp(new THREE.Color("#ffffff"), 0.15).getStyle();
  const rock = new THREE.Color(theme.stone).multiplyScalar(0.42).getStyle();

  useFrame(({ clock, camera }, dt) => {
    if (crystal.current) {
      crystal.current.rotation.y = clock.elapsedTime * 0.8;
      crystal.current.position.y = top + 17 + Math.sin(clock.elapsedTime * 1.2) * 0.6;
    }
    if (label.current) label.current.quaternion.copy(camera.quaternion);
    // The Sky Hall restores whoever stands on it.
    if (
      Math.hypot(playerState.pos.x - island.x, playerState.pos.z - island.z) < r - 2 &&
      Math.abs(playerState.y - top) < 3
    ) {
      healPlayer(HEAL_PER_SEC * Math.min(dt, 0.05));
    }
  });

  const pylons = [0, 1, 2, 3].map((i) => {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    return { x: Math.cos(a) * r * 0.7, z: Math.sin(a) * r * 0.7 };
  });

  return (
    <group position={[island.x, 0, island.z]}>
      {/* the rock beneath, hanging down to a point */}
      <mesh position={[0, top - 24, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[r * 0.98, 46, 9]} />
        <meshStandardMaterial color={rock} roughness={1} flatShading />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2 + hash01(i, island.kingdom, 501);
        const rr = r * (0.45 + hash01(i, island.kingdom, 502) * 0.35);
        const h = 14 + hash01(i, island.kingdom, 503) * 14;
        return (
          <mesh key={i} position={[Math.cos(a) * rr, top - 6 - h / 2, Math.sin(a) * rr]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[2.4 + hash01(i, island.kingdom, 504) * 2, h, 5]} />
            <meshStandardMaterial color={rock} roughness={1} flatShading />
          </mesh>
        );
      })}

      {/* the surface you land on: its top is exactly at `top` */}
      <mesh position={[0, top - 1.2, 0]}>
        <cylinderGeometry args={[r, r * 0.97, 2.4, 28]} />
        <meshStandardMaterial color={ground} roughness={1} />
      </mesh>
      <mesh position={[0, top1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[r - 2.2, r - 1.2, 56]} />
        <meshBasicMaterial color={theme.glow} toneMapped={false} />
      </mesh>

      {/* landing pad */}
      <mesh position={[0, top1 + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[8, 9.2, 40]} />
        <meshBasicMaterial color={theme.trim} toneMapped={false} />
      </mesh>
      <mesh position={[0, top1 + 0.02, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 6]}>
        <ringGeometry args={[3.6, 4.4, 6]} />
        <meshBasicMaterial color={theme.glow} toneMapped={false} />
      </mesh>

      {/* four pylons with glowing crowns and banners */}
      {pylons.map((p, i) => (
        <group key={i} position={[p.x, top, p.z]}>
          <mesh position={[0, 3.5, 0]}>
            <boxGeometry args={[1.4, 7, 1.4]} />
            <meshStandardMaterial color={theme.stone} roughness={1} />
          </mesh>
          <mesh position={[0, 8.2, 0]}>
            <octahedronGeometry args={[0.9, 0]} />
            <meshBasicMaterial color={theme.glow} toneMapped={false} />
          </mesh>
          <mesh position={[0, 4.4, 0.78]}>
            <planeGeometry args={[1.5, 4]} />
            <meshStandardMaterial color={theme.cloth} roughness={1} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* the shrine behind the pad, with a floating crystal */}
      <mesh position={[0, top + 5, -r * 0.5]}>
        <cylinderGeometry args={[0.9, 2.2, 10, 4]} />
        <meshStandardMaterial color={theme.stone} emissive={theme.glow} emissiveIntensity={0.18} roughness={1} />
      </mesh>
      <mesh ref={crystal} position={[0, top + 17, -r * 0.5]} scale={[1, 1.8, 1]}>
        <octahedronGeometry args={[1.4, 0]} />
        <meshBasicMaterial color={theme.glow} toneMapped={false} />
      </mesh>

      {/* scattered boulders */}
      {Array.from({ length: BOULDERS }, (_, i) => {
        const a = (i / BOULDERS) * Math.PI * 2 + 0.4;
        const rr = r * (0.55 + hash01(i, island.kingdom, 505) * 0.3);
        const s = 1 + hash01(i, island.kingdom, 506) * 1.4;
        return (
          <mesh key={i} position={[Math.cos(a) * rr, top + s * 0.4, Math.sin(a) * rr]} scale={[s, s * 0.8, s]}>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={theme.stone} roughness={1} />
          </mesh>
        );
      })}

      <Text
        ref={(o) => { label.current = o as unknown as THREE.Object3D; }}
        position={[0, top + 27, -r * 0.5]}
        fontSize={4}
        color="#ffffff"
        outlineWidth={0.22}
        outlineColor="#2a2530"
        anchorX="center"
        anchorY="middle"
      >
        {`SKY HALL OF THE ${theme.name.toUpperCase()}`}
      </Text>
    </group>
  );
}

/** The four landable floating islands, one above each kingdom's Hall. */
export function SkyIslands() {
  return (
    <>
      {SKY_ISLANDS.map((i) => (
        <Island key={i.kingdom} island={i} />
      ))}
    </>
  );
}