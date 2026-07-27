import { useEffect, useState } from "react";
import { WEAPONS, WEAPON_ORDER, weaponState, ownsWeapon, purchaseWeapon, selectWeapon } from "./weaponState";
import { playerState } from "./playerState";
import { weaponDiscount } from "./territoryState";
import { shopState } from "./shopState";

export function WeaponShop() {
  const [open, setOpen] = useState(false);
  const [nearShop, setNearShop] = useState(false);
  const [, force] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setNearShop(shopState.nearOwnShop);
      if (open) force((n) => n + 1);
    }, 200);
    return () => clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (nearShop) setOpen(true);
    else setOpen(false);
  }, [nearShop]);

  const discount = weaponDiscount();

  if (!nearShop && !open) {
    return (
      <div className="pointer-events-none fixed left-4 top-40 z-20 rounded bg-black/50 px-3 py-1 text-[10px] text-white/50 backdrop-blur">
        Walk to your gang's weapon shop to buy gear
      </div>
    );
  }

  return (
    <div className="fixed left-4 top-40 z-30 w-56 rounded-lg border border-amber-400/50 bg-black/85 p-2 backdrop-blur">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-amber-300">Weapon Shop</div>
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
                  purchaseWeapon(id, discount);
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
  );
}