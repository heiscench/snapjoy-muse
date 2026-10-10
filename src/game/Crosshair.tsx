import { useEffect, useState } from "react";
import { input } from "./input";
import { weaponState } from "./weaponState";
import { shotFeedback, type HitKind } from "./shotFeedback";

const HIT_SHOW_MS = 170;

function Ticks({ gap, len, thick, color, offset = 0 }: {
  gap: number; len: number; thick: number; color: string; offset?: number;
}) {
  return (
    <>
      {[0, 90, 180, 270].map((deg) => (
        <div
          key={deg}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: thick,
            height: len,
            background: color,
            boxShadow: "0 0 2px rgba(0,0,0,0.9)",
            transform: `translate(-50%, -50%) rotate(${deg + offset}deg) translateY(-${gap}px)`,
          }}
        />
      ))}
    </>
  );
}

const HIT_COLOR: Record<HitKind, string> = {
  body: "#ffffff",
  head: "#ffd24a",
  kill: "#ff4d5e",
};

export function Crosshair() {
  const [aiming, setAiming] = useState(false);
  const [weapon, setWeapon] = useState(weaponState.current);
  const [hit, setHit] = useState<HitKind | null>(null);

  useEffect(() => {
    let raf: number;
    const tick = () => {
      setAiming(input.aim);
      setWeapon(weaponState.current);
      const on = performance.now() - shotFeedback.hitAt < HIT_SHOW_MS;
      setHit(on ? shotFeedback.hitKind : null);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const scoped = aiming && weapon === "sniper";

  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      {scoped && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at center, transparent 0, transparent 21vh, rgba(0,0,0,0.9) 21.6vh)",
          }}
        />
      )}
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0 }}>
        {scoped ? (
          <>
            <div style={{ position: "absolute", left: -110, top: -0.5, width: 220, height: 1, background: "rgba(255,255,255,0.75)" }} />
            <div style={{ position: "absolute", left: -0.5, top: -110, width: 1, height: 220, background: "rgba(255,255,255,0.75)" }} />
          </>
        ) : (
          <>
            <div
              style={{
                position: "absolute", left: -2, top: -2, width: 4, height: 4, borderRadius: 4,
                background: "#fff", boxShadow: "0 0 3px rgba(0,0,0,0.9)",
              }}
            />
            <Ticks gap={aiming ? 6 : 11} len={8} thick={2} color={aiming ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.6)"} />
          </>
        )}
        {hit && <Ticks gap={13} len={7} thick={2.5} color={HIT_COLOR[hit]} offset={45} />}
      </div>
    </div>
  );
}