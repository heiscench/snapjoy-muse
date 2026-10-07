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

/** Every humanoid in the game renders at this scale — player, NPCs,
 * guards, civilians and remote players. Keep it in one place. */
export const CHARACTER_SCALE = 1.15;

/** FORGOTTEN palette shared by every humanoid. */
const INK = "#15131c";
const INK_SOFT = "#1e1b28";
const EYE_GLOW = "#b98cff";
const SOCKET = "#07060a";
const DRIP = "#4a2d78";

type Props = {
  color: string;
  accent: string;
  skin?: string;
  showWeaponSlot?: React.ReactNode;
  scale?: number;
};

export const Character = forwardRef<CharacterRefs, Props>(function Character(
  { color, accent, skin = "#c4a487", showWeaponSlot, scale = CHARACTER_SCALE },
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
    <group ref={root} scale={scale}>
      <group ref={body}>
        {/* Torso — faction color hoodie */}
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[0.72, 0.9, 0.42]} />
          <meshStandardMaterial ref={torsoMat} color={color} roughness={0.85} />
        </mesh>
        {/* Crown glyph on the chest */}
        <mesh position={[0, 0.66, 0.22]}>
          <boxGeometry args={[0.26, 0.05, 0.02]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.6} />
        </mesh>
        {[-0.1, 0, 0.1].map((x) => (
          <mesh key={x} position={[x, 0.73, 0.22]}>
            <boxGeometry args={[0.04, 0.12 + (x === 0 ? 0.05 : 0), 0.02]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.6} />
          </mesh>
        ))}
        {/* Dark rune stripe down the front */}
        <mesh position={[0, 0.4, 0.22]}>
          <boxGeometry args={[0.05, 0.4, 0.02]} />
          <meshStandardMaterial color={INK} />
        </mesh>
        {/* Belt */}
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[0.74, 0.08, 0.44]} />
          <meshStandardMaterial color={SOCKET} />
        </mesh>

        <group ref={head} position={[0, 1.2, 0]}>
          {/* Neck */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.22, 0.16, 0.22]} />
            <meshStandardMaterial color={skin} />
          </mesh>
          {/* Face */}
          <mesh position={[0, 0.27, 0]}>
            <boxGeometry args={[0.44, 0.44, 0.44]} />
            <meshStandardMaterial color={skin} />
          </mesh>
          {/* Ink eye — glowing side */}
          <mesh position={[-0.1, 0.32, 0.222]}>
            <boxGeometry args={[0.1, 0.06, 0.012]} />
            <meshBasicMaterial color={EYE_GLOW} toneMapped={false} />
          </mesh>
          {/* Ink eye — hollow socket with drip */}
          <mesh position={[0.1, 0.32, 0.222]}>
            <boxGeometry args={[0.1, 0.08, 0.012]} />
            <meshBasicMaterial color={SOCKET} />
          </mesh>
          <mesh position={[0.1, 0.24, 0.222]}>
            <boxGeometry args={[0.05, 0.12, 0.012]} />
            <meshBasicMaterial color={DRIP} />
          </mesh>
          {/* Beanie — dark ink with faction band */}
          <mesh position={[0, 0.52, -0.02]}>
            <boxGeometry args={[0.48, 0.16, 0.48]} />
            <meshStandardMaterial color={INK_SOFT} roughness={1} />
          </mesh>
          <mesh position={[0, 0.45, -0.01]}>
            <boxGeometry args={[0.5, 0.05, 0.5]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
        </group>

        {/* Arms — faction color sleeves */}
        <group ref={armL} position={[-0.46, 1.0, 0]}>
          <mesh position={[0, -0.4, 0]}>
            <boxGeometry args={[0.2, 0.8, 0.22]} />
            <meshStandardMaterial color={color} roughness={0.85} />
          </mesh>
          <mesh position={[0, -0.9, 0]}>
            <boxGeometry args={[0.18, 0.18, 0.18]} />
            <meshStandardMaterial color={skin} />
          </mesh>
        </group>
        <group ref={armR} position={[0.46, 1.0, 0]}>
          <mesh position={[0, -0.4, 0]}>
            <boxGeometry args={[0.2, 0.8, 0.22]} />
            <meshStandardMaterial color={color} roughness={0.85} />
          </mesh>
          <mesh position={[0, -0.9, 0]}>
            <boxGeometry args={[0.18, 0.18, 0.18]} />
            <meshStandardMaterial color={skin} />
          </mesh>
          {showWeaponSlot && (
            <group position={[0, -0.95, 0.15]} rotation={[1.4, 0, 0]}>
              {showWeaponSlot}
            </group>
          )}
        </group>

        {/* Legs */}
        <group ref={legL} position={[-0.18, 0.1, 0]}>
          <mesh position={[0, -0.4, 0]}>
            <boxGeometry args={[0.26, 0.85, 0.28]} />
            <meshStandardMaterial color={INK} />
          </mesh>
          <mesh position={[0, -0.9, 0.05]}>
            <boxGeometry args={[0.28, 0.12, 0.4]} />
            <meshStandardMaterial color={SOCKET} />
          </mesh>
        </group>
        <group ref={legR} position={[0.18, 0.1, 0]}>
          <mesh position={[0, -0.4, 0]}>
            <boxGeometry args={[0.26, 0.85, 0.28]} />
            <meshStandardMaterial color={INK} />
          </mesh>
          <mesh position={[0, -0.9, 0.05]}>
            <boxGeometry args={[0.28, 0.12, 0.4]} />
            <meshStandardMaterial color={SOCKET} />
          </mesh>
        </group>
      </group>
    </group>
  );
});