import { db } from "./db";
import { authState } from "./authState";
import { modifiers, playerState } from "./playerState";

// The server holds every player's Echoes. The game only REPORTS what happened and shows
// the server's balance (plus an estimate for beings not reported yet).
const BOUNTY = 50;

type Client = { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };
const client = () => db() as unknown as Client;

let unsentKills = 0;

function showBalance(serverBalance: number) {
  playerState.money = Math.max(0, Math.floor(serverBalance + unsentKills * BOUNTY * modifiers.earn));
}

/** Set the displayed Echoes from a balance the server just returned. */
export function setBalance(balance: number) {
  showBalance(balance);
}

/** A being was unmade. Only the count is sent; the server decides the payout and the limits. */
export function recordNpcKill() {
  unsentKills++;
  playerState.money += Math.floor(BOUNTY * modifiers.earn); // shown at once, confirmed by the next sync
}

let syncing = false;

export async function syncEconomy() {
  if (syncing || !authState.userId) return;
  syncing = true;
  const send = Math.min(unsentKills, 30);
  unsentKills -= send;
  try {
    const { data, error } = await client().rpc("economy_sync", { p_npc_kills: send });
    if (error) {
      unsentKills += send;
      console.error("[economy] sync failed", error);
      return;
    }
    const r = data as { ok: boolean; balance?: number };
    if (r.ok && typeof r.balance === "number") showBalance(r.balance);
  } finally {
    syncing = false;
  }
}

/** Starts the 5-second sync for the lifetime of the game scene. Returns a stop function. */
export function startEconomySync(): () => void {
  void syncEconomy();
  const id = setInterval(() => void syncEconomy(), 5000);
  return () => clearInterval(id);
}

/** Buy from the Cache. The server checks the price, your Echoes and what you already own. */
export async function serverBuy(kind: "weapon" | "vehicle", id: string): Promise<{ ok: boolean; reason?: string }> {
  const { data, error } = await client().rpc("economy_buy", { p_kind: kind, p_id: id });
  if (error) {
    console.error("[economy] buy failed", error);
    return { ok: false, reason: "error" };
  }
  const r = data as { ok: boolean; reason?: string; balance?: number };
  if (typeof r.balance === "number") showBalance(r.balance);
  return { ok: r.ok, reason: r.reason };
}

/** You fell. The server takes the death tax and pays your killer if another kingdom did it. */
export async function reportDeath(killerId: string | null) {
  const { data, error } = await client().rpc("economy_death", { p_killer: killerId });
  if (error) {
    console.error("[economy] death report failed", error);
    return;
  }
  const r = data as { balance?: number };
  if (typeof r.balance === "number") showBalance(r.balance);
}

/** A vault raid: the server picks the payout. Returns it, or 0 if it was refused. */
export async function claimRaid(bankId: number): Promise<number> {
  const { data, error } = await client().rpc("economy_raid", { p_bank: bankId });
  if (error) {
    console.error("[economy] raid failed", error);
    return 0;
  }
  const r = data as { ok: boolean; payout?: number; balance?: number };
  if (typeof r.balance === "number") showBalance(r.balance);
  return r.ok ? r.payout ?? 0 : 0;
}