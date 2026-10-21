import { db } from "../db";
import { PLAYER_GANG } from "../gangs";
import { ALL_DISTRICTS, districtHQ, districtLabel, type District } from "../worldData";
import { setBalance } from "../economy";
import { pushAlert } from "../alertState";
import { hash01 } from "../city/palette";
import { ROAD_LINES } from "../city/layout";

// The server decides all of this: 11:11 and 23:11 UTC, a 5-minute window.
export const PERIOD_MS = 43_200_000;
export const OFFSET_MS = 40_260_000;
export const WINDOW_MS = 300_000;
export const TOUCH_R = 4.5;
export const HEART_R = 8;
export const GLYPH_COUNT = 5;

// Add ?fracture=1 to the page address to preview the event any time (nothing is saved).
const PREVIEW = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("fracture");
let previewStart = Date.now();
const GANG_HQ_DISTRICT: District[] = ["downtown", "industrial", "shopping", "harbor"];

const mod = (n: number, m: number) => ((n % m) + m) % m;
export const bitCount = (m: number) => [0, 1, 2, 3, 4].filter((i) => m & (1 << i)).length;

export const fractureState = {
  synced: false,
  offsetMs: 0,
  slot: -1,
  district: "downtown" as District,
  startMs: 0,
  mask: 0,
  completed: false,
  completedSeenAt: 0,
  failed: false,
  myTouches: 0,
  claimed: false,
  flashUntil: 0, // performance.now() time until which the "11:11" flash shows
  version: 0,
};

type Status = {
  now_ms: number; slot: number; district: string; start_ms: number; active: boolean;
  mask: number; completed: boolean; failed: boolean; my_touches: number; claimed: boolean;
};
type TouchResult = { ok: boolean; newly?: boolean; reason?: string; mask?: number; completed?: boolean };

type Client = { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };
const client = () => db() as unknown as Client;

export function fractureNow() {
  return Date.now() + fractureState.offsetMs;
}

export function fractureSchedule(nowMs: number) {
  if (PREVIEW) {
    const t = nowMs - previewStart;
    const d = GANG_HQ_DISTRICT[PLAYER_GANG];
    return {
      slot: -777, startMs: previewStart, active: t < WINDOW_MS, msLeft: Math.max(0, WINDOW_MS - t),
      nextStartMs: previewStart + WINDOW_MS + 5000, district: d, nextDistrict: d,
    };
  }
  const slot = Math.floor((nowMs - OFFSET_MS) / PERIOD_MS);
  const startMs = slot * PERIOD_MS + OFFSET_MS;
  const t = nowMs - startMs;
  const active = t < WINDOW_MS;
  return {
    slot, startMs, active,
    msLeft: active ? WINDOW_MS - t : 0,
    nextStartMs: active ? startMs : startMs + PERIOD_MS,
    district: ALL_DISTRICTS[mod(slot, 13)],
    nextDistrict: ALL_DISTRICTS[mod(slot + (active ? 0 : 1), 13)],
  };
}

type Layout = { chamber: { x: number; z: number }; glyphs: { x: number; z: number }[] };
const layoutCache = new Map<string, Layout>();

/** Chamber at the crossing beside the district's Hall; four glyphs at crossings around it; the heart in the chamber. */
export function fractureLayout(slot: number, district: District): Layout {
  const key = `${slot}:${district}`;
  const hit = layoutCache.get(key);
  if (hit) return hit;

  const hq = districtHQ(district);
  const chamber = { x: hq.x + 32, z: hq.z + 32 };
  const cands: { x: number; z: number; d: number; s: number }[] = [];
  for (let i = 0; i < ROAD_LINES.length; i++) {
    for (let j = 0; j < ROAD_LINES.length; j++) {
      const x = ROAD_LINES[i];
      const z = ROAD_LINES[j];
      cands.push({ x, z, d: Math.hypot(x - chamber.x, z - chamber.z), s: hash01(i + slot * 0.37, j, 401) });
    }
  }
  const pick = (minD: number, maxD: number, sep: number) => {
    const out: { x: number; z: number }[] = [];
    const pool = cands.filter((c) => c.d >= minD && c.d <= maxD).sort((a, b) => a.s - b.s);
    for (const c of pool) {
      if (out.length >= 4) break;
      if (out.every((o) => Math.hypot(o.x - c.x, o.z - c.z) >= sep)) out.push({ x: c.x, z: c.z });
    }
    return out;
  };
  let g = pick(55, 170, 55);
  if (g.length < 4) g = pick(40, 300, 40);
  if (g.length < 4) g = pick(30, 600, 30);
  const pads = [[64, 64], [-64, 64], [64, -64], [-64, -64]];
  while (g.length < 4) {
    const p = pads[g.length];
    g.push({ x: chamber.x + p[0], z: chamber.z + p[1] });
  }
  const layout = { chamber, glyphs: [...g, chamber] };
  layoutCache.set(key, layout);
  return layout;
}

export function fractureLive(): boolean {
  if (!fractureState.synced || fractureState.completed) return false;
  const sc = fractureSchedule(fractureNow());
  return sc.active && fractureState.slot === sc.slot;
}

/** A glyph can be lit when it is not lit yet, and (for the heart) the other four are. */
export function glyphAvailable(i: number): boolean {
  const m = fractureState.mask;
  if (m & (1 << i)) return false;
  if (i === 4 && (m & 15) !== 15) return false;
  return true;
}

/** Everything the minimap and HUD need about the live event, or null. */
export function fracturePoints(): { x: number; z: number; lit: boolean; available: boolean; heart: boolean }[] | null {
  if (!fractureLive()) return null;
  const sc = fractureSchedule(fractureNow());
  const layout = fractureLayout(sc.slot, sc.district);
  return layout.glyphs.map((p, i) => ({
    x: p.x, z: p.z, lit: !!(fractureState.mask & (1 << i)), available: glyphAvailable(i), heart: i === 4,
  }));
}

let announced = -1;
let doneAnnounced = -1;
let failAnnounced = -1;
let claimTried = -1;

async function claim(slot: number) {
  const { data, error } = await client().rpc("fracture_claim", { p_slot: slot });
  if (error) {
    console.error("[fracture] claim failed", error);
    claimTried = -1;
    return;
  }
  const r = data as { ok: boolean; reward: number; balance?: number };
  if (r.ok && r.reward > 0) {
    if (typeof r.balance === "number") setBalance(r.balance); // the server has already paid you
    fractureState.claimed = true;
    fractureState.version++;
    pushAlert(`+${r.reward} Echoes from the Fracture`);
  }
}

function applyStatus(s: Status) {
  if (s.slot !== fractureState.slot) {
    fractureState.completed = false;
    fractureState.failed = false;
    fractureState.claimed = false;
    fractureState.myTouches = 0;
    fractureState.mask = 0;
  }
  fractureState.slot = s.slot;
  fractureState.district = s.district as District;
  fractureState.startMs = s.start_ms;
  fractureState.mask = s.mask;
  fractureState.myTouches = s.my_touches;
  fractureState.claimed = s.claimed;
  if (s.completed && !fractureState.completed) fractureState.completedSeenAt = performance.now();
  fractureState.completed = s.completed;
  fractureState.failed = s.failed;
  fractureState.version++;

  if (s.active && !s.completed && !s.failed && announced !== s.slot) {
    announced = s.slot;
    fractureState.flashUntil = performance.now() + 3200;
    pushAlert(`11:11. The city fractures in ${districtLabel(fractureState.district)}. Light the five glyphs together.`, "warn");
  }
  if (s.completed && doneAnnounced !== s.slot) {
    doneAnnounced = s.slot;
    pushAlert("The fracture closes. Every realm is blessed for 10 minutes.");
  }
  if (s.failed && failAnnounced !== s.slot) {
    failAnnounced = s.slot;
    pushAlert("The fracture seals. The glyphs fade.", "warn");
  }
  if ((s.completed || s.failed) && fractureState.myTouches > 0 && !s.claimed && claimTried !== s.slot) {
    claimTried = s.slot;
    void claim(s.slot);
  }
}

async function poll() {
  const t0 = Date.now();
  const { data, error } = await client().rpc("fracture_status");
  const t1 = Date.now();
  if (error || !data) {
    console.error("[fracture] status failed", error);
    return;
  }
  const s = data as Status;
  fractureState.offsetMs = s.now_ms - (t0 + t1) / 2;
  fractureState.synced = true;
  applyStatus(s);
}

const cooldown = new Map<number, number>();

async function sendTouch(i: number) {
  const { data, error } = await client().rpc("fracture_touch", { p_slot: fractureState.slot, p_glyph: i });
  if (error) {
    console.error("[fracture] touch failed", error);
    return;
  }
  const r = data as TouchResult;
  if (r.mask !== undefined) {
    fractureState.mask = r.mask;
    fractureState.version++;
  }
  if (r.ok && r.newly) {
    fractureState.myTouches++;
    pushAlert(`Glyph lit (${bitCount(fractureState.mask)}/${GLYPH_COUNT})`);
  } else if (r.reason === "locked") {
    cooldown.set(i, performance.now() + 6000);
    pushAlert("The heart glyph is sealed. Light the other four first.", "warn");
  }
  if (r.completed) await poll();
}

function previewTouch(i: number) {
  if (!glyphAvailable(i)) {
    if (i === 4 && !(fractureState.mask & 16)) pushAlert("The heart glyph is sealed. Light the other four first.", "warn");
    return;
  }
  fractureState.mask |= 1 << i;
  fractureState.myTouches++;
  fractureState.version++;
  pushAlert(`Glyph lit (${bitCount(fractureState.mask)}/${GLYPH_COUNT})`);
  if (fractureState.mask === 31) {
    fractureState.completed = true;
    fractureState.completedSeenAt = performance.now();
    pushAlert("Preview: the fracture closes. Nothing is saved.");
  }
}

/** Called by the 3D scene when the player stands on a glyph. */
export function touchGlyph(i: number) {
  const nowP = performance.now();
  if ((cooldown.get(i) ?? 0) > nowP) return;
  cooldown.set(i, nowP + 2500);
  if (PREVIEW) previewTouch(i);
  else void sendTouch(i);
}

function startPreview(): () => void {
  const respawn = () => {
    previewStart = Date.now();
    fractureState.mask = 0;
    fractureState.completed = false;
    fractureState.failed = false;
    fractureState.myTouches = 0;
    fractureState.district = GANG_HQ_DISTRICT[PLAYER_GANG];
    fractureState.flashUntil = performance.now() + 3200;
  };
  fractureState.synced = true;
  fractureState.offsetMs = 0;
  fractureState.slot = -777;
  respawn();
  pushAlert("Fracture preview: the glyphs are open now. Nothing is saved.", "warn");
  const id = setInterval(() => {
    fractureState.district = GANG_HQ_DISTRICT[PLAYER_GANG];
    if (fractureState.completed && performance.now() - fractureState.completedSeenAt > 10_000) respawn();
    if (!fractureState.completed && !fractureSchedule(Date.now()).active) respawn();
    fractureState.version++;
  }, 400);
  return () => clearInterval(id);
}

/** Starts the event loop for the lifetime of the game scene. Returns a stop function. */
export function startFractureSync(): () => void {
  if (PREVIEW) return startPreview();
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const loop = async () => {
    if (stopped) return;
    try {
      await poll();
    } catch (e) {
      console.error("[fracture] sync error", e);
    }
    const sc = fractureSchedule(fractureNow());
    const fast = sc.active || sc.nextStartMs - fractureNow() < 15_000;
    timer = setTimeout(loop, fast ? 2000 : 10_000);
  };
  void loop();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}