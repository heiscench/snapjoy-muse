export type GangId = 0 | 1 | 2 | 3;

export const GANGS = [
  { id: 0, name: "Crimson Vipers", color: "#c81d34", accent: "#ff4d5e", emissive: "#7a0f1c" },
  { id: 1, name: "Neon Yakuza",    color: "#00c2b2", accent: "#5ffbea", emissive: "#00726a" },
  { id: 2, name: "Toxic Skulls",   color: "#8fd400", accent: "#c8ff5c", emissive: "#4f7600" },
  { id: 3, name: "Violet Kings",   color: "#8a2be2", accent: "#c58bff", emissive: "#4a1391" },
] as const;

// Mutated once at login-time from the persisted profile. Existing files import
// this as a live binding, so updating it before the game mounts is safe.
export let PLAYER_GANG: GangId = 0;

export function setPlayerGang(id: GangId) {
  PLAYER_GANG = id;
}