// Shared world state (district ownership + vault robbery/guard locks) backed
// by the forgotten.territory and forgotten.bank_state tables and kept live
// with Postgres change subscriptions. Everything here mutates the same plain
// state objects the single-player systems already read.
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { db, FORGOTTEN_SCHEMA } from "./db";
import { authState } from "./authState";
import { PLAYER_GANG, GANGS, type GangId } from "./gangs";
import type { District } from "./worldData";
import { DISTRICT_LABELS } from "./worldData";
import {
  applyRemoteBankLock,
  applyRemoteOwner,
  registerTerritoryHooks,
  territoryState,
  GUARD_RESPAWN,
} from "./territoryState";
import { applyRemoteBankGuards, registerBankGuardsClearedHook } from "./guardState";
import { broadcastAlert } from "./presence";
import { pushAlert } from "./alertState";

const TERRITORY_CHANNEL = "forgotten-world";

let channel: RealtimeChannel | null = null;

type TerritoryRow = {
  district: string;
  owner: number | null;
  lock_until: string | null;
  captured_by: string | null;
};
type BankRow = {
  bank_id: number;
  robbery_lock_until: string | null;
  guards_respawn_at: string | null;
};

function toMs(iso: string | null): number | null {
  return iso ? new Date(iso).getTime() : null;
}

function districtName(d: District) {
  return DISTRICT_LABELS.find((l) => l.district === d)?.name ?? d.toUpperCase();
}

function applyTerritoryRow(row: TerritoryRow) {
  const d = row.district as District;
  if (!(d in territoryState.owners)) return;
  const prevOwner = territoryState.owners[d];
  const owner = (row.owner === null ? null : (row.owner as GangId));
  applyRemoteOwner(d, owner, toMs(row.lock_until));
  if (prevOwner !== owner && row.captured_by && row.captured_by !== authState.userId) {
    if (prevOwner === PLAYER_GANG) {
      pushAlert(`${districtName(d)} has faded from your faction`, "warn");
    } else if (owner === PLAYER_GANG) {
      pushAlert(`${districtName(d)} remembered by ${GANGS[PLAYER_GANG].name}`);
    }
  }
}

function applyBankRow(row: BankRow) {
  applyRemoteBankLock(row.bank_id, toMs(row.robbery_lock_until));
  applyRemoteBankGuards(row.bank_id, toMs(row.guards_respawn_at));
}

// Set synchronously so a second call during the awaited initial fetch (React
// StrictMode double-mounts in dev) can't build a second channel with the same
// name — Supabase would reuse the already-subscribed one and throw when we
// attach postgres_changes handlers to it.
let startPromise: Promise<void> | null = null;

export function startWorldSync(): Promise<void> {
  if (!startPromise) startPromise = openWorldSync();
  return startPromise;
}

async function openWorldSync() {
  if (channel) return;

  const [{ data: terr }, { data: banks }] = await Promise.all([
    db().from("territory").select("district, owner, lock_until, captured_by"),
    db().from("bank_state").select("bank_id, robbery_lock_until, guards_respawn_at"),
  ]);
  for (const row of (terr ?? []) as TerritoryRow[]) applyTerritoryRow(row);
  for (const row of (banks ?? []) as BankRow[]) applyBankRow(row);

  // Drop any stale channel with the same topic (dev double-mount) before
  // building a fresh one — attaching handlers to a subscribed channel throws.
  for (const ch of supabase.getChannels()) {
    if (ch.topic === `realtime:${TERRITORY_CHANNEL}`) supabase.removeChannel(ch);
  }

  channel = supabase
    .channel(TERRITORY_CHANNEL)
    .on(
      "postgres_changes",
      { event: "*", schema: FORGOTTEN_SCHEMA, table: "territory" },
      (payload) => {
        const row = payload.new as TerritoryRow | null;
        if (row?.district) applyTerritoryRow(row);
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: FORGOTTEN_SCHEMA, table: "bank_state" },
      (payload) => {
        const row = payload.new as BankRow | null;
        if (row && typeof row.bank_id === "number") applyBankRow(row);
      },
    )
    .subscribe();

  // ---- Push local outcomes to the shared world ---------------------------
  registerTerritoryHooks({
    onCaptured: (district, owner, lockUntilMs) => {
      void db()
        .from("territory")
        .upsert(
          {
            district,
            owner,
            lock_until: new Date(lockUntilMs).toISOString(),
            captured_by: authState.userId,
          },
          { onConflict: "district" },
        )
        .then(({ error }) => {
          if (error) console.error("[worldSync] capture push failed", error);
        });
      broadcastAlert(owner, `${districtName(district)} reclaimed by ${authState.username}`, "info");
    },
    onRobbed: (bankId, lockUntilMs) => {
      void db()
        .from("bank_state")
        .upsert(
          { bank_id: bankId, robbery_lock_until: new Date(lockUntilMs).toISOString() },
          { onConflict: "bank_id" },
        )
        .then(({ error }) => {
          if (error) console.error("[worldSync] raid push failed", error);
        });
    },
    onAttackStarted: (district, defendingGang) => {
      broadcastAlert(
        defendingGang,
        `${districtName(district)} is fracturing!`,
        "warn",
      );
    },
  });

  registerBankGuardsClearedHook((bankId) => {
    const respawnAt = Date.now() + GUARD_RESPAWN * 1000;
    void db()
      .from("bank_state")
      .upsert(
        { bank_id: bankId, guards_respawn_at: new Date(respawnAt).toISOString() },
        { onConflict: "bank_id" },
      )
      .then(({ error }) => {
        if (error) console.error("[worldSync] guard push failed", error);
      });
  });
}

export function stopWorldSync() {
  startPromise = null;
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}