// Positions of other logged-in players received via Realtime broadcast.
// Rendered by RemotePlayers.tsx using the shared Character component.
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
  lastSeen: number; // ms epoch
};

export const remotePlayers = new Map<string, RemotePlayer>();
