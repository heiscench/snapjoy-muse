// Personal (purchasable) vehicles. Unlike the street traffic cars, these are
// owned by the player, cannot be taken by anyone else, and always respawn at
// their gang HQ parking pad after being destroyed.
import { spendMoney } from "./playerState";
import { PLAYER_GANG } from "./gangs";
import { GANG_HQ } from "./worldData";

export type PersonalVehicleId = "cruiser" | "warhorse" | "phantom";
export type PersonalBodyType = "sedan" | "suv" | "sport";

export type PersonalVehicleDef = {
  id: PersonalVehicleId;
  name: string;
  cost: number;
  body: PersonalBodyType;
  color: string;
  blurb: string;
};

export const PERSONAL_VEHICLES: Record<PersonalVehicleId, PersonalVehicleDef> = {
  cruiser:  { id: "cruiser",  name: "Street Cruiser", cost: 6000,  body: "sedan",  color: "#c9d6e2", blurb: "Reliable daily runner" },
  warhorse: { id: "warhorse", name: "Warhorse SUV",   cost: 12000, body: "suv",    color: "#2f3a2a", blurb: "Heavy, hard to shift" },
  phantom:  { id: "phantom",  name: "Phantom GT",     cost: 22000, body: "sport",  color: "#12060f", blurb: "Fastest thing on the map" },
};

export const PERSONAL_ORDER: PersonalVehicleId[] = ["cruiser", "warhorse", "phantom"];

/** Parking slot offsets from the gang HQ, one per catalogue entry. */
export const PERSONAL_PARK_OFFSETS: { x: number; z: number }[] = [
  { x: -10, z: 12 },
  { x: 0, z: 14 },
  { x: 10, z: 12 },
];

export const personalVehicleState = {
  owned: new Set<PersonalVehicleId>(),
  /** Bumped whenever the owned set changes so the renderer can rebuild. */
  version: 0,
};

export function ownsPersonalVehicle(id: PersonalVehicleId): boolean {
  return personalVehicleState.owned.has(id);
}

export function ownedPersonalVehicles(): PersonalVehicleDef[] {
  return PERSONAL_ORDER.filter((id) => personalVehicleState.owned.has(id)).map(
    (id) => PERSONAL_VEHICLES[id],
  );
}

export function purchasePersonalVehicle(id: PersonalVehicleId): boolean {
  if (personalVehicleState.owned.has(id)) return true;
  if (!spendMoney(PERSONAL_VEHICLES[id].cost)) return false;
  personalVehicleState.owned.add(id);
  personalVehicleState.version++;
  return true;
}

export function setOwnedPersonalVehicles(ids: string[]) {
  personalVehicleState.owned = new Set(
    ids.filter((v): v is PersonalVehicleId => PERSONAL_ORDER.includes(v as PersonalVehicleId)),
  );
  personalVehicleState.version++;
}

/** Home parking spot for an owned vehicle, based on catalogue order. */
export function personalParkSpot(id: PersonalVehicleId): { x: number; z: number; rotY: number } {
  const hq = GANG_HQ[PLAYER_GANG];
  const off = PERSONAL_PARK_OFFSETS[PERSONAL_ORDER.indexOf(id)] ?? PERSONAL_PARK_OFFSETS[0];
  return { x: hq.x + off.x, z: hq.z + off.z, rotY: 0 };
}
