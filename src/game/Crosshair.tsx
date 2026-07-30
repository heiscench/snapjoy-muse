import { useEffect, useState } from "react";
import { input } from "./input";
import { weaponState } from "./weaponState";

export function Crosshair() {
  const [aiming, setAiming] = useState(false);
  const [weapon, setWeapon] = useState(weaponState.current);

  useEffect(() => {
    let raf: number;
    const tick = () => {
      setAiming(input.aim);
      if (weaponState.current !== weapon) setWeapon(weaponState.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [weapon]);

  if (!aiming) return null;
  const isSniper = weapon === "sniper";
  const gap = isSniper ? 2 : 7;
  const len = isSniper ? 6 : 8;

  if (isSniper) {
    return (
      <div className="pointer-events-none fixed left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
        <div className="h-56 w-56 rounded-full border-2 border-black/80 bg-black" />
        <div className="absolute left-1/2 top-1/2 h-56 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-white/70" />
        <div className="absolute left-1/2 top-1/2 h-[2px] w-56 -translate-x-1/2 -translate-y-1/2 bg-white/70" />
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
      <div className="relative h-6 w-6">
        <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
        {[0, 90, 180, 270].map((deg) => (
          <div
            key={deg}
            className="absolute left-1/2 top-1/2 bg-white/85"
            style={{
              width: 2,
              height: len,
              transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-${gap}px)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}