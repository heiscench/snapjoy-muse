import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { playerState } from "../playerState";
import { themeOf } from "../city/palette";
import {
  bitCount, fractureLayout, fractureLive, fractureNow, fractureSchedule, fractureState,
  glyphAvailable, GLYPH_COUNT, HEART_R, startFractureSync, TOUCH_R, touchGlyph,
} from "./fractureState";

const GLYPHS = Array.from({ length: GLYPH_COUNT }, (_, i) => i);
const GRAY = new THREE.Color("#5a5568");
const GOLD = new THREE.Color("#fff1b8");
const tmp = new THREE.Color();

export function Fracture() {
  const chamber = useRef<THREE.Group>(null!);
  const chamberRing = useRef<THREE.Mesh>(null!);
  const beam = useRef<THREE.Mesh>(null!);
  const glyphs = useRef<(THREE.Group | null)[]>([]);

  const crystalMats = useMemo(() => GLYPHS.map(() => new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false })), []);
  const beamMats = useMemo(
    () => GLYPHS.map(() => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false })),
    [],
  );
  const stoneMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1c1730", emissive: "#6a4cc8", emissiveIntensity: 0.5, roughness: 1 }),
    [],
  );
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#fff1b8", toneMapped: false }), []);
  const bigBeamMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#fff1b8", transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false }),
    [],
  );

  useEffect(() => startFractureSync(), []);

  useFrame(({ clock }) => {
    const live = fractureLive();
    if (chamber.current) chamber.current.visible = live;
    if (beam.current) beam.current.visible = live;
    glyphs.current.forEach((g) => { if (g) g.visible = live; });
    if (!live) return;

    const sc = fractureSchedule(fractureNow());
    const layout = fractureLayout(sc.slot, sc.district);
    const theme = themeOf(sc.district);
    const t = clock.elapsedTime;
    const mask = fractureState.mask;
    const lit = bitCount(mask);
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);

    chamber.current.position.set(layout.chamber.x, 0, layout.chamber.z);
    chamberRing.current.rotation.y = t * 0.6;
    chamberRing.current.scale.setScalar(1 + lit * 0.12);
    beam.current.position.set(layout.chamber.x, 150, layout.chamber.z);
    bigBeamMat.opacity = 0.25 + lit * 0.1;
    ringMat.color.set(theme.glow);

    const px = playerState.pos.x;
    const pz = playerState.pos.z;

    for (let i = 0; i < GLYPH_COUNT; i++) {
      const g = glyphs.current[i];
      if (!g) continue;
      const p = layout.glyphs[i];
      const heart = i === 4;
      g.position.set(p.x, heart ? 19 : 0, p.z);
      g.rotation.y = t * (heart ? 0.8 : 1.2) + i;

      const isLit = (mask & (1 << i)) !== 0;
      const avail = glyphAvailable(i);
      const c = crystalMats[i].color;
      if (isLit) c.set(theme.glow);
      else if (avail) c.copy(tmp.set("#ffffff").lerp(GOLD, pulse));
      else c.copy(GRAY);
      beamMats[i].color.copy(c);
      beamMats[i].opacity = isLit ? 0.22 : avail ? 0.3 + pulse * 0.25 : 0.1;
      g.scale.setScalar((heart ? 2 : 1) * (avail && !isLit ? 1 + pulse * 0.12 : 1));

      if (avail && Math.hypot(p.x - px, p.z - pz) < (heart ? HEART_R : TOUCH_R)) touchGlyph(i);
    }
  });

  return (
    <group>
      <group ref={chamber} visible={false}>
        <mesh position={[0, 8, 0]} material={stoneMat}><cylinderGeometry args={[0.9, 2.4, 16, 4]} /></mesh>
        <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} material={ringMat}><ringGeometry args={[7, 8, 48]} /></mesh>
        <mesh ref={chamberRing} position={[0, 12, 0]} rotation={[Math.PI / 2, 0, 0]} material={ringMat}><torusGeometry args={[4, 0.18, 6, 32]} /></mesh>
      </group>
      <mesh ref={beam} visible={false} material={bigBeamMat}>
        <cylinderGeometry args={[3.5, 5, 300, 10, 1, true]} />
      </mesh>

      {GLYPHS.map((i) => (
        <group key={i} ref={(el) => { glyphs.current[i] = el; }} visible={false}>
          <mesh position={[0, 2.6, 0]} scale={[1, 2.2, 1]} material={crystalMats[i]}><octahedronGeometry args={[0.8, 0]} /></mesh>
          {i !== 4 && (
            <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} material={crystalMats[i]}><ringGeometry args={[2.6, 3.3, 28]} /></mesh>
          )}
          <mesh position={[0, 22, 0]} material={beamMats[i]}><cylinderGeometry args={[0.35, 0.35, 44, 6, 1, true]} /></mesh>
        </group>
      ))}
    </group>
  );
}