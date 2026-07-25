import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

type NPC = {
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  gang: 0 | 1 | 2 | 3;
  phase: number;
};

const GANG_COLORS = ["#e94b4b", "#4bb0e9", "#4be97a", "#e9c94b"];

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function NPCs({ count = 24 }: { count?: number }) {
  const npcs = useMemo<NPC[]>(() => {
    const r = rng(42);
    return Array.from({ length: count }, () => {
      const angle = r() * Math.PI * 2;
      const dist = 20 + r() * 80;
      return {
        pos: new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist),
        dir: new THREE.Vector3(Math.cos(r() * Math.PI * 2), 0, Math.sin(r() * Math.PI * 2)),
        speed: 1.5 + r() * 1.5,
        gang: Math.floor(r() * 4) as 0 | 1 | 2 | 3,
        phase: r() * 10,
      };
    });
  }, [count]);

  // Group NPCs by gang for instanced coloring
  const groups = useMemo(() => {
    const g: NPC[][] = [[], [], [], []];
    npcs.forEach((n) => g[n.gang].push(n));
    return g;
  }, [npcs]);

  return (
    <group>
      {groups.map((gnpcs, gi) => (
        <NPCGang key={gi} npcs={gnpcs} color={GANG_COLORS[gi]} />
      ))}
    </group>
  );
}

function NPCGang({ npcs, color }: { npcs: NPC[]; color: string }) {
  const bodyRef = useRef<THREE.InstancedMesh>(null!);
  const headRef = useRef<THREE.InstancedMesh>(null!);
  const legLRef = useRef<THREE.InstancedMesh>(null!);
  const legRRef = useRef<THREE.InstancedMesh>(null!);

  useFrame((_, dt) => {
    const dtc = Math.min(dt, 0.05);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const bodyPos = new THREE.Vector3();
    const legPos = new THREE.Vector3();

    npcs.forEach((n, i) => {
      // Wander
      n.phase += dtc;
      if (n.phase > 3) {
        n.phase = 0;
        n.dir.set(Math.random() * 2 - 1, 0, Math.random() * 2 - 1).normalize();
      }
      n.pos.addScaledVector(n.dir, n.speed * dtc);
      // Keep bounded
      if (n.pos.length() > 140) n.dir.multiplyScalar(-1);

      const yaw = Math.atan2(n.dir.x, n.dir.z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const walk = Math.sin(n.phase * n.speed * 6) * 0.6;

      // Body
      bodyPos.set(n.pos.x, 0.9, n.pos.z);
      m.compose(bodyPos, q, new THREE.Vector3(0.7, 1.4, 0.42));
      bodyRef.current?.setMatrixAt(i, m);

      // Head
      bodyPos.set(n.pos.x, 1.75, n.pos.z);
      m.compose(bodyPos, q, new THREE.Vector3(0.42, 0.42, 0.42));
      headRef.current?.setMatrixAt(i, m);

      // Legs — offset with yaw rotation applied
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const legOffset = 0.18;
      const swingOffZ = Math.sin(walk) * 0.15;

      legPos.set(n.pos.x + cy * -legOffset, 0.3 + Math.abs(Math.sin(walk)) * 0.02, n.pos.z + sy * legOffset + swingOffZ);
      const qLeg = new THREE.Quaternion().setFromEuler(new THREE.Euler(walk, yaw, 0));
      m.compose(legPos, qLeg, new THREE.Vector3(0.24, 0.8, 0.26));
      legLRef.current?.setMatrixAt(i, m);

      legPos.set(n.pos.x + cy * legOffset, 0.3 + Math.abs(Math.sin(walk)) * 0.02, n.pos.z - sy * legOffset - swingOffZ);
      const qLeg2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(-walk, yaw, 0));
      m.compose(legPos, qLeg2, new THREE.Vector3(0.24, 0.8, 0.26));
      legRRef.current?.setMatrixAt(i, m);
    });

    [bodyRef, headRef, legLRef, legRRef].forEach((r) => {
      if (r.current) r.current.instanceMatrix.needsUpdate = true;
    });
  });

  if (npcs.length === 0) return null;

  return (
    <group>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, npcs.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, npcs.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#d9a582" />
      </instancedMesh>
      <instancedMesh ref={legLRef} args={[undefined, undefined, npcs.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#1a1a20" />
      </instancedMesh>
      <instancedMesh ref={legRRef} args={[undefined, undefined, npcs.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#1a1a20" />
      </instancedMesh>
    </group>
  );
}
