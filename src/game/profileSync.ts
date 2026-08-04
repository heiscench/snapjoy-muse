// Load + save player_profiles row. Called on login, on an interval, and on
// page unload. Never touches React state directly — mutates the shared
// game-state objects imperatively (same pattern as npcState / vehicleState).
import { supabase } from "@/integrations/supabase/client";
import type { GangId } from "./gangs";
import { setPlayerGang } from "./gangs";
import { playerState } from "./playerState";
import { weaponState, WEAPON_ORDER, type WeaponId } from "./weaponState";
import { authState } from "./authState";
import { GANG_HQ } from "./worldData";
import { personalVehicleState, setOwnedPersonalVehicles } from "./personalVehicleState";

export type ProfileRow = {
  user_id: string;
  username: string;
  gang: number;
  money: number;
  reputation: number;
  owned_weapons: string[];
  owned_vehicles: string[];
  equipped_weapon: string;
  last_position_x: number;
  last_position_z: number;
};

export async function loadProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("player_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[profileSync] load failed", error);
    return null;
  }
  return (data as ProfileRow | null) ?? null;
}

// Username rules — kept in sync with the DB trigger/unique index that enforce
// the same thing server-side (client checks can be bypassed).
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
const USERNAME_PATTERN = /^[A-Za-z0-9 ._-]+$/;
const GMAIL_DOMAIN = "@gmail.com";

export function validateUsername(raw: string): string {
  const name = raw.trim();
  if (name.length < USERNAME_MIN || name.length > USERNAME_MAX) {
    throw new Error(`Username must be ${USERNAME_MIN}-${USERNAME_MAX} characters (no blank names).`);
  }
  if (!USERNAME_PATTERN.test(name)) {
    throw new Error("Username can only use letters, numbers, spaces, dots, underscores and hyphens.");
  }
  return name;
}

export function validateSignupEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (!email.endsWith(GMAIL_DOMAIN)) {
    throw new Error("Sign-ups are limited to @gmail.com addresses.");
  }
  return email;
}

export async function createProfile(
  userId: string, username: string, gang: GangId,
): Promise<ProfileRow | null> {
  // New accounts start at their gang's HQ — this is the only case position
  // should default rather than resume, since there's nothing to resume yet.
  const hq = GANG_HQ[gang];
  const { data, error } = await supabase
    .from("player_profiles")
    .insert({
      user_id: userId,
      username: username.trim(),
      gang,
      last_position_x: hq.x + 14, last_position_z: hq.z,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[profileSync] create failed", error);
    if (error.code === "23505" || /duplicate key/i.test(error.message)) {
      throw new Error("That username is already taken — pick another.");
    }
    if (/gmail\.com/i.test(error.message)) {
      throw new Error("Sign-ups are limited to @gmail.com addresses.");
    }
    if (/Username/i.test(error.message)) throw new Error(error.message);
    return null;
  }
  return data as ProfileRow;
}


// Hydrate in-memory game state from a loaded row. Called once on login.
export function applyProfileToGameState(row: ProfileRow) {
  authState.userId = row.user_id;
  authState.username = row.username;
  setPlayerGang(row.gang as GangId);
  playerState.money = row.money;
  playerState.reputation = row.reputation;
  playerState.pos.x = row.last_position_x;
  playerState.pos.z = row.last_position_z;

  weaponState.owned = new Set<WeaponId>(
    row.owned_weapons.filter((w): w is WeaponId => WEAPON_ORDER.includes(w as WeaponId)),
  );
  if (!weaponState.owned.has("pistol")) weaponState.owned.add("pistol");

  setOwnedPersonalVehicles(row.owned_vehicles ?? []);

  const eq = row.equipped_weapon as WeaponId;
  weaponState.current = weaponState.owned.has(eq) ? eq : "pistol";
}

export async function syncProfileToServer(): Promise<void> {
  const uid = authState.userId;
  if (!uid) return;
  const payload = {
    money: Math.floor(playerState.money),
    reputation: Math.floor(playerState.reputation),
    owned_weapons: Array.from(weaponState.owned),
    owned_vehicles: Array.from(personalVehicleState.owned),
    equipped_weapon: weaponState.current,
    last_position_x: playerState.pos.x,
    last_position_z: playerState.pos.z,
  };
  const { error } = await supabase.from("player_profiles").update(payload).eq("user_id", uid);
  if (error) console.error("[profileSync] save failed", error);
}

// Fire-and-forget beacon on unload — awaiting a fetch doesn't survive a page
// close, but supabase-js .update() dispatches the request synchronously so
// browsers usually flush it.
export function syncProfileToServerBeacon() {
  void syncProfileToServer();
}