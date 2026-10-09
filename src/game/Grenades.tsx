import { useFrame } from "@react-three/fiber";
import { useState } from "react";
import * as THREE from "three";
import { GRENADES } from "./grenadeState";
import { resolveCollision } from "./worldData";
import { NPCS, damageNPC } from "./npcState";
import { GUARDS, damageGuard } from "./guardState";
import { remotePlayers } from "./remotePlayerState";
import { broadcastHit } from "./presence";
import { earnMoney, KILL_BOUNTY } from "./playerState";
import { onPlayerKill } from "./territoryState";
import { PLAYER_GANG } from "./gangs";
import { RELIC_PALETTE } from "./RelicVisuals";

const GRAVITY = -22;

function explode(g: (typeof GRENADES)[number]) {
  for (const n of NPCS) {
    if (n.dead) continue;
    const d = g.pos.distanceTo(new THREE.Vector3(n.pos.x, 1, n.pos.z));
    if (d < g.splash) {
      damageNPC(n, g.damage * (1 - d / g.splash));
      if (n.dead) { earnMoney(KILL_BOUNTY); onPlayerKill(); }
    }
  }
  for (const gd of GUARDS) {
    if (gd.dead) continue;
    const d = g.pos.distanceTo(new THREE.Vector3(gd.pos.x, 1, gd.pos.z));
    if (d < g.splash) damageGuard(gd, g.damage * (1 - d / g.splash));
  }
  for (const rp of remotePlayers.values()) {
    if (rp.health <= 0 || rp.inVehicle || rp.gang === PLAYER_GANG) continue;
    const d = g.pos.distanceTo(new THREE.Vector3(rp.x, 1, rp.z));
    if (d < g.splash) broadcastHit(rp.userId, g.damage * (1 - d / g.splash));
  }
}

export function Grenades() {
  const [, force] = useState(0);

  useFrame((_, dt) => {
    let changed = false;
    for (let i = GRENADES.length - 1; i >= 0; i--) {
      const g = GRENADES[i];
      if (g.exploded) {
        g.explodeT -= dt;
        if (g.explodeT <= 0) { GRENADES.splice(i, 1); changed = true; }
        continue;
      }
      g.timer -= dt;
      g.vel.y += GRAVITY * dt;
      const nx = g.pos.x + g.vel.x * dt;
      const nz = g.pos.z + g.vel.z * dt;
      const resolved = resolveCollision(g.pos.x, g.pos.z, nx, nz, 0.3);
      if (resolved.x === g.pos.x && resolved.z === g.pos.z) {
        g.vel.x *= -0.4; g.vel.z *= -0.4;
      }
      g.pos.x = resolved.x;
      g.pos.z = resolved.z;
      g.pos.y += g.vel.y * dt;
      if (g.pos.y <= 0.3) {
        g.pos.y = 0.3;
        g.vel.y *= -0.35;
        g.vel.x *= 0.6; g.vel.z *= 0.6;
      }
      if (g.timer <= 0) {
        g.exploded = true;
        g.explodeT = 0.35;
        explode(g);
      }
      changed = true;
    }
    if (changed) force((n) => n + 1);
  });

  return (
    <group>
      {GRENADES.map((g) =>
        g.exploded ? (
          <group key={g.id} position={g.pos}>
            <mesh><sphereGeometry args={[g.splash * (1 - g.explodeT / 0.35), 12, 12]} /><meshBasicMaterial color={RELIC_PALETTE.violet} transparent opacity={g.explodeT / 0.35 * 0.6} toneMapped={false} /></mesh>
            <mesh><sphereGeometry args={[g.splash * (1 - g.explodeT / 0.35) * 0.45, 8, 8]} /><meshBasicMaterial color={RELIC_PALETTE.pale} transparent opacity={g.explodeT / 0.35 * 0.8} toneMapped={false} /></mesh>
          </group>
        ) : (
          <mesh key={g.id} position={g.pos}>
            <sphereGeometry args={[0.14, 8, 8]} />
            <meshStandardMaterial color={RELIC_PALETTE.ink} emissive={RELIC_PALETTE.violet} emissiveIntensity={0.3} roughness={0.6} />
          </mesh>
        ),
      )}
    </group>
  );
}