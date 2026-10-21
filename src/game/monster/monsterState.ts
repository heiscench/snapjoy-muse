import { db } from "../db";
import { PLAYER_GANG } from "../gangs";
import { GANG_HQ } from "../worldData";
import { modifiers } from "../playerState";
import { setBalance } from "../economy";
import { pushAlert } from "../alertState";
import { THEMES } from "../city/palette";
import { warEffect } from "../war/warState";

// The server decides all of this: a monster every 20 minutes (at :00, :20 and :40 UTC),
// rotating through the four kingdoms, for a 4-minute window.
export const SLOT_MS = 1_200_000;
export const WINDOW_MS = 240_000;
export const ARRIVE_S = 150; // seconds for it to walk from the edge to the Hall
export const MONSTER_NAME = "The Ashen Wraith";
export const PULSE_S = 3;
export const PULSE_R = 30;
export const PULSE_DAMAGE = 14;
export const SCALE = 2.2;
const SPAWN_DIST = 230;
const HOVER = 6; // it rises out of the ground, so players can reach it with normal aim
const HIT_Y = 14; // hitbox centre height
const HIT_R = 24; // hitbox radius

const KINGDOM_NAME = THEMES.map((t) => t.name);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// Add ?monster=1 to the page address to preview the Wraith any time (nothing is saved).
const PREVIEW = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("monster");
let previewStart = Date.now();

export const monsterState = {
  synced: false,
  offsetMs: 0, // server clock minus this device's clock
  slot: -1,
  kingdom: 0,
  startMs: 0,
  hp: 5000,
  maxHp: 5000,
  defeated: false,
  defeatedSeenAt: 0,
  failed: false,
  myDamage: 0,
  claimed: false,
  pending: 0, // damage dealt but not yet reported
  power: [0, 0, 0, 0],
  blessUntil: [0, 0, 0, 0],
  curseUntil: [0, 0, 0, 0],
  version: 0,
};

type Status = {
  now_ms: number; slot: number; kingdom: number; start_ms: number; active: boolean;
  hp: number; max_hp: number; defeated: boolean; failed: boolean;
  my_damage: number; claimed: boolean;
  kingdoms: { kingdom: number; power: number; blessing_ms: number; curse_ms: number }[];
};
type HitResult = { ok: boolean; hp?: number; max_hp?: number; defeated?: boolean; my_damage?: number };

type Client = { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };
const client = () => db() as unknown as Client;

export function serverNow() {
  return Date.now() + monsterState.offsetMs;
}

export function schedule(nowMs: number) {
  if (PREVIEW) {
    const t = nowMs - previewStart;
    return {
      slot: -999,
      kingdom: PLAYER_GANG as number,
      startMs: previewStart,
      active: t < WINDOW_MS,
      msLeft: Math.max(0, WINDOW_MS - t),
      nextStartMs: previewStart + WINDOW_MS + 5000,
      nextKingdom: PLAYER_GANG as number,
    };
  }
  const slot = Math.floor(nowMs / SLOT_MS);
  const startMs = slot * SLOT_MS;
  const t = nowMs - startMs;
  const active = t < WINDOW_MS;
  return {
    slot,
    kingdom: slot % 4,
    startMs,
    active,
    msLeft: active ? WINDOW_MS - t : 0,
    nextStartMs: active ? startMs : startMs + SLOT_MS,
    nextKingdom: active ? slot % 4 : (slot + 1) % 4,
  };
}

/** Where the Wraith is: the same for everyone, worked out from the server clock. */
export function monsterPose(nowMs: number) {
  const sc = schedule(nowMs);
  const kingdom = sc.kingdom;
  const hq = GANG_HQ[kingdom as 0 | 1 | 2 | 3];
  const len = Math.hypot(hq.x, hq.z) || 1;
  const sx = clamp(hq.x + (hq.x / len) * SPAWN_DIST, -520, 520);
  const sz = clamp(hq.z + (hq.z / len) * SPAWN_DIST, -520, 520);
  const t = Math.max(0, (nowMs - sc.startMs) / 1000);
  const p = clamp(t / ARRIVE_S, 0, 1);
  const arrived = p >= 1;
  let x = sx + (hq.x - sx) * p;
  let z = sz + (hq.z - sz) * p;
  let yaw = Math.atan2(hq.x - sx, hq.z - sz);
  if (arrived) {
    const a = (t - ARRIVE_S) * 0.25;
    const r = Math.min(10, (t - ARRIVE_S) * 2);
    x = hq.x + Math.cos(a) * r;
    z = hq.z + Math.sin(a) * r;
    yaw += Math.sin(t * 0.3) * 0.6;
  }
  return { x, z, y: HOVER + Math.sin(t * 0.8) * 1.2, yaw, arrived, kingdom, t };
}

export function canFight(): boolean {
  if (!monsterState.synced || monsterState.defeated) return false;
  const sc = schedule(serverNow());
  return sc.active && monsterState.slot === sc.slot;
}

/** Hitbox for shooting; null when there is nothing to shoot. */
export function monsterTarget(): { x: number; y: number; z: number; r: number; kingdom: number } | null {
  if (!canFight()) return null;
  const p = monsterPose(serverNow());
  return { x: p.x, y: HIT_Y, z: p.z, r: HIT_R, kingdom: p.kingdom };
}

/** Called by the shooting code whenever a bullet hits the Wraith. */
export function damageMonster(amount: number) {
  if (!canFight() || amount <= 0) return;
  monsterState.hp = Math.max(0, monsterState.hp - amount);
  monsterState.pending += amount;
  monsterState.myDamage += amount;
  monsterState.version++;
}

export function kingdomEffect(k: number): "blessed" | "cursed" | null {
  const now = serverNow();
  if (monsterState.blessUntil[k] > now) return "blessed";
  if (monsterState.curseUntil[k] > now) return "cursed";
  return null;
}

function applyModifiers() {
  const fx = kingdomEffect(PLAYER_GANG);
  if (fx === "blessed") {
    modifiers.earn = 1.25;
    modifiers.damageTaken = 0.85;
  } else if (fx === "cursed") {
    modifiers.earn = 0.8;
    modifiers.damageTaken = 1;
  } else {
    modifiers.earn = 1;
    modifiers.damageTaken = 1;
  }
  // The war standing adds on top (Ascendant earns more; Humbled earns less but takes less damage).
  const war = warEffect(PLAYER_GANG);
  modifiers.earn *= war.earn;
  modifiers.damageTaken *= war.damageTaken;
}

let announced = -1;
let defeatAnnounced = -1;
let failAnnounced = -1;
let claimTried = -1;

async function claim(slot: number) {
  const { data, error } = await client().rpc("monster_claim", { p_slot: slot });
  if (error) {
    console.error("[monster] claim failed", error);
    claimTried = -1;
    return;
  }
  const r = data as { ok: boolean; reward: number; balance?: number };
  if (r.ok && r.reward > 0) {
    if (typeof r.balance === "number") setBalance(r.balance); // the server has already paid you
    monsterState.claimed = true;
    monsterState.version++;
    pushAlert(`+${r.reward} Echoes for fighting ${MONSTER_NAME}`);
  }
}

function applyStatus(s: Status) {
  if (s.slot !== monsterState.slot) {
    monsterState.pending = 0;
    monsterState.defeated = false;
    monsterState.failed = false;
    monsterState.claimed = false;
    monsterState.myDamage = 0;
  }
  monsterState.slot = s.slot;
  monsterState.kingdom = s.kingdom;
  monsterState.startMs = s.start_ms;
  monsterState.maxHp = s.max_hp > 0 ? s.max_hp : 5000;
  monsterState.hp = Math.max(0, s.hp - monsterState.pending);
  monsterState.myDamage = s.my_damage + monsterState.pending;
  monsterState.claimed = s.claimed;
  if (s.defeated && !monsterState.defeated) monsterState.defeatedSeenAt = performance.now();
  monsterState.defeated = s.defeated;
  monsterState.failed = s.failed;
  for (const k of s.kingdoms ?? []) {
    monsterState.power[k.kingdom] = k.power;
    monsterState.blessUntil[k.kingdom] = k.blessing_ms ?? 0;
    monsterState.curseUntil[k.kingdom] = k.curse_ms ?? 0;
  }
  monsterState.version++;

  const name = KINGDOM_NAME[s.kingdom];
  if (s.active && !s.defeated && !s.failed && announced !== s.slot) {
    announced = s.slot;
    pushAlert(`${MONSTER_NAME} attacks the realm of the ${name}! Hunt it down.`, "warn");
  }
  if (s.defeated && defeatAnnounced !== s.slot) {
    defeatAnnounced = s.slot;
    pushAlert(`${MONSTER_NAME} is destroyed! The ${name} are blessed.`);
  }
  if (s.failed && failAnnounced !== s.slot) {
    failAnnounced = s.slot;
    pushAlert(`${MONSTER_NAME} reached the Hall. The ${name} are cursed for a while.`, "warn");
  }
  if (s.defeated && monsterState.myDamage > 0 && !s.claimed && claimTried !== s.slot) {
    claimTried = s.slot;
    void claim(s.slot);
  }
}

async function poll() {
  const t0 = Date.now();
  const { data, error } = await client().rpc("monster_status");
  const t1 = Date.now();
  if (error || !data) {
    console.error("[monster] status failed", error);
    return;
  }
  const s = data as Status;
  monsterState.offsetMs = s.now_ms - (t0 + t1) / 2;
  monsterState.synced = true;
  applyStatus(s);
}

async function flush() {
  const send = Math.min(Math.floor(monsterState.pending), 1500);
  if (send <= 0 || monsterState.slot < 0) return;
  monsterState.pending -= send;
  const { data, error } = await client().rpc("monster_hit", { p_slot: monsterState.slot, p_damage: send });
  if (error) {
    monsterState.pending += send;
    console.error("[monster] hit failed", error);
    return;
  }
  const r = data as HitResult;
  if (!r.ok) {
    monsterState.pending = 0;
    return;
  }
  monsterState.maxHp = r.max_hp ?? monsterState.maxHp;
  monsterState.hp = Math.max(0, (r.hp ?? monsterState.hp) - monsterState.pending);
  monsterState.myDamage = (r.my_damage ?? 0) + monsterState.pending;
  monsterState.version++;
  if (r.defeated) await poll(); // runs the victory messages and the reward claim
}

/** Preview mode: a local Wraith for testing. No server, nothing saved. */
function startPreview(): () => void {
  const respawn = () => {
    previewStart = Date.now();
    monsterState.defeated = false;
    monsterState.hp = monsterState.maxHp = 5000;
    monsterState.myDamage = 0;
    monsterState.pending = 0;
    monsterState.startMs = previewStart;
  };
  monsterState.synced = true;
  monsterState.offsetMs = 0;
  monsterState.slot = -999;
  monsterState.kingdom = PLAYER_GANG;
  respawn();
  pushAlert("Monster preview: the Wraith appears now. Nothing is saved.", "warn");

  const id = setInterval(() => {
    monsterState.kingdom = PLAYER_GANG;
    monsterState.pending = 0;
    if (!monsterState.defeated && monsterState.hp <= 0) {
      monsterState.defeated = true;
      monsterState.defeatedSeenAt = performance.now();
      pushAlert("Preview: the Wraith is destroyed. It returns in 8 seconds.");
    }
    if (monsterState.defeated && performance.now() - monsterState.defeatedSeenAt > 8000) respawn();
    if (!monsterState.defeated && !schedule(Date.now()).active) respawn();
    monsterState.version++;
  }, 300);
  return () => clearInterval(id);
}

/** Starts the hunt loop for the lifetime of the game scene. Returns a stop function. */
export function startMonsterSync(): () => void {
  if (PREVIEW) return startPreview();
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const loop = async () => {
    if (stopped) return;
    try {
      if (monsterState.pending > 0 && canFight()) await flush();
      else await poll();
    } catch (e) {
      console.error("[monster] sync error", e);
    }
    applyModifiers();
    const sc = schedule(serverNow());
    const fast = sc.active || sc.nextStartMs - serverNow() < 15_000;
    timer = setTimeout(loop, fast ? 1500 : 6000);
  };
  void loop();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}