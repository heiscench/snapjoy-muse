// Single Realtime channel for everything live: player positions/health, PvP
// hits, squad requests, vehicle transforms + destruction, and HUD alerts.
// Deliberately low-rate — see the *_HZ constants below.
import { supabase } from "@/integrations/supabase/client";
import { authState } from "./authState";
import { PLAYER_GANG, GANGS, type GangId } from "./gangs";
import { playerState, damagePlayer, earnMoney, KILL_BOUNTY } from "./playerState";
import { remotePlayers, type RemotePlayer } from "./remotePlayerState";
import { squadState } from "./squadState";
import { pushAlert } from "./alertState";
import { warRecord } from "./war/warState";
import { pilotState, HELICOPTERS, applyRemoteVehicleDestroyed } from "./vehicleState";
import { CAR_LIVE, carPilot, carRemote } from "./carState";
import { onPlayerKill } from "./territoryState";
import type { RealtimeChannel } from "@supabase/supabase-js";

const CHANNEL_NAME = "gang-wars-presence";
export const PRESENCE_HZ = 8;
export const VEHICLE_HZ = 8;
export const REMOTE_STALE_MS = 5000;

let channel: RealtimeChannel | null = null;
let posTimer: ReturnType<typeof setInterval> | null = null;
let vehTimer: ReturnType<typeof setInterval> | null = null;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

type PositionPayload = {
  userId: string;
  username: string;
  gang: number;
  x: number;
  z: number;
  yaw: number;
  health: number;
  inVehicle: boolean;
};

type HitPayload = { toUserId: string; fromUserId: string; fromUsername: string; amount: number };
type DiedPayload = { userId: string; username: string; killerUserId: string | null; tax?: number };
type SquadReqPayload = { fromUserId: string; fromUsername: string; toUserId: string };
type SquadResPayload = { fromUserId: string; fromUsername: string; toUserId: string; accepted: boolean };
type VehiclePayload = {
  ownerId: string;
  car: { i: number; x: number; z: number; rotY: number } | null;
  heli: { gang: number; x: number; y: number; z: number; yaw: number } | null;
};
type VehicleDeadPayload = { kind: "car" | "heli"; id: number };
type AlertPayload = { gang: number; text: string; tone: "info" | "warn" };

function send(event: string, payload: unknown) {
  if (!channel || !authState.userId) return;
  channel.send({ type: "broadcast", event, payload });
}

// ---- Outgoing -------------------------------------------------------------

export function broadcastHit(toUserId: string, amount: number) {
  if (!authState.userId) return;
  send("hit", {
    toUserId,
    fromUserId: authState.userId,
    fromUsername: authState.username,
    amount,
  } satisfies HitPayload);
}

export function broadcastDeath(killerUserId: string | null) {
  if (!authState.userId) return;
  send("died", {
    userId: authState.userId,
    username: authState.username,
    killerUserId,
  } satisfies DiedPayload);
}

export function broadcastSquadRequest(toUserId: string) {
  if (!authState.userId) return;
  send("squadreq", {
    fromUserId: authState.userId,
    fromUsername: authState.username,
    toUserId,
  } satisfies SquadReqPayload);
}

export function broadcastSquadResponse(toUserId: string, accepted: boolean) {
  if (!authState.userId) return;
  send("squadres", {
    fromUserId: authState.userId,
    fromUsername: authState.username,
    toUserId,
    accepted,
  } satisfies SquadResPayload);
}

export function broadcastVehicleDestroyed(kind: "car" | "heli", id: number) {
  send("vehdead", { kind, id } satisfies VehicleDeadPayload);
}

export function broadcastAlert(gang: GangId, text: string, tone: "info" | "warn" = "warn") {
  send("alert", { gang, text, tone } satisfies AlertPayload);
}

/** Tracks who last damaged us, so the kill bounty goes to the right player. */
export const lastAttacker = { userId: null as string | null, at: 0 };
export const LAST_ATTACKER_WINDOW_MS = 10000;

// ---- Channel lifecycle ----------------------------------------------------

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
      existing.gang = p.gang as GangId;
      existing.health = p.health;
      existing.inVehicle = p.inVehicle;
      existing.lastSeen = now;
    } else {
      const fresh: RemotePlayer = {
        userId: p.userId,
        username: p.username,
        gang: p.gang as GangId,
        x: p.x, z: p.z, yaw: p.yaw,
        targetX: p.x, targetZ: p.z, targetYaw: p.yaw,
        health: p.health,
        inVehicle: p.inVehicle,
        lastSeen: now,
        screenX: -1, screenY: -1, screenVisible: false,
      };
      remotePlayers.set(p.userId, fresh);
    }
  });

  channel.on("broadcast", { event: "hit" }, (msg) => {
    const p = msg.payload as HitPayload;
    if (!p || p.toUserId !== authState.userId) return;
    if (pilotState.piloting || carPilot.driving) return; // vehicle immunity
    lastAttacker.userId = p.fromUserId;
    lastAttacker.at = Date.now();
    damagePlayer(p.amount);
    pushAlert(`Marked by ${p.fromUsername}`, "warn");
  });

  channel.on("broadcast", { event: "died" }, (msg) => {
    const p = msg.payload as DiedPayload;
    if (!p) return;
    const victim = remotePlayers.get(p.userId);
    if (victim) victim.health = 0;
    squadState.humanFollowers.delete(p.userId);
    if (squadState.followingUserId === p.userId) squadState.followingUserId = null;
    if (p.killerUserId && p.killerUserId === authState.userId) {
      earnMoney(KILL_BOUNTY);
      onPlayerKill();
      pushAlert(`You unmade ${p.username} — +◈ ${KILL_BOUNTY}`);
    }
  });

  channel.on("broadcast", { event: "squadreq" }, (msg) => {
    const p = msg.payload as SquadReqPayload;
    if (!p || p.toUserId !== authState.userId) return;
    squadState.pendingHumanRequest = {
      fromUserId: p.fromUserId,
      fromUsername: p.fromUsername,
      at: Date.now(),
    };
  });

  channel.on("broadcast", { event: "squadres" }, (msg) => {
    const p = msg.payload as SquadResPayload;
    if (!p || p.toUserId !== authState.userId) return;
    if (squadState.outgoingRequest?.toUserId === p.fromUserId) {
      squadState.outgoingRequest = null;
    }
    if (p.accepted) {
      squadState.humanFollowers.add(p.fromUserId);
      pushAlert(`${p.fromUsername} walks beside you`);
    } else {
      pushAlert(`${p.fromUsername} declined`, "warn");
    }
  });

  channel.on("broadcast", { event: "veh" }, (msg) => {
    const p = msg.payload as VehiclePayload;
    if (!p || p.ownerId === authState.userId) return;
    if (p.car && CAR_LIVE[p.car.i] && carPilot.drivingIndex !== p.car.i) {
      const c = CAR_LIVE[p.car.i];
      c.x = p.car.x; c.z = p.car.z; c.rotY = p.car.rotY;
      carRemote.set(p.car.i, { userId: p.ownerId, lastSeen: performance.now() });
    }
    if (p.heli) {
      const gid = p.heli.gang as 0 | 1 | 2 | 3;
      const mine = pilotState.piloting && gid === PLAYER_GANG;
      if (!mine) {
        const h = HELICOPTERS[gid];
        h.pos.set(p.heli.x, p.heli.y, p.heli.z);
        h.yaw = p.heli.yaw;
      }
    }
  });

  channel.on("broadcast", { event: "vehdead" }, (msg) => {
    const p = msg.payload as VehicleDeadPayload;
    if (!p) return;
    applyRemoteVehicleDestroyed(p.kind, p.id);
  });

  channel.on("broadcast", { event: "alert" }, (msg) => {
    const p = msg.payload as AlertPayload;
    if (!p) return;
    if (p.gang !== PLAYER_GANG) return;
    pushAlert(p.text, p.tone);
  });

  channel.subscribe();

  posTimer = setInterval(() => {
    if (!authState.userId) return;
    const payload: PositionPayload = {
      userId: authState.userId,
      username: authState.username,
      gang: PLAYER_GANG,
      x: playerState.pos.x,
      z: playerState.pos.z,
      yaw: playerState.yaw,
      health: playerState.health,
      inVehicle: pilotState.piloting || carPilot.driving,
    };
    send("pos", payload);
  }, 1000 / PRESENCE_HZ);

  vehTimer = setInterval(() => {
    if (!authState.userId) return;
    if (!carPilot.driving && !pilotState.piloting) return;
    const car =
      carPilot.driving && CAR_LIVE[carPilot.drivingIndex]
        ? {
            i: carPilot.drivingIndex,
            x: CAR_LIVE[carPilot.drivingIndex].x,
            z: CAR_LIVE[carPilot.drivingIndex].z,
            rotY: CAR_LIVE[carPilot.drivingIndex].rotY,
          }
        : null;
    const h = HELICOPTERS[PLAYER_GANG];
    const heli = pilotState.piloting
      ? { gang: PLAYER_GANG, x: h.pos.x, y: h.pos.y, z: h.pos.z, yaw: h.yaw }
      : null;
    send("veh", { ownerId: authState.userId, car, heli } satisfies VehiclePayload);
  }, 1000 / VEHICLE_HZ);

  cleanupTimer = setInterval(() => {
    const now = performance.now();
    for (const [id, p] of remotePlayers) {
      if (now - p.lastSeen > REMOTE_STALE_MS) {
        remotePlayers.delete(id);
        squadState.humanFollowers.delete(id);
        if (squadState.followingUserId === id) squadState.followingUserId = null;
      }
    }
    for (const [i, r] of carRemote) {
      if (now - r.lastSeen > REMOTE_STALE_MS) carRemote.delete(i);
    }
  }, 1000);
}

export function stopPresence() {
  if (posTimer) { clearInterval(posTimer); posTimer = null; }
  if (vehTimer) { clearInterval(vehTimer); vehTimer = null; }
  if (cleanupTimer) { clearInterval(cleanupTimer); cleanupTimer = null; }
  if (channel) { supabase.removeChannel(channel); channel = null; }
  remotePlayers.clear();
  carRemote.clear();
}

export function gangName(gang: GangId) {
  return GANGS[gang].name;
}
