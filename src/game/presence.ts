// Low-rate Realtime broadcast of the local player's position/yaw/gang.
// Deliberately NOT one broadcast per physics frame — see PRESENCE_HZ below.
import { supabase } from "@/integrations/supabase/client";
import { authState } from "./authState";
import { PLAYER_GANG } from "./gangs";
import { playerState } from "./playerState";
import { remotePlayers } from "./remotePlayerState";
import type { RealtimeChannel } from "@supabase/supabase-js";

const CHANNEL_NAME = "gang-wars-presence";
export const PRESENCE_HZ = 8;
export const REMOTE_STALE_MS = 5000;

let channel: RealtimeChannel | null = null;
let broadcastTimer: ReturnType<typeof setInterval> | null = null;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

type PositionPayload = {
  userId: string;
  username: string;
  gang: number;
  x: number;
  z: number;
  yaw: number;
};

export function startPresence() {
  if (channel || !authState.userId) return;

  channel = supabase.channel(CHANNEL_NAME, {
    config: { broadcast: { self: false } },
  });

  channel.on("broadcast", { event: "pos" }, (msg) => {
    const p = msg.payload as PositionPayload;
    if (!p || !p.userId || p.userId === authState.userId) return;
    const now = performance.now();
    const existing = remotePlayers.get(p.userId);
    if (existing) {
      existing.targetX = p.x;
      existing.targetZ = p.z;
      existing.targetYaw = p.yaw;
      existing.username = p.username;
      existing.gang = p.gang as RemotePlayer["gang"];
      existing.lastSeen = now;
    } else {
      remotePlayers.set(p.userId, {
        userId: p.userId,
        username: p.username,
        gang: p.gang as RemotePlayer["gang"],
        x: p.x, z: p.z, yaw: p.yaw,
        targetX: p.x, targetZ: p.z, targetYaw: p.yaw,
        lastSeen: now,
      });
    }
  });

  channel.subscribe();

  broadcastTimer = setInterval(() => {
    if (!channel || !authState.userId) return;
    const payload: PositionPayload = {
      userId: authState.userId,
      username: authState.username,
      gang: PLAYER_GANG,
      x: playerState.pos.x,
      z: playerState.pos.z,
      yaw: playerState.yaw,
    };
    channel.send({ type: "broadcast", event: "pos", payload });
  }, 1000 / PRESENCE_HZ);

  cleanupTimer = setInterval(() => {
    const now = performance.now();
    for (const [id, p] of remotePlayers) {
      if (now - p.lastSeen > REMOTE_STALE_MS) remotePlayers.delete(id);
    }
  }, 1000);
}

export function stopPresence() {
  if (broadcastTimer) { clearInterval(broadcastTimer); broadcastTimer = null; }
  if (cleanupTimer) { clearInterval(cleanupTimer); cleanupTimer = null; }
  if (channel) { supabase.removeChannel(channel); channel = null; }
  remotePlayers.clear();
}

// Import type for RemotePlayer without circular runtime dep
import type { RemotePlayer } from "./remotePlayerState";
