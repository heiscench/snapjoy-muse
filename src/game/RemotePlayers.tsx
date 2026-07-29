// Renders other logged-in players as animated humanoids driven by
// Realtime-broadcast positions. Also projects them to screen space each frame
// so the squad-tap UI can target real players, and hides anyone currently
// sitting inside a vehicle (their car/heli is what you see instead).
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { Character, type CharacterRefs } from "./Character";
import { GANGS, PLAYER_GANG } from "./gangs";
import { remotePlayers, type RemotePlayer } from "./remotePlayerState";

const MAX_REMOTE = 32;
const LERP_RATE = 8; // higher = snappier interpolation
const WALK_SPEED_SCALE = 3.5;
const MARKER_HEIGHT = 2.4;
const MARKER_SPIN = 3;

type Slot = {
  refs: React.MutableRefObject<CharacterRefs | null>;
  marker: React.MutableRefObject<THREE.Mesh | null>;
  phase: number;
};

const _screenV = new THREE.Vector3();

export function RemotePlayers() {
  const slots = useRef<Slot[]>(
    Array.from({ length: MAX_REMOTE }, () => ({
      refs: { current: null },
      marker: { current: null },
      phase: Math.random() * 10,
    })),
  );
  const active = useRef<RemotePlayer[]>([]);
  const { camera, size } = useThree();

  useFrame((_, dt) => {
    const dtc = Math.min(dt, 0.05);
    active.current = Array.from(remotePlayers.values()).slice(0, MAX_REMOTE);

    for (let i = 0; i < slots.current.length; i++) {
      const slot = slots.current[i];
      const r = slot.refs.current;
      if (!r || !r.root) continue;
      const p = active.current[i];
      if (!p) {
        r.root.visible = false;
        if (slot.marker.current) slot.marker.current.visible = false;
        continue;
      }

      // Interpolate toward the latest broadcast position
      const t = 1 - Math.exp(-LERP_RATE * dtc);
      p.x += (p.targetX - p.x) * t;
      p.z += (p.targetZ - p.z) * t;
      let dy = p.targetYaw - p.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      p.yaw += dy * t;

      const visible = !p.inVehicle && p.health > 0;
      r.root.visible = visible;
      r.root.position.set(p.x, 0, p.z);
      r.root.rotation.y = p.yaw;

      const moving = Math.hypot(p.targetX - p.x, p.targetZ - p.z) > 0.05;
      slot.phase += dtc * (moving ? WALK_SPEED_SCALE : 0);
      const swing = moving ? Math.sin(slot.phase * 2) * 0.6 : 0;
      if (r.legL) r.legL.rotation.x = swing;
      if (r.legR) r.legR.rotation.x = -swing;
      if (r.armL) r.armL.rotation.x = -swing * 0.6;
      if (r.armR) r.armR.rotation.x = swing * 0.6;

      // Ally marker — same rule as NPCs: only your own gang is tagged.
      const isAlly = p.gang === PLAYER_GANG;
      if (slot.marker.current) {
        slot.marker.current.visible = visible && isAlly;
        slot.marker.current.position.set(p.x, MARKER_HEIGHT, p.z);
        if (visible && isAlly) slot.marker.current.rotation.y += dtc * MARKER_SPIN;
      }

      if (visible) {
        _screenV.set(p.x, 1.8, p.z).project(camera);
        p.screenVisible = _screenV.z < 1 && _screenV.z > -1;
        p.screenX = (_screenV.x * 0.5 + 0.5) * size.width;
        p.screenY = (-_screenV.y * 0.5 + 0.5) * size.height;
      } else {
        p.screenVisible = false;
      }
    }
  });

  return (
    <>
      {slots.current.map((slot, i) => {
        const p = active.current[i];
        const gang = GANGS[(p?.gang ?? 0) as 0 | 1 | 2 | 3];
        return (
          <group key={i}>
            <Character
              ref={(v) => { slot.refs.current = v; }}
              color={gang.color}
              accent={gang.accent}
              scale={1.15}
            />
            <mesh ref={(m) => { slot.marker.current = m; }} visible={false}>
              <coneGeometry args={[0.18, 0.35, 4]} />
              <meshBasicMaterial color={GANGS[PLAYER_GANG].accent} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}
