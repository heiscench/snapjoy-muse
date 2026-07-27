import { useEffect, useState } from "react";
import { WEAPONS, WEAPON_ORDER, weaponState, ownsWeapon, purchaseWeapon, selectWeapon } from "./weaponState";
import { playerState } from "./playerState";
import { weaponDiscount } from "./territoryState";

export function WeaponShop() {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => force((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [open]);

  const discount = weaponDiscount();
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="fixed right-4 top-64 z-20 rounded border border-white/20 bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur"
      >
        {open ? "Close" : "Weapons"}
      </button>
      {open && (
        <div className="fixed right-4 top-80 z-30 w-56 rounded-lg border border-white/20 bg-black/85 p-2 backdrop-blur">
          {discount > 0 && (
            <div className="mb-1 rounded bg-cyan-900/60 px-2 py-1 text-[9px] uppercase tracking-widest text-cyan-200">
              Industrial: {(discount * 100) | 0}% off
            </div>
          )}
          {WEAPON_ORDER.map((id) => {
            const w = WEAPONS[id];
            const owned = ownsWeapon(id);
            const price = Math.floor(w.cost * (1 - discount));
            const isCurrent = weaponState.current === id;
            return (
              <div key={id} className={`mb-1 flex items-center justify-between rounded px-2 py-1 text-[10px] ${isCurrent ? "bg-white/15" : "bg-white/5"}`}>
                <div>
                  <div className="font-bold text-white">{w.name}</div>
                  <div className="text-white/60">DMG {w.damage} · RATE {w.fireRate.toFixed(2)}s</div>
                </div>
                {owned ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); selectWeapon(id); force((n) => n + 1); }}
                    className={`rounded px-2 py-1 text-[10px] font-bold ${isCurrent ? "bg-cyan-500/60 text-white" : "bg-white/10 text-white/90"}`}
                  >
                    {isCurrent ? "Equipped" : "Equip"}
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const ok = purchaseWeapon(id, discount);
                      if (!ok) { /* insufficient funds - silent */ }
                      force((n) => n + 1);
                    }}
                    disabled={playerState.money < price}
                    className="rounded bg-green-600/70 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-40"
                  >
                    ${price}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
