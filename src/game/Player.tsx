import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { input, readKeyboardMove } from "./input";

export function Player() {
  const group = useRef<THREE.Group>(null!);
  const vel = useRef(new THREE.Vector3());
  const yaw = useRef(0);
  const pitch = useRef(0.35);
  const grounded = useRef(true);
  const { camera } = useThree();

  useFrame((_, dt) => {
    const dtc = Math.min(dt, 0.05);

    // Look input (right stick or arrow keys)
    const lookX = input.look.x + ((input.keys.has("ArrowRight") ? 1 : 0) - (input.keys.has("ArrowLeft") ? 1 : 0));
    const lookY = input.look.y + ((input.keys.has("ArrowDown") ? 1 : 0) - (input.keys.has("ArrowUp") ? 1 : 0));
    yaw.current -= lookX * 2.2 * dtc;
    pitch.current = THREE.MathUtils.clamp(pitch.current + lookY * 1.6 * dtc, 0.05, 1.2);

    // Move input
    const kb = readKeyboardMove();
    const mx = input.move.x + kb.x;
    const my = input.move.y + kb.y;
    const mag = Math.min(1, Math.hypot(mx, my));

    const speed = (input.run || input.keys.has("ShiftLeft") ? 9 : 5) * mag;
    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const dir = new THREE.Vector3();
    if (mag > 0.01) {
      dir.addScaledVector(forward, -my / (mag || 1));
      dir.addScaledVector(right, mx / (mag || 1));
      dir.normalize().multiplyScalar(speed);
    }

    vel.current.x = dir.x;
    vel.current.z = dir.z;

    // Gravity + jump
    vel.current.y -= 22 * dtc;
    if (input.jump && grounded.current) {
      vel.current.y = 8;
      grounded.current = false;
    }
    input.jump = false;

    const p = group.current.position;
    p.x += vel.current.x * dtc;
    p.y += vel.current.y * dtc;
    p.z += vel.current.z * dtc;
    if (p.y <= 0) {
      p.y = 0;
      vel.current.y = 0;
      grounded.current = true;
    }

    // Face movement direction
    if (mag > 0.05) {
      const targetRot = Math.atan2(dir.x, dir.z);
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        targetRot,
        Math.min(1, dtc * 12),
      );
    }

    // Third-person camera
    const camDist = 6;
    const camHeight = 3 + Math.sin(pitch.current) * 2;
    const back = new THREE.Vector3(Math.sin(yaw.current), 0, Math.cos(yaw.current));
    const camPos = new THREE.Vector3(
      p.x + back.x * camDist,
      p.y + camHeight,
      p.z + back.z * camDist,
    );
    camera.position.lerp(camPos, Math.min(1, dtc * 10));
    camera.lookAt(p.x, p.y + 1.2, p.z);
  });

  return (
    <group ref={group} position={[0, 0, 0]}>
      {/* Body */}
      <mesh castShadow position={[0, 1.1, 0]}>
        <boxGeometry args={[0.8, 1.2, 0.5]} />
        <meshStandardMaterial color="#2b5cff" />
      </mesh>
      {/* Head */}
      <mesh castShadow position={[0, 2.0, 0]}>
        <boxGeometry args={[0.55, 0.55, 0.55]} />
        <meshStandardMaterial color="#e0b48a" />
      </mesh>
      {/* Legs */}
      <mesh castShadow position={[-0.2, 0.35, 0]}>
        <boxGeometry args={[0.3, 0.7, 0.35]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh castShadow position={[0.2, 0.35, 0]}>
        <boxGeometry args={[0.3, 0.7, 0.35]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
    </group>
  );
}
