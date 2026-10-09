import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { WEAPONS, WEAPON_ORDER, weaponState, ownsWeapon, purchaseWeapon, selectWeapon } from "./weaponState";
import { playerState } from "./playerState";
import { weaponDiscount } from "./territoryState";
import { shopState } from "./shopState";
import {
  PERSONAL_ORDER,
  PERSONAL_VEHICLES,
  ownsPersonalVehicle,
  purchasePersonalVehicle,
} from "./personalVehicleState";

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
      <div className="game-cache-hint">
        Your faction’s Cache awaits.
      </div>
    );
  }

  return (
    <div className="game-cache-panel">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-lore-gold">The Cache</div>
      {discount > 0 && (
        <div className="mb-1 rounded bg-secondary px-2 py-1 text-[9px] uppercase tracking-widest text-lore-violet">
          Foundry: {(discount * 100) | 0}% off
        </div>
      )}
      {WEAPON_ORDER.map((id) => {
        const w = WEAPONS[id];
        const owned = ownsWeapon(id);
        const price = Math.floor(w.cost * (1 - discount));
        const isCurrent = weaponState.current === id;
        return (
          <div key={id} className={`mb-1 flex items-center justify-between rounded px-2 py-1 text-[10px] ${isCurrent ? "bg-muted" : "bg-muted"}`}>
            <div>
              <div className="font-bold text-foreground">{w.name}</div>
              <div className="text-foreground">DMG {w.damage} · RATE {w.fireRate.toFixed(2)}s</div>
            </div>
            {owned ? (
              <Button
                onClick={(e) => { e.stopPropagation(); selectWeapon(id); force((n) => n + 1); }}
                className={`rounded px-2 py-1 text-[10px] font-bold ${isCurrent ? "bg-secondary text-foreground" : "bg-muted text-foreground"}`}
              >
                {isCurrent ? "Equipped" : "Equip"}
              </Button>
            ) : (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  purchaseWeapon(id, discount);
                  force((n) => n + 1);
                }}
                disabled={playerState.money < price}
                className="rounded bg-secondary px-2 py-1 text-[10px] font-bold text-foreground disabled:opacity-40"
              >
                ◈ {price}
              </Button>
            )}
          </div>
        );
      })}

      <div className="mb-1 mt-3 text-[10px] font-bold uppercase tracking-widest text-lore-gold">
        Bound Husks
      </div>
      <div className="mb-1 text-[9px] text-foreground">
        Bound to you. Returned to the Hall.
      </div>
      {PERSONAL_ORDER.map((id) => {
        const v = PERSONAL_VEHICLES[id];
        const owned = ownsPersonalVehicle(id);
        return (
          <div key={id} className="mb-1 flex items-center justify-between rounded bg-muted px-2 py-1 text-[10px]">
            <div>
              <div className="font-bold text-foreground">{v.name}</div>
              <div className="text-foreground">{v.blurb}</div>
            </div>
            {owned ? (
              <span className="rounded bg-secondary px-2 py-1 text-[10px] font-bold text-foreground">Owned</span>
            ) : (
              <Button
                onClick={(e) => { e.stopPropagation(); purchasePersonalVehicle(id); force((n) => n + 1); }}
                disabled={playerState.money < v.cost}
                className="rounded bg-secondary px-2 py-1 text-[10px] font-bold text-foreground disabled:opacity-40"
              >
                ◈ {v.cost}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}