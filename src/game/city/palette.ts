import type { District } from "../worldData";

export type Theme = {
  id: number;
  name: string;
  stone: string;
  dark: string;
  trim: string;
  glow: string;
  cloth: string;
  ground: string;
};

export const THEMES: Theme[] = [
  { id: 0, name: "Kings", stone: "#f0dca8", dark: "#4a3f28", trim: "#f2c75c", glow: "#ffd978", cloth: "#b8862b", ground: "#a8946a" },
  { id: 1, name: "Warriors", stone: "#e8b2b8", dark: "#4a2a30", trim: "#ff6b7d", glow: "#ff8a96", cloth: "#a8334a", ground: "#a8707a" },
  { id: 2, name: "Outcasts", stone: "#cfe2a2", dark: "#33401f", trim: "#c4f04a", glow: "#d9ff7a", cloth: "#6f9a2a", ground: "#8aa464" },
  { id: 3, name: "Monsters", stone: "#cdbcf0", dark: "#2e2448", trim: "#b98cff", glow: "#cdb0ff", cloth: "#6a3fb0", ground: "#8672b0" },
];

const DISTRICT_KINGDOM: Record<District, number> = {
  downtown: 0,
  uptown: 0,
  bank: 0,
  industrial: 1,
  chinatown: 1,
  airport: 1,
  shopping: 2,
  slums: 2,
  park: 2,
  residential: 2,
  harbor: 3,
  casino: 3,
  stadium: 3,
};

export function themeOf(d: District): Theme {
  return THEMES[DISTRICT_KINGDOM[d] ?? 0];
}

export const INK = "#2a2530";
export const RUBBLE = "#8d877b";

/** Deterministic 0..1 hash from world position. */
export function hash01(x: number, z: number, salt = 0): number {
  const v = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
  return v - Math.floor(v);
}