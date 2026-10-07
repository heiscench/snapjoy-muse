// District ownership + capture channel state. Also drives passive income and
// weapon-cost discounts via the economy system.
//
// Multiplayer note: ownership + lock timers are now SHARED state. Locks are
// stored as absolute epoch-ms so they mean the same thing on every client.
// Capture/robbery *progress* stays local to whoever is channeling.
import { PLAYER_GANG, type GangId, GANGS } from "./gangs";
import {
  ALL_DISTRICTS,
  CAPTURE_RADIUS,
  DISTRICT_LABELS,
  ROBBABLE_BANKS,
  VAULT_RADIUS,
  districtAt,
  districtLabel,
  type District,
} from "./worldData";
import {
  playerState,
  earnMoney,
  addReputation,
  STADIUM_REP_PER_KILL,
} from "./playerState";
import { pushAlert } from "./alertState";

export const CAPTURE_TIME = 30;
export const CAPTURE_LOCK = 5 * 60;
export const HARBOR_INCOME_PER_SEC = 2;
export const BANK_INCOME_PER_SEC = 3;
export const INDUSTRIAL_WEAPON_DISCOUNT = 0.25;
export const STADIUM_REP_TICK = 0.15;

export const ROBBERY_TIME = 30;
export const ROBBERY_COOLDOWN = 10 * 60;
/** Bank/neutral guards return quickly so a robbery is hard, not hopeless. */
export const GUARD_RESPAWN = 30;
export const ROBBERY_MIN_PAYOUT = 2000;
export const ROBBERY_MAX_PAYOUT = 4000;

/** Seconds the "you entered X" popup stays on screen. */
export const DISTRICT_TOAST_SECS = 5;

// How often (seconds) a capture-in-progress re-announces itself to the
// defending gang, so late joiners still get warned.
export const ATTACK_ALERT_INTERVAL = 20;

export type Owner = GangId | null;

const INITIAL_OWNERS: Record<District, Owner> = (() => {
  const base = {} as Record<District, Owner>;
  for (const d of ALL_DISTRICTS) base[d] = null;
  base.downtown = 0;
  base.industrial = 1;
  base.shopping = 2;
  base.harbor = 3;
  return base;
})();

export const territoryState = {
  owners: { ...INITIAL_OWNERS } as Record<District, Owner>,
  captureDistrict: null as District | null,
  captureProgress: 0,
  captureMessage: null as string | null,
  captureMessageT: 0,
  // epoch-ms values, shared across clients
  lockUntil: {} as Partial<Record<District, number>>,
  robberyBankId: null as number | null,
  robberyProgress: 0,
  robberyLockUntil: {} as Record<number, number>,
  currentDistrict: null as District | null,
  _lastHealth: playerState.health,
  _tSecs: 0,
  _attackAlertT: 0,
};

// ---- Multiplayer hooks (registered by worldSync.ts) -----------------------
type CaptureHook = (district: District, owner: GangId, lockUntilMs: number) => void;
type RobberyHook = (bankId: number, lockUntilMs: number) => void;
type AttackHook = (district: District, defendingGang: GangId) => void;
/** Fired whenever a district's owner changes, locally or remotely. */
type OwnerChangedHook = (district: District, owner: Owner) => void;

let _onCaptured: CaptureHook = () => {};
let _onRobbed: RobberyHook = () => {};
let _onAttackStarted: AttackHook = () => {};
const _ownerChangedHooks: OwnerChangedHook[] = [];
const _onOwnerChanged: OwnerChangedHook = (d, o) => {
  for (const fn of _ownerChangedHooks) fn(d, o);
};

export function registerTerritoryHooks(hooks: {
  onCaptured?: CaptureHook;
  onRobbed?: RobberyHook;
  onAttackStarted?: AttackHook;
}) {
  if (hooks.onCaptured) _onCaptured = hooks.onCaptured;
  if (hooks.onRobbed) _onRobbed = hooks.onRobbed;
  if (hooks.onAttackStarted) _onAttackStarted = hooks.onAttackStarted;
}

/** Registered by npcState (district defenders) and guardState (guard re-skin). */
export function registerOwnerChangedHook(fn: OwnerChangedHook) {
  _ownerChangedHooks.push(fn);
}

/** Applied when the shared world state says a district changed hands. */
export function applyRemoteOwner(district: District, owner: Owner, lockUntilMs: number | null) {
  const prev = territoryState.owners[district];
  territoryState.owners[district] = owner;
  if (lockUntilMs) territoryState.lockUntil[district] = lockUntilMs;
  if (prev !== owner) _onOwnerChanged(district, owner);
  if (prev !== owner && territoryState.captureDistrict === district) {
    // Someone else finished first — our channel resets.
    territoryState.captureDistrict = null;
    territoryState.captureProgress = 0;
  }
}

export function applyRemoteBankLock(bankId: number, lockUntilMs: number | null) {
  if (lockUntilMs) territoryState.robberyLockUntil[bankId] = lockUntilMs;
  if (territoryState.robberyBankId === bankId) {
    territoryState.robberyBankId = null;
    territoryState.robberyProgress = 0;
  }
}

export function districtOwner(d: District): Owner {
  return territoryState.owners[d];
}

export function playerHolds(d: District): boolean {
  return territoryState.owners[d] === PLAYER_GANG;
}

export function weaponDiscount(): number {
  return playerHolds("industrial") ? INDUSTRIAL_WEAPON_DISCOUNT : 0;
}

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

function announceDistrict(d: District) {
  const owner = territoryState.owners[d];
  const name = districtLabel(d);
  if (owner === null || owner === undefined) {
    pushAlert(`${name} — forgotten`, "info", DISTRICT_TOAST_SECS);
  } else if (owner === PLAYER_GANG) {
    pushAlert(`${name} — remembered by your faction`, "info", DISTRICT_TOAST_SECS);
  } else {
    pushAlert(`${name} — remembered by ${GANGS[owner].name}`, "warn", DISTRICT_TOAST_SECS);
  }
}

export function tickTerritory(dt: number, playerX: number, playerZ: number) {
  const s = territoryState;
  s._tSecs += dt;
  const nowMs = Date.now();

  // ---- District entry popup ----------------------------------------------
  const here = districtAt(playerX, playerZ);
  if (here !== s.currentDistrict) {
    s.currentDistrict = here;
    announceDistrict(here);
  }

  if (s.captureMessageT > 0) {
    s.captureMessageT = Math.max(0, s.captureMessageT - dt);
    if (s.captureMessageT === 0) s.captureMessage = null;
  }

  if (playerHolds("harbor")) earnMoney(HARBOR_INCOME_PER_SEC * dt);
  if (playerHolds("bank")) earnMoney(BANK_INCOME_PER_SEC * dt);
  if (playerHolds("stadium")) addReputation(STADIUM_REP_TICK * dt);

  const damaged = playerState.health < s._lastHealth - 0.01;
  s._lastHealth = playerState.health;

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
    } else if (nowMs < lockedUntil) {
      if (s.captureDistrict !== inZone) setMessage("Memory zone sealed");
      s.captureDistrict = null;
      s.captureProgress = 0;
    } else {
      if (s.captureDistrict !== inZone) {
        s.captureDistrict = inZone;
        s.captureProgress = 0;
        s._attackAlertT = 0;
      }
      if (damaged) s.captureProgress = 0;
      else s.captureProgress = Math.min(CAPTURE_TIME, s.captureProgress + dt);

      // Warn the defending gang that their turf is being taken.
      if (owner !== null && owner !== PLAYER_GANG) {
        s._attackAlertT -= dt;
        if (s._attackAlertT <= 0) {
          s._attackAlertT = ATTACK_ALERT_INTERVAL;
          _onAttackStarted(inZone, owner);
        }
      }

      if (s.captureProgress >= CAPTURE_TIME) {
        const lockUntilMs = nowMs + CAPTURE_LOCK * 1000;
        s.owners[inZone] = PLAYER_GANG;
        s.lockUntil[inZone] = lockUntilMs;
        setMessage(`${labelFor(inZone)?.name ?? inZone.toUpperCase()} remembered`);
        _onOwnerChanged(inZone, PLAYER_GANG);
        _onCaptured(inZone, PLAYER_GANG, lockUntilMs);
        s.captureDistrict = null;
        s.captureProgress = 0;
      }
    }
  } else if (s.captureDistrict) {
    s.captureDistrict = null;
    s.captureProgress = 0;
  }

  let inVault: { id: number } | null = null;
  for (const b of ROBBABLE_BANKS) {
    const d2 = Math.hypot(b.x - playerX, b.z - playerZ);
    if (d2 < VAULT_RADIUS) { inVault = { id: b.id }; break; }
  }
  if (inVault) {
    const lockUntil = s.robberyLockUntil[inVault.id] ?? 0;
    const guardsAlive = anyGuardAliveForBank(inVault.id);
    if (nowMs < lockUntil || guardsAlive) {
      if (s.robberyBankId !== inVault.id) {
        setMessage(guardsAlive ? "The Sentinels still remember" : "Relic sealed");
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
        const lockUntilMs = nowMs + ROBBERY_COOLDOWN * 1000;
        s.robberyLockUntil[inVault.id] = lockUntilMs;
        setMessage(`Relic raid complete: +◈ ${payout}`);
        pushAlert(`Memory unearthed — +◈ ${payout}`);
        _onRobbed(inVault.id, lockUntilMs);
        s.robberyBankId = null;
        s.robberyProgress = 0;
      }
    }
  } else if (s.robberyBankId !== null) {
    s.robberyBankId = null;
    s.robberyProgress = 0;
  }
}

let _guardsAliveForBank: (bankId: number) => boolean = () => false;
export function registerGuardsAliveForBank(fn: (bankId: number) => boolean) {
  _guardsAliveForBank = fn;
}
function anyGuardAliveForBank(bankId: number): boolean {
  return _guardsAliveForBank(bankId);
}
