// Load + save player_profiles row. Called on login, on an interval, and on
// page unload. Never touches React state directly — mutates the shared
// game-state objects imperatively (same pattern as npcState / vehicleState).
//
// Echoes, weapons and vehicles are owned by the SERVER now (see economy.ts):
// they are loaded here, but never written back from the browser. The kingdom is
// assigned by the server too (create_profile).
import type { User } from "@supabase/supabase-js";
import { db } from "./db";
import type { GangId } from "./gangs";
import { setPlayerGang } from "./gangs";
import { playerState } from "./playerState";
import { weaponState, WEAPON_ORDER, type WeaponId } from "./weaponState";
import { authState } from "./authState";
import { setOwnedPersonalVehicles } from "./personalVehicleState";

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
  const { data, error } = await db()
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

// Name rules — kept in sync with the DB trigger/unique index that enforce
// the same thing server-side (client checks can be bypassed).
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
const USERNAME_PATTERN = /^[A-Za-z0-9 ._-]+$/;

export function validateUsername(raw: string): string {
  const name = raw.trim();
  if (name.length < USERNAME_MIN || name.length > USERNAME_MAX) {
    throw new Error(`Your name must be ${USERNAME_MIN}-${USERNAME_MAX} characters (no blank names).`);
  }
  if (!USERNAME_PATTERN.test(name)) {
    throw new Error("Names can only use letters, numbers, spaces, dots, underscores and hyphens.");
  }
  return name;
}

// Any valid email can begin an awakening.
export function validateSignupEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  return email;
}

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { code?: string; message: string } | null;
  }>;
};

/** Creates the profile on the server, which also decides the kingdom (balanced, or pre-assigned by you). */
export async function createProfile(username: string): Promise<ProfileRow | null> {
  const { data, error } = await (db() as unknown as RpcClient).rpc("create_profile", {
    p_username: username.trim(),
  });
  if (error) {
    console.error("[profileSync] create failed", error);
    if (error.code === "23505" || /duplicate key/i.test(error.message)) {
      throw new Error("That name is already remembered. Choose another.");
    }
    if (/Name must|Name may only/i.test(error.message)) throw new Error(error.message);
    return null;
  }
  return data as ProfileRow;
}

/** Returns the user's profile, creating it from signup metadata if it does
 * not exist yet (happens when email confirmation delayed the first insert). */
export async function ensureProfile(user: User): Promise<ProfileRow | null> {
  const existing = await loadProfile(user.id);
  if (existing) return existing;
  const meta = (user.user_metadata ?? {}) as { username?: string };
  if (!meta.username) return null;
  return createProfile(validateUsername(meta.username));
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
  // Position, reputation and the equipped weapon only. Echoes, weapons,
  // vehicles and the kingdom are changed by the server alone.
  const payload = {
    reputation: Math.floor(playerState.reputation),
    equipped_weapon: weaponState.current,
    last_position_x: playerState.pos.x,
    last_position_z: playerState.pos.z,
  };
  const { error } = await db().from("player_profiles").update(payload).eq("user_id", uid);
  if (error) console.error("[profileSync] save failed", error);
}

// Fire-and-forget beacon on unload — awaiting a fetch doesn't survive a page
// close, but supabase-js .update() dispatches the request synchronously so
// browsers usually flush it.
export function syncProfileToServerBeacon() {
  void syncProfileToServer();
}