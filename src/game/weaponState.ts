import { spendMoney } from "./playerState";

export type WeaponId = "pistol" | "smg" | "rifle" | "shotgun" | "sniper" | "grenade" | "tank";
export type WeaponKind = "hitscan" | "grenade";

export type WeaponDef = {
  id: WeaponId;
  name: string;
  cost: number;
  damage: number;
  fireRate: number;
  range: number;
  spread: number;
  pellets: number;
  kind: WeaponKind;
  splash?: number; // splash radius in world units — explosive weapons only
};

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol:  { id: "pistol",  name: "Pistol",        cost: 0,    damage: 34,  fireRate: 0.28, range: 60,  spread: 0.985, pellets: 1, kind: "hitscan" },
  smg:     { id: "smg",     name: "SMG",           cost: 800,  damage: 18,  fireRate: 0.08, range: 55,  spread: 0.978, pellets: 1, kind: "hitscan" },
  rifle:   { id: "rifle",   name: "Assault Rifle", cost: 1500, damage: 30,  fireRate: 0.14, range: 90,  spread: 0.99,  pellets: 1, kind: "hitscan" },
  shotgun: { id: "shotgun", name: "Shotgun",       cost: 1200, damage: 14,  fireRate: 0.7,  range: 30,  spread: 0.965, pellets: 6, kind: "hitscan" },
  sniper:  { id: "sniper",  name: "Sniper",        cost: 2500, damage: 110, fireRate: 1.1,  range: 220, spread: 0.998, pellets: 1, kind: "hitscan" },
  grenade: { id: "grenade", name: "Grenade",       cost: 600,  damage: 70,  fireRate: 1.2,  range: 999, spread: 0,     pellets: 1, kind: "grenade", splash: 6 },
  tank:    { id: "tank",    name: "Cannon",        cost: 9000, damage: 180, fireRate: 2.6,  range: 150, spread: 0.995, pellets: 1, kind: "hitscan", splash: 5 },
};

export const WEAPON_ORDER: WeaponId[] = ["pistol", "smg", "rifle", "shotgun", "sniper", "grenade", "tank"];

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

export function purchaseWeapon(id: WeaponId, discount = 0): boolean {
  if (weaponState.owned.has(id)) return true;
  const price = Math.max(0, Math.floor(WEAPONS[id].cost * (1 - discount)));
  if (!spendMoney(price)) return false;
  weaponState.owned.add(id);
  weaponState.current = id;
  return true;
}