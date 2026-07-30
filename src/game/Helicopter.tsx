import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { GANGS } from "./gangs";
import { HELICOPTERS } from "./vehicleState";
import { HELI_PADS } from "./worldData";

function ParkedHelicopter({ gangId }: { gangId: 0 | 1 | 2 | 3 }) {
  const group = useRef<THREE.Group>(null!);
  const rotor = useRef<THREE.Group>(null!);
  const gang = GANGS[gangId];
  const lastPos = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const h = HELICOPTERS[gangId];
    if (!group.current || !rotor.current) return;

    if (h.destroyed) {
      group.current.visible = false;
      h.respawn -= dt;
      if (h.respawn <= 0) {
        const pad = HELI_PADS[gangId];
        h.pos.set(pad.x, 0, pad.z);
        h.yaw = 0; h.vy = 0;
        h.hp = 300;
        h.destroyed = false;
      }
      return;
    }
    group.current.visible = true;

    const flying = h.pos.y > 0.5 || Math.abs(h.vy) > 0.5;
    rotor.current.rotation.y += dt * (flying ? 22 : 1.2);

    const vx = h.pos.x - lastPos.current.x;
    const vz = h.pos.z - lastPos.current.z;
    lastPos.current.set(h.pos.x, h.pos.y, h.pos.z);

    group.current.position.set(h.pos.x, h.pos.y, h.pos.z);
    group.current.rotation.y = h.yaw;
    const localX = Math.cos(-h.yaw) * vx - Math.sin(-h.yaw) * vz;
    group.current.rotation.z = THREE.MathUtils.lerp(
      group.current.rotation.z,
      THREE.MathUtils.clamp(-localX * 6, -0.35, 0.35),
      Math.min(1, dt * 4),
    );
  });

  return (
    <group ref={group} position={[HELI_PADS[gangId].x, 0, HELI_PADS[gangId].z]}>
      {/* Main fuselage — tapered nose to tail instead of a plain capsule */}
      <mesh position={[0, 1.4, 0.3]}>
        <coneGeometry args={[0.55, 1.4, 10]} />
        <meshStandardMaterial color={gang.color} metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.4, -0.9]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.4, 2.4, 10]} />
        <meshStandardMaterial color={gang.color} metalness={0.55} roughness={0.35} />
      </mesh>
      {/* Cockpit glass */}
      <mesh position={[0, 1.48, 1.15]}>
        <sphereGeometry args={[0.62, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshStandardMaterial color="#0c1420" transparent opacity={0.6} roughness={0.05} metalness={0.2} />
      </mesh>
      {/* Belly intake / engine detail */}
      <mesh position={[0, 1.05, -0.6]}>
        <boxGeometry args={[0.7, 0.3, 1.1]} />
        <meshStandardMaterial color="#1a1a1e" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Tail boom, tapered */}
      <mesh position={[0, 1.45, -2.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.28, 3, 8]} />
        <meshStandardMaterial color={gang.color} metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Tail fin */}
      <mesh position={[0, 1.85, -4]}>
        <boxGeometry args={[0.06, 0.8, 0.9]} />
        <meshStandardMaterial color={gang.color} />
      </mesh>
      <mesh position={[0.05, 1.9, -4]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.05, 1.1, 0.1]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* Skids, angled struts */}
      {[-0.85, 0.85].map((s) => (
        <group key={s}>
          <mesh position={[s, 0.32, 0]}>
            <boxGeometry args={[0.1, 0.1, 2.8]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          <mesh position={[s, 0.75, 0.7]} rotation={[0, 0, s > 0 ? -0.35 : 0.35]}>
            <boxGeometry args={[0.06, 0.9, 0.06]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          <mesh position={[s, 0.75, -0.7]} rotation={[0, 0, s > 0 ? -0.35 : 0.35]}>
            <boxGeometry args={[0.06, 0.9, 0.06]} />
            <meshStandardMaterial color="#111" />
          </mesh>
        </group>
      ))}
      {/* Gang accent stripe */}
      <mesh position={[0, 1.4, 0]}>
        <boxGeometry args={[1.02, 0.15, 3.2]} />
        <meshBasicMaterial color={gang.accent} />
      </mesh>
      <group ref={rotor} position={[0, 2.75, 0.3]}>
        <mesh>
          <boxGeometry args={[7.5, 0.06, 0.32]} />
          <meshStandardMaterial color="#0a0a0a" metalness={0.3} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[7.5, 0.06, 0.32]} />
          <meshStandardMaterial color="#0a0a0a" metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.25, 8]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>
    </group>
  );
}

function LandingPad({ gangId }: { gangId: 0 | 1 | 2 | 3 }) {
  const gang = GANGS[gangId];
  const pos = HELI_PADS[gangId];
  return (
    <group position={[pos.x, 0, pos.z]}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[7, 24]} />
        <meshStandardMaterial color="#141414" />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5.6, 6, 24]} />
        <meshBasicMaterial color={gang.accent} />
      </mesh>
    </group>
  );
}

export function Helicopters() {
  const ids = [0, 1, 2, 3] as const;
  return (
    <>
      {ids.map((g) => <LandingPad key={`pad-${g}`} gangId={g} />)}
      {ids.map((g) => <ParkedHelicopter key={`heli-${g}`} gangId={g} />)}
    </>
  );
}