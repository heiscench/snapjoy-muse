import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { input, readKeyboardMove } from "./input";
import { Weapon } from "./Weapon";

export function Player() {
  const group = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const legL = useRef<THREE.Group>(null!);
  const legR = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);

  const vel = useRef(new THREE.Vector3());
  const yaw = useRef(0);
  const pitch = useRef(0.25);
  const grounded = useRef(true);
  const walkPhase = useRef(0);
  const camOffset = useRef(new THREE.Vector3());
  const { camera } = useThree();

  useFrame((_, dt) => {
    const dtc = Math.min(dt, 0.05);

    // Look
    const lookX =
      input.look.x +
      ((input.keys.has("ArrowRight") ? 1 : 0) - (input.keys.has("ArrowLeft") ? 1 : 0)) +
      input.mouseDX * 0.12;
    const lookY =
      input.look.y +
      ((input.keys.has("ArrowDown") ? 1 : 0) - (input.keys.has("ArrowUp") ? 1 : 0)) +
      input.mouseDY * 0.12;
    input.mouseDX = 0;
    input.mouseDY = 0;
    yaw.current -= lookX * 2.6 * dtc;
    pitch.current = THREE.MathUtils.clamp(pitch.current + lookY * 1.4 * dtc, -0.3, 1.0);

    // Move
    const kb = readKeyboardMove();
    const mx = input.move.x + kb.x;
    const my = input.move.y + kb.y;
    const mag = Math.min(1, Math.hypot(mx, my));
    const running = input.run || input.keys.has("ShiftLeft");
    const aiming = input.aim;
    const speedBase = aiming ? 3.5 : running ? 9 : 5;
    const speed = speedBase * mag;

    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const dir = new THREE.Vector3();
    if (mag > 0.01) {
      dir.addScaledVector(forward, -my / (mag || 1));
      dir.addScaledVector(right, mx / (mag || 1));
      dir.normalize().multiplyScalar(speed);
    }
    // Smooth velocity for less jitter
    vel.current.x = THREE.MathUtils.lerp(vel.current.x, dir.x, Math.min(1, dtc * 12));
    vel.current.z = THREE.MathUtils.lerp(vel.current.z, dir.z, Math.min(1, dtc * 12));

    // Gravity + jump
    vel.current.y -= 22 * dtc;
    if (input.jump && grounded.current) {
      vel.current.y = 8.5;
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

    // Face movement or camera when aiming
    if (aiming) {
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        yaw.current,
        Math.min(1, dtc * 18),
      );
    } else if (mag > 0.05) {
      const targetRot = Math.atan2(dir.x, dir.z);
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        targetRot,
        Math.min(1, dtc * 14),
      );
    }

    // Walk cycle
    const step = running ? 13 : 8;
    walkPhase.current += dtc * step * (mag > 0.05 ? 1 : 0);
    const swing = Math.sin(walkPhase.current) * (running ? 1.0 : 0.65) * mag;
    if (legL.current && legR.current && armL.current && armR.current && body.current) {
      legL.current.rotation.x = swing;
      legR.current.rotation.x = -swing;
      const armSwing = aiming ? 0 : swing * 0.8;
      armL.current.rotation.x = -armSwing;
      armR.current.rotation.x = aiming ? -1.4 : armSwing;
      armL.current.rotation.z = aiming ? 0.15 : 0;
      body.current.position.y = 1.05 + Math.abs(Math.sin(walkPhase.current)) * 0.06 * mag;
    }
    if (head.current) {
      head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, pitch.current * 0.4, 0.2);
    }

    // Chase camera — over-the-shoulder when aiming, wider when free
    const targetDist = aiming ? 2.6 : 5.8;
    const shoulderX = aiming ? 0.7 : 0;
    const camHeight = 2.0 + Math.sin(pitch.current) * 2.4;
    const back = new THREE.Vector3(Math.sin(yaw.current), 0, Math.cos(yaw.current));
    const sideV = new THREE.Vector3(-back.z, 0, back.x);
    const targetOffset = new THREE.Vector3(
      back.x * targetDist + sideV.x * shoulderX,
      camHeight,
      back.z * targetDist + sideV.z * shoulderX,
    );
    camOffset.current.lerp(targetOffset, Math.min(1, dtc * 8));
    camera.position.set(
      p.x + camOffset.current.x,
      p.y + camOffset.current.y,
      p.z + camOffset.current.z,
    );
    camera.lookAt(p.x + sideV.x * shoulderX * 0.6, p.y + 1.5, p.z + sideV.z * shoulderX * 0.6);
  });

  return (
    <group ref={group} position={[0, 0, 0]}>
      <group ref={body}>
        {/* Torso */}
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[0.72, 0.9, 0.42]} />
          <meshStandardMaterial color="#1a1a1f" roughness={0.55} />
        </mesh>
        {/* Chest stripe */}
        <mesh position={[0, 0.6, 0.22]}>
          <boxGeometry args={[0.5, 0.5, 0.02]} />
          <meshStandardMaterial color="#8b1a1a" emissive="#3a0808" emissiveIntensity={0.3} />
        </mesh>
        {/* Belt */}
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[0.74, 0.08, 0.44]} />
          <meshStandardMaterial color="#0a0a0d" />
        </mesh>

        <group ref={head} position={[0, 1.2, 0]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.22, 0.16, 0.22]} />
            <meshStandardMaterial color="#c99879" />
          </mesh>
          <mesh position={[0, 0.27, 0]}>
            <boxGeometry args={[0.44, 0.44, 0.44]} />
            <meshStandardMaterial color="#d9a582" />
          </mesh>
          {/* Sunglasses */}
          <mesh position={[0, 0.32, 0.22]}>
            <boxGeometry args={[0.38, 0.08, 0.02]} />
            <meshStandardMaterial color="#050505" roughness={0.2} metalness={0.6} />
          </mesh>
          {/* Cap */}
          <mesh position={[0, 0.52, -0.02]}>
            <boxGeometry args={[0.46, 0.14, 0.46]} />
            <meshStandardMaterial color="#0d0d10" />
          </mesh>
          <mesh position={[0, 0.46, 0.24]}>
            <boxGeometry args={[0.46, 0.04, 0.14]} />
            <meshStandardMaterial color="#0d0d10" />
          </mesh>
        </group>

        {/* Arms */}
        <group ref={armL} position={[-0.46, 1.0, 0]}>
          <mesh position={[0, -0.4, 0]}>
            <boxGeometry args={[0.2, 0.8, 0.22]} />
            <meshStandardMaterial color="#1a1a1f" />
          </mesh>
          <mesh position={[0, -0.9, 0]}>
            <boxGeometry args={[0.18, 0.18, 0.18]} />
            <meshStandardMaterial color="#d9a582" />
          </mesh>
        </group>
        <group ref={armR} position={[0.46, 1.0, 0]}>
          <mesh position={[0, -0.4, 0]}>
            <boxGeometry args={[0.2, 0.8, 0.22]} />
            <meshStandardMaterial color="#1a1a1f" />
          </mesh>
          <mesh position={[0, -0.9, 0]}>
            <boxGeometry args={[0.18, 0.18, 0.18]} />
            <meshStandardMaterial color="#d9a582" />
          </mesh>
          {/* Weapon parented to right hand */}
          <group position={[0, -0.95, 0.15]}>
            <Weapon />
          </group>
        </group>

        {/* Legs */}
        <group ref={legL} position={[-0.18, 0.1, 0]}>
          <mesh position={[0, -0.4, 0]}>
            <boxGeometry args={[0.26, 0.85, 0.28]} />
            <meshStandardMaterial color="#2a2f3a" />
          </mesh>
          <mesh position={[0, -0.9, 0.05]}>
            <boxGeometry args={[0.28, 0.12, 0.4]} />
            <meshStandardMaterial color="#050505" />
          </mesh>
        </group>
        <group ref={legR} position={[0.18, 0.1, 0]}>
          <mesh position={[0, -0.4, 0]}>
            <boxGeometry args={[0.26, 0.85, 0.28]} />
            <meshStandardMaterial color="#2a2f3a" />
          </mesh>
          <mesh position={[0, -0.9, 0.05]}>
            <boxGeometry args={[0.28, 0.12, 0.4]} />
            <meshStandardMaterial color="#050505" />
          </mesh>
        </group>
      </group>
    </group>
  );
}
