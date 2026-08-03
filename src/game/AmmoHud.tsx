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
    <div className="fixed bottom-6 right-6 z-20 w-32 select-none">
      <div className="rounded bg-black/60 px-3 py-2 text-right backdrop-blur">
        <div className="text-[9px] uppercase tracking-widest text-white/50">{w.name}</div>
        {reloading ? (
          <>
            <div className="text-sm font-bold uppercase tracking-widest text-amber-300">
              Reloading
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-amber-300" style={{ width: `${pct}%` }} />
            </div>
          </>
        ) : (
          <div
            className="text-xl font-black leading-none"
            style={{ color: mag === 0 ? "#ff5a5a" : low ? "#ffd66a" : "#ffffff" }}
          >
            {mag}
            <span className="text-xs font-bold text-white/40"> / {w.magSize}</span>
          </div>
        )}
      </div>
      <button
        onPointerDown={(e) => {
          e.stopPropagation();
          input.reload = true;
          startReload();
        }}
        disabled={reloading || mag >= w.magSize}
        className="mt-2 w-full rounded border border-amber-400/50 bg-amber-500/25 px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur disabled:opacity-30"
      >
        Reload{weaponState.current === "grenade" ? " pack" : ""}
      </button>
    </div>
  );
}
