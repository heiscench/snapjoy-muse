// Unified combat-target list: the local player plus every visible remote
// player. NPCs and guards use this so they react to real players from other
// clients, not just whoever is sitting at this keyboard.
//
// Damage authority stays local: an NPC only ever *damages* the local player.
// Each remote player's own client runs the same simulation for them, so
// nobody takes duplicated damage from the same bot.
import { PLAYER_GANG, type GangId } from "./gangs";
import { playerState } from "./playerState";
import { pilotState } from "./vehicleState";
import { carPilot } from "./carState";
import { remotePlayers } from "./remotePlayerState";

export type CombatTarget = {
  x: number;
  z: number;
  gang: GangId;
  isLocal: boolean;
  userId: string | null;
  inVehicle: boolean;
  alive: boolean;
};

const _targets: CombatTarget[] = [];

/** Rebuilt once per frame by the first caller; cheap enough for <40 entities. */
export function combatTargets(): CombatTarget[] {
  _targets.length = 0;
  _targets.push({
    x: playerState.pos.x,
    z: playerState.pos.z,
    gang: PLAYER_GANG,
    isLocal: true,
    userId: null,
    inVehicle: pilotState.piloting || carPilot.driving,
    alive: playerState.health > 0,
  });
  for (const p of remotePlayers.values()) {
    _targets.push({
      x: p.x,
      z: p.z,
      gang: p.gang,
      isLocal: false,
      userId: p.userId,
      inVehicle: p.inVehicle,
      alive: p.health > 0,
    });
  }
  return _targets;
}

/** Nearest hostile target to a point, or null. */
export function nearestHostile(
  x: number,
  z: number,
  myGang: GangId | null,
  maxDist: number,
  hostileToAll = false,
): { target: CombatTarget; dist: number } | null {
  let best: { target: CombatTarget; dist: number } | null = null;
  for (const t of combatTargets()) {
    if (!t.alive) continue;
    if (!hostileToAll && myGang !== null && t.gang === myGang) continue;
    const d = Math.hypot(t.x - x, t.z - z);
    if (d > maxDist) continue;
    if (!best || d < best.dist) best = { target: t, dist: d };
  }
  return best;
}
