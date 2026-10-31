// Renders the unarmed civilian population. Same humanoid rig as every other
// character in the game, just without a weapon or gang colours.
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Character, type CharacterRefs } from "./Character";
import { characterVariant } from "./characterAppearance";
import { lodLevel, PROXY_GEO, PROXY_Y } from "./characterLod";
import { solidMaterial } from "./city/textures";
import {
  CIVILIANS,
  CIVILIAN_TURN_SECS,
  CIVILIAN_WANDER_RADIUS,
  initCivilians,
  type CivilianState,
} from "./civilianState";
import { resolveCollision } from "./worldData";
import { playerState } from "./playerState";

/** Civilians further than this from the player skip their update entirely. */
const CIVILIAN_ACTIVE_RANGE = 120;
const CIVILIAN_COLLIDE_RADIUS = 0.5;

export function Civilians() {
  useEffect(() => {
    initCivilians();
  }, []);
  const [, force] = useState(0);
  useEffect(() => { force(1); }, []);
  if (CIVILIANS.length === 0) return null;
  return (
    <group>
      {CIVILIANS.map((c) => <CivilianUnit key={c.id} civ={c} />)}
    </group>
  );
}

function CivilianUnit({ civ }: { civ: CivilianState }) {
  const refs = useRef<CharacterRefs>(null!);
  const proxy = useRef<THREE.Mesh>(null!);
  const walkPhase = useRef(0);

  useFrame(({ camera }, dt) => {
    const dtc = Math.min(dt, 0.05);
    const r = refs.current;
    if (!r || !r.root) return;

    const distToPlayer = Math.hypot(civ.pos.x - playerState.pos.x, civ.pos.z - playerState.pos.z);
    if (distToPlayer > CIVILIAN_ACTIVE_RANGE) {
      r.root.visible = false;
      if (proxy.current) proxy.current.visible = false;
      return;
    }

    civ.phase += dtc;
    if (civ.phase > CIVILIAN_TURN_SECS) {
      civ.phase = 0;
      civ.dir.set(Math.random() * 2 - 1, 0, Math.random() * 2 - 1).normalize();
    }

    const nx = civ.pos.x + civ.dir.x * civ.speed * dtc;
    const nz = civ.pos.z + civ.dir.z * civ.speed * dtc;
    const resolved = resolveCollision(civ.pos.x, civ.pos.z, nx, nz, CIVILIAN_COLLIDE_RADIUS);
    if (resolved.x === civ.pos.x && resolved.z === civ.pos.z) civ.dir.multiplyScalar(-1);
    civ.pos.x = resolved.x;
    civ.pos.z = resolved.z;

    const distHome = Math.hypot(civ.pos.x - civ.home.x, civ.pos.z - civ.home.z);
    if (distHome > CIVILIAN_WANDER_RADIUS) {
      civ.dir.set(civ.home.x - civ.pos.x, 0, civ.home.z - civ.pos.z).normalize();
    }

    // Level of detail: the full body up close, one simple figure further out.
    const lvl = lodLevel(Math.hypot(civ.pos.x - camera.position.x, civ.pos.z - camera.position.z));
    r.root.visible = lvl === 0;
    if (proxy.current) {
      proxy.current.visible = lvl === 1;
      proxy.current.position.set(civ.pos.x, PROXY_Y, civ.pos.z);
    }
    if (lvl !== 0) return;

    r.root.position.set(civ.pos.x, 0, civ.pos.z);
    r.root.rotation.y = Math.atan2(civ.dir.x, civ.dir.z);

    walkPhase.current += dtc * 7 * civ.speed * 0.6;
    const swing = Math.sin(walkPhase.current) * 0.55;
    if (r.legL) r.legL.rotation.x = swing;
    if (r.legR) r.legR.rotation.x = -swing;
    if (r.armL) r.armL.rotation.x = -swing * 0.7;
    if (r.armR) r.armR.rotation.x = swing * 0.7;
  });

  return (
    <>
      <Character role="civilian" variant={characterVariant(civ.id)} ref={refs} color={civ.shirt} accent={civ.pants} />
      <mesh ref={proxy} geometry={PROXY_GEO} material={solidMaterial(civ.shirt)} visible={false} scale={1.15} />
    </>
  );
}