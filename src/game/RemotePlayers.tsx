// Renders other logged-in players as animated humanoids driven by
// Realtime-broadcast positions. Read-only w.r.t. gameplay — no combat,
// collision, or AI hooks yet; that lands in a later multiplayer phase.
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { Character, type CharacterRefs } from "./Character";
import { GANGS } from "./gangs";
import { remotePlayers, type RemotePlayer } from "./remotePlayerState";

const MAX_REMOTE = 32;
const LERP_RATE = 8; // higher = snappier interpolation
const WALK_SPEED_SCALE = 3.5;

type Slot = {
  refs: React.MutableRefObject<CharacterRefs | null>;
  phase: number;
};

export function RemotePlayers() {
  const slots = useRef<Slot[]>(
    Array.from({ length: MAX_REMOTE }, () => ({ refs: { current: null }, phase: Math.random() * 10 })),
  );
  const active = useRef<RemotePlayer[]>([]);

  useFrame((_, dt) => {
    const dtc = Math.min(dt, 0.05);
    active.current = Array.from(remotePlayers.values()).slice(0, MAX_REMOTE);

    for (let i = 0; i < slots.current.length; i++) {
      const slot = slots.current[i];
      const r = slot.refs.current;
      if (!r || !r.root) continue;
      const p = active.current[i];
      if (!p) { r.root.visible = false; continue; }
      r.root.visible = true;

      // Interpolate toward the latest broadcast position
      const t = 1 - Math.exp(-LERP_RATE * dtc);
      p.x += (p.targetX - p.x) * t;
      p.z += (p.targetZ - p.z) * t;
      // Shortest-angle yaw lerp
      let dy = p.targetYaw - p.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      p.yaw += dy * t;

      r.root.position.set(p.x, 0, p.z);
      r.root.rotation.y = p.yaw;

      // Cheap walk animation driven by change in position
      const moving = Math.hypot(p.targetX - p.x, p.targetZ - p.z) > 0.05;
      slot.phase += dtc * (moving ? WALK_SPEED_SCALE : 0);
      const swing = moving ? Math.sin(slot.phase * 2) * 0.6 : 0;
      if (r.legL) r.legL.rotation.x = swing;
      if (r.legR) r.legR.rotation.x = -swing;
      if (r.armL) r.armL.rotation.x = -swing * 0.6;
      if (r.armR) r.armR.rotation.x = swing * 0.6;
    }
  });

  return (
    <>
      {slots.current.map((slot, i) => {
        // Assign gang color from the currently-mapped remote player, or fall back
        const p = active.current[i];
        const gang = GANGS[(p?.gang ?? 0) as 0 | 1 | 2 | 3];
        return (
          <group key={i} visible={false}>
            <Character
              ref={(v) => { slot.refs.current = v; }}
              color={gang.color}
              accent={gang.accent}
            />
          </group>
        );
      })}
    </>
  );
}
