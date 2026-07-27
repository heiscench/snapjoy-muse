// Weapon definitions, inventory + selection. Reads mutated imperatively
// from useFrame — no React state on the hot path.
import { spendMoney } from "./playerState";

export type WeaponId = "pistol" | "smg" | "rifle" | "shotgun" | "sniper";

export type WeaponDef = {
  id: WeaponId;
  name: string;
  cost: number;
  damage: number;
  fireRate: number; // seconds between shots
  range: number;
  spread: number;   // dot-product tolerance (higher = tighter)
  pellets: number;  // >1 for shotgun
};

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol:  { id: "pistol",  name: "Pistol",       cost: 0,    damage: 34, fireRate: 0.28, range: 60, spread: 0.985, pellets: 1 },
  smg:     { id: "smg",     name: "SMG",          cost: 800,  damage: 18, fireRate: 0.08, range: 55, spread: 0.978, pellets: 1 },
  rifle:   { id: "rifle",   name: "Assault Rifle",cost: 1500, damage: 30, fireRate: 0.14, range: 90, spread: 0.99,  pellets: 1 },
  shotgun: { id: "shotgun", name: "Shotgun",      cost: 1200, damage: 14, fireRate: 0.7,  range: 30, spread: 0.965, pellets: 6 },
  sniper:  { id: "sniper",  name: "Sniper",       cost: 2500, damage: 110,fireRate: 1.1,  range: 220,spread: 0.998, pellets: 1 },
};

export const WEAPON_ORDER: WeaponId[] = ["pistol", "smg", "rifle", "shotgun", "sniper"];

export const weaponState = {
  current: "pistol" as WeaponId,
  owned: new Set<WeaponId>(["pistol"]),
};

export function currentWeapon(): WeaponDef {
  return WEAPONS[weaponState.current];
}

export function ownsWeapon(id: WeaponId): boolean {
  return weaponState.owned.has(id);
}

export function selectWeapon(id: WeaponId) {
  if (weaponState.owned.has(id)) weaponState.current = id;
}

// Returns true on successful purchase. Cost is modulated by an optional discount
// (0..1) applied by the territory system when the player's gang holds Industrial.
export function purchaseWeapon(id: WeaponId, discount = 0): boolean {
  if (weaponState.owned.has(id)) return true;
  const price = Math.max(0, Math.floor(WEAPONS[id].cost * (1 - discount)));
  if (!spendMoney(price)) return false;
  weaponState.owned.add(id);
  weaponState.current = id;
  return true;
}
