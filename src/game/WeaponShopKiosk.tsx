import { GANGS } from "./gangs";
import { WEAPON_SHOPS } from "./worldData";

function Kiosk({ gangId }: { gangId: 0 | 1 | 2 | 3 }) {
  const gang = GANGS[gangId];
  const pos = WEAPON_SHOPS[gangId];
  return (
    <group position={[pos.x, 0, pos.z]}>
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[3, 2.2, 2.2]} />
        <meshStandardMaterial color="#181818" roughness={0.8} />
      </mesh>
      <mesh position={[0, 2.3, 0]}>
        <boxGeometry args={[3.6, 0.2, 2.6]} />
        <meshStandardMaterial color={gang.color} />
      </mesh>
      <mesh position={[0, 1.3, 1.12]}>
        <boxGeometry args={[2.2, 1, 0.05]} />
        <meshBasicMaterial color="#ffd66a" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 2.6, 0]}>
        <boxGeometry args={[1.6, 0.4, 0.05]} />
        <meshBasicMaterial color={gang.accent} />
      </mesh>
    </group>
  );
}

export function WeaponShopKiosks() {
  const ids = [0, 1, 2, 3] as const;
  return <>{ids.map((g) => <Kiosk key={g} gangId={g} />)}</>;
}