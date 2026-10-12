import { db } from "../db";
import { authState } from "../authState";
import { setBalance } from "../economy";
import { pushAlert } from "../alertState";
import { FRAGMENT_COUNT } from "./fragments";
import { LORE } from "./lore";

export const memoryState = {
  found: new Set<number>(),
  version: 0,
  open: null as number | null, // memory whose page is on screen
};

// The generated Supabase types only know the public schema, so talk to ours untyped.
type Client = {
  from: (t: string) => {
    select: (c: string) => { eq: (k: string, v: string) => Promise<{ data: { fragment_id: number }[] | null; error: unknown }> };
  };
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};
const client = () => db() as unknown as Client;

export async function loadMemories() {
  const uid = authState.userId;
  if (!uid) return;
  const { data, error } = await client().from("fragments_found").select("fragment_id").eq("user_id", uid);
  if (error) {
    console.error("[memory] load failed", error);
    return;
  }
  memoryState.found = new Set((data ?? []).map((r) => r.fragment_id));
  memoryState.version++;
}

/** Collect a memory: shown at once, confirmed and paid by the server, rewarded only the first time. */
export async function collectFragment(id: number) {
  if (memoryState.found.has(id)) return;
  memoryState.found.add(id);
  memoryState.open = id;
  memoryState.version++;

  const { data, error } = await client().rpc("claim_fragment", { p_id: id });
  if (error) {
    console.error("[memory] claim failed", error);
    memoryState.found.delete(id);
    memoryState.open = null;
    memoryState.version++;
    pushAlert("The memory slipped away. Try again.", "warn");
    return;
  }
  const res = data as { newly: boolean; total: number; reward?: number; balance?: number };
  if (typeof res.balance === "number") setBalance(res.balance);
  if (res.newly) {
    pushAlert(`Memory recovered: ${LORE[id - 1].title} (${res.total}/${FRAGMENT_COUNT}) +◈ ${res.reward ?? 0}`);
    if (res.total >= FRAGMENT_COUNT) pushAlert("Every memory recovered. The Forgotten remember you.");
  }
}