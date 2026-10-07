export type GangId = 0 | 1 | 2 | 3;

// Four deliberately distinct hue families — warm red, electric cyan, acid
// lime and royal violet — so gangs read apart instantly at a distance.
export const GANGS = [
  { id: 0, name: "The Kings", color: "#d8ac52", accent: "#ffe0a0", emissive: "#76551d" },
  { id: 1, name: "The Warriors",    color: "#bb2947", accent: "#ff8b9d", emissive: "#68132a" },
  { id: 2, name: "The Outcasts",   color: "#a6e017", accent: "#e2ff70", emissive: "#5b7d00" },
  { id: 3, name: "The Monsters",   color: "#8643bd", accent: "#c7a2ea", emissive: "#23112f" },
] as const;

// Mutated once at login-time from the persisted profile. Existing files import
// this as a live binding, so updating it before the game mounts is safe.
export let PLAYER_GANG: GangId = 0;

export function setPlayerGang(id: GangId) {
  PLAYER_GANG = id;
}
