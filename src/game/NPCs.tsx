import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Character, type CharacterRefs } from "./Character";
import { GANGS, PLAYER_GANG, type GangId } from "./gangs";
import { NPCS, npcRoster, spawnNPC, respawnPosition, type NPCState } from "./npcState";
import { resolveCollision, districtAt } from "./worldData";
import { playerState, damagePlayer } from "./playerState";
import { territoryState } from "./territoryState";
import { spawnTracer } from "./tracerState";
import { isFollowing, FOLLOW_RADIUS, FOLLOW_MAX_SPEED } from "./squadState";
import { pilotState, damageHeli, damageCar } from "./vehicleState";
import { carPilot } from "./carState";

const DETECT_RANGE = 22;
const NPC_FIRE_RATE = 0.9;
const NPC_DAMAGE = 5;
const NPC_MOVE_COMBAT = 3.2;
const NPC_FIRE_RANGE = 40;
const NPC_HIT_RANGE = 36;
const ROSTER_POLL_MS = 300;

export function NPCs({ count = 12 }: { count?: number }) {
  useEffect(() => {
    for (let i = NPCS.length - 1; i >= 0; i--) {
      if (NPCS[i].kind === "gang") NPCS.splice(i, 1);
    }
    for (let i = 0; i < count; i++) {
      NPCS.push(spawnNPC(i, (i % 4) as GangId));
    }
    npcRoster.version++;
  }, [count]);

  const [version, setVersion] = useState(npcRoster.version);
  useEffect(() => {
    const id = setInterval(() => {
      if (npcRoster.version !== version) setVersion(npcRoster.version);
    }, ROSTER_POLL_MS);
    return () => clearInterval(id);
  }, [version]);

  if (NPCS.length === 0) return null;
  return (
    <group>
      {NPCS.map((n) => <NPCUnit key={`${n.id}-${n.kind}`} npc={n} />)}
    </group>
  );
}

const _screenV = new THREE.Vector3();

function NPCUnit({ npc }: { npc: NPCState }) {
  const refs = useRef<CharacterRefs>(null!);
  const gang = GANGS[npc.gang];
  const baseColor = useMemo(() => new THREE.Color(gang.color), [gang.color]);
  const hitColor = useMemo(() => new THREE.Color("#ff5050"), []);
  const walkPhase = useRef(0);
  const marker = useRef<THREE.Mesh>(null!);
  const { camera, size } = useThree();

  useFrame((_, dt) => {
    const dtc = Math.min(dt, 0.05);
    const r = refs.current;
    if (!r || !r.root) return;

    if (npc.dead) {
      npc.respawn -= dtc;
      r.root.visible = false;
      npc.screenVisible = false;
      if (npc.respawn <= 0) {
        npc.pos.copy(respawnPosition(npc));
        npc.dir.set(Math.random() * 2 - 1, 0, Math.random() * 2 - 1).normalize();
        npc.hp = 100;
        npc.dead = false;
        npc.mode = "patrol";
      }
      return;
    }

    // Boarded followers are "inside" a vehicle the player entered — hidden
    // and paused until the player exits and they're placed back in the world.
    if (npc.boarded) {
      r.root.visible = false;
      npc.screenVisible = false;
      return;
    }

    r.root.visible = true;

    const pp = playerState.pos;
    const distToPlayer = Math.hypot(npc.pos.x - pp.x, npc.pos.z - pp.z);
    const isEnemyOfPlayer = npc.gang !== PLAYER_GANG;
    const playerInVehicle = pilotState.piloting || carPilot.driving;

    let wantsCombat = false;
    const following = isFollowing(npc.id) && npc.gang === PLAYER_GANG;
    if (isEnemyOfPlayer) {
      const npcDistrict = districtAt(npc.pos.x, npc.pos.z);
      const playerDistrict = districtAt(pp.x, pp.z);
      const ownsThis = territoryState.owners[npcDistrict] === npc.gang;
      if (ownsThis && playerDistrict === npcDistrict) wantsCombat = true;
      if (npc.kind === "defender" && npc.district === playerDistrict) wantsCombat = true;
      if (distToPlayer < DETECT_RANGE) wantsCombat = true;
    }
    if (following && playerState.health > 0) {
      const anyThreatNearPlayer = NPCS.some(
        (o) => !o.dead && o.gang !== PLAYER_GANG && Math.hypot(o.pos.x - pp.x, o.pos.z - pp.z) < DETECT_RANGE,
      );
      if (anyThreatNearPlayer) wantsCombat = true;
    }

    if (wantsCombat) npc.mode = "combat";
    else if (npc.mode === "combat" && distToPlayer > DETECT_RANGE * 1.5) npc.mode = "patrol";

    if (npc.mode === "combat" && isEnemyOfPlayer) {
      const dx = pp.x - npc.pos.x, dz = pp.z - npc.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const nx = npc.pos.x + (dx / d) * NPC_MOVE_COMBAT * dtc;
      const nz = npc.pos.z + (dz / d) * NPC_MOVE_COMBAT * dtc;
      const resolved = resolveCollision(npc.pos.x, npc.pos.z, nx, nz, 0.5);
      npc.pos.x = resolved.x; npc.pos.z = resolved.z;
      npc.dir.set(dx / d, 0, dz / d);

      npc.fireCd = Math.max(0, npc.fireCd - dtc);
      if (distToPlayer < NPC_FIRE_RANGE && npc.fireCd === 0) {
        npc.fireCd = NPC_FIRE_RATE;
        const from = new THREE.Vector3(npc.pos.x, 1.4, npc.pos.z);
        const to = new THREE.Vector3(pp.x, 1.4, pp.z).sub(from).normalize();
        spawnTracer(from, to);
        if (distToPlayer < NPC_HIT_RANGE) {
          if (playerInVehicle) {
            if (pilotState.piloting) damageHeli(PLAYER_GANG, NPC_DAMAGE, true);
            else if (carPilot.driving) damageCar(carPilot.drivingIndex, NPC_DAMAGE);
          } else {
            damagePlayer(NPC_DAMAGE);
          }
        }
      }
    } else if (following) {
      const slot = npc.id % 6;
      const angle = (slot / 6) * Math.PI * 2;
      const targetX = pp.x + Math.cos(angle) * 3;
      const targetZ = pp.z + Math.sin(angle) * 3;
      const dx = targetX - npc.pos.x, dz = targetZ - npc.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > FOLLOW_RADIUS) {
        const s = Math.min(FOLLOW_MAX_SPEED, d);
        const nx = npc.pos.x + (dx / d) * s * dtc;
        const nz = npc.pos.z + (dz / d) * s * dtc;
        const resolved = resolveCollision(npc.pos.x, npc.pos.z, nx, nz, 0.5);
        npc.pos.x = resolved.x; npc.pos.z = resolved.z;
        npc.dir.set(dx / d, 0, dz / d);
      }
    } else {
      npc.phase += dtc;
      if (npc.phase > 3) {
        npc.phase = 0;
        npc.dir.set(Math.random() * 2 - 1, 0, Math.random() * 2 - 1).normalize();
      }
      const nx = npc.pos.x + npc.dir.x * npc.speed * dtc;
      const nz = npc.pos.z + npc.dir.z * npc.speed * dtc;
      const resolved = resolveCollision(npc.pos.x, npc.pos.z, nx, nz, 0.5);
      if (resolved.x === npc.pos.x && resolved.z === npc.pos.z) npc.dir.multiplyScalar(-1);
      npc.pos.x = resolved.x; npc.pos.z = resolved.z;

      const distHome = Math.hypot(npc.pos.x - npc.home.x, npc.pos.z - npc.home.z);
      if (distHome > npc.wanderRadius) {
        const towardHome = new THREE.Vector3(npc.home.x - npc.pos.x, 0, npc.home.z - npc.pos.z).normalize();
        npc.dir.copy(towardHome);
      }
    }

    const yaw = Math.atan2(npc.dir.x, npc.dir.z);
    r.root.position.set(npc.pos.x, 0, npc.pos.z);
    r.root.rotation.y = yaw;

    walkPhase.current += dtc * 8 * npc.speed * 0.5;
    const swing = Math.sin(walkPhase.current) * 0.7;
    if (r.legL) r.legL.rotation.x = swing;
    if (r.legR) r.legR.rotation.x = -swing;
    if (r.armL) r.armL.rotation.x = -swing * 0.7;
    if (r.armR) r.armR.rotation.x = swing * 0.7;

    if (npc.hitFlash > 0) {
      npc.hitFlash -= dtc;
      if (r.torsoMat) r.torsoMat.color.copy(hitColor);
    } else if (r.torsoMat) {
      r.torsoMat.color.copy(baseColor);
    }

    const isAlly = npc.gang === PLAYER_GANG;
    if (marker.current) {
      marker.current.visible = isAlly;
      marker.current.position.set(npc.pos.x, 2.4, npc.pos.z);
      if (isAlly) marker.current.rotation.y += dtc * 3;
    }

    if (isAlly) {
      _screenV.set(npc.pos.x, 1.8, npc.pos.z).project(camera);
      const inFront = _screenV.z < 1 && _screenV.z > -1;
      npc.screenX = (_screenV.x * 0.5 + 0.5) * size.width;
      npc.screenY = (-_screenV.y * 0.5 + 0.5) * size.height;
      npc.screenVisible = inFront;
    } else {
      npc.screenVisible = false;
    }
  });

  return (
    <group>
      <Character ref={refs} color={gang.color} accent={gang.accent} />
      <mesh ref={marker} position={[0, 2.4, 0]} visible={false}>
        <coneGeometry args={[0.18, 0.35, 4]} />
        <meshBasicMaterial color={isFollowing(npc.id) ? "#5cff8a" : GANGS[PLAYER_GANG].accent} />
      </mesh>
    </group>
  );
}