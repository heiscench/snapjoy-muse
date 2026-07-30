// Neutral security + bank guards. Kept separate from NPCS to avoid touching
// the existing wander/respawn loop.
import * as THREE from "three";
import { NEUTRAL_HQS, ROBBABLE_BANKS, type District } from "./worldData";
import { registerGuardsAliveForBank, registerOwnerChangedHook, GUARD_RESPAWN } from "./territoryState";
import type { GangId } from "./gangs";

export type GuardKind = "bank" | "neutral";

export type GuardState = {
  id: number;
  kind: GuardKind;
  bankId?: number;      // set for kind === "bank"
  district?: District;  // set for kind === "neutral"
  gang: GangId | null;  // neutral guards may re-skin to capturing gang
  home: THREE.Vector3;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  hp: number;
  maxHp: number;
  dead: boolean;
  respawn: number;      // seconds until respawn
  hitFlash: number;
  fireCd: number;
  aggroT: number;       // time remaining in aggro state
};

// ---- Balance ---------------------------------------------------------------
// Bank guards were previously 3x220hp with a 5 minute respawn, which made a
// robbery effectively impossible. Now: fewer, softer, quicker to come back.
export const BANK_GUARD_MAX_HP = 90;
export const NEUTRAL_GUARD_MAX_HP = 120;
/** Legacy alias kept for callers that just want "a guard's full health". */
export const GUARD_MAX_HP = NEUTRAL_GUARD_MAX_HP;
export const GUARD_DAMAGE = 7;
export const GUARD_FIRE_RATE = 0.75;
export const GUARD_DETECT_RANGE = 20;
export const GUARD_DEAGGRO_RANGE = GUARD_DETECT_RANGE * 1.6;
export const GUARD_AGGRO_SECS = 6;
export const NEUTRAL_GUARDS_PER_HQ = 2;
export const BANK_GUARDS_PER_BANK = 2;
export const GUARD_RESKIN_RESPAWN = 2;

export const GUARDS: GuardState[] = [];

let nextId = 1;

function spawnAround(cx: number, cz: number, offset: number): THREE.Vector3 {
  const a = Math.random() * Math.PI * 2;
  return new THREE.Vector3(cx + Math.cos(a) * offset, 0, cz + Math.sin(a) * offset);
}

export function initGuards() {
  GUARDS.length = 0;
  nextId = 1;
  // Bank guards
  for (const b of ROBBABLE_BANKS) {
    for (let i = 0; i < BANK_GUARDS_PER_BANK; i++) {
      const home = spawnAround(b.x, b.z, 12);
      GUARDS.push({
        id: nextId++, kind: "bank", bankId: b.id, gang: null,
        home, pos: home.clone(),
        dir: new THREE.Vector3(0, 0, 1),
        hp: BANK_GUARD_MAX_HP, maxHp: BANK_GUARD_MAX_HP,
        dead: false, respawn: 0, hitFlash: 0, fireCd: 0, aggroT: 0,
      });
    }
  }
  // Neutral district guards (one set per dominatable district)
  for (const n of NEUTRAL_HQS) {
    for (let i = 0; i < NEUTRAL_GUARDS_PER_HQ; i++) {
      const home = spawnAround(n.x, n.z, 6);
      GUARDS.push({
        id: nextId++, kind: "neutral", district: n.district, gang: null,
        home, pos: home.clone(),
        dir: new THREE.Vector3(0, 0, 1),
        hp: NEUTRAL_GUARD_MAX_HP, maxHp: NEUTRAL_GUARD_MAX_HP,
        dead: false, respawn: 0, hitFlash: 0, fireCd: 0, aggroT: 0,
      });
    }
  }
}

// Multiplayer: fired when the LAST living guard of a bank goes down, so the
// shared world state can mark that bank's security as cleared for everyone.
type BankGuardsClearedHook = (bankId: number) => void;
let _onBankGuardsCleared: BankGuardsClearedHook = () => {};
export function registerBankGuardsClearedHook(fn: BankGuardsClearedHook) {
  _onBankGuardsCleared = fn;
}

export function bankGuardsAlive(bankId: number): boolean {
  for (const g of GUARDS) {
    if (g.kind === "bank" && g.bankId === bankId && !g.dead) return true;
  }
  return false;
}

/** Mirror another client's guard wipe: everyone sees the same dead guards. */
export function applyRemoteBankGuards(bankId: number, respawnAtMs: number | null) {
  if (!respawnAtMs) return;
  const remaining = (respawnAtMs - Date.now()) / 1000;
  if (remaining <= 0) return;
  for (const g of GUARDS) {
    if (g.kind !== "bank" || g.bankId !== bankId) continue;
    g.dead = true;
    g.hp = 0;
    g.respawn = remaining;
  }
}

export function damageGuard(g: GuardState, amount: number) {
  if (g.dead) return;
  g.hp -= amount;
  g.hitFlash = 0.25;
  g.aggroT = GUARD_AGGRO_SECS;
  if (g.hp <= 0) {
    g.dead = true;
    g.respawn = GUARD_RESPAWN;
    if (g.kind === "bank" && g.bankId !== undefined && !bankGuardsAlive(g.bankId)) {
      _onBankGuardsCleared(g.bankId);
    }
  }
}

// Territory system asks: are any guards for this bank still alive?
registerGuardsAliveForBank((bankId: number) => {
  for (const g of GUARDS) {
    if (g.kind === "bank" && g.bankId === bankId && !g.dead) return true;
  }
  return false;
});

// When a district changes hands its HQ guards join the new owner. They briefly
// "die" so the swap reads as the old garrison being replaced.
export function reskinNeutralDistrictGuards(district: District, gang: GangId | null) {
  for (const g of GUARDS) {
    if (g.kind === "neutral" && g.district === district) {
      g.gang = gang;
      g.dead = true;
      g.respawn = GUARD_RESKIN_RESPAWN;
      g.hp = g.maxHp;
    }
  }
}

registerOwnerChangedHook((district, owner) => reskinNeutralDistrictGuards(district, owner));
