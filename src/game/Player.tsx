import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { input, readKeyboardMove } from "./input";

export function Player() {
  const group = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const legL = useRef<THREE.Group>(null!);
  const legR = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);

  const vel = useRef(new THREE.Vector3());
  const yaw = useRef(0);
  const pitch = useRef(0.35);
  const grounded = useRef(true);
  const walkPhase = useRef(0);
  const { camera } = useThree();

  useFrame((_, dt) => {
    const dtc = Math.min(dt, 0.05);

    // Look
    const lookX =
      input.look.x +
      ((input.keys.has("ArrowRight") ? 1 : 0) - (input.keys.has("ArrowLeft") ? 1 : 0)) +
      input.mouseDX * 0.15;
    const lookY =
      input.look.y +
      ((input.keys.has("ArrowDown") ? 1 : 0) - (input.keys.has("ArrowUp") ? 1 : 0)) +
      input.mouseDY * 0.15;
    input.mouseDX = 0;
    input.mouseDY = 0;
    yaw.current -= lookX * 2.4 * dtc;
    pitch.current = THREE.MathUtils.clamp(pitch.current + lookY * 1.6 * dtc, 0.05, 1.1);

    // Move
    const kb = readKeyboardMove();
    const mx = input.move.x + kb.x;
    const my = input.move.y + kb.y;
    const mag = Math.min(1, Math.hypot(mx, my));
    const running = input.run || input.keys.has("ShiftLeft");
    const speed = (running ? 9 : 5) * mag;

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

    // Face movement
    if (mag > 0.05) {
      const targetRot = Math.atan2(dir.x, dir.z);
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        targetRot,
        Math.min(1, dtc * 12),
      );
    }

    // Procedural walk cycle
    const step = running ? 12 : 8;
    walkPhase.current += dtc * step * (mag > 0.05 ? 1 : 0);
    const swing = Math.sin(walkPhase.current) * (running ? 0.9 : 0.6) * mag;
    if (legL.current && legR.current && armL.current && armR.current && body.current) {
      legL.current.rotation.x = swing;
      legR.current.rotation.x = -swing;
      armL.current.rotation.x = -swing * 0.8;
      armR.current.rotation.x = swing * 0.8;
      body.current.position.y = 1.05 + Math.abs(Math.sin(walkPhase.current)) * 0.05 * mag;
    }

    // Chase camera
    const camDist = 5.5;
    const camHeight = 2.4 + Math.sin(pitch.current) * 2.2;
    const back = new THREE.Vector3(Math.sin(yaw.current), 0, Math.cos(yaw.current));
    const camPos = new THREE.Vector3(
      p.x + back.x * camDist,
      p.y + camHeight,
      p.z + back.z * camDist,
    );
    camera.position.lerp(camPos, Math.min(1, dtc * 10));
    camera.lookAt(p.x, p.y + 1.4, p.z);
  });

  return (
    <group ref={group} position={[0, 0, 0]}>
      <group ref={body}>
        {/* Torso — leather jacket */}
        <mesh castShadow position={[0, 0.55, 0]}>
          <boxGeometry args={[0.7, 0.9, 0.4]} />
          <meshStandardMaterial color="#1a1a1f" roughness={0.5} />
        </mesh>
        {/* Neck */}
        <mesh castShadow position={[0, 1.08, 0]}>
          <boxGeometry args={[0.22, 0.16, 0.22]} />
          <meshStandardMaterial color="#c99879" />
        </mesh>
        {/* Head */}
        <mesh castShadow position={[0, 1.35, 0]}>
          <boxGeometry args={[0.44, 0.44, 0.44]} />
          <meshStandardMaterial color="#d9a582" />
        </mesh>
        {/* Hair/cap */}
        <mesh castShadow position={[0, 1.6, -0.02]}>
          <boxGeometry args={[0.46, 0.14, 0.46]} />
          <meshStandardMaterial color="#0d0d10" />
        </mesh>

        {/* Arms — pivot at shoulder */}
        <group ref={armL} position={[-0.45, 1.0, 0]}>
          <mesh castShadow position={[0, -0.4, 0]}>
            <boxGeometry args={[0.2, 0.8, 0.22]} />
            <meshStandardMaterial color="#1a1a1f" />
          </mesh>
          <mesh castShadow position={[0, -0.9, 0]}>
            <boxGeometry args={[0.18, 0.18, 0.18]} />
            <meshStandardMaterial color="#d9a582" />
          </mesh>
        </group>
        <group ref={armR} position={[0.45, 1.0, 0]}>
          <mesh castShadow position={[0, -0.4, 0]}>
            <boxGeometry args={[0.2, 0.8, 0.22]} />
            <meshStandardMaterial color="#1a1a1f" />
          </mesh>
          <mesh castShadow position={[0, -0.9, 0]}>
            <boxGeometry args={[0.18, 0.18, 0.18]} />
            <meshStandardMaterial color="#d9a582" />
          </mesh>
        </group>

        {/* Legs — pivot at hip */}
        <group ref={legL} position={[-0.18, 0.1, 0]}>
          <mesh castShadow position={[0, -0.4, 0]}>
            <boxGeometry args={[0.26, 0.85, 0.28]} />
            <meshStandardMaterial color="#2a2f3a" />
          </mesh>
          <mesh castShadow position={[0, -0.9, 0.05]}>
            <boxGeometry args={[0.28, 0.12, 0.4]} />
            <meshStandardMaterial color="#050505" />
          </mesh>
        </group>
        <group ref={legR} position={[0.18, 0.1, 0]}>
          <mesh castShadow position={[0, -0.4, 0]}>
            <boxGeometry args={[0.26, 0.85, 0.28]} />
            <meshStandardMaterial color="#2a2f3a" />
          </mesh>
          <mesh castShadow position={[0, -0.9, 0.05]}>
            <boxGeometry args={[0.28, 0.12, 0.4]} />
            <meshStandardMaterial color="#050505" />
          </mesh>
        </group>
      </group>
    </group>
  );
}
