import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { damagePlayer, playerState } from "../playerState";
import { THEMES, hash01 } from "../city/palette";
import {
  monsterPose, monsterState, PULSE_DAMAGE, PULSE_R, PULSE_S, SCALE, schedule, serverNow, startMonsterSync,
} from "./monsterState";

const INK = "#120e1a";
const TENDRILS = 6;

/** The Ashen Wraith: a colossal hooded shadow with one glowing ink eye. */
export function Monster() {
  const root = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const tendrils = useRef<(THREE.Group | null)[]>([]);
  const ring = useRef<THREE.Mesh>(null!);
  const beam = useRef<THREE.Mesh>(null!);
  const lastCycle = useRef(-1);
  const lastSlot = useRef(-1);

  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: INK, emissive: "#3a2470", emissiveIntensity: 0.25, roughness: 1 }),
    [],
  );
  const runeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#cfb878", toneMapped: false }), []);
  const ringMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#ff4d5e", transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    [],
  );
  const beamMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false, blending: THREE.AdditiveBlending }),
    [],
  );

  useEffect(() => startMonsterSync(), []);

  useFrame(({ clock }) => {
    const g = root.current;
    if (!g) return;
    const now = serverNow();
    const sc = schedule(now);
    const synced = monsterState.synced && monsterState.slot === sc.slot;
    const dying = monsterState.defeated ? (performance.now() - monsterState.defeatedSeenAt) / 1000 : 0;
    const show = synced && sc.active && (!monsterState.defeated || dying < 3.2);
    g.visible = show;
    ring.current.visible = show && !monsterState.defeated;
    beam.current.visible = show;
    if (!show) return;

    const pose = monsterPose(now);
    g.position.set(pose.x, pose.y, pose.z);
    g.rotation.y = pose.yaw;
    g.scale.setScalar(SCALE * (monsterState.defeated ? Math.max(0.001, 1 - dying / 3) : 1));

    const t = clock.elapsedTime;
    armL.current.rotation.z = 0.35 + Math.sin(t * 1.4) * 0.25;
    armR.current.rotation.z = -0.35 - Math.sin(t * 1.4 + 1) * 0.25;
    tendrils.current.forEach((td, i) => {
      if (!td) return;
      td.rotation.x = Math.sin(t * 1.2 + i) * 0.25;
      td.rotation.z = Math.cos(t * 1.1 + i * 1.7) * 0.25;
    });

    const theme = THEMES[sc.kingdom];
    runeMat.color.set(theme.glow);
    beamMat.color.set(theme.glow);
    beam.current.position.set(pose.x, 80, pose.z);

    // A red shockwave grows for PULSE_S seconds, then hits everyone still inside it.
    const tt = (now - sc.startMs) / 1000;
    const phase = (tt % PULSE_S) / PULSE_S;
    ring.current.position.set(pose.x, 0.3, pose.z);
    ring.current.scale.setScalar(Math.max(0.1, phase * PULSE_R));
    ringMat.opacity = 0.2 + phase * 0.5;

    if (lastSlot.current !== sc.slot) {
      lastSlot.current = sc.slot;
      lastCycle.current = -1;
    }
    const cycle = Math.floor(tt / PULSE_S);
    if (lastCycle.current === -1) {
      lastCycle.current = cycle;
    } else if (cycle !== lastCycle.current) {
      lastCycle.current = cycle;
      if (!monsterState.defeated) {
        const d = Math.hypot(playerState.pos.x - pose.x, playerState.pos.z - pose.z);
        if (d < PULSE_R) damagePlayer(PULSE_DAMAGE);
      }
    }
  });

  return (
    <group>
      <group ref={root} visible={false}>
        {/* body and flared cloak */}
        <mesh position={[0, 6, 0]} scale={[6, 9, 5]} material={bodyMat}><octahedronGeometry args={[1, 0]} /></mesh>
        <mesh position={[0, -0.5, 0]} material={bodyMat}><coneGeometry args={[8, 14, 7]} /></mesh>
        {/* glowing rune lines */}
        <mesh position={[0, 6, 4.3]} scale={[0.3, 7, 0.2]} material={runeMat}><boxGeometry args={[1, 1, 1]} /></mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 2.2, 5, 3.1]} rotation={[0, 0, s * 0.25]} scale={[0.25, 6, 0.2]} material={runeMat}>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        ))}
        {/* hood */}
        <mesh position={[0, 15, 1.5]} scale={[3.2, 4, 3]} material={bodyMat}><octahedronGeometry args={[1, 0]} /></mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 2, 18.6, 1]} rotation={[0, 0, -s * 0.4]} material={bodyMat}>
            <coneGeometry args={[0.7, 4.5, 5]} />
          </mesh>
        ))}
        {/* the ink eye: one glowing, one hollow socket that drips */}
        <mesh position={[-1.1, 15.6, 4.5]}><sphereGeometry args={[0.75, 10, 10]} /><meshBasicMaterial color="#d6b8ff" toneMapped={false} /></mesh>
        <mesh position={[1.1, 15.6, 4.5]}><sphereGeometry args={[0.85, 10, 10]} /><meshBasicMaterial color="#05040a" /></mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[1.1 + (i - 1) * 0.35, 13.6 - i * 0.4, 4.6]}>
            <boxGeometry args={[0.22, 3 - i * 0.5, 0.18]} />
            <meshBasicMaterial color="#4a2d78" />
          </mesh>
        ))}
        {/* arms with claws */}
        <group ref={armL} position={[-6.2, 11, 0]}>
          <mesh position={[0, -6, 0]} scale={[1.2, 12, 1.2]} material={bodyMat}><boxGeometry args={[1, 1, 1]} /></mesh>
          <mesh position={[0, -6, 0.65]} scale={[0.2, 11, 0.12]} material={runeMat}><boxGeometry args={[1, 1, 1]} /></mesh>
          {[-0.6, 0, 0.6].map((x) => (
            <mesh key={x} position={[x, -13.5, 0]} rotation={[Math.PI, 0, 0]} material={bodyMat}><coneGeometry args={[0.45, 3.4, 4]} /></mesh>
          ))}
        </group>
        <group ref={armR} position={[6.2, 11, 0]}>
          <mesh position={[0, -6, 0]} scale={[1.2, 12, 1.2]} material={bodyMat}><boxGeometry args={[1, 1, 1]} /></mesh>
          <mesh position={[0, -6, 0.65]} scale={[0.2, 11, 0.12]} material={runeMat}><boxGeometry args={[1, 1, 1]} /></mesh>
          {[-0.6, 0, 0.6].map((x) => (
            <mesh key={x} position={[x, -13.5, 0]} rotation={[Math.PI, 0, 0]} material={bodyMat}><coneGeometry args={[0.45, 3.4, 4]} /></mesh>
          ))}
        </group>
        {/* tendrils hanging under the cloak */}
        {Array.from({ length: TENDRILS }, (_, i) => {
          const a = (i / TENDRILS) * Math.PI * 2;
          return (
            <group key={i} ref={(el) => { tendrils.current[i] = el; }} position={[Math.cos(a) * 5, -7, Math.sin(a) * 5]}>
              <mesh position={[0, -4 - hash01(i, 1, 301) * 2, 0]} rotation={[Math.PI, 0, 0]} material={bodyMat}>
                <coneGeometry args={[0.5, 8 + hash01(i, 2, 302) * 4, 5]} />
              </mesh>
            </group>
          );
        })}
      </group>

      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false} material={ringMat}>
        <ringGeometry args={[0.9, 1, 64]} />
      </mesh>
      <mesh ref={beam} visible={false} material={beamMat}>
        <cylinderGeometry args={[1.4, 2.4, 180, 10, 1, true]} />
      </mesh>
    </group>
  );
}