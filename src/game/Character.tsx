import { forwardRef, useImperativeHandle, useRef } from "react";
import * as THREE from "three";

export type CharacterRefs = {
  root: THREE.Group | null;
  body: THREE.Group | null;
  head: THREE.Group | null;
  armL: THREE.Group | null;
  armR: THREE.Group | null;
  legL: THREE.Group | null;
  legR: THREE.Group | null;
  torsoMat: THREE.MeshStandardMaterial | null;
};

type Props = {
  color: string;
  accent: string;
  skin?: string;
  showWeaponSlot?: React.ReactNode;
};

export const Character = forwardRef<CharacterRefs, Props>(function Character(
  { color, accent, skin = "#c99879", showWeaponSlot },
  ref,
) {
  const root = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const legL = useRef<THREE.Group>(null!);
  const legR = useRef<THREE.Group>(null!);
  const torsoMat = useRef<THREE.MeshStandardMaterial>(null!);

  useImperativeHandle(ref, () => ({
    get root() { return root.current; },
    get body() { return body.current; },
    get head() { return head.current; },
    get armL() { return armL.current; },
    get armR() { return armR.current; },
    get legL() { return legL.current; },
    get legR() { return legR.current; },
    get torsoMat() { return torsoMat.current; },
  }));

  return (
    <group ref={root}>
      <group ref={body}>
        {/* Torso — gang color */}
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[0.72, 0.9, 0.42]} />
          <meshStandardMaterial ref={torsoMat} color={color} roughness={0.6} />
        </mesh>
        {/* Chest stripe / accent */}
        <mesh position={[0, 0.6, 0.22]}>
          <boxGeometry args={[0.5, 0.5, 0.02]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.25} />
        </mesh>
        {/* Belt */}
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[0.74, 0.08, 0.44]} />
          <meshStandardMaterial color="#0a0a0d" />
        </mesh>

        <group ref={head} position={[0, 1.2, 0]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.22, 0.16, 0.22]} />
            <meshStandardMaterial color={skin} />
          </mesh>
          <mesh position={[0, 0.27, 0]}>
            <boxGeometry args={[0.44, 0.44, 0.44]} />
            <meshStandardMaterial color={skin} />
          </mesh>
          {/* Sunglasses */}
          <mesh position={[0, 0.32, 0.22]}>
            <boxGeometry args={[0.38, 0.08, 0.02]} />
            <meshStandardMaterial color="#050505" roughness={0.2} metalness={0.6} />
          </mesh>
          {/* Cap — gang color */}
          <mesh position={[0, 0.52, -0.02]}>
            <boxGeometry args={[0.46, 0.14, 0.46]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, 0.46, 0.24]}>
            <boxGeometry args={[0.46, 0.04, 0.14]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>

        {/* Arms — gang color sleeves */}
        <group ref={armL} position={[-0.46, 1.0, 0]}>
          <mesh position={[0, -0.4, 0]}>
            <boxGeometry args={[0.2, 0.8, 0.22]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, -0.9, 0]}>
            <boxGeometry args={[0.18, 0.18, 0.18]} />
            <meshStandardMaterial color={skin} />
          </mesh>
        </group>
        <group ref={armR} position={[0.46, 1.0, 0]}>
          <mesh position={[0, -0.4, 0]}>
            <boxGeometry args={[0.2, 0.8, 0.22]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, -0.9, 0]}>
            <boxGeometry args={[0.18, 0.18, 0.18]} />
            <meshStandardMaterial color={skin} />
          </mesh>
          {showWeaponSlot && (
            // rotation.x = +1.4 exactly cancels the arm's -1.4 aim-pose rotation
            // (same axis, so they compose to zero), so the gun's own forward
            // axis stays pointing where the character faces while aiming,
            // instead of rotating up with the arm bone.
            <group position={[0, -0.95, 0.15]} rotation={[1.4, 0, 0]}>
              {showWeaponSlot}
            </group>
          )}
        </group>

        {/* Legs */}
        <group ref={legL} position={[-0.18, 0.1, 0]}>
          <mesh position={[0, -0.4, 0]}>
            <boxGeometry args={[0.26, 0.85, 0.28]} />
            <meshStandardMaterial color="#1a1a20" />
          </mesh>
          <mesh position={[0, -0.9, 0.05]}>
            <boxGeometry args={[0.28, 0.12, 0.4]} />
            <meshStandardMaterial color="#050505" />
          </mesh>
        </group>
        <group ref={legR} position={[0.18, 0.1, 0]}>
          <mesh position={[0, -0.4, 0]}>
            <boxGeometry args={[0.26, 0.85, 0.28]} />
            <meshStandardMaterial color="#1a1a20" />
          </mesh>
          <mesh position={[0, -0.9, 0.05]}>
            <boxGeometry args={[0.28, 0.12, 0.4]} />
            <meshStandardMaterial color="#050505" />
          </mesh>
        </group>
      </group>
    </group>
  );
});