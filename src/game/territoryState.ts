// District ownership + capture channel state. Also drives passive income and
// weapon-cost discounts via the economy system.
import { PLAYER_GANG, type GangId } from "./gangs";
import {
  CAPTURE_RADIUS,
  DISTRICT_LABELS,
  ROBBABLE_BANKS,
  VAULT_RADIUS,
  type District,
} from "./worldData";
import {
  playerState,
  earnMoney,
  addReputation,
  STADIUM_REP_PER_KILL,
} from "./playerState";

// ---- Tunables ------------------------------------------------------------
export const CAPTURE_TIME = 30;             // seconds
export const CAPTURE_LOCK = 5 * 60;         // seconds after successful capture
export const HARBOR_INCOME_PER_SEC = 2;
export const BANK_INCOME_PER_SEC = 3;
export const INDUSTRIAL_WEAPON_DISCOUNT = 0.25;
export const STADIUM_REP_TICK = 0.15;       // per second

export const ROBBERY_TIME = 30;             // vault channel seconds
export const ROBBERY_COOLDOWN = 10 * 60;    // per bank
export const GUARD_RESPAWN = 5 * 60;
export const ROBBERY_MIN_PAYOUT = 2000;
export const ROBBERY_MAX_PAYOUT = 4000;

// ---- District ownership --------------------------------------------------
export type Owner = GangId | null;

const INITIAL_OWNERS: Record<District, Owner> = {
  downtown: 0,
  industrial: 1,
  shopping: 2,
  harbor: 3,
  stadium: null,
  bank: null,
};

export const territoryState = {
  owners: { ...INITIAL_OWNERS } as Record<District, Owner>,
  // capture channel
  captureDistrict: null as District | null,
  captureProgress: 0,
  captureMessage: null as string | null,
  captureMessageT: 0,
  lockUntil: {} as Partial<Record<District, number>>, // seconds since epoch (perf.now/1000)
  // bank robbery
  robberyBankId: null as number | null,
  robberyProgress: 0,
  robberyLockUntil: {} as Record<number, number>,
  // internal
  _lastHealth: playerState.health,
  _tSecs: 0,
};

export function districtOwner(d: District): Owner {
  return territoryState.owners[d];
}

export function playerHolds(d: District): boolean {
  return territoryState.owners[d] === PLAYER_GANG;
}

export function weaponDiscount(): number {
  return playerHolds("industrial") ? INDUSTRIAL_WEAPON_DISCOUNT : 0;
}

// Called from Player fire logic when the player kills an NPC.
export function onPlayerKill() {
  if (playerHolds("stadium")) addReputation(STADIUM_REP_PER_KILL * 2);
  else addReputation(STADIUM_REP_PER_KILL);
}

function labelFor(d: District) {
  return DISTRICT_LABELS.find((l) => l.district === d);
}

function setMessage(msg: string) {
  territoryState.captureMessage = msg;
  territoryState.captureMessageT = 3;
}

// ---- Per-frame tick ------------------------------------------------------
// Player.tsx calls this once per frame (already inside its useFrame).
export function tickTerritory(dt: number, playerX: number, playerZ: number) {
  const s = territoryState;
  s._tSecs += dt;

  // Fade capture toast.
  if (s.captureMessageT > 0) {
    s.captureMessageT = Math.max(0, s.captureMessageT - dt);
    if (s.captureMessageT === 0) s.captureMessage = null;
  }

  // Passive income from held districts.
  if (playerHolds("harbor")) earnMoney(HARBOR_INCOME_PER_SEC * dt);
  if (playerHolds("bank")) earnMoney(BANK_INCOME_PER_SEC * dt);
  if (playerHolds("stadium")) addReputation(STADIUM_REP_TICK * dt);

  // Damage reset (works for both capture + robbery channels).
  const damaged = playerState.health < s._lastHealth - 0.01;
  s._lastHealth = playerState.health;

  // ---- District capture channel ----
  let inZone: District | null = null;
  for (const lbl of DISTRICT_LABELS) {
    const d2 = Math.hypot(lbl.x - playerX, lbl.z - playerZ);
    if (d2 < CAPTURE_RADIUS) {
      inZone = lbl.district;
      break;
    }
  }
  if (inZone) {
    const owner = s.owners[inZone];
    const lockedUntil = s.lockUntil[inZone] ?? 0;
    if (owner === PLAYER_GANG) {
      s.captureDistrict = null;
      s.captureProgress = 0;
    } else if (s._tSecs < lockedUntil) {
      if (s.captureDistrict !== inZone) setMessage("District locked");
      s.captureDistrict = null;
      s.captureProgress = 0;
    } else {
      if (s.captureDistrict !== inZone) {
        s.captureDistrict = inZone;
        s.captureProgress = 0;
      }
      if (damaged) s.captureProgress = 0;
      else s.captureProgress = Math.min(CAPTURE_TIME, s.captureProgress + dt);
      if (s.captureProgress >= CAPTURE_TIME) {
        s.owners[inZone] = PLAYER_GANG;
        s.lockUntil[inZone] = s._tSecs + CAPTURE_LOCK;
        setMessage(`${labelFor(inZone)?.name ?? inZone.toUpperCase()} captured`);
        s.captureDistrict = null;
        s.captureProgress = 0;
      }
    }
  } else if (s.captureDistrict) {
    s.captureDistrict = null;
    s.captureProgress = 0;
  }

  // ---- Bank robbery channel ----
  let inVault: { id: number } | null = null;
  for (const b of ROBBABLE_BANKS) {
    const d2 = Math.hypot(b.x - playerX, b.z - playerZ);
    if (d2 < VAULT_RADIUS) { inVault = { id: b.id }; break; }
  }
  if (inVault) {
    const lockUntil = s.robberyLockUntil[inVault.id] ?? 0;
    // Guards must all be dead — imported lazily to avoid circular dep.
    const guardsAlive = anyGuardAliveForBank(inVault.id);
    if (s._tSecs < lockUntil || guardsAlive) {
      if (s.robberyBankId !== inVault.id) {
        setMessage(guardsAlive ? "Clear the guards first" : "Vault sealed");
      }
      s.robberyBankId = null;
      s.robberyProgress = 0;
    } else {
      if (s.robberyBankId !== inVault.id) {
        s.robberyBankId = inVault.id;
        s.robberyProgress = 0;
      }
      if (damaged) s.robberyProgress = 0;
      else s.robberyProgress = Math.min(ROBBERY_TIME, s.robberyProgress + dt);
      if (s.robberyProgress >= ROBBERY_TIME) {
        const payout = Math.floor(
          ROBBERY_MIN_PAYOUT + Math.random() * (ROBBERY_MAX_PAYOUT - ROBBERY_MIN_PAYOUT),
        );
        earnMoney(payout);
        s.robberyLockUntil[inVault.id] = s._tSecs + ROBBERY_COOLDOWN;
        setMessage(`Robbery success: +$${payout}`);
        s.robberyBankId = null;
        s.robberyProgress = 0;
      }
    }
  } else if (s.robberyBankId !== null) {
    s.robberyBankId = null;
    s.robberyProgress = 0;
  }
}

// Wired by guardState after import to break the module cycle.
let _guardsAliveForBank: (bankId: number) => boolean = () => false;
export function registerGuardsAliveForBank(fn: (bankId: number) => boolean) {
  _guardsAliveForBank = fn;
}
function anyGuardAliveForBank(bankId: number): boolean {
  return _guardsAliveForBank(bankId);
}
