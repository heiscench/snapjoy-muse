import { Button } from "@/components/ui/button";
// Player stats + inventory screen. Toggled from a HUD button; reads the
// shared imperative state objects on open so nothing re-renders per frame.
import { useEffect, useState } from "react";
import { playerState } from "./playerState";
import { GANGS, PLAYER_GANG } from "./gangs";
import { authState } from "./authState";
import { WEAPONS, WEAPON_ORDER, weaponState, magAmmo, selectWeapon } from "./weaponState";
import { PERSONAL_VEHICLES, PERSONAL_ORDER, personalVehicleState } from "./personalVehicleState";
import { territoryState } from "./territoryState";
import { districtLabel, type District } from "./worldData";

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
    .map(([d]) => districtLabel(d as District));

  return (
    <>
      <Button
        onPointerDown={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="game-stats-button"
      >
        {open ? "Close" : "Stats"}
      </Button>

      {open && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="fixed left-1/2 top-1/2 z-40 max-h-[78dvh] w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md border p-4 backdrop-blur"
          style={{ backgroundColor: "var(--background)", borderColor: gang.accent }}
        >
          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-widest text-foreground">Awakened being</div>
            <div className="text-lg font-black text-foreground">{authState.username || "Forgotten"}</div>
            <div className="text-xs font-bold" style={{ color: gang.accent }}>{gang.name}</div>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Echoes" value={`◈ ${Math.floor(playerState.money)}`} color="var(--f-green)" />
            <Stat label="Remembered" value={`${Math.floor(playerState.reputation)}`} color="var(--f-gold)" />
            <Stat label="Health" value={`${Math.round(playerState.health)}`} color="var(--destructive)" />
          </div>

          <Section title="Relics" />
          <div className="mb-4 flex flex-col gap-1">
            {owned.map((id) => {
              const w = WEAPONS[id];
              const isCurrent = weaponState.current === id;
              return (
                <div key={id} className={`flex items-center justify-between rounded px-2 py-1 text-[11px] ${isCurrent ? "bg-muted" : "bg-muted"}`}>
                  <div>
                    <div className="font-bold text-foreground">{w.name}</div>
                    <div className="text-foreground">DMG {w.damage} · MAG {magAmmo(id)}/{w.magSize}</div>
                  </div>
                  <Button
                    onPointerDown={(e) => { e.stopPropagation(); selectWeapon(id); force((n) => n + 1); }}
                    className={`rounded px-2 py-1 text-[10px] font-bold ${isCurrent ? "bg-secondary text-foreground" : "bg-muted text-foreground"}`}
                  >
                    {isCurrent ? "Equipped" : "Equip"}
                  </Button>
                </div>
              );
            })}
          </div>

          <Section title="Husks" />
          <div className="mb-4 flex flex-col gap-1">
            {garage.length === 0 && (
              <div className="rounded bg-muted px-2 py-1 text-[11px] text-foreground">
                No bound Husks. The Cache awaits.
              </div>
            )}
            {garage.map((id) => {
              const v = PERSONAL_VEHICLES[id];
              return (
                <div key={id} className="flex items-center justify-between rounded bg-muted px-2 py-1 text-[11px]">
                  <span className="font-bold text-foreground">{v.name}</span>
                  <span className="text-foreground">at the Hall</span>
                </div>
              );
            })}
          </div>

          <Section title="Memory zones" />
          <div className="text-[11px] text-foreground">
            {held.length ? held.join(" · ") : "No memories reclaimed"}
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title }: { title: string }) {
  return (
    <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-foreground">{title}</div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded bg-muted py-2">
      <div className="text-[9px] uppercase tracking-widest text-foreground">{label}</div>
      <div className="text-sm font-black" style={{ color }}>{value}</div>
    </div>
  );
}
