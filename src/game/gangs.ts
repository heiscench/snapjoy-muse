export type GangId = 0 | 1 | 2 | 3;

export const GANGS = [
  { id: 0, name: "Crimson Vipers", color: "#5a0f14", accent: "#8b1a20", emissive: "#3a0a0e" },
  { id: 1, name: "Neon Yakuza",    color: "#1e4a4a", accent: "#2f6b6b", emissive: "#0d2b2b" },
  { id: 2, name: "Toxic Skulls",   color: "#4a5a1f", accent: "#6b7a2a", emissive: "#2b350f" },
  { id: 3, name: "Violet Kings",   color: "#2a103a", accent: "#4a1f5f", emissive: "#180820" },
] as const;

// Mutated once at login-time from the persisted profile. Existing files import
// this as a live binding, so updating it before the game mounts is safe.
export let PLAYER_GANG: GangId = 0;

export function setPlayerGang(id: GangId) {
  PLAYER_GANG = id;
}
