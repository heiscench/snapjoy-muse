// Positions of other logged-in players received via Realtime broadcast.
// Rendered by RemotePlayers.tsx using the shared Character component and used
// as combat targets by Player.tsx / NPCs.tsx / Guards.tsx.
import type { GangId } from "./gangs";

export type RemotePlayer = {
  userId: string;
  username: string;
  gang: GangId;
  // Live position (interpolation target)
  targetX: number;
  targetZ: number;
  targetYaw: number;
  // Current interpolated position
  x: number;
  z: number;
  yaw: number;
  health: number;
  inVehicle: boolean;
  lastSeen: number; // ms epoch
  // Screen-space projection, refreshed each frame by RemotePlayers.tsx so the
  // squad-tap UI can hit-test them the same way it does NPCs.
  screenX: number;
  screenY: number;
  screenVisible: boolean;
};

export const remotePlayers = new Map<string, RemotePlayer>();

/** Alive, on-foot remote players — the only valid shooting targets. */
export function targetableRemotePlayers(): RemotePlayer[] {
  const out: RemotePlayer[] = [];
  for (const p of remotePlayers.values()) {
    if (p.inVehicle) continue;
    if (p.health <= 0) continue;
    out.push(p);
  }
  return out;
}
