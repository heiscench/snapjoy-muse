import { db } from "../db";
import { PLAYER_GANG } from "../gangs";
import { pushAlert } from "../alertState";

export type WarKind = "player_kill" | "npc_kill" | "capture" | "raid";
export const WAR_POINTS: Record<WarKind, number> = { player_kill: 10, npc_kill: 1, capture: 25, raid: 15 };
export type WarRole = "ascendant" | "humbled" | null;

type Row = { score: number; player_kills: number; captures: number; raids: number };
const emptyRow = (): Row => ({ score: 0, player_kills: 0, captures: 0, raids: 0 });

export const warState = {
  synced: false,
  offsetMs: 0,
  week: 0,
  weekEndMs: 0,
  scores: [emptyRow(), emptyRow(), emptyRow(), emptyRow()],
  lastWeek: [0, 0, 0, 0],
  top: [] as { username: string; kingdom: number; points: number }[],
  myPoints: 0,
  version: 0,
};

type Status = {
  now_ms: number; week: number; week_end_ms: number;
  scores: { kingdom: number; score: number; player_kills: number; captures: number; raids: number }[];
  last_week: { kingdom: number; score: number }[];
  top: { username: string; kingdom: number; points: number }[];
  my_points: number;
};
type Client = { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };
const client = () => db() as unknown as Client;

export function warNow() {
  return Date.now() + warState.offsetMs;
}

/** Kingdoms from first to last place. */
export function warOrder(): number[] {
  const sc = warState.scores.map((s) => s.score);
  return [0, 1, 2, 3].sort((a, b) => sc[b] - sc[a]);
}

export function warRank(kingdom: number): number {
  return warOrder().indexOf(kingdom) + 1;
}

/** The leader with a clear lead is Ascendant; a kingdom clearly behind is Humbled. */
export function warRoleOf(kingdom: number): WarRole {
  const sc = warState.scores.map((s) => s.score);
  const o = warOrder();
  if (sc[o[0]] < 100) return null; // the war has barely started
  if (kingdom === o[0] && sc[o[0]] > sc[o[1]] * 1.1) return "ascendant";
  if (kingdom === o[3] && sc[o[3]] < sc[o[2]] * 0.9) return "humbled";
  return null;
}

/** Multipliers from the war standing: Ascendant earns more; Humbled earns less but takes less damage (Last Stand). */
export function warEffect(kingdom: number): { earn: number; damageTaken: number } {
  const r = warRoleOf(kingdom);
  if (r === "ascendant") return { earn: 1.1, damageTaken: 1 };
  if (r === "humbled") return { earn: 0.9, damageTaken: 0.85 };
  return { earn: 1, damageTaken: 1 };
}

const pending = { pk: 0, nk: 0, cap: 0, raid: 0 };

/** Called whenever something happens that counts in the war. Reported to the server in batches. */
export function warRecord(kind: WarKind) {
  if (kind === "player_kill") pending.pk++;
  else if (kind === "npc_kill") pending.nk++;
  else if (kind === "capture") pending.cap++;
  else pending.raid++;
  // Show it on the scoreboard straight away; the server confirms on the next sync.
  warState.scores[PLAYER_GANG].score += WAR_POINTS[kind];
  warState.myPoints += WAR_POINTS[kind];
  warState.version++;
}

async function flush() {
  if (pending.pk + pending.nk + pending.cap + pending.raid === 0) return;
  const send = { ...pending };
  pending.pk = pending.nk = pending.cap = pending.raid = 0;
  const { error } = await client().rpc("war_report", {
    p_pk: send.pk, p_nk: send.nk, p_cap: send.cap, p_raid: send.raid,
  });
  if (error) {
    pending.pk += send.pk;
    pending.nk += send.nk;
    pending.cap += send.cap;
    pending.raid += send.raid;
    console.error("[war] report failed", error);
  }
}

let lastRole: WarRole | undefined;

async function poll() {
  const t0 = Date.now();
  const { data, error } = await client().rpc("war_status");
  const t1 = Date.now();
  if (error || !data) {
    console.error("[war] status failed", error);
    return;
  }
  const s = data as Status;
  warState.offsetMs = s.now_ms - (t0 + t1) / 2;
  warState.week = s.week;
  warState.weekEndMs = s.week_end_ms;
  for (const r of s.scores ?? []) warState.scores[r.kingdom] = {
    score: r.score, player_kills: r.player_kills, captures: r.captures, raids: r.raids,
  };
  for (const r of s.last_week ?? []) warState.lastWeek[r.kingdom] = r.score;
  warState.top = s.top ?? [];
  warState.myPoints = s.my_points;
  warState.synced = true;
  warState.version++;

  const role = warRoleOf(PLAYER_GANG);
  if (lastRole !== undefined && role !== lastRole) {
    if (role === "ascendant") pushAlert("Your kingdom is Ascendant: +10% Echoes.");
    else if (role === "humbled") pushAlert("Your kingdom is Humbled: −10% Echoes, but you take 15% less damage.", "warn");
    else pushAlert("Your kingdom's war standing returns to normal.");
  }
  lastRole = role;
}

/** Starts the war loop for the lifetime of the game scene. Returns a stop function. */
export function startWarSync(): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const loop = async () => {
    if (stopped) return;
    try {
      await flush();
      await poll();
    } catch (e) {
      console.error("[war] sync error", e);
    }
    timer = setTimeout(loop, 10_000);
  };
  void loop();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}