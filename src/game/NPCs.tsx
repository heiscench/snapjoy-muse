import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Character, type CharacterRefs } from "./Character";
import { GANGS, type GangId } from "./gangs";
import { NPCS, damageNPC, spawnNPC, type NPCState } from "./npcState";
import { resolveCollision } from "./worldData";

export function NPCs({ count = 12 }: { count?: number }) {
  useEffect(() => {
    NPCS.length = 0;
    for (let i = 0; i < count; i++) {
      NPCS.push(spawnNPC(i, (i % 4) as GangId));
    }
  }, [count]);

  const [, force] = useState(0);
  useEffect(() => { force(1); }, []);

  if (NPCS.length === 0) return null;
  return (
    <group>
      {NPCS.map((n) => <NPCUnit key={n.id} npc={n} />)}
    </group>
  );
}

function NPCUnit({ npc }: { npc: NPCState }) {
  const refs = useRef<CharacterRefs>(null!);
  const gang = GANGS[npc.gang];
  const baseColor = useMemo(() => new THREE.Color(gang.color), [gang.color]);
  const hitColor = useMemo(() => new THREE.Color("#ff5050"), []);
  const walkPhase = useRef(0);

  useFrame((_, dt) => {
    const dtc = Math.min(dt, 0.05);
    const r = refs.current;
    if (!r || !r.root) return;

    if (npc.dead) {
      npc.respawn -= dtc;
      r.root.visible = false;
      if (npc.respawn <= 0) {
        const s = spawnNPC(npc.id, npc.gang);
        npc.pos.copy(s.pos);
        npc.dir.copy(s.dir);
        npc.hp = 100;
        npc.dead = false;
      }
      return;
    }
    r.root.visible = true;

    // Wander w/ collision
    npc.phase += dtc;
    if (npc.phase > 3) {
      npc.phase = 0;
      npc.dir.set(Math.random() * 2 - 1, 0, Math.random() * 2 - 1).normalize();
    }
    const nx = npc.pos.x + npc.dir.x * npc.speed * dtc;
    const nz = npc.pos.z + npc.dir.z * npc.speed * dtc;
    const resolved = resolveCollision(npc.pos.x, npc.pos.z, nx, nz, 0.5);
    if (resolved.x === npc.pos.x && resolved.z === npc.pos.z) {
      npc.dir.multiplyScalar(-1);
    }
    npc.pos.x = resolved.x;
    npc.pos.z = resolved.z;
    if (npc.pos.length() > 240) npc.dir.multiplyScalar(-1);

    const yaw = Math.atan2(npc.dir.x, npc.dir.z);
    r.root.position.set(npc.pos.x, 0, npc.pos.z);
    r.root.rotation.y = yaw;

    walkPhase.current += dtc * 8 * npc.speed * 0.5;
    const swing = Math.sin(walkPhase.current) * 0.7;
    if (r.legL) r.legL.rotation.x = swing;
    if (r.legR) r.legR.rotation.x = -swing;
    if (r.armL) r.armL.rotation.x = -swing * 0.7;
    if (r.armR) r.armR.rotation.x = swing * 0.7;

    // Hit flash
    if (npc.hitFlash > 0) {
      npc.hitFlash -= dtc;
      if (r.torsoMat) r.torsoMat.color.copy(hitColor);
    } else if (r.torsoMat) {
      r.torsoMat.color.copy(baseColor);
    }
  });

  return <Character ref={refs} color={gang.color} accent={gang.accent} />;
}
