// Player stats + inventory screen. Toggled from a HUD button; reads the
// shared imperative state objects on open so nothing re-renders per frame.
import { useEffect, useState } from "react";
import { playerState } from "./playerState";
import { GANGS, PLAYER_GANG } from "./gangs";
import { authState } from "./authState";
import { WEAPONS, WEAPON_ORDER, weaponState, magAmmo, selectWeapon } from "./weaponState";
import { PERSONAL_VEHICLES, PERSONAL_ORDER, personalVehicleState } from "./personalVehicleState";
import { territoryState } from "./territoryState";
import { districtLabel } from "./worldData";

const POLL_MS = 250;

export function StatsPanel() {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => force((n) => n + 1), POLL_MS);
    return () => clearInterval(id);
  }, [open]);

  const gang = GANGS[PLAYER_GANG];
  const owned = WEAPON_ORDER.filter((id) => weaponState.owned.has(id));
  const garage = PERSONAL_ORDER.filter((id) => personalVehicleState.owned.has(id));
  const held = Object.entries(territoryState.owners)
    .filter(([, o]) => o === PLAYER_GANG)
    .map(([d]) => districtLabel(d as never));

  return (
    <>
      <button
        onPointerDown={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="fixed right-4 top-14 z-30 rounded border border-white/25 bg-black/60 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur"
      >
        {open ? "Close" : "Stats"}
      </button>

      {open && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="fixed left-1/2 top-1/2 z-40 max-h-[78vh] w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border p-4 backdrop-blur"
          style={{ backgroundColor: "rgba(6,7,12,0.92)", borderColor: gang.accent }}
        >
          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-widest text-white/50">Operative</div>
            <div className="text-lg font-black text-white">{authState.username ?? "Unregistered"}</div>
            <div className="text-xs font-bold" style={{ color: gang.accent }}>{gang.name}</div>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Cash" value={`$${Math.floor(playerState.money)}`} color="#5cff8a" />
            <Stat label="Rep" value={`${Math.floor(playerState.reputation)}`} color="#ffd66a" />
            <Stat label="Health" value={`${Math.round(playerState.health)}`} color="#ff8a8a" />
          </div>

          <Section title="Arsenal" />
          <div className="mb-4 flex flex-col gap-1">
            {owned.map((id) => {
              const w = WEAPONS[id];
              const isCurrent = weaponState.current === id;
              return (
                <div key={id} className={`flex items-center justify-between rounded px-2 py-1 text-[11px] ${isCurrent ? "bg-white/15" : "bg-white/5"}`}>
                  <div>
                    <div className="font-bold text-white">{w.name}</div>
                    <div className="text-white/50">DMG {w.damage} · MAG {magAmmo(id)}/{w.magSize}</div>
                  </div>
                  <button
                    onPointerDown={(e) => { e.stopPropagation(); selectWeapon(id); force((n) => n + 1); }}
                    className={`rounded px-2 py-1 text-[10px] font-bold ${isCurrent ? "bg-cyan-500/60 text-white" : "bg-white/10 text-white/90"}`}
                  >
                    {isCurrent ? "Equipped" : "Equip"}
                  </button>
                </div>
              );
            })}
          </div>

          <Section title="Garage" />
          <div className="mb-4 flex flex-col gap-1">
            {garage.length === 0 && (
              <div className="rounded bg-white/5 px-2 py-1 text-[11px] text-white/50">
                No personal vehicles — buy one at your gang shop.
              </div>
            )}
            {garage.map((id) => {
              const v = PERSONAL_VEHICLES[id];
              return (
                <div key={id} className="flex items-center justify-between rounded bg-white/5 px-2 py-1 text-[11px]">
                  <span className="font-bold text-white">{v.name}</span>
                  <span className="text-white/50">parked at HQ</span>
                </div>
              );
            })}
          </div>

          <Section title="Territory" />
          <div className="text-[11px] text-white/70">
            {held.length ? held.join(" · ") : "No districts held"}
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title }: { title: string }) {
  return (
    <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/40">{title}</div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded bg-white/5 py-2">
      <div className="text-[9px] uppercase tracking-widest text-white/40">{label}</div>
      <div className="text-sm font-black" style={{ color }}>{value}</div>
    </div>
  );
}
