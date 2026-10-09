import { Button } from "@/components/ui/button";
// Ammo counter + reload control. Polls the shared ammo state instead of
// re-rendering the whole HUD every frame (same pattern as WeaponShop).
import { useEffect, useState } from "react";
import {
  ammoState,
  currentWeapon,
  magAmmo,
  reloadProgress,
  startReload,
  weaponState,
} from "./weaponState";
import { input } from "./input";

const POLL_MS = 100;

export function AmmoHud() {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), POLL_MS);
    return () => clearInterval(id);
  }, []);

  const w = currentWeapon();
  const mag = magAmmo();
  const reloading = ammoState.reloading;
  const pct = reloadProgress() * 100;
  const low = !reloading && mag <= Math.max(1, Math.floor(w.magSize * 0.25));

  return (
    <div className="game-ammo">
      <div className="rounded bg-background/90 px-3 py-2 text-right backdrop-blur">
        <div className="text-[9px] uppercase tracking-widest text-foreground">{w.name}</div>
        {reloading ? (
          <>
            <div className="text-sm font-bold uppercase tracking-widest text-lore-gold">
              Reloading
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-secondary" style={{ width: `${pct}%` }} />
            </div>
          </>
        ) : (
          <div
            className="text-xl font-black leading-none"
            style={{ color: mag === 0 ? "var(--destructive)" : low ? "var(--f-gold)" : "var(--foreground)" }}
          >
            {mag}
            <span className="text-xs font-bold text-foreground"> / {w.magSize}</span>
          </div>
        )}
      </div>
      <Button
        onPointerDown={(e) => {
          e.stopPropagation();
          input.reload = true;
          startReload();
        }}
        disabled={reloading || mag >= w.magSize}
        className="mt-2 w-full rounded border border-border bg-secondary px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-foreground backdrop-blur disabled:opacity-30"
      >
        Reload{weaponState.current === "grenade" ? " pack" : ""}
      </Button>
    </div>
  );
}
